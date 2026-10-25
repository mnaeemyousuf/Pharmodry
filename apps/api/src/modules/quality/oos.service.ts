import { Injectable } from '@nestjs/common';
import { OosStatus, Prisma, QcResult, QcSample } from '@prisma/client';
import { OOS_SEQUENCE } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService, UserDirectory } from '../core/core.services';
import { NotificationService } from '../notifications/notification.service';
import { SignatureService } from '../signatures/signature.service';
import { OosAdvanceDto, OosApproveDto } from './quality.dto';

const DAY = 86_400_000;

/** Field each phase must complete before the investigation can move to the next phase. */
const PHASE_REQUIREMENT: Partial<Record<OosStatus, keyof OosAdvanceDto>> = {
  PRELIMINARY_INVESTIGATION: 'preliminaryFindings',
  LAB_INVESTIGATION: 'labInvestigation',
  MANUFACTURING_INVESTIGATION: 'manufacturingInvestigation',
  ROOT_CAUSE: 'rootCause',
  IMPACT_ASSESSMENT: 'impactAssessment',
};

/**
 * OOS investigations. The system only *flags* an OOS candidate and opens the record;
 * the conclusion (confirmed vs. invalidated) is always a QA decision with e-signature.
 */
@Injectable()
export class OosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly notifications: NotificationService,
    private readonly signatures: SignatureService,
    private readonly users: UserDirectory,
  ) {}

  async openFromResult(tx: Tx, _user: AuthPrincipal, sample: QcSample, result: QcResult) {
    const lot = sample.lotId ? await tx.inventoryLot.findFirst({ where: { id: sample.lotId } }) : null;
    const number = await this.numbering.next(tx, sample.tenantId, 'OOS');
    const spec = result.specSnapshot as { text?: string };
    const actual = result.numericValue !== null ? `${Number(result.numericValue)}${result.unit ? ` ${result.unit}` : ''}` : (result.textValue ?? String(result.passFail));
    const oos = await tx.oosInvestigation.create({
      data: {
        tenantId: sample.tenantId,
        siteId: sample.siteId,
        number,
        qcResultId: result.id,
        sampleId: sample.id,
        productId: sample.productId,
        materialId: sample.materialId,
        batchId: sample.batchId,
        lotId: sample.lotId,
        supplierId: lot?.supplierId ?? null,
        testName: result.testName,
        specification: spec.text ?? '',
        actualResult: actual,
        analystId: result.analystId,
        instrument: result.instrument,
        dueDate: new Date(Date.now() + 30 * DAY),
      },
    });
    await this.audit.record(tx, {
      entityType: 'OosInvestigation',
      entityId: oos.id,
      entityLabel: number,
      action: 'CREATE',
      next: { test: result.testName, specification: oos.specification, result: actual, sample: sample.number, status: 'REPORTED' },
      reason: 'Automatically reported: result outside specification (OOS candidate). Conclusion requires QA review.',
    });
    await this.notifications.notify(tx, {
      tenantId: sample.tenantId,
      event: 'OOS_REPORTED',
      severity: 'CRITICAL',
      title: `${number}: OOS candidate — ${result.testName}`,
      body: `Sample ${sample.number}: ${result.testName} = ${actual} (spec ${oos.specification}). Release is blocked pending investigation.`,
      entityType: 'OosInvestigation',
      entityId: oos.id,
      link: `/quality/oos/${oos.id}`,
      permission: 'oos.approve',
      siteId: sample.siteId,
    });
    await this.notifications.notify(tx, {
      tenantId: sample.tenantId,
      event: 'QC_RESULT_FAILED',
      severity: 'CRITICAL',
      title: `QC result failed: ${result.testName}`,
      body: `${sample.number} — ${actual} vs ${oos.specification}. OOS ${number} opened.`,
      entityType: 'OosInvestigation',
      entityId: oos.id,
      link: `/quality/oos/${oos.id}`,
      permission: 'qc.result.review',
      siteId: sample.siteId,
    });
    return oos;
  }

  async list(q: FilterQueryDto) {
    const where: Prisma.OosInvestigationWhereInput = {
      status: statusFilter(q) ?? (q.view === 'open' ? { not: 'CLOSED' } : undefined),
      batchId: q.batchId || undefined,
      lotId: q.lotId || undefined,
      productId: q.productId || undefined,
      siteId: q.siteId || undefined,
      ...(q.q ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { testName: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.oosInvestigation.findMany({ where, orderBy: orderBy(q, ['number', 'createdAt', 'dueDate', 'status'], { createdAt: 'desc' }), ...pageArgs(q) }),
      this.prisma.db.oosInvestigation.count({ where }),
    ]);
    const batches = await this.prisma.db.batch.findMany({ where: { id: { in: rows.map((r) => r.batchId).filter(Boolean) as string[] } }, select: { id: true, batchNumber: true } });
    const lots = await this.prisma.db.inventoryLot.findMany({ where: { id: { in: rows.map((r) => r.lotId).filter(Boolean) as string[] } }, select: { id: true, lotNumber: true } });
    const decorated = await this.users.decorate(rows, ['ownerId', 'analystId']);
    return toPage(
      decorated.map((r) => ({
        ...r,
        batchNumber: batches.find((b) => b.id === r.batchId)?.batchNumber ?? null,
        lotNumber: lots.find((l) => l.id === r.lotId)?.lotNumber ?? null,
        ageDays: Math.floor((Date.now() - r.createdAt.getTime()) / DAY),
        overdue: r.status !== 'CLOSED' && r.dueDate < new Date(),
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const o = await this.prisma.db.oosInvestigation.findFirst({ where: { id } });
    if (!o) throw new NotFoundError('OOS investigation', id);
    const [sample, batch, lot, product, material, deviation, capas, rca, signatures, equipment] = await Promise.all([
      this.prisma.db.qcSample.findFirst({ where: { id: o.sampleId }, select: { id: true, number: true, status: true, stage: true } }),
      o.batchId ? this.prisma.db.batch.findFirst({ where: { id: o.batchId }, select: { id: true, batchNumber: true, status: true } }) : null,
      o.lotId ? this.prisma.db.inventoryLot.findFirst({ where: { id: o.lotId }, select: { id: true, lotNumber: true, status: true } }) : null,
      o.productId ? this.prisma.db.product.findFirst({ where: { id: o.productId }, select: { id: true, code: true, genericName: true, strength: true } }) : null,
      o.materialId ? this.prisma.db.material.findFirst({ where: { id: o.materialId }, select: { id: true, code: true, name: true } }) : null,
      o.deviationId ? this.prisma.db.deviation.findFirst({ where: { id: o.deviationId }, select: { id: true, number: true, title: true, status: true } }) : null,
      this.prisma.db.capa.findMany({ where: { oosId: id }, select: { id: true, number: true, status: true, problemStatement: true } }),
      this.prisma.db.rootCauseAnalysis.findMany({ where: { oosId: id }, orderBy: { createdAt: 'desc' } }),
      this.signatures.forEntity('OosInvestigation', id),
      o.equipmentId ? this.prisma.db.equipment.findFirst({ where: { id: o.equipmentId }, select: { id: true, code: true, description: true } }) : null,
    ]);
    return this.users.decorateOne(
      { ...o, sample, batch, lot, product, material, deviation, capas, rootCauseAnalyses: rca, signatures, equipment, phases: OOS_SEQUENCE },
      ['ownerId', 'analystId', 'closedById'],
    );
  }

  /** Records the current phase's findings and advances to the next phase. */
  async advance(user: AuthPrincipal, id: string, dto: OosAdvanceDto) {
    return this.prisma.transaction(async (tx) => {
      const o = await tx.oosInvestigation.findFirst({ where: { id } });
      if (!o) throw new NotFoundError('OOS investigation', id);
      user.require('oos.investigate', o.siteId);
      const idx = OOS_SEQUENCE.indexOf(o.status);
      const next = OOS_SEQUENCE[idx + 1];
      if (!next || o.status === 'QA_APPROVAL' || o.status === 'CLOSED') throw new ConflictError(`OOS ${o.number} is ${o.status}; use QA approval to close`);
      const data: Prisma.OosInvestigationUpdateInput = { status: next };
      if (o.status === 'REPORTED') {
        data.ownerId = dto.ownerId ?? user.id;
      }
      const required = PHASE_REQUIREMENT[o.status];
      if (required) {
        const value = dto[required];
        if (value === undefined || value === null || value === '') throw new ValidationError(`${String(required)} is required to complete ${o.status.replace(/_/g, ' ').toLowerCase()}`);
        (data as Record<string, unknown>)[required] = value;
      }
      if (o.status === 'LAB_INVESTIGATION') {
        if (typeof dto.assignableLabError !== 'boolean') throw new ValidationError('State whether an assignable laboratory error was identified');
        data.assignableLabError = dto.assignableLabError;
      }
      if (o.status === 'CAPA') {
        const capas = await tx.capa.count({ where: { oosId: id, status: { not: 'CANCELLED' } } });
        if (capas === 0 && !dto.capaJustification) {
          throw new RuleViolationError('Link a CAPA or document why no CAPA is required', [{ code: 'CAPA_REQUIRED', message: 'Create a CAPA from this OOS or provide capaJustification' }]);
        }
        data.capaJustification = dto.capaJustification ?? null;
      }
      if (dto.equipmentId) data.equipmentId = dto.equipmentId;
      const after = await tx.oosInvestigation.update({ where: { id }, data });
      await this.audit.record(tx, {
        entityType: 'OosInvestigation',
        entityId: id,
        entityLabel: o.number,
        action: 'STATUS_CHANGE',
        previous: { status: o.status },
        next: { status: next, ...(required ? { [required]: dto[required] } : {}), ...(o.status === 'LAB_INVESTIGATION' ? { assignableLabError: dto.assignableLabError } : {}) },
      });
      if (next === 'QA_APPROVAL') {
        await this.notifications.notify(tx, {
          tenantId: o.tenantId,
          event: 'ASSIGNMENT',
          severity: 'WARNING',
          title: `${o.number} ready for QA approval`,
          body: `Investigation of ${o.testName} is complete and awaits QA conclusion.`,
          entityType: 'OosInvestigation',
          entityId: id,
          link: `/quality/oos/${id}`,
          permission: 'oos.approve',
          siteId: o.siteId,
        });
      }
      return after;
    });
  }

  /**
   * QA conclusion with e-signature. INVALIDATED_LAB_ERROR invalidates the original result so a
   * retest can be entered; CONFIRMED_OOS keeps the result, so QC approval concludes FAIL.
   */
  async approve(user: AuthPrincipal, id: string, dto: OosApproveDto) {
    return this.prisma.transaction(async (tx) => {
      const o = await tx.oosInvestigation.findFirst({ where: { id } });
      if (!o) throw new NotFoundError('OOS investigation', id);
      user.require('oos.approve', o.siteId);
      if (o.status !== 'QA_APPROVAL') throw new ConflictError(`OOS ${o.number} is ${o.status}; all investigation phases must be completed first`);
      if (o.ownerId === user.id) throw new RuleViolationError('Segregation of duties: the investigation owner cannot give the QA conclusion');
      if (dto.conclusion === 'INVALIDATED_LAB_ERROR' && !o.assignableLabError) {
        throw new RuleViolationError('A result can only be invalidated when the laboratory investigation identified an assignable laboratory error');
      }
      if (!dto.reason || dto.reason.length < 5) throw new ValidationError('A justification is required for the OOS conclusion');
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'OosInvestigation',
        entityId: id,
        entityLabel: o.number,
        action: 'OOS_QA_APPROVAL',
        meaning: dto.conclusion === 'CONFIRMED_OOS' ? 'QA approval: OOS confirmed — result is valid and out of specification' : 'QA approval: result invalidated due to assignable laboratory error; retest authorised',
        record: o,
      });
      if (dto.conclusion === 'INVALIDATED_LAB_ERROR') {
        await tx.qcResult.update({ where: { id: o.qcResultId }, data: { status: 'INVALIDATED', invalidatedReason: `Invalidated by ${o.number}: ${dto.reason}`, invalidatedById: user.id, invalidatedAt: new Date() } });
        const sample = await tx.qcSample.findFirstOrThrow({ where: { id: o.sampleId } });
        if (['SUBMITTED', 'REVIEWED'].includes(sample.status)) {
          await tx.qcSample.update({ where: { id: sample.id }, data: { status: 'IN_TESTING', reviewedAt: null, reviewedById: null } });
        }
      }
      const after = await tx.oosInvestigation.update({ where: { id }, data: { status: 'CLOSED', conclusion: dto.conclusion, closedAt: new Date(), closedById: user.id } });
      await this.audit.record(tx, {
        entityType: 'OosInvestigation',
        entityId: id,
        entityLabel: o.number,
        action: 'APPROVE',
        previous: { status: o.status },
        next: { status: 'CLOSED', conclusion: dto.conclusion },
        reason: dto.reason,
        signatureId: signature.id,
      });
      return after;
    });
  }

  async linkDeviation(user: AuthPrincipal, id: string, deviationId: string) {
    return this.prisma.transaction(async (tx) => {
      const o = await tx.oosInvestigation.findFirst({ where: { id } });
      if (!o) throw new NotFoundError('OOS investigation', id);
      user.require('oos.investigate', o.siteId);
      const d = await tx.deviation.findFirst({ where: { id: deviationId } });
      if (!d) throw new NotFoundError('Deviation', deviationId);
      await tx.oosInvestigation.update({ where: { id }, data: { deviationId } });
      await tx.deviation.update({ where: { id: deviationId }, data: { oosId: id } });
      await this.audit.record(tx, { entityType: 'OosInvestigation', entityId: id, entityLabel: o.number, action: 'UPDATE', previous: { deviation: o.deviationId }, next: { deviation: d.number } });
      return { ok: true };
    });
  }
}
