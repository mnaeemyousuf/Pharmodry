import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth-user';
import { NotFoundError, ValidationError } from '../../common/errors';
import { FilterQueryDto } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const r2 = (n: number) => Math.round(n * 100) / 100;
const count = <T>(rows: T[], key: (r: T) => string | null | undefined) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r) ?? 'UNSPECIFIED', (m.get(key(r) ?? 'UNSPECIFIED') ?? 0) + 1));
  return [...m.entries()].map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count);
};

/**
 * Product Quality Review (PQR / APR) data pack — PIC/S GMP Part I Chapter 1. All figures are computed
 * from records; QA authors the conclusions. Sections not captured in this release are listed explicitly.
 */
@Injectable()
export class PqrService {
  constructor(private readonly prisma: PrismaService) {}

  async build(productId: string, fromIso: string, toIso: string) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new ValidationError('Provide a valid review period');
    const product = await this.prisma.db.product.findFirst({ where: { id: productId }, include: { dosageForm: true } });
    if (!product) throw new NotFoundError('Product', productId);
    const batches = await this.prisma.db.batch.findMany({ where: { productId, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } });
    const ids = batches.map((b) => b.id);
    const [deviations, oos, samples, consumptions] = await Promise.all([
      this.prisma.db.deviation.findMany({ where: { OR: [{ batchId: { in: ids } }, { productId, occurredAt: { gte: from, lte: to } }], status: { not: 'CANCELLED' } } }),
      this.prisma.db.oosInvestigation.findMany({ where: { OR: [{ batchId: { in: ids } }, { productId, createdAt: { gte: from, lte: to } }] } }),
      this.prisma.db.qcSample.findMany({ where: { batchId: { in: ids }, stage: 'FINISHED_PRODUCT', status: 'APPROVED' }, include: { results: { where: { status: 'ENTERED' } } } }),
      this.prisma.db.batchMaterialConsumption.findMany({ where: { batchId: { in: ids } } }),
    ]);
    const capas = await this.prisma.db.capa.findMany({ where: { OR: [{ deviationId: { in: deviations.map((d) => d.id) } }, { oosId: { in: oos.map((o) => o.id) } }] } });
    const lots = await this.prisma.db.inventoryLot.findMany({ where: { id: { in: [...new Set(consumptions.map((c) => c.lotId))] } }, select: { id: true, materialId: true, supplierId: true } });
    const [materials, suppliers] = await Promise.all([
      this.prisma.db.material.findMany({ where: { id: { in: lots.map((l) => l.materialId).filter(Boolean) as string[] } }, select: { id: true, code: true, name: true, type: true } }),
      this.prisma.db.supplier.findMany({ where: { id: { in: lots.map((l) => l.supplierId).filter(Boolean) as string[] } }, select: { id: true, code: true, name: true } }),
    ]);
    const yields = batches.filter((b) => b.yieldPct !== null).map((b) => Number(b.yieldPct));
    const mean = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null;
    const sd = yields.length > 1 && mean !== null ? Math.sqrt(yields.reduce((a, y) => a + (y - mean) ** 2, 0) / (yields.length - 1)) : null;
    const testStats = new Map<string, number[]>();
    samples.forEach((s) => s.results.forEach((r) => r.numericValue !== null && testStats.set(r.testName, [...(testStats.get(r.testName) ?? []), Number(r.numericValue)])));
    const materialSuppliers = materials.map((m) => {
      const supplierIds = [...new Set(lots.filter((l) => l.materialId === m.id).map((l) => l.supplierId).filter(Boolean) as string[])];
      return { material: `${m.code} ${m.name}`, type: m.type, suppliers: supplierIds.map((id) => suppliers.find((s) => s.id === id)?.name ?? id) };
    });
    return {
      product: { id: product.id, code: product.code, name: `${product.genericName} ${product.strength}`, brand: product.brandName, dosageForm: product.dosageForm?.name, registrationNumber: product.registrationNumber, gtin: product.gtin },
      period: { from, to },
      batches: {
        total: batches.length,
        released: batches.filter((b) => ['RELEASED', 'CLOSED'].includes(b.status)).length,
        rejected: batches.filter((b) => b.status === 'REJECTED').length,
        inProcess: batches.filter((b) => !['RELEASED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(b.status)).length,
        list: batches.map((b) => ({ id: b.id, batchNumber: b.batchNumber, status: b.status, yieldPct: b.yieldPct === null ? null : Number(b.yieldPct), withinTolerance: b.yieldWithinLimits, qaDecisionAt: b.qaDecisionAt })),
      },
      yield: { n: yields.length, mean: mean === null ? null : r2(mean), sd: sd === null ? null : r2(sd), min: yields.length ? Math.min(...yields) : null, max: yields.length ? Math.max(...yields) : null, outOfTolerance: batches.filter((b) => b.yieldWithinLimits === false).length },
      qcResults: [...testStats.entries()].map(([test, v]) => ({ test, n: v.length, mean: r2(v.reduce((a, b) => a + b, 0) / v.length), min: Math.min(...v), max: Math.max(...v) })),
      deviations: { total: deviations.length, bySeverity: count(deviations, (d) => d.classification ?? d.proposedSeverity), byCategory: count(deviations, (d) => d.category), open: deviations.filter((d) => !['CLOSED', 'CANCELLED'].includes(d.status)).length, list: deviations.map((d) => ({ id: d.id, number: d.number, title: d.title, status: d.status, classification: d.classification })) },
      oos: { total: oos.length, confirmed: oos.filter((o) => o.conclusion === 'CONFIRMED_OOS').length, invalidated: oos.filter((o) => o.conclusion === 'INVALIDATED_LAB_ERROR').length, open: oos.filter((o) => o.status !== 'CLOSED').length, list: oos.map((o) => ({ id: o.id, number: o.number, test: o.testName, result: o.actualResult, conclusion: o.conclusion, status: o.status })) },
      capas: { total: capas.length, closed: capas.filter((c) => c.status === 'CLOSED').length, effectivenessFailures: capas.reduce((a, c) => a + c.effectivenessFailures, 0), overdue: capas.filter((c) => !['CLOSED', 'CANCELLED'].includes(c.status) && c.dueDate < new Date()).length, list: capas.map((c) => ({ id: c.id, number: c.number, status: c.status, problem: c.problemStatement })) },
      startingMaterials: materialSuppliers,
      notCaptured: ['Stability programme results', 'Market complaints, returns and recalls', 'Change controls and regulatory variations', 'Equipment/utility qualification status review', 'Technical agreements review'],
    };
  }
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics/pqr')
export class PqrController {
  constructor(private readonly svc: PqrService) {}

  @Get()
  @RequirePermissions('analytics.view', 'batch.view')
  build(@Query() q: FilterQueryDto) {
    if (!q.productId) throw new ValidationError('productId is required');
    return this.svc.build(q.productId, q.from ?? new Date(Date.now() - 365 * 86_400_000).toISOString(), q.to ?? new Date().toISOString());
  }
}
