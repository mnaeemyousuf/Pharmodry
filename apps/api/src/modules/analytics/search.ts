import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, CurrentUser } from '../../common/auth-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
}

const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

/** Permission-aware global search across regulated records. */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: AuthPrincipal, raw: string) {
    const q = raw.trim().slice(0, 80);
    if (q.length < 2) return { hits: [], related: null };
    const db = this.prisma.db;
    const take = 6;
    const tasks: Promise<SearchHit[]>[] = [];
    if (user.has('batch.view'))
      tasks.push(
        db.batch
          .findMany({ where: { batchNumber: ci(q) }, take, include: { product: { select: { genericName: true, strength: true } } } })
          .then((r) => r.map((b) => ({ type: 'Batch', id: b.id, title: b.batchNumber, subtitle: `${b.product.genericName} ${b.product.strength}`, status: b.status, href: `/production/batches/${b.id}` }))),
      );
    if (user.has('masterdata.view')) {
      tasks.push(
        db.product
          .findMany({ where: { OR: [{ code: ci(q) }, { genericName: ci(q) }, { brandName: ci(q) }] }, take })
          .then((r) => r.map((p) => ({ type: 'Product', id: p.id, title: `${p.code} · ${p.genericName} ${p.strength}`, subtitle: p.brandName ?? 'Product', status: p.status, href: `/master-data/products/${p.id}` }))),
      );
      tasks.push(
        db.material
          .findMany({ where: { OR: [{ code: ci(q) }, { name: ci(q) }] }, take })
          .then((r) => r.map((m) => ({ type: 'Material', id: m.id, title: `${m.code} · ${m.name}`, subtitle: m.type, status: m.status, href: `/master-data/materials/${m.id}` }))),
      );
    }
    if (user.has('supplier.view'))
      tasks.push(
        db.supplier
          .findMany({ where: { OR: [{ code: ci(q) }, { name: ci(q) }] }, take })
          .then((r) => r.map((s) => ({ type: 'Supplier', id: s.id, title: `${s.code} · ${s.name}`, subtitle: s.country, status: s.status, href: `/master-data/suppliers/${s.id}` }))),
      );
    if (user.has('inventory.view')) {
      tasks.push(
        db.inventoryLot
          .findMany({ where: { OR: [{ lotNumber: ci(q) }, { supplierBatch: ci(q) }] }, take })
          .then((r) => r.map((l) => ({ type: 'Lot', id: l.id, title: l.lotNumber, subtitle: `${Number(l.quantity)} ${l.uomCode}${l.supplierBatch ? ` · supplier batch ${l.supplierBatch}` : ''}`, status: l.status, href: `/inventory/lots/${l.id}` }))),
      );
      tasks.push(
        db.goodsReceipt
          .findMany({ where: { number: ci(q) }, take })
          .then((r) => r.map((g) => ({ type: 'GRN', id: g.id, title: g.number, subtitle: `Received ${g.receivedAt.toISOString().slice(0, 10)}`, status: g.status, href: `/inventory/receipts/${g.id}` }))),
      );
    }
    if (user.has('procurement.po.view'))
      tasks.push(
        db.purchaseOrder
          .findMany({ where: { number: ci(q) }, take })
          .then((r) => r.map((p) => ({ type: 'PO', id: p.id, title: p.number, subtitle: `Ordered ${p.orderDate.toISOString().slice(0, 10)}`, status: p.status, href: `/procurement/purchase-orders/${p.id}` }))),
      );
    if (user.has('deviation.view'))
      tasks.push(
        db.deviation
          .findMany({ where: { OR: [{ number: ci(q) }, { title: ci(q) }] }, take })
          .then((r) => r.map((d) => ({ type: 'Deviation', id: d.id, title: d.number, subtitle: d.title, status: d.status, href: `/quality/deviations/${d.id}` }))),
      );
    if (user.has('capa.view'))
      tasks.push(
        db.capa
          .findMany({ where: { OR: [{ number: ci(q) }, { problemStatement: ci(q) }] }, take })
          .then((r) => r.map((c) => ({ type: 'CAPA', id: c.id, title: c.number, subtitle: c.problemStatement.slice(0, 90), status: c.status, href: `/quality/capa/${c.id}` }))),
      );
    if (user.has('oos.view'))
      tasks.push(
        db.oosInvestigation
          .findMany({ where: { OR: [{ number: ci(q) }, { testName: ci(q) }] }, take })
          .then((r) => r.map((o) => ({ type: 'OOS', id: o.id, title: o.number, subtitle: `${o.testName}: ${o.actualResult} (spec ${o.specification})`, status: o.status, href: `/quality/oos/${o.id}` }))),
      );
    if (user.has('qc.view'))
      tasks.push(
        db.qcSample
          .findMany({ where: { number: ci(q) }, take })
          .then((r) => r.map((s) => ({ type: 'QC sample', id: s.id, title: s.number, subtitle: s.stage.replace(/_/g, ' ').toLowerCase(), status: s.status, href: `/quality/samples/${s.id}` }))),
      );
    const hits = (await Promise.all(tasks)).flat();

    // Exact batch match: show the related regulated records immediately.
    let related = null;
    const exact = user.has('batch.view') ? await db.batch.findFirst({ where: { batchNumber: { equals: q, mode: 'insensitive' } } }) : null;
    if (exact) {
      const [qc, deviations, oos, lots, consumptions, audit] = await Promise.all([
        db.qcSample.count({ where: { batchId: exact.id } }),
        db.deviation.findMany({ where: { batchId: exact.id }, select: { id: true } }),
        db.oosInvestigation.findMany({ where: { batchId: exact.id }, select: { id: true } }),
        db.inventoryLot.count({ where: { batchId: exact.id } }),
        db.batchMaterialConsumption.count({ where: { batchId: exact.id } }),
        user.has('audit.view') ? db.auditEvent.count({ where: { entityId: exact.id } }) : Promise.resolve(null),
      ]);
      const capas = await db.capa.count({ where: { OR: [{ deviationId: { in: deviations.map((d) => d.id) } }, { oosId: { in: oos.map((o) => o.id) } }] } });
      related = {
        batchId: exact.id,
        batchNumber: exact.batchNumber,
        status: exact.status,
        counts: { qcSamples: qc, materialsConsumed: consumptions, deviations: deviations.length, oos: oos.length, capas, inventoryLots: lots, auditEvents: audit },
      };
    }
    return { hits, related };
  }
}

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  search(@CurrentUser() u: AuthPrincipal, @Query('q') q = '') {
    return this.svc.search(u, q);
  }
}
