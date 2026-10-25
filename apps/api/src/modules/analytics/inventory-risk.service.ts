import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const DAY = 86_400_000;
const LOOKBACK_DAYS = 90;

export interface MaterialRisk {
  materialId: string;
  code: string;
  name: string;
  type: string;
  uom: string;
  available: number;
  quarantine: number;
  safetyStock: number;
  avgDailyConsumption: number;
  stockCoverDays: number | null;
  leadTimeDays: number;
  openPoQuantity: number;
  plannedDemand: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
}

export interface ExpiryRisk {
  lotId: string;
  lotNumber: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  expiryDate: Date;
  daysToExpiry: number;
  value: number;
  projectedUseBeforeExpiry: number;
  atRiskQuantity: number;
  recommendation: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Deterministic inventory analytics. All numbers are computed here from the ledger; the AI layer
 * may only explain these results, never produce figures of its own.
 */
@Injectable()
export class InventoryRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async materialRisks(tenantId: string, siteId?: string): Promise<MaterialRisk[]> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * DAY);
    const [materials, uoms, lots, issues, poLines, plannedBatches] = await Promise.all([
      this.prisma.db.material.findMany({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.db.unitOfMeasure.findMany({ where: { tenantId } }),
      this.prisma.db.inventoryLot.findMany({ where: { tenantId, itemType: 'MATERIAL', siteId: siteId || undefined, quantity: { gt: 0 } } }),
      this.prisma.db.$queryRaw<{ materialId: string; qty: number }[]>`
        SELECT l."materialId", SUM(-t.quantity)::float AS qty
        FROM inventory_transactions t JOIN inventory_lots l ON l.id = t."lotId"
        WHERE t."tenantId" = ${tenantId}::uuid AND t."performedAt" >= ${since}
          AND t.type IN ('ISSUE_TO_PRODUCTION','RETURN_FROM_PRODUCTION') AND l."materialId" IS NOT NULL
        GROUP BY l."materialId"`,
      this.prisma.db.purchaseOrderLine.findMany({ where: { tenantId, purchaseOrder: { status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } } } }),
      this.prisma.db.batch.findMany({ where: { tenantId, status: 'PLANNED', siteId: siteId || undefined }, select: { bomId: true, plannedQuantity: true } }),
    ]);
    const boms = await this.prisma.db.bom.findMany({ where: { id: { in: plannedBatches.map((b) => b.bomId) } }, include: { lines: true } });
    const demand = new Map<string, number>();
    for (const b of plannedBatches) {
      const bom = boms.find((x) => x.id === b.bomId);
      if (!bom) continue;
      for (const l of bom.lines) demand.set(l.materialId, (demand.get(l.materialId) ?? 0) + (Number(l.quantity) * Number(b.plannedQuantity)) / Number(bom.batchSize));
    }
    const now = new Date();
    return materials
      .map((m) => {
        const own = lots.filter((l) => l.materialId === m.id);
        const available = own
          .filter((l) => l.status === 'RELEASED' && l.expiryDate > now && (!l.retestDate || l.retestDate > now))
          .reduce((a, l) => a + Number(l.quantity) - Number(l.reservedQuantity), 0);
        const quarantine = own.filter((l) => l.status === 'QUARANTINE' || l.status === 'UNDER_TEST').reduce((a, l) => a + Number(l.quantity), 0);
        const consumed = Number(issues.find((i) => i.materialId === m.id)?.qty ?? 0);
        const avgDaily = Math.max(0, consumed / LOOKBACK_DAYS);
        const plannedDemand = demand.get(m.id) ?? 0;
        const openPo = poLines.filter((p) => p.materialId === m.id).reduce((a, p) => a + Math.max(0, Number(p.quantity) - Number(p.receivedQuantity)), 0);
        const cover = avgDaily > 0 ? r1(Math.max(0, available - plannedDemand) / avgDaily) : null;
        const safety = Number(m.safetyStock);
        const uom = uoms.find((u) => u.id === m.uomId)?.code ?? '';
        let risk: MaterialRisk['risk'] = 'LOW';
        const reasons: string[] = [];
        if (available <= 0 && (avgDaily > 0 || plannedDemand > 0)) {
          risk = 'HIGH';
          reasons.push(`no released stock is available${quarantine > 0 ? ` (${r1(quarantine)} ${uom} still in quarantine)` : ''}`);
        } else if (cover !== null && cover < m.leadTimeDays) {
          const leadDemand = avgDaily * m.leadTimeDays;
          risk = available + openPo + quarantine < leadDemand + plannedDemand ? 'HIGH' : 'MEDIUM';
          reasons.push(`available stock covers approximately ${Math.round(cover)} days while supplier lead time is ${m.leadTimeDays} days`);
          if (openPo > 0) reasons.push(`${r1(openPo)} ${uom} is on open purchase orders`);
        }
        if (plannedDemand > available && plannedDemand > 0 && available > 0) {
          risk = 'HIGH';
          reasons.push(`planned batches need ${r1(plannedDemand)} ${uom} but only ${r1(available)} ${uom} is released`);
        }
        if (safety > 0 && available < safety) {
          if (risk === 'LOW') risk = 'MEDIUM';
          reasons.push(`available ${r1(available)} ${uom} is below safety stock of ${r1(safety)} ${uom}`);
        }
        const explanation =
          reasons.length > 0
            ? `${m.code} is at ${risk.toLowerCase()} stockout risk because ${reasons.join('; ')}.`
            : `${m.code} has adequate cover${cover !== null ? ` (~${Math.round(cover)} days vs ${m.leadTimeDays}-day lead time)` : ''}.`;
        return {
          materialId: m.id,
          code: m.code,
          name: m.name,
          type: m.type,
          uom,
          available: r1(available),
          quarantine: r1(quarantine),
          safetyStock: safety,
          avgDailyConsumption: Math.round(avgDaily * 1000) / 1000,
          stockCoverDays: cover,
          leadTimeDays: m.leadTimeDays,
          openPoQuantity: r1(openPo),
          plannedDemand: r1(plannedDemand),
          risk,
          explanation,
        };
      })
      .sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[a.risk] - ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[b.risk] || (a.stockCoverDays ?? 1e9) - (b.stockCoverDays ?? 1e9));
  }

  /** Near-expiry lots with projected consumption before expiry and a recommendation for human review. */
  async expiryRisks(tenantId: string, withinDays = 90, siteId?: string): Promise<ExpiryRisk[]> {
    const now = Date.now();
    const lots = await this.prisma.db.inventoryLot.findMany({
      where: { tenantId, siteId: siteId || undefined, quantity: { gt: 0 }, status: { in: ['RELEASED', 'QUARANTINE', 'UNDER_TEST', 'EXPIRED'] }, expiryDate: { lte: new Date(now + withinDays * DAY) } },
      orderBy: { expiryDate: 'asc' },
    });
    const risks = await this.materialRisks(tenantId, siteId);
    const [materials, products] = await Promise.all([
      this.prisma.db.material.findMany({ where: { id: { in: lots.map((l) => l.materialId).filter(Boolean) as string[] } } }),
      this.prisma.db.product.findMany({ where: { id: { in: lots.map((l) => l.productId).filter(Boolean) as string[] } } }),
    ]);
    return lots.map((l) => {
      const m = materials.find((x) => x.id === l.materialId);
      const p = products.find((x) => x.id === l.productId);
      const days = Math.floor((l.expiryDate.getTime() - now) / DAY);
      const qty = Number(l.quantity);
      const rate = m ? (risks.find((r) => r.materialId === m.id)?.avgDailyConsumption ?? 0) : 0;
      const projected = Math.min(qty, Math.max(0, days) * rate);
      const atRisk = r1(qty - projected);
      let recommendation: string;
      if (days < 0) recommendation = 'Expired: confirm EXPIRED status, segregate and initiate destruction per SOP.';
      else if (!m) recommendation = 'Finished goods: prioritise dispatch (FEFO) and review distributor allocation.';
      else if (atRisk <= 0) recommendation = 'Projected to be consumed before expiry at current usage — keep FEFO allocation.';
      else if (rate > 0) recommendation = 'Prioritise consumption in the next planned batches and review open purchase orders to avoid over-stocking.';
      else recommendation = 'Slow-moving: no recent consumption. Review future procurement and evaluate inter-site transfer or return.';
      return {
        lotId: l.id,
        lotNumber: l.lotNumber,
        itemCode: m?.code ?? p?.code ?? '',
        itemName: m?.name ?? (p ? `${p.genericName} ${p.strength}` : ''),
        quantity: qty,
        uom: l.uomCode,
        expiryDate: l.expiryDate,
        daysToExpiry: days,
        value: Math.round(qty * Number(l.unitCost)),
        projectedUseBeforeExpiry: r1(projected),
        atRiskQuantity: Math.max(0, atRisk),
        recommendation,
      };
    });
  }
}
