import { Prisma } from '@prisma/client';
import { Controller, HttpCode, Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { mergeSettings, OPEN_CAPA_STATUSES, OPEN_DEVIATION_STATUSES } from '@pharmodry/types';
import { loadConfig } from '../../config/env';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { agingOf } from '../deviations/deviations';
import { InventoryLedger } from '../inventory/ledger.service';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationService } from '../notifications/notification.service';

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Scheduled compliance scans. They only raise notifications and apply the deterministic
 * EXPIRED status; they never approve, release or close anything.
 */
@Injectable()
export class ScansService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedger,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  async onApplicationBootstrap() {
    const cfg = loadConfig();
    if (cfg.disableScheduler) return;
    await this.queue.schedule('compliance-scans', cfg.scansIntervalMinutes * 60_000, () => this.runAll());
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async runAll() {
    const tenants = await this.prisma.base.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    const results = [];
    for (const t of tenants) results.push(await this.run(t.id));
    return results;
  }

  async run(tenantId: string) {
    const db = this.prisma.base;
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const s = mergeSettings(tenant.settings);
    const now = Date.now();
    const summary = { expired: 0, expiryAlerts: 0, lowStock: 0, capaOverdue: 0, deviationOverdue: 0, calibration: 0, qaBacklog: 0 };

    // 1. Expired lots → EXPIRED (deterministic), with ledger + audit.
    const expired = await db.inventoryLot.findMany({ where: { tenantId, expiryDate: { lte: new Date() }, quantity: { gt: 0 }, status: { in: ['RELEASED', 'QUARANTINE', 'UNDER_TEST', 'BLOCKED'] } } });
    for (const lot of expired) {
      await this.prisma.base.$transaction(async (tx) => {
        if (Number(lot.reservedQuantity) > 0) {
          const res = await tx.materialReservation.findMany({ where: { tenantId, lotId: lot.id, status: 'ACTIVE' } });
          for (const r of res) {
            await this.ledger.post(tx, { lotId: lot.id, type: 'UNRESERVE', reserved: -Number(r.quantity), referenceType: 'Batch', referenceId: r.batchId, reason: 'Lot expired' });
            await tx.materialReservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
          }
        }
        await this.ledger.post(tx, { lotId: lot.id, type: 'STATUS_CHANGE', statusTo: 'EXPIRED', reason: 'Automatic: expiry date reached' });
        await this.audit.record(tx, { tenantId, actor: { name: 'System (scheduled scan)' }, entityType: 'InventoryLot', entityId: lot.id, entityLabel: lot.lotNumber, action: 'STATUS_CHANGE', previous: { status: lot.status }, next: { status: 'EXPIRED' }, reason: 'Expiry date reached' });
        await this.notifications.notify(tx, { tenantId, event: 'MATERIAL_EXPIRED', severity: 'CRITICAL', title: `Lot ${lot.lotNumber} expired`, body: 'Status set to EXPIRED. Segregate and dispose per SOP.', entityType: 'InventoryLot', entityId: lot.id, link: `/inventory/lots/${lot.id}`, permission: 'inventory.release', siteId: lot.siteId, dedupeKey: `expired:${lot.id}` });
      });
      summary.expired++;
    }

    await this.prisma.base.$transaction(async (tx) => {
      // 2. Expiry windows (30/60/90 by default).
      for (const days of [...s.expiryAlertDays].sort((a, b) => a - b)) {
        const lots = await tx.inventoryLot.findMany({ where: { tenantId, quantity: { gt: 0 }, status: { in: ['RELEASED', 'QUARANTINE', 'UNDER_TEST'] }, expiryDate: { gt: new Date(), lte: new Date(now + days * DAY) } } });
        for (const lot of lots) {
          summary.expiryAlerts += await this.notifications.notify(tx, {
            tenantId,
            event: 'MATERIAL_NEAR_EXPIRY',
            severity: days <= 30 ? 'WARNING' : 'INFO',
            title: `Lot ${lot.lotNumber} expires within ${days} days`,
            body: `${Number(lot.quantity)} ${lot.uomCode} expires ${lot.expiryDate.toISOString().slice(0, 10)}.`,
            entityType: 'InventoryLot',
            entityId: lot.id,
            link: `/inventory/lots/${lot.id}`,
            permission: 'inventory.view',
            siteId: lot.siteId,
            dedupeKey: `expiry${days}:${lot.id}`,
          });
        }
      }
      // 3. Below safety stock.
      const materials = await tx.material.findMany({ where: { tenantId, status: 'ACTIVE', safetyStock: { gt: 0 } } });
      for (const m of materials) {
        const agg = await tx.inventoryLot.aggregate({ where: { tenantId, materialId: m.id, status: 'RELEASED', expiryDate: { gt: new Date() } }, _sum: { quantity: true, reservedQuantity: true } });
        const available = Number(agg._sum.quantity ?? 0) - Number(agg._sum.reservedQuantity ?? 0);
        if (available < Number(m.safetyStock)) {
          summary.lowStock += await this.notifications.notify(tx, {
            tenantId,
            event: 'LOW_STOCK',
            severity: available <= 0 ? 'CRITICAL' : 'WARNING',
            title: `${m.code} below safety stock`,
            body: `Available ${available} vs safety stock ${Number(m.safetyStock)}.`,
            entityType: 'Material',
            entityId: m.id,
            link: `/master-data/materials/${m.id}`,
            permission: 'procurement.po.create',
            dedupeKey: `lowstock:${m.id}:${today()}`,
          });
        }
      }
      // 4. Overdue CAPAs.
      const capas = await tx.capa.findMany({ where: { tenantId, status: { in: OPEN_CAPA_STATUSES }, dueDate: { lt: new Date() } } });
      for (const c of capas) {
        summary.capaOverdue += await this.notifications.notify(tx, {
          tenantId,
          event: 'CAPA_OVERDUE',
          severity: 'CRITICAL',
          title: `CAPA ${c.number} is overdue`,
          body: `Due ${c.dueDate.toISOString().slice(0, 10)}. ${c.problemStatement.slice(0, 120)}`,
          entityType: 'Capa',
          entityId: c.id,
          link: `/quality/capa/${c.id}`,
          userIds: [c.ownerId],
          permission: 'capa.close',
          siteId: c.siteId,
          dedupeKey: `capaOverdue:${c.id}:${today()}`,
        });
      }
      // 5. Overdue deviations.
      const devs = await tx.deviation.findMany({ where: { tenantId, status: { in: OPEN_DEVIATION_STATUSES } } });
      for (const d of devs.filter((x) => agingOf(x, s).overdue)) {
        summary.deviationOverdue += await this.notifications.notify(tx, {
          tenantId,
          event: 'DEVIATION_OVERDUE',
          severity: 'CRITICAL',
          title: `Deviation ${d.number} is overdue`,
          body: d.title,
          entityType: 'Deviation',
          entityId: d.id,
          link: `/quality/deviations/${d.id}`,
          userIds: d.ownerId ? [d.ownerId] : [],
          permission: 'deviation.approve',
          siteId: d.siteId,
          dedupeKey: `devOverdue:${d.id}:${today()}`,
        });
      }
      // 6. Calibration due in 7 days or expired.
      const eq = await tx.equipment.findMany({ where: { tenantId, isActive: true, nextCalibrationDue: { lte: new Date(now + 7 * DAY) } } });
      for (const e of eq) {
        summary.calibration += await this.notifications.notify(tx, {
          tenantId,
          event: 'CALIBRATION_DUE',
          severity: e.nextCalibrationDue! < new Date() ? 'CRITICAL' : 'WARNING',
          title: `${e.code} calibration ${e.nextCalibrationDue! < new Date() ? 'expired' : 'due'}`,
          body: `${e.description} — due ${e.nextCalibrationDue!.toISOString().slice(0, 10)}.`,
          entityType: 'Equipment',
          entityId: e.id,
          link: `/master-data/equipment/${e.id}`,
          permission: 'equipment.manage',
          siteId: e.siteId,
          dedupeKey: `cal:${e.id}:${e.nextCalibrationDue!.toISOString().slice(0, 10)}`,
        });
      }
      // 7. QA release backlog.
      const backlog = await tx.batch.findMany({ where: { tenantId, status: 'AWAITING_QA', actualEnd: { lt: new Date(now - s.qaReleaseSlaHours * 3_600_000) } } });
      for (const b of backlog) {
        summary.qaBacklog += await this.notifications.notify(tx, {
          tenantId,
          event: 'BATCH_AWAITING_QA',
          severity: 'WARNING',
          title: `Batch ${b.batchNumber} awaiting QA > ${s.qaReleaseSlaHours} h`,
          body: 'Release decision is pending beyond the configured SLA.',
          entityType: 'Batch',
          entityId: b.id,
          link: `/production/batches/${b.id}`,
          permission: 'batch.approve',
          siteId: b.siteId,
          dedupeKey: `qaBacklog:${b.id}:${today()}`,
        });
      }
    }, { timeout: 60_000 });

    // 8. AI retention policy: redact stored prompt/response text beyond retention.
    const cutoff = new Date(now - s.ai.retentionDays * DAY);
    await db.aiMessage.updateMany({ where: { tenantId, createdAt: { lt: cutoff }, redactedAt: null }, data: { content: null, facts: Prisma.DbNull, redactedAt: new Date() } });

    this.logger.log({ msg: 'Compliance scans complete', tenantId, ...summary });
    return { tenantId, ...summary };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly scans: ScansService) {}

  @Post('run-scans')
  @HttpCode(200)
  @RequirePermissions('admin.tenant.manage')
  run(@CurrentUser() u: AuthPrincipal) {
    return this.scans.run(u.tenantId);
  }
}

@Module({ imports: [InventoryModule], controllers: [JobsController], providers: [ScansService, QueueService], exports: [ScansService] })
export class JobsModule {}
