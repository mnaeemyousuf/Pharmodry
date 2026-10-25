import { Injectable } from '@nestjs/common';
import { OPEN_CAPA_STATUSES, OPEN_DEVIATION_STATUSES, OPEN_OOS_STATUSES, type Citation, type PermissionCode } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { InventoryRiskService } from '../analytics/inventory-risk.service';
import { SettingsService, UserDirectory } from '../core/core.services';
import { agingOf } from '../deviations/deviations';
import { SuppliersService } from '../suppliers/suppliers';

export const INTENTS = [
  'DELAYED_BATCHES',
  'AWAITING_RELEASE',
  'OVERDUE_CAPAS',
  'DEVIATIONS',
  'STOCKOUT_RISK',
  'NEAR_EXPIRY',
  'SUPPLIER_QUALITY',
  'PLAN_ACHIEVEMENT',
  'OOS_STATUS',
  'QUALITY_TRENDS',
  'OPERATIONS_SUMMARY',
] as const;
export type Intent = (typeof INTENTS)[number];

export interface ToolResult {
  intent: Intent;
  title: string;
  /** Pre-computed facts. The LLM may explain these but must not derive new figures. */
  facts: Record<string, unknown>;
  rows: Record<string, unknown>[];
  citations: Citation[];
}

const DAY = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Rule-based intent detection (deterministic, auditable). */
export function detectIntent(question: string): Intent | null {
  const q = question.toLowerCase();
  const rules: [Intent, RegExp][] = [
    ['PLAN_ACHIEVEMENT', /(plan achievement|production plan|plan vs|why did production|output fall|production fall|achievement)/],
    ['DELAYED_BATCHES', /\b(delay\w*|late|behind schedule|overdue batch(es)?)\b/],
    ['AWAITING_RELEASE', /(awaiting (qa|release)|pending release|qa release|release backlog|waiting for release)/],
    ['OVERDUE_CAPAS', /capa/],
    ['OOS_STATUS', /(\boos\b|out[- ]of[- ]spec)/],
    ['QUALITY_TRENDS', /(trend|pattern|categor|most common|recurring|repeat)/],
    ['DEVIATIONS', /deviation/],
    ['STOCKOUT_RISK', /(stockout|stock-out|stock out|shortage|run out|running out|safety stock|at risk of|materials? at risk|lead time)/],
    ['NEAR_EXPIRY', /(expir|slow[- ]moving|excess stock)/],
    ['SUPPLIER_QUALITY', /(supplier|vendor|rejection rate)/],
    ['OPERATIONS_SUMMARY', /(what is happening|summary|overview|status of|attention|right now|exceptions)/],
  ];
  for (const [intent, re] of rules) if (re.test(q)) return intent;
  return null;
}

const MONTHS_RE = /(?:last|past)\s+(\d{1,2}|six|three|twelve|one)\s+months?/;
const WORD_NUM: Record<string, number> = { one: 1, three: 3, six: 6, twelve: 12 };
const STAGES = ['dispensing', 'mixing', 'granulation', 'drying', 'compression', 'coating', 'encapsulation', 'blending', 'packing', 'filling', 'sampling', 'warehouse', 'laboratory'];

/** Controlled retrieval: each tool re-checks the user's domain permission and returns computed facts. */
@Injectable()
export class CopilotTools {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: InventoryRiskService,
    private readonly suppliers: SuppliersService,
    private readonly settings: SettingsService,
    private readonly users: UserDirectory,
  ) {}

  readonly required: Record<Intent, PermissionCode> = {
    DELAYED_BATCHES: 'batch.view',
    AWAITING_RELEASE: 'batch.view',
    OVERDUE_CAPAS: 'capa.view',
    DEVIATIONS: 'deviation.view',
    STOCKOUT_RISK: 'inventory.view',
    NEAR_EXPIRY: 'inventory.view',
    SUPPLIER_QUALITY: 'supplier.view',
    PLAN_ACHIEVEMENT: 'production.plan.view',
    OOS_STATUS: 'oos.view',
    QUALITY_TRENDS: 'deviation.view',
    OPERATIONS_SUMMARY: 'commandcenter.view',
  };

  async run(intent: Intent, user: AuthPrincipal, question: string): Promise<ToolResult> {
    switch (intent) {
      case 'DELAYED_BATCHES':
        return this.delayedBatches();
      case 'AWAITING_RELEASE':
        return this.awaitingRelease(user);
      case 'OVERDUE_CAPAS':
        return this.overdueCapas();
      case 'DEVIATIONS':
        return this.deviations(user, question);
      case 'STOCKOUT_RISK':
        return this.stockout(user);
      case 'NEAR_EXPIRY':
        return this.nearExpiry(user);
      case 'SUPPLIER_QUALITY':
        return this.supplierQuality();
      case 'PLAN_ACHIEVEMENT':
        return this.planAchievement(user);
      case 'OOS_STATUS':
        return this.oos();
      case 'QUALITY_TRENDS':
        return this.qualityTrends(question);
      default:
        return this.summary(user);
    }
  }

  private async delayedBatches(): Promise<ToolResult> {
    const now = new Date();
    const rows = await this.prisma.db.batch.findMany({
      where: {
        OR: [
          { status: { in: ['PLANNED', 'MATERIAL_RESERVED', 'READY'] }, plannedStart: { lt: now } },
          { status: { in: ['IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA'] }, plannedEnd: { lt: now } },
        ],
      },
      include: { product: { select: { genericName: true, strength: true } } },
      take: 20,
    });
    return {
      intent: 'DELAYED_BATCHES',
      title: 'Delayed batches',
      facts: { delayedBatchCount: rows.length },
      rows: rows.map((b) => ({
        batch: b.batchNumber,
        product: `${b.product.genericName} ${b.product.strength}`,
        status: b.status,
        plannedStart: b.plannedStart.toISOString().slice(0, 10),
        plannedEnd: b.plannedEnd?.toISOString().slice(0, 10) ?? null,
        daysLate: Math.floor((now.getTime() - (['PLANNED', 'MATERIAL_RESERVED', 'READY'].includes(b.status) ? b.plannedStart : b.plannedEnd!).getTime()) / DAY),
      })),
      citations: rows.map((b) => ({ type: 'Batch', id: b.id, label: b.batchNumber, href: `/production/batches/${b.id}` })),
    };
  }

  private async awaitingRelease(user: AuthPrincipal): Promise<ToolResult> {
    const s = await this.settings.get(user.tenantId);
    const rows = await this.prisma.db.batch.findMany({ where: { status: { in: ['AWAITING_QA', 'AWAITING_QC'] } }, include: { product: { select: { genericName: true, strength: true } } }, take: 20 });
    const now = Date.now();
    const data = rows.map((b) => ({
      batch: b.batchNumber,
      product: `${b.product.genericName} ${b.product.strength}`,
      status: b.status,
      hoursWaiting: b.actualEnd ? Math.round((now - b.actualEnd.getTime()) / 3_600_000) : null,
    }));
    return {
      intent: 'AWAITING_RELEASE',
      title: 'Batches awaiting QC/QA release',
      facts: { awaitingQa: rows.filter((b) => b.status === 'AWAITING_QA').length, awaitingQc: rows.filter((b) => b.status === 'AWAITING_QC').length, slaHours: s.qaReleaseSlaHours, beyondSla: data.filter((d) => d.status === 'AWAITING_QA' && (d.hoursWaiting ?? 0) > s.qaReleaseSlaHours).length },
      rows: data,
      citations: rows.map((b) => ({ type: 'Batch', id: b.id, label: b.batchNumber, href: `/production/batches/${b.id}` })),
    };
  }

  private async overdueCapas(): Promise<ToolResult> {
    const open = await this.prisma.db.capa.findMany({ where: { status: { in: OPEN_CAPA_STATUSES } }, orderBy: { dueDate: 'asc' } });
    const names = await this.users.names(open.map((c) => c.ownerId));
    const overdue = open.filter((c) => c.dueDate < new Date());
    return {
      intent: 'OVERDUE_CAPAS',
      title: 'Overdue CAPAs',
      facts: { openCapas: open.length, overdueCapas: overdue.length },
      rows: overdue.slice(0, 20).map((c) => ({ capa: c.number, owner: names[c.ownerId], priority: c.priority, status: c.status, dueDate: c.dueDate.toISOString().slice(0, 10), daysOverdue: Math.floor((Date.now() - c.dueDate.getTime()) / DAY), problem: c.problemStatement.slice(0, 160) })),
      citations: overdue.slice(0, 20).map((c) => ({ type: 'CAPA', id: c.id, label: c.number, href: `/quality/capa/${c.id}` })),
    };
  }

  private async deviations(user: AuthPrincipal, question: string): Promise<ToolResult> {
    const q = question.toLowerCase();
    const m = q.match(MONTHS_RE);
    const months = m ? (WORD_NUM[m[1]] ?? Number(m[1])) : null;
    const stage = STAGES.find((s) => q.includes(s));
    const since = months ? new Date(Date.now() - months * 30 * DAY) : null;
    const s = await this.settings.get(user.tenantId);
    const rows = await this.prisma.db.deviation.findMany({
      where: {
        status: q.includes('open') ? { in: OPEN_DEVIATION_STATUSES } : { not: 'CANCELLED' },
        ...(since ? { occurredAt: { gte: since } } : {}),
        ...(stage ? { OR: [{ category: { contains: stage, mode: 'insensitive' } }, { title: { contains: stage, mode: 'insensitive' } }, { description: { contains: stage, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: 25,
    });
    return {
      intent: 'DEVIATIONS',
      title: `Deviations${stage ? ` related to ${stage}` : ''}${months ? ` (last ${months} months)` : ''}`,
      facts: { matching: rows.length, open: rows.filter((d) => (OPEN_DEVIATION_STATUSES as string[]).includes(d.status)).length, filters: { stage: stage ?? null, months } },
      rows: rows.map((d) => ({ deviation: d.number, title: d.title, category: d.category, classification: d.classification ?? d.proposedSeverity, status: d.status, occurred: d.occurredAt.toISOString().slice(0, 10), aging: agingOf(d, s).aging })),
      citations: rows.map((d) => ({ type: 'Deviation', id: d.id, label: d.number, href: `/quality/deviations/${d.id}` })),
    };
  }

  private async stockout(user: AuthPrincipal): Promise<ToolResult> {
    const risks = (await this.risk.materialRisks(user.tenantId)).filter((r) => r.risk !== 'LOW');
    return {
      intent: 'STOCKOUT_RISK',
      title: 'Materials at stockout risk',
      facts: { high: risks.filter((r) => r.risk === 'HIGH').length, medium: risks.filter((r) => r.risk === 'MEDIUM').length },
      rows: risks.map((r) => ({ material: r.code, name: r.name, risk: r.risk, available: r.available, uom: r.uom, stockCoverDays: r.stockCoverDays, leadTimeDays: r.leadTimeDays, openPoQuantity: r.openPoQuantity, explanation: r.explanation })),
      citations: risks.map((r) => ({ type: 'Material', id: r.materialId, label: r.code, href: `/master-data/materials/${r.materialId}` })),
    };
  }

  private async nearExpiry(user: AuthPrincipal): Promise<ToolResult> {
    const rows = await this.risk.expiryRisks(user.tenantId, 90);
    return {
      intent: 'NEAR_EXPIRY',
      title: 'Near-expiry and slow-moving inventory',
      facts: { lots: rows.length, totalValuePkr: rows.reduce((a, r) => a + r.value, 0), atRiskLots: rows.filter((r) => r.atRiskQuantity > 0).length },
      rows: rows.slice(0, 20).map((r) => ({ lot: r.lotNumber, item: `${r.itemCode} ${r.itemName}`, quantity: r.quantity, uom: r.uom, daysToExpiry: r.daysToExpiry, valuePkr: r.value, atRiskQuantity: r.atRiskQuantity, recommendation: r.recommendation })),
      citations: rows.slice(0, 20).map((r) => ({ type: 'Lot', id: r.lotId, label: r.lotNumber, href: `/inventory/lots/${r.lotId}` })),
    };
  }

  private async supplierQuality(): Promise<ToolResult> {
    const sup = await this.prisma.db.supplier.findMany({ select: { id: true, code: true, name: true, status: true } });
    const scores = await this.suppliers.scorecards(sup.map((s) => s.id));
    const rows = sup
      .map((s) => ({ supplier: s.code, name: s.name, status: s.status, ...scores[s.id] }))
      .sort((a, b) => Number(b.qcRejectionPct ?? -1) - Number(a.qcRejectionPct ?? -1));
    return {
      intent: 'SUPPLIER_QUALITY',
      title: 'Supplier quality (QC rejection, delivery, documentation)',
      facts: { suppliers: rows.length, withRejections: rows.filter((r) => Number(r.qcRejectionPct ?? 0) > 0).length },
      rows,
      citations: sup.map((s) => ({ type: 'Supplier', id: s.id, label: s.code, href: `/master-data/suppliers/${s.id}` })),
    };
  }

  private async planAchievement(user: AuthPrincipal): Promise<ToolResult> {
    const trend = await this.analytics.planVsActual({}, 6);
    const now = new Date();
    const delayed = await this.delayedBatches();
    const [oosBlocked, rejected] = await Promise.all([
      this.prisma.db.oosInvestigation.findMany({ where: { status: { in: OPEN_OOS_STATUSES }, batchId: { not: null } }, select: { id: true, number: true, batchId: true } }),
      this.prisma.db.batch.findMany({ where: { status: 'REJECTED', qaDecisionAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, select: { id: true, batchNumber: true } }),
    ]);
    const shortages = (await this.risk.materialRisks(user.tenantId)).filter((r) => r.risk === 'HIGH');
    return {
      intent: 'PLAN_ACHIEVEMENT',
      title: 'Production plan achievement',
      facts: {
        monthly: trend.map((t) => ({ ...t, achievementPct: t.planned ? r1((t.actual / t.planned) * 100) : null })),
        contributingFactors: {
          delayedBatches: delayed.rows.length,
          batchesBlockedByOpenOos: oosBlocked.length,
          batchesRejectedThisMonth: rejected.length,
          materialsAtHighStockoutRisk: shortages.map((s) => s.code),
        },
      },
      rows: delayed.rows,
      citations: [
        ...delayed.citations,
        ...oosBlocked.map((o) => ({ type: 'OOS', id: o.id, label: o.number, href: `/quality/oos/${o.id}` })),
        ...rejected.map((b) => ({ type: 'Batch', id: b.id, label: b.batchNumber, href: `/production/batches/${b.id}` })),
      ],
    };
  }

  private async oos(): Promise<ToolResult> {
    const rows = await this.prisma.db.oosInvestigation.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return {
      intent: 'OOS_STATUS',
      title: 'OOS investigations',
      facts: { open: rows.filter((o) => o.status !== 'CLOSED').length, overdue: rows.filter((o) => o.status !== 'CLOSED' && o.dueDate < new Date()).length },
      rows: rows.map((o) => ({ oos: o.number, test: o.testName, result: o.actualResult, specification: o.specification, status: o.status, conclusion: o.conclusion, ageDays: Math.floor((Date.now() - o.createdAt.getTime()) / DAY) })),
      citations: rows.map((o) => ({ type: 'OOS', id: o.id, label: o.number, href: `/quality/oos/${o.id}` })),
    };
  }

  private async qualityTrends(question: string): Promise<ToolResult> {
    const m = question.toLowerCase().match(MONTHS_RE);
    const months = m ? (WORD_NUM[m[1]] ?? Number(m[1])) : 6;
    const since = new Date(Date.now() - months * 30 * DAY);
    const devs = await this.prisma.db.deviation.findMany({ where: { occurredAt: { gte: since }, status: { not: 'CANCELLED' } }, select: { id: true, number: true, category: true, equipmentId: true, productId: true, classification: true } });
    const rca = await this.prisma.db.rootCauseAnalysis.findMany({ where: { deviationId: { in: devs.map((d) => d.id) } }, select: { primaryCategory: true } });
    const count = (vals: (string | null)[]) => {
      const map = new Map<string, number>();
      vals.forEach((v) => map.set(v ?? 'UNSPECIFIED', (map.get(v ?? 'UNSPECIFIED') ?? 0) + 1));
      return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ value: k, count: n, sharePct: devs.length ? r1((n / devs.length) * 100) : 0 }));
    };
    const equipment = await this.prisma.db.equipment.findMany({ where: { id: { in: devs.map((d) => d.equipmentId).filter(Boolean) as string[] } }, select: { id: true, code: true } });
    const oos = await this.prisma.db.oosInvestigation.findMany({ where: { createdAt: { gte: since } }, select: { testName: true } });
    return {
      intent: 'QUALITY_TRENDS',
      title: `Quality trends (last ${months} months)`,
      facts: {
        deviations: devs.length,
        byProcessStage: count(devs.map((d) => d.category)),
        bySeverity: count(devs.map((d) => d.classification)),
        byEquipment: count(devs.map((d) => equipment.find((e) => e.id === d.equipmentId)?.code ?? null)),
        byRootCauseCategory: count(rca.map((r) => r.primaryCategory)),
        oosByTest: (() => {
          const map = new Map<string, number>();
          oos.forEach((o) => map.set(o.testName, (map.get(o.testName) ?? 0) + 1));
          return [...map.entries()].map(([test, n]) => ({ test, count: n }));
        })(),
      },
      rows: [],
      citations: devs.slice(0, 15).map((d) => ({ type: 'Deviation', id: d.id, label: d.number, href: `/quality/deviations/${d.id}` })),
    };
  }

  private async summary(user: AuthPrincipal): Promise<ToolResult> {
    const cc = await this.analytics.commandCenter(user.tenantId);
    return {
      intent: 'OPERATIONS_SUMMARY',
      title: 'Operations summary (Command Center)',
      facts: { headlines: cc.headlines, exceptionsBySection: cc.counts, critical: cc.critical },
      rows: cc.items.slice(0, 15).map((i) => ({ section: i.section, severity: i.severity, item: i.title, why: i.why, owner: i.owner, ageDays: i.ageDays })),
      citations: cc.items.slice(0, 15).map((i) => ({ type: i.section, id: i.id, label: i.title.split(' · ')[0], href: i.href })),
    };
  }
}
