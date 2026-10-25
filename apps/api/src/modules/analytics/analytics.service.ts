import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OPEN_CAPA_STATUSES, OPEN_DEVIATION_STATUSES, OPEN_OOS_STATUSES } from '@pharmodry/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SettingsService, UserDirectory } from '../core/core.services';
import { agingOf } from '../deviations/deviations';
import { SuppliersService } from '../suppliers/suppliers';
import { InventoryRiskService } from './inventory-risk.service';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface DashboardFilters {
  siteId?: string;
  from?: string;
  to?: string;
  productId?: string;
  categoryId?: string;
}

export interface ExceptionItem {
  id: string;
  section: 'BATCHES' | 'MATERIALS' | 'QUALITY' | 'COMPLIANCE' | 'SUPPLIERS' | 'INVENTORY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  why: string;
  process: string;
  owner: string | null;
  ageDays: number | null;
  href: string;
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
function lastMonths(n: number, end = new Date()) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1))));
  return out;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: InventoryRiskService,
    private readonly suppliers: SuppliersService,
    private readonly settings: SettingsService,
    private readonly users: UserDirectory,
  ) {}

  private range(f: DashboardFilters) {
    const to = f.to ? new Date(f.to) : new Date();
    const from = f.from ? new Date(f.from) : new Date(to.getTime() - 180 * DAY);
    return { from, to };
  }

  private productScope(f: DashboardFilters): Prisma.BatchWhereInput {
    return { siteId: f.siteId || undefined, productId: f.productId || undefined, ...(f.categoryId ? { product: { categoryId: f.categoryId } } : {}) };
  }

  async dashboard(tenantId: string, f: DashboardFilters) {
    const { from, to } = this.range(f);
    const scope = this.productScope(f);
    const now = new Date();
    const [activeBatches, awaitingQa, openDeviations, overdueCapas, openOos, released, materialRisks, expiry, lots, supplierList] = await Promise.all([
      this.prisma.db.batch.count({ where: { ...scope, status: { in: ['PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA'] } } }),
      this.prisma.db.batch.count({ where: { ...scope, status: 'AWAITING_QA' } }),
      this.prisma.db.deviation.count({ where: { siteId: f.siteId || undefined, productId: f.productId || undefined, status: { in: OPEN_DEVIATION_STATUSES } } }),
      this.prisma.db.capa.count({ where: { siteId: f.siteId || undefined, status: { in: OPEN_CAPA_STATUSES }, dueDate: { lt: now } } }),
      this.prisma.db.oosInvestigation.count({ where: { siteId: f.siteId || undefined, productId: f.productId || undefined, status: { in: OPEN_OOS_STATUSES } } }),
      this.prisma.db.batch.findMany({
        where: { ...scope, status: { in: ['RELEASED', 'CLOSED'] }, qaDecisionAt: { gte: from, lte: to } },
        select: { id: true, batchNumber: true, actualEnd: true, qaDecisionAt: true, yieldPct: true, actualYield: true, productId: true },
      }),
      this.risk.materialRisks(tenantId, f.siteId),
      this.risk.expiryRisks(tenantId, 90, f.siteId),
      this.prisma.db.inventoryLot.groupBy({ by: ['status'], where: { siteId: f.siteId || undefined, quantity: { gt: 0 } }, _count: { _all: true }, _sum: { quantity: true } }),
      this.prisma.db.supplier.findMany({ where: { status: { in: ['APPROVED', 'CONDITIONALLY_APPROVED'] } }, select: { id: true, code: true, name: true } }),
    ]);
    const lotValues = await this.prisma.db.$queryRaw<{ status: string; value: number }[]>`
      SELECT status::text, COALESCE(SUM(quantity * "unitCost"),0)::float AS value FROM inventory_lots
      WHERE "tenantId" = ${tenantId}::uuid AND quantity > 0 ${f.siteId ? Prisma.sql`AND "siteId" = ${f.siteId}::uuid` : Prisma.empty}
      GROUP BY status`;
    const cycle = released.filter((b) => b.actualEnd && b.qaDecisionAt).map((b) => ({ batch: b.batchNumber, id: b.id, hours: r1((b.qaDecisionAt!.getTime() - b.actualEnd!.getTime()) / HOUR) }));
    const scores = await this.suppliers.scorecards(supplierList.map((s) => s.id));
    const supplierRows = supplierList.map((s) => ({ ...s, ...scores[s.id] }));
    const scored = supplierRows.filter((s) => s.qualityScore !== null && s.qualityScore !== undefined);
    const plan = await this.planVsActual(f, 6);
    const thisPeriodPlan = plan.reduce((a, p) => a + p.planned, 0);
    const thisPeriodActual = plan.reduce((a, p) => a + p.actual, 0);

    const kpis = {
      activeBatches,
      batchesAwaitingQa: awaitingQa,
      openDeviations,
      overdueCapas,
      openOos,
      rawMaterialStockouts: materialRisks.filter((m) => m.type !== 'PACKAGING' && m.available <= 0 && (m.avgDailyConsumption > 0 || m.plannedDemand > 0)).length,
      materialsAtRisk: materialRisks.filter((m) => m.risk === 'HIGH').length,
      nearExpiryLots: expiry.filter((e) => e.daysToExpiry >= 0).length,
      nearExpiryValue: expiry.filter((e) => e.daysToExpiry >= 0).reduce((a, e) => a + e.value, 0),
      planAchievementPct: thisPeriodPlan ? r1((thisPeriodActual / thisPeriodPlan) * 100) : null,
      avgBatchReleaseHours: cycle.length ? r1(cycle.reduce((a, c) => a + c.hours, 0) / cycle.length) : null,
      supplierQualityScore: scored.length ? r1(scored.reduce((a, s) => a + Number(s.qualityScore), 0) / scored.length) : null,
    };

    const [deviationTrend, oosTrend, capaAging] = await Promise.all([this.deviationTrend(f, 6), this.oosTrend(f, 6), this.capaAging(f)]);
    return {
      kpis,
      charts: {
        planVsActual: plan,
        yieldTrend: released
          .filter((b) => b.yieldPct !== null)
          .sort((a, b) => a.qaDecisionAt!.getTime() - b.qaDecisionAt!.getTime())
          .map((b) => ({ batch: b.batchNumber, id: b.id, yieldPct: Number(b.yieldPct), date: b.qaDecisionAt })),
        deviationTrend,
        capaAging,
        oosTrend,
        inventoryByStatus: lots.map((l) => ({ status: l.status, lots: l._count._all, value: Math.round(lotValues.find((v) => v.status === l.status)?.value ?? 0) })),
        nearExpiry: [
          { bucket: 'Expired', lo: -Infinity, hi: -1 },
          { bucket: '0–30 days', lo: 0, hi: 30 },
          { bucket: '31–60 days', lo: 31, hi: 60 },
          { bucket: '61–90 days', lo: 61, hi: 90 },
        ].map(({ bucket, lo, hi }) => {
          const rows = expiry.filter((e) => e.daysToExpiry >= lo && e.daysToExpiry <= hi);
          return { bucket, lots: rows.length, value: rows.reduce((a, e) => a + e.value, 0) };
        }),
        supplierRejection: supplierRows.map((s) => ({ supplier: s.name, code: s.code, id: s.id, rejectionPct: s.qcRejectionPct ?? 0, lots: s.lotsReceived ?? 0 })),
        releaseCycleTime: cycle,
      },
      period: { from, to },
    };
  }

  async planVsActual(f: DashboardFilters, months: number) {
    const keys = lastMonths(months);
    const start = new Date(`${keys[0]}-01T00:00:00Z`);
    const [lines, batches] = await Promise.all([
      this.prisma.db.productionPlanLine.findMany({
        where: { productId: f.productId || undefined, plan: { status: { in: ['APPROVED', 'CLOSED'] }, siteId: f.siteId || undefined, periodStart: { gte: start } } },
        include: { plan: { select: { periodStart: true } } },
      }),
      this.prisma.db.batch.findMany({ where: { ...this.productScope(f), status: { in: ['RELEASED', 'CLOSED'] }, qaDecisionAt: { gte: start } }, select: { qaDecisionAt: true, actualYield: true } }),
    ]);
    return keys.map((k) => ({
      month: k,
      planned: lines.filter((l) => monthKey(l.plan.periodStart) === k).reduce((a, l) => a + Number(l.plannedQuantity), 0),
      actual: batches.filter((b) => b.qaDecisionAt && monthKey(b.qaDecisionAt) === k).reduce((a, b) => a + Number(b.actualYield ?? 0), 0),
    }));
  }

  async deviationTrend(f: DashboardFilters, months: number) {
    const keys = lastMonths(months);
    const rows = await this.prisma.db.deviation.findMany({
      where: { siteId: f.siteId || undefined, productId: f.productId || undefined, status: { not: 'CANCELLED' }, occurredAt: { gte: new Date(`${keys[0]}-01T00:00:00Z`) } },
      select: { occurredAt: true, classification: true, proposedSeverity: true },
    });
    return keys.map((k) => {
      const m = rows.filter((r) => monthKey(r.occurredAt) === k);
      const sev = (s: string) => m.filter((r) => (r.classification ?? r.proposedSeverity ?? 'MINOR') === s).length;
      return { month: k, MINOR: sev('MINOR'), MAJOR: sev('MAJOR'), CRITICAL: sev('CRITICAL'), total: m.length };
    });
  }

  async oosTrend(f: DashboardFilters, months: number) {
    const keys = lastMonths(months);
    const rows = await this.prisma.db.oosInvestigation.findMany({ where: { siteId: f.siteId || undefined, productId: f.productId || undefined, createdAt: { gte: new Date(`${keys[0]}-01T00:00:00Z`) } }, select: { createdAt: true, conclusion: true } });
    return keys.map((k) => {
      const m = rows.filter((r) => monthKey(r.createdAt) === k);
      return { month: k, oos: m.length, confirmed: m.filter((r) => r.conclusion === 'CONFIRMED_OOS').length, invalidated: m.filter((r) => r.conclusion === 'INVALIDATED_LAB_ERROR').length };
    });
  }

  async capaAging(f: DashboardFilters) {
    const open = await this.prisma.db.capa.findMany({ where: { siteId: f.siteId || undefined, status: { in: OPEN_CAPA_STATUSES } }, select: { createdAt: true, dueDate: true } });
    const buckets = [
      { bucket: '0–30 days', min: 0, max: 30 },
      { bucket: '31–60 days', min: 31, max: 60 },
      { bucket: '61–90 days', min: 61, max: 90 },
      { bucket: '> 90 days', min: 91, max: Infinity },
    ];
    return buckets.map((b) => {
      const rows = open.filter((c) => {
        const age = Math.floor((Date.now() - c.createdAt.getTime()) / DAY);
        return age >= b.min && age <= b.max;
      });
      return { bucket: b.bucket, open: rows.length, overdue: rows.filter((c) => c.dueDate < new Date()).length };
    });
  }

  /** CAPA KPIs: open, overdue, by department, average closure time, effectiveness failure rate. */
  async capaKpis() {
    const all = await this.prisma.db.capa.findMany({ select: { status: true, dueDate: true, createdAt: true, closedAt: true, departmentId: true, effectivenessFailures: true, effectivenessEffective: true } });
    const departments = await this.prisma.db.department.findMany({ select: { id: true, name: true } });
    const closed = all.filter((c) => c.status === 'CLOSED' && c.closedAt);
    const checked = all.filter((c) => c.effectivenessEffective !== null || c.effectivenessFailures > 0);
    return {
      open: all.filter((c) => (OPEN_CAPA_STATUSES as string[]).includes(c.status)).length,
      overdue: all.filter((c) => (OPEN_CAPA_STATUSES as string[]).includes(c.status) && c.dueDate < new Date()).length,
      avgClosureDays: closed.length ? r1(closed.reduce((a, c) => a + (c.closedAt!.getTime() - c.createdAt.getTime()) / DAY, 0) / closed.length) : null,
      effectivenessFailureRatePct: checked.length ? r1((checked.filter((c) => c.effectivenessFailures > 0).length / checked.length) * 100) : null,
      byDepartment: departments
        .map((d) => ({ department: d.name, open: all.filter((c) => c.departmentId === d.id && (OPEN_CAPA_STATUSES as string[]).includes(c.status)).length }))
        .filter((d) => d.open > 0),
    };
  }

  /**
   * Exception-driven view: what needs attention, why, which process, who owns it, how long pending.
   */
  async commandCenter(tenantId: string, siteId?: string) {
    const s = await this.settings.get(tenantId);
    const now = Date.now();
    const items: ExceptionItem[] = [];
    const ageDays = (d: Date) => Math.floor((now - d.getTime()) / DAY);

    // ── Batches
    const batches = await this.prisma.db.batch.findMany({
      where: { siteId: siteId || undefined, status: { in: ['PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA'] } },
      include: { product: { select: { genericName: true, strength: true } } },
    });
    const batchOos = await this.prisma.db.oosInvestigation.findMany({ where: { batchId: { in: batches.map((b) => b.id) }, status: { in: OPEN_OOS_STATUSES } }, select: { batchId: true, number: true } });
    const ownerNames = await this.users.names(batches.map((b) => b.createdById));
    for (const b of batches) {
      const label = `${b.batchNumber} · ${b.product.genericName} ${b.product.strength}`;
      const oos = batchOos.filter((o) => o.batchId === b.id);
      if (oos.length) {
        items.push({ id: `batch-oos-${b.id}`, section: 'BATCHES', severity: 'CRITICAL', title: label, why: `Release blocked by open OOS ${oos.map((o) => o.number).join(', ')}`, process: 'QC → QA release', owner: null, ageDays: b.actualEnd ? ageDays(b.actualEnd) : null, href: `/production/batches/${b.id}` });
      } else if (b.status === 'AWAITING_QA' && b.actualEnd) {
        const hours = (now - b.actualEnd.getTime()) / HOUR;
        if (hours > s.qaReleaseSlaHours) {
          items.push({ id: `batch-qa-${b.id}`, section: 'BATCHES', severity: 'WARNING', title: label, why: `Awaiting QA release for ${Math.round(hours)} h (SLA ${s.qaReleaseSlaHours} h)`, process: 'QA batch release', owner: 'QA', ageDays: Math.floor(hours / 24), href: `/production/batches/${b.id}` });
        }
      }
      if (['PLANNED', 'MATERIAL_RESERVED', 'READY'].includes(b.status) && b.plannedStart.getTime() < now) {
        items.push({ id: `batch-late-${b.id}`, section: 'BATCHES', severity: 'WARNING', title: label, why: `Planned start ${b.plannedStart.toISOString().slice(0, 10)} missed (status ${b.status.replace(/_/g, ' ').toLowerCase()})`, process: 'Production execution', owner: ownerNames[b.createdById] ?? null, ageDays: ageDays(b.plannedStart), href: `/production/batches/${b.id}` });
      } else if (['IN_PROGRESS', 'AWAITING_QC'].includes(b.status) && b.plannedEnd && b.plannedEnd.getTime() < now) {
        items.push({ id: `batch-overrun-${b.id}`, section: 'BATCHES', severity: 'WARNING', title: label, why: `Past planned completion (${b.plannedEnd.toISOString().slice(0, 10)}), currently ${b.status.replace(/_/g, ' ').toLowerCase()}`, process: b.status === 'AWAITING_QC' ? 'QC testing' : 'Production execution', owner: ownerNames[b.createdById] ?? null, ageDays: ageDays(b.plannedEnd), href: `/production/batches/${b.id}` });
      }
    }

    // ── Materials
    const risks = await this.risk.materialRisks(tenantId, siteId);
    for (const r of risks.filter((x) => x.risk !== 'LOW')) {
      items.push({ id: `mat-${r.materialId}`, section: 'MATERIALS', severity: r.risk === 'HIGH' ? 'CRITICAL' : 'WARNING', title: `${r.code} · ${r.name}`, why: r.explanation, process: 'Procurement / supply planning', owner: 'Supply Chain', ageDays: null, href: `/master-data/materials/${r.materialId}` });
    }
    const pendingLots = await this.prisma.db.inventoryLot.findMany({ where: { siteId: siteId || undefined, itemType: 'MATERIAL', status: { in: ['QUARANTINE', 'UNDER_TEST'] }, createdAt: { lt: new Date(now - 7 * DAY) }, quantity: { gt: 0 } } });
    for (const l of pendingLots) {
      items.push({ id: `lot-pending-${l.id}`, section: 'MATERIALS', severity: 'WARNING', title: `Lot ${l.lotNumber}`, why: `In ${l.status.replace('_', ' ').toLowerCase()} for ${ageDays(l.createdAt)} days awaiting QC/QA disposition`, process: 'Incoming QC → QA release', owner: 'QC / QA', ageDays: ageDays(l.createdAt), href: `/inventory/lots/${l.id}` });
    }

    // ── Quality
    const [oos, deviations, capas] = await Promise.all([
      this.prisma.db.oosInvestigation.findMany({ where: { siteId: siteId || undefined, status: { in: OPEN_OOS_STATUSES } } }),
      this.prisma.db.deviation.findMany({ where: { siteId: siteId || undefined, status: { in: OPEN_DEVIATION_STATUSES } } }),
      this.prisma.db.capa.findMany({ where: { siteId: siteId || undefined, status: { in: OPEN_CAPA_STATUSES } } }),
    ]);
    const qNames = await this.users.names([...oos.map((o) => o.ownerId), ...deviations.map((d) => d.ownerId), ...capas.map((c) => c.ownerId)]);
    for (const o of oos) {
      items.push({ id: `oos-${o.id}`, section: 'QUALITY', severity: 'CRITICAL', title: `${o.number} · ${o.testName}`, why: `Result ${o.actualResult} vs ${o.specification}; investigation at ${o.status.replace(/_/g, ' ').toLowerCase()}${o.dueDate.getTime() < now ? ' — OVERDUE' : ''}`, process: 'OOS investigation', owner: o.ownerId ? (qNames[o.ownerId] ?? null) : 'Unassigned', ageDays: ageDays(o.createdAt), href: `/quality/oos/${o.id}` });
    }
    for (const d of deviations) {
      const a = agingOf(d, s);
      if (a.overdue || d.classification === 'CRITICAL' || d.status === 'SUBMITTED') {
        items.push({
          id: `dev-${d.id}`,
          section: 'QUALITY',
          severity: d.classification === 'CRITICAL' || a.overdue ? 'CRITICAL' : 'WARNING',
          title: `${d.number} · ${d.title}`,
          why: a.overdue ? `Overdue (${a.ageDays} days open, ${d.status.replace(/_/g, ' ').toLowerCase()})` : d.status === 'SUBMITTED' ? 'Awaiting QA review and classification' : `Critical deviation in ${d.status.replace(/_/g, ' ').toLowerCase()}`,
          process: 'Deviation management',
          owner: d.ownerId ? (qNames[d.ownerId] ?? null) : 'Unassigned',
          ageDays: a.ageDays,
          href: `/quality/deviations/${d.id}`,
        });
      }
    }
    for (const c of capas.filter((c) => c.dueDate.getTime() < now || c.effectivenessFailures > 0)) {
      items.push({
        id: `capa-${c.id}`,
        section: 'QUALITY',
        severity: c.dueDate.getTime() < now ? 'CRITICAL' : 'WARNING',
        title: `${c.number} · ${c.problemStatement.slice(0, 80)}`,
        why: c.dueDate.getTime() < now ? `Overdue by ${ageDays(c.dueDate)} days (${c.status.replace(/_/g, ' ').toLowerCase()})` : `Failed ${c.effectivenessFailures} effectiveness check(s)`,
        process: 'CAPA',
        owner: qNames[c.ownerId] ?? null,
        ageDays: ageDays(c.createdAt),
        href: `/quality/capa/${c.id}`,
      });
    }

    // ── Compliance deadlines
    const equipment = await this.prisma.db.equipment.findMany({ where: { siteId: siteId || undefined, isActive: true, nextCalibrationDue: { lte: new Date(now + 7 * DAY) } } });
    for (const e of equipment) {
      const expired = e.nextCalibrationDue!.getTime() < now;
      items.push({ id: `cal-${e.id}`, section: 'COMPLIANCE', severity: expired ? 'CRITICAL' : 'WARNING', title: `${e.code} · ${e.description}`, why: expired ? `Calibration expired ${e.nextCalibrationDue!.toISOString().slice(0, 10)} — blocked for GMP use` : `Calibration due ${e.nextCalibrationDue!.toISOString().slice(0, 10)}`, process: 'Calibration', owner: 'Engineering', ageDays: null, href: `/master-data/equipment/${e.id}` });
    }
    const suppliers = await this.prisma.db.supplier.findMany({ where: { status: { in: ['APPROVED', 'CONDITIONALLY_APPROVED'] } } });
    for (const sp of suppliers) {
      if (sp.requalificationDate && sp.requalificationDate.getTime() < now + 30 * DAY) {
        items.push({ id: `requal-${sp.id}`, section: 'COMPLIANCE', severity: sp.requalificationDate.getTime() < now ? 'CRITICAL' : 'WARNING', title: `${sp.code} · ${sp.name}`, why: `Supplier requalification ${sp.requalificationDate.getTime() < now ? 'overdue since' : 'due'} ${sp.requalificationDate.toISOString().slice(0, 10)}`, process: 'Supplier qualification', owner: 'QA', ageDays: null, href: `/master-data/suppliers/${sp.id}` });
      }
      for (const c of (sp.certifications as { name?: string; expiresAt?: string }[]) ?? []) {
        if (c.expiresAt && new Date(c.expiresAt).getTime() < now + 30 * DAY) {
          items.push({ id: `cert-${sp.id}-${c.name}`, section: 'COMPLIANCE', severity: new Date(c.expiresAt).getTime() < now ? 'CRITICAL' : 'WARNING', title: `${sp.code} · ${c.name ?? 'Certificate'}`, why: `Certificate ${new Date(c.expiresAt).getTime() < now ? 'expired' : 'expires'} ${c.expiresAt.slice(0, 10)}`, process: 'Supplier qualification', owner: 'QA', ageDays: null, href: `/master-data/suppliers/${sp.id}` });
        }
      }
    }

    // Serialization readiness: DRAP S.R.O. 963(I)/2026 (2D DataMatrix + serials for batches made from 9 Oct 2026)
    const noGtin = await this.prisma.db.product.findMany({ where: { status: 'ACTIVE', gtin: null } });
    for (const p of noGtin) {
      items.push({ id: `gtin-${p.id}`, section: 'COMPLIANCE', severity: 'WARNING', title: `${p.code} · ${p.genericName} ${p.strength}`, why: 'No GS1 GTIN recorded — 2D DataMatrix barcode and serialization are required for batches manufactured from 9 Oct 2026 (DRAP S.R.O. 963(I)/2026)', process: 'Serialization readiness', owner: 'Regulatory Affairs', ageDays: null, href: `/master-data/products/${p.id}` });
    }

    // ── Suppliers
    const scores = await this.suppliers.scorecards(suppliers.map((x) => x.id));
    for (const sp of suppliers) {
      const sc = scores[sp.id];
      if (sc?.qcRejectionPct && sc.qcRejectionPct >= 10) {
        items.push({ id: `sup-${sp.id}`, section: 'SUPPLIERS', severity: sc.qcRejectionPct >= 25 ? 'CRITICAL' : 'WARNING', title: `${sp.code} · ${sp.name}`, why: `QC rejection rate ${sc.qcRejectionPct}% (${sc.lotsRejected} of dispositioned lots)`, process: 'Supplier quality', owner: 'QA / Procurement', ageDays: null, href: `/master-data/suppliers/${sp.id}` });
      }
    }

    // ── Inventory
    const expiry = await this.risk.expiryRisks(tenantId, 90, siteId);
    for (const e of expiry.filter((x) => x.daysToExpiry < 0 || x.atRiskQuantity > 0)) {
      items.push({ id: `exp-${e.lotId}`, section: 'INVENTORY', severity: e.daysToExpiry < 0 ? 'CRITICAL' : e.daysToExpiry <= 30 ? 'WARNING' : 'INFO', title: `${e.lotNumber} · ${e.itemName}`, why: `${e.daysToExpiry < 0 ? `Expired ${-e.daysToExpiry} days ago` : `Expires in ${e.daysToExpiry} days`}; ${e.atRiskQuantity} ${e.uom} at risk (PKR ${e.value.toLocaleString('en-US')}). ${e.recommendation}`, process: 'Inventory / FEFO', owner: 'Warehouse', ageDays: null, href: `/inventory/lots/${e.lotId}` });
    }

    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    items.sort((a, b) => order[a.severity] - order[b.severity] || (b.ageDays ?? 0) - (a.ageDays ?? 0));
    const qaBacklog = items.filter((i) => i.id.startsWith('batch-qa-')).length;
    const expiringValue = expiry.filter((e) => e.daysToExpiry >= 0).reduce((a, e) => a + e.value, 0);
    const headlines = [
      qaBacklog ? `${qaBacklog} batch(es) awaiting QA > ${s.qaReleaseSlaHours} hours` : null,
      capas.filter((c) => c.dueDate.getTime() < now).length ? `${capas.filter((c) => c.dueDate.getTime() < now).length} CAPA(s) overdue` : null,
      oos.length ? `${oos.length} open OOS investigation(s)` : null,
      risks.filter((r) => r.risk === 'HIGH' && r.type === 'API').length ? `${risks.filter((r) => r.risk === 'HIGH' && r.type === 'API').length} API(s) at high stockout risk` : null,
      expiringValue ? `PKR ${expiringValue.toLocaleString('en-US')} of inventory expiring within 90 days` : null,
      equipment.length ? `${equipment.length} calibration(s) due within 7 days or expired` : null,
    ].filter(Boolean) as string[];
    const sections = ['BATCHES', 'MATERIALS', 'QUALITY', 'COMPLIANCE', 'SUPPLIERS', 'INVENTORY'] as const;
    return {
      generatedAt: new Date(),
      headlines,
      counts: Object.fromEntries(sections.map((sec) => [sec, items.filter((i) => i.section === sec).length])),
      critical: items.filter((i) => i.severity === 'CRITICAL').length,
      items,
    };
  }
}
