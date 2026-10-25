import { Global, Injectable, Module } from '@nestjs/common';
import { QcStage } from '@prisma/client';
import { RuleViolationError } from '../../common/errors';
import { Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService } from '../core/core.services';
import { NotificationService } from '../notifications/notification.service';

/**
 * Creates QC sample requests against the ACTIVE specification of a material or product.
 * Kept dependency-free so GRN (inventory) and batch completion (production) can both use it.
 */
@Injectable()
export class SampleRequestService {
  constructor(
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async request(
    tx: Tx,
    p: { tenantId: string; siteId: string; stage: QcStage; materialId?: string; productId?: string; lotId?: string; batchId?: string; requestedById?: string; label: string },
  ) {
    const spec = await tx.qcSpecification.findFirst({
      where: { status: 'ACTIVE', stage: p.stage, ...(p.materialId ? { materialId: p.materialId } : { productId: p.productId }) },
      orderBy: { version: 'desc' },
    });
    if (!spec) {
      throw new RuleViolationError(`No active ${p.stage.replace('_', ' ').toLowerCase()} specification for ${p.label}. QC cannot be requested.`, [
        { code: 'NO_SPECIFICATION', message: 'Create and approve a QC specification first', href: '/master-data/specifications' },
      ]);
    }
    const number = await this.numbering.next(tx, p.tenantId, 'QC_SAMPLE');
    const sample = await tx.qcSample.create({
      data: {
        tenantId: p.tenantId,
        siteId: p.siteId,
        number,
        stage: p.stage,
        specificationId: spec.id,
        materialId: p.materialId,
        productId: p.productId,
        lotId: p.lotId,
        batchId: p.batchId,
        requestedById: p.requestedById,
      },
    });
    await this.audit.record(tx, { entityType: 'QcSample', entityId: sample.id, entityLabel: number, action: 'CREATE', next: { stage: p.stage, specification: `${spec.code} v${spec.version}`, for: p.label } });
    await this.notifications.notify(tx, {
      tenantId: p.tenantId,
      event: 'QC_SAMPLE_REQUESTED',
      title: `QC sample ${number} requested`,
      body: `${p.label} requires ${p.stage.replace(/_/g, ' ').toLowerCase()} testing against ${spec.code}.`,
      entityType: 'QcSample',
      entityId: sample.id,
      link: `/quality/samples/${sample.id}`,
      permission: 'qc.sample.collect',
      siteId: p.siteId,
    });
    return sample;
  }
}

@Global()
@Module({ providers: [SampleRequestService], exports: [SampleRequestService] })
export class SamplingModule {}
