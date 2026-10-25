import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthPrincipal } from '../../common/auth-user';
import { ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService, UserDirectory } from '../core/core.services';
import { CreatePlanDto } from './production.dto';

const CLOSED_BATCH = ['RELEASED', 'CLOSED'] as const;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly users: UserDirectory,
  ) {}

  async list(q: FilterQueryDto) {
    const where: Prisma.ProductionPlanWhereInput = { status: statusFilter(q), siteId: q.siteId || undefined, ...(q.q ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.db.productionPlan.findMany({ where, include: { lines: true }, orderBy: orderBy(q, ['number', 'periodStart'], { periodStart: 'desc' }), ...pageArgs(q) }),
      this.prisma.db.productionPlan.count({ where }),
    ]);
    const withProgress = await Promise.all(rows.map(async (p) => ({ ...p, progress: await this.progress(p.lines.map((l) => l.id)) })));
    return toPage(await this.users.decorate(withProgress, ['createdById', 'approvedById']), total, q);
  }

  /** Plan achievement = released quantity of linked batches ÷ planned quantity. */
  private async progress(lineIds: string[]) {
    const lines = await this.prisma.db.productionPlanLine.findMany({ where: { id: { in: lineIds } } });
    const batches = await this.prisma.db.batch.findMany({ where: { planLineId: { in: lineIds }, status: { not: 'CANCELLED' } }, select: { planLineId: true, status: true, actualYield: true, plannedQuantity: true } });
    const planned = lines.reduce((a, l) => a + Number(l.plannedQuantity), 0);
    const released = batches.filter((b) => (CLOSED_BATCH as readonly string[]).includes(b.status)).reduce((a, b) => a + Number(b.actualYield ?? 0), 0);
    return {
      plannedQuantity: planned,
      releasedQuantity: released,
      achievementPct: planned ? Math.round((released / planned) * 1000) / 10 : 0,
      batchesPlanned: lines.reduce((a, l) => a + l.plannedBatches, 0),
      batchesCreated: batches.length,
      batchesReleased: batches.filter((b) => (CLOSED_BATCH as readonly string[]).includes(b.status)).length,
    };
  }

  async get(id: string) {
    const plan = await this.prisma.db.productionPlan.findFirst({ where: { id }, include: { lines: true } });
    if (!plan) throw new NotFoundError('Production plan', id);
    const [products, batches] = await Promise.all([
      this.prisma.db.product.findMany({ where: { id: { in: plan.lines.map((l) => l.productId) } }, select: { id: true, code: true, genericName: true, strength: true, standardBatchSize: true } }),
      this.prisma.db.batch.findMany({ where: { planLineId: { in: plan.lines.map((l) => l.id) } }, select: { id: true, batchNumber: true, status: true, planLineId: true, plannedQuantity: true, actualYield: true, plannedStart: true } }),
    ]);
    const lines = await Promise.all(
      plan.lines.map(async (l) => {
        const fg = await this.prisma.db.inventoryLot.aggregate({ where: { productId: l.productId, status: 'RELEASED' }, _sum: { quantity: true } });
        return {
          ...l,
          product: products.find((p) => p.id === l.productId),
          batches: batches.filter((b) => b.planLineId === l.id),
          finishedGoodsAvailable: Number(fg._sum.quantity ?? 0),
          availability: await this.availability(l.productId, plan.siteId, Number(l.plannedQuantity) / l.plannedBatches),
        };
      }),
    );
    return this.users.decorateOne({ ...plan, lines, progress: await this.progress(plan.lines.map((l) => l.id)) }, ['createdById', 'approvedById']);
  }

  async create(user: AuthPrincipal, dto: CreatePlanDto) {
    user.require('production.plan.manage', dto.siteId);
    if (new Date(dto.periodEnd) <= new Date(dto.periodStart)) throw new ValidationError('Plan period end must be after start');
    return this.prisma.transaction(async (tx) => {
      const count = await tx.product.count({ where: { id: { in: dto.lines.map((l) => l.productId) }, status: 'ACTIVE' } });
      if (count !== new Set(dto.lines.map((l) => l.productId)).size) throw new ValidationError('Every plan line needs an active product');
      const number = await this.numbering.next(tx, user.tenantId, 'PLAN');
      const plan = await tx.productionPlan.create({
        data: {
          tenantId: user.tenantId,
          siteId: dto.siteId,
          number,
          name: dto.name,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          createdById: user.id,
          lines: { create: dto.lines.map((l) => ({ ...l, tenantId: user.tenantId, demandQuantity: l.demandQuantity ?? 0 })) },
        },
        include: { lines: true },
      });
      await this.audit.record(tx, { entityType: 'ProductionPlan', entityId: plan.id, entityLabel: number, action: 'CREATE', next: plan });
      return plan;
    });
  }

  async approve(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const plan = await tx.productionPlan.findFirst({ where: { id } });
      if (!plan) throw new NotFoundError('Production plan', id);
      user.require('production.plan.approve', plan.siteId);
      if (plan.status !== 'DRAFT') throw new ConflictError(`Plan is ${plan.status}`);
      const after = await tx.productionPlan.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() } });
      await this.audit.record(tx, { entityType: 'ProductionPlan', entityId: id, entityLabel: plan.number, action: 'APPROVE', previous: { status: 'DRAFT' }, next: { status: 'APPROVED' } });
      return after;
    });
  }

  /** BOM requirement vs. released-available, quarantine and open-PO quantities for a batch size. */
  async availability(productId: string, siteId: string, quantity?: number, tx?: Tx) {
    const db = tx ?? this.prisma.db;
    const product = await db.product.findFirst({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product', productId);
    const bom = await db.bom.findFirst({ where: { productId, status: 'ACTIVE' }, include: { lines: true }, orderBy: { version: 'desc' } });
    if (!bom) throw new RuleViolationError(`Product ${product.code} has no active BOM`);
    const qty = quantity ?? Number(product.standardBatchSize);
    const factor = qty / Number(bom.batchSize);
    const materialIds = bom.lines.map((l) => l.materialId);
    const now = new Date();
    const [materials, lots, poLines] = await Promise.all([
      db.material.findMany({ where: { id: { in: materialIds } } }),
      db.inventoryLot.findMany({ where: { materialId: { in: materialIds }, siteId, quantity: { gt: 0 } } }),
      db.purchaseOrderLine.findMany({ where: { materialId: { in: materialIds }, purchaseOrder: { status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } } } }),
    ]);
    const lines = bom.lines.map((l) => {
      const m = materials.find((x) => x.id === l.materialId)!;
      const required = Math.round(Number(l.quantity) * factor * 10_000) / 10_000;
      const own = lots.filter((x) => x.materialId === l.materialId);
      const available = own
        .filter((x) => x.status === 'RELEASED' && x.expiryDate > now && (!x.retestDate || x.retestDate > now))
        .reduce((a, x) => a + Number(x.quantity) - Number(x.reservedQuantity), 0);
      const quarantine = own.filter((x) => x.status === 'QUARANTINE' || x.status === 'UNDER_TEST').reduce((a, x) => a + Number(x.quantity), 0);
      const onOrder = poLines.filter((p) => p.materialId === l.materialId).reduce((a, p) => a + Math.max(0, Number(p.quantity) - Number(p.receivedQuantity)), 0);
      return {
        materialId: m.id,
        code: m.code,
        name: m.name,
        type: m.type,
        required,
        available: Math.round(available * 10_000) / 10_000,
        quarantine,
        onOrder,
        shortage: Math.max(0, Math.round((required - available) * 10_000) / 10_000),
        sufficient: available >= required,
      };
    });
    return { productId, quantity: qty, bomVersion: bom.version, feasible: lines.every((l) => l.sufficient), lines };
  }
}
