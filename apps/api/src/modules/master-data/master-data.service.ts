import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeGtin } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { serialize } from '../../common/http';
import { ListQueryDto, orderBy, pageArgs, statusFilter, textSearch, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diff } from '../audit/audit.service';
import {
  BomDto,
  CalibrationDto,
  EquipmentDto,
  MaterialDto,
  ProductDto,
  RoutingDto,
  SpecificationDto,
  TestMethodDto,
  UpdateMaterialDto,
  UpdateProductDto,
} from './master-data.dto';

/** Writes an immutable version snapshot for regulated master data. */
export async function snapshotVersion(tx: Tx, tenantId: string, entityType: string, entity: { id: string; version?: number }, userId: string, reason?: string) {
  await tx.masterDataVersion.create({
    data: {
      tenantId,
      entityType,
      entityId: entity.id,
      version: entity.version ?? 1,
      snapshot: serialize(entity) as Prisma.InputJsonValue,
      reason,
      changedById: userId,
    },
  });
}

/** Validates and normalises a GTIN to GTIN-14 (undefined when not supplied). */
function gtinOrThrow(gtin?: string) {
  if (!gtin) return undefined;
  const g = normalizeGtin(gtin);
  if (!g) throw new ValidationError(`GTIN ${gtin} is not a valid GS1 GTIN (length or check digit)`);
  return g;
}

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lookups() {
    const [uoms, categories, dosageForms, testMethods] = await Promise.all([
      this.prisma.db.unitOfMeasure.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.db.productCategory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.db.dosageForm.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.db.testMethod.findMany({ orderBy: { code: 'asc' } }),
    ]);
    return { uoms, categories, dosageForms, testMethods };
  }

  versions(entityType: string, entityId: string) {
    return this.prisma.db.masterDataVersion.findMany({ where: { entityType, entityId }, orderBy: { version: 'desc' } });
  }

  // ── Products ────────────────────────────────────────────────
  async listProducts(q: ListQueryDto & { categoryId?: string }) {
    const where: Prisma.ProductWhereInput = {
      status: statusFilter(q),
      categoryId: q.categoryId || undefined,
      OR: textSearch(q.q, ['code', 'genericName', 'brandName', 'registrationNumber']),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.product.findMany({
        where,
        include: { dosageForm: true, category: true },
        orderBy: orderBy(q, ['code', 'genericName', 'createdAt'], { code: 'asc' }),
        ...pageArgs(q),
      }),
      this.prisma.db.product.count({ where }),
    ]);
    return toPage(rows, total, q);
  }

  async getProduct(id: string) {
    const p = await this.prisma.db.product.findFirst({
      where: { id },
      include: {
        dosageForm: true,
        category: true,
        boms: { orderBy: { version: 'desc' }, include: { lines: { include: { material: { select: { code: true, name: true, type: true, uomId: true } } } } } },
        routings: { orderBy: { version: 'desc' }, include: { steps: { orderBy: { sequence: 'asc' } } } },
      },
    });
    if (!p) throw new NotFoundError('Product', id);
    const specs = await this.prisma.db.qcSpecification.findMany({ where: { productId: id }, include: { tests: { orderBy: { sequence: 'asc' } } }, orderBy: [{ code: 'asc' }, { version: 'desc' }] });
    return { ...p, specifications: specs };
  }

  async createProduct(user: AuthPrincipal, dto: ProductDto) {
    return this.prisma.transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...dto, gtin: gtinOrThrow(dto.gtin), tenantId: user.tenantId } });
      await snapshotVersion(tx, user.tenantId, 'Product', p, user.id, 'Initial version');
      await this.audit.record(tx, { entityType: 'Product', entityId: p.id, entityLabel: p.code, action: 'CREATE', next: p });
      return p;
    });
  }

  async updateProduct(user: AuthPrincipal, id: string, dto: UpdateProductDto) {
    const { reason, ...data } = dto;
    return this.prisma.transaction(async (tx) => {
      const before = await tx.product.findFirst({ where: { id } });
      if (!before) throw new NotFoundError('Product', id);
      const after = await tx.product.update({ where: { id }, data: { ...data, gtin: data.gtin === undefined ? undefined : gtinOrThrow(data.gtin), version: { increment: 1 } } });
      await snapshotVersion(tx, user.tenantId, 'Product', after, user.id, reason);
      const [p, n] = diff(before, after);
      await this.audit.record(tx, { entityType: 'Product', entityId: id, entityLabel: after.code, action: 'UPDATE', previous: p, next: n, reason });
      return after;
    });
  }

  /** Creates a new BOM version; prior versions are kept (INACTIVE), never overwritten. */
  async createBom(user: AuthPrincipal, productId: string, dto: BomDto) {
    return this.prisma.transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId } });
      if (!product) throw new NotFoundError('Product', productId);
      const materials = await tx.material.count({ where: { id: { in: dto.lines.map((l) => l.materialId) } } });
      if (materials !== new Set(dto.lines.map((l) => l.materialId)).size) throw new ValidationError('Unknown material in BOM');
      const last = await tx.bom.findFirst({ where: { productId }, orderBy: { version: 'desc' } });
      await tx.bom.updateMany({ where: { productId, status: 'ACTIVE' }, data: { status: 'INACTIVE' } });
      const bom = await tx.bom.create({
        data: {
          tenantId: user.tenantId,
          productId,
          version: (last?.version ?? 0) + 1,
          batchSize: dto.batchSize,
          lines: { create: dto.lines.map((l) => ({ ...l, tenantId: user.tenantId })) },
        },
        include: { lines: true },
      });
      await snapshotVersion(tx, user.tenantId, 'Bom', bom, user.id, dto.reason);
      await this.audit.record(tx, { entityType: 'Bom', entityId: bom.id, entityLabel: `${product.code} BOM v${bom.version}`, action: 'CREATE', next: bom, reason: dto.reason });
      return bom;
    });
  }

  async createRouting(user: AuthPrincipal, productId: string, dto: RoutingDto) {
    return this.prisma.transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId } });
      if (!product) throw new NotFoundError('Product', productId);
      if (!dto.steps.some((s) => s.recordsOutput)) throw new ValidationError('At least one step must record output quantity');
      const last = await tx.routing.findFirst({ where: { productId }, orderBy: { version: 'desc' } });
      await tx.routing.updateMany({ where: { productId, status: 'ACTIVE' }, data: { status: 'INACTIVE' } });
      const routing = await tx.routing.create({
        data: {
          tenantId: user.tenantId,
          productId,
          version: (last?.version ?? 0) + 1,
          steps: {
            create: dto.steps.map((s, i) => ({
              tenantId: user.tenantId,
              sequence: (i + 1) * 10,
              code: s.code,
              name: s.name,
              instructions: s.instructions,
              equipmentType: s.equipmentType,
              expectedDurationMin: s.expectedDurationMin,
              requiresVerification: s.requiresVerification ?? true,
              consumesMaterials: s.consumesMaterials ?? false,
              recordsOutput: s.recordsOutput ?? false,
              parameters: (s.parameters ?? []) as unknown as Prisma.InputJsonValue,
              ipcChecks: (s.ipcChecks ?? []) as unknown as Prisma.InputJsonValue,
            })),
          },
        },
        include: { steps: true },
      });
      await snapshotVersion(tx, user.tenantId, 'Routing', routing, user.id, dto.reason);
      await this.audit.record(tx, { entityType: 'Routing', entityId: routing.id, entityLabel: `${product.code} eBMR template v${routing.version}`, action: 'CREATE', next: { steps: routing.steps.map((s) => s.name) }, reason: dto.reason });
      return routing;
    });
  }

  // ── Materials ───────────────────────────────────────────────
  async listMaterials(q: ListQueryDto & { type?: string }) {
    const where: Prisma.MaterialWhereInput = {
      status: statusFilter(q),
      type: (q.type as Prisma.EnumMaterialTypeFilter['equals']) || undefined,
      OR: textSearch(q.q, ['code', 'name']),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.material.findMany({ where, orderBy: orderBy(q, ['code', 'name', 'type'], { code: 'asc' }), ...pageArgs(q) }),
      this.prisma.db.material.count({ where }),
    ]);
    const stock = await this.prisma.db.inventoryLot.groupBy({
      by: ['materialId', 'status'],
      where: { materialId: { in: rows.map((r) => r.id) } },
      _sum: { quantity: true },
    });
    return toPage(
      rows.map((m) => {
        const s = stock.filter((x) => x.materialId === m.id);
        const sum = (st?: string) => s.filter((x) => !st || x.status === st).reduce((a, x) => a + Number(x._sum.quantity ?? 0), 0);
        return { ...m, stock: { released: sum('RELEASED'), quarantine: sum('QUARANTINE') + sum('UNDER_TEST'), total: sum() } };
      }),
      total,
      q,
    );
  }

  async getMaterial(id: string) {
    const m = await this.prisma.db.material.findFirst({
      where: { id },
      include: { suppliers: { include: { supplier: { select: { id: true, code: true, name: true, status: true, country: true } } } } },
    });
    if (!m) throw new NotFoundError('Material', id);
    const [lots, specs] = await Promise.all([
      this.prisma.db.inventoryLot.findMany({ where: { materialId: id, quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } }),
      this.prisma.db.qcSpecification.findMany({ where: { materialId: id }, include: { tests: { orderBy: { sequence: 'asc' } } } }),
    ]);
    return { ...m, lots, specifications: specs };
  }

  async createMaterial(user: AuthPrincipal, dto: MaterialDto) {
    return this.prisma.transaction(async (tx) => {
      const m = await tx.material.create({ data: { ...dto, tenantId: user.tenantId } });
      await snapshotVersion(tx, user.tenantId, 'Material', m, user.id, 'Initial version');
      await this.audit.record(tx, { entityType: 'Material', entityId: m.id, entityLabel: m.code, action: 'CREATE', next: m });
      return m;
    });
  }

  async updateMaterial(user: AuthPrincipal, id: string, dto: UpdateMaterialDto) {
    const { reason, ...data } = dto;
    return this.prisma.transaction(async (tx) => {
      const before = await tx.material.findFirst({ where: { id } });
      if (!before) throw new NotFoundError('Material', id);
      const after = await tx.material.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
      await snapshotVersion(tx, user.tenantId, 'Material', after, user.id, reason);
      const [p, n] = diff(before, after);
      await this.audit.record(tx, { entityType: 'Material', entityId: id, entityLabel: after.code, action: 'UPDATE', previous: p, next: n, reason });
      return after;
    });
  }

  // ── Equipment ───────────────────────────────────────────────
  async listEquipment(q: ListQueryDto & { type?: string }) {
    const where: Prisma.EquipmentWhereInput = { siteId: q.siteId || undefined, type: q.type || undefined, OR: textSearch(q.q, ['code', 'description', 'type', 'location']) };
    const [rows, total] = await Promise.all([
      this.prisma.db.equipment.findMany({ where, orderBy: orderBy(q, ['code', 'nextCalibrationDue'], { code: 'asc' }), ...pageArgs(q) }),
      this.prisma.db.equipment.count({ where }),
    ]);
    const now = Date.now();
    return toPage(
      rows.map((e) => ({
        ...e,
        calibrationState: !e.nextCalibrationDue ? 'NOT_REQUIRED' : e.nextCalibrationDue.getTime() < now ? 'EXPIRED' : e.nextCalibrationDue.getTime() < now + 7 * 86_400_000 ? 'DUE_SOON' : 'VALID',
      })),
      total,
      q,
    );
  }

  async getEquipment(id: string) {
    const e = await this.prisma.db.equipment.findFirst({ where: { id }, include: { calibrations: { orderBy: { performedAt: 'desc' } } } });
    if (!e) throw new NotFoundError('Equipment', id);
    return e;
  }

  async createEquipment(user: AuthPrincipal, dto: EquipmentDto) {
    return this.prisma.transaction(async (tx) => {
      const e = await tx.equipment.create({ data: { ...dto, nextCalibrationDue: dto.nextCalibrationDue ? new Date(dto.nextCalibrationDue) : null, tenantId: user.tenantId } });
      await this.audit.record(tx, { entityType: 'Equipment', entityId: e.id, entityLabel: e.code, action: 'CREATE', next: e });
      return e;
    });
  }

  async recordCalibration(user: AuthPrincipal, equipmentId: string, dto: CalibrationDto) {
    return this.prisma.transaction(async (tx) => {
      const e = await tx.equipment.findFirst({ where: { id: equipmentId } });
      if (!e) throw new NotFoundError('Equipment', equipmentId);
      const performedAt = new Date(dto.performedAt);
      if (performedAt > new Date()) throw new ValidationError('Calibration date cannot be in the future');
      const nextDue = dto.nextDue ? new Date(dto.nextDue) : e.calibrationFrequencyDays ? new Date(performedAt.getTime() + e.calibrationFrequencyDays * 86_400_000) : null;
      if (!nextDue) throw new ValidationError('nextDue is required when the equipment has no calibration frequency');
      const cal = await tx.calibration.create({
        data: { tenantId: user.tenantId, equipmentId, performedAt, nextDue, result: dto.result, certificateNo: dto.certificateNo, performedById: user.id },
      });
      const after = await tx.equipment.update({ where: { id: equipmentId }, data: { lastCalibrationAt: performedAt, nextCalibrationDue: nextDue } });
      await this.audit.record(tx, {
        entityType: 'Equipment',
        entityId: equipmentId,
        entityLabel: e.code,
        action: 'UPDATE',
        previous: { lastCalibrationAt: e.lastCalibrationAt, nextCalibrationDue: e.nextCalibrationDue },
        next: { lastCalibrationAt: after.lastCalibrationAt, nextCalibrationDue: after.nextCalibrationDue, result: dto.result, certificateNo: dto.certificateNo },
        reason: 'Calibration recorded',
      });
      return cal;
    });
  }

  // ── Specifications ──────────────────────────────────────────
  listSpecs(materialId?: string, productId?: string) {
    return this.prisma.db.qcSpecification.findMany({
      where: { materialId: materialId || undefined, productId: productId || undefined },
      include: { tests: { orderBy: { sequence: 'asc' } } },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });
  }

  async getSpec(id: string) {
    const s = await this.prisma.db.qcSpecification.findFirst({ where: { id }, include: { tests: { orderBy: { sequence: 'asc' } } } });
    if (!s) throw new NotFoundError('Specification', id);
    return s;
  }

  /** New specification version; previous ACTIVE version of the same code becomes INACTIVE. */
  async createSpec(user: AuthPrincipal, dto: SpecificationDto) {
    if (!!dto.materialId === !!dto.productId) throw new ValidationError('A specification applies to exactly one material or product');
    for (const t of dto.tests) {
      if (t.resultType === 'NUMERIC' && t.operator === 'RANGE' && (t.minValue === undefined || t.maxValue === undefined)) {
        throw new ValidationError(`Test "${t.name}": RANGE requires min and max`);
      }
      if (t.minValue !== undefined && t.maxValue !== undefined && t.minValue > t.maxValue) throw new ValidationError(`Test "${t.name}": min > max`);
    }
    return this.prisma.transaction(async (tx) => {
      const last = await tx.qcSpecification.findFirst({ where: { code: dto.code }, orderBy: { version: 'desc' } });
      if (last && (last.materialId ?? null) !== (dto.materialId ?? null) && (last.productId ?? null) !== (dto.productId ?? null)) {
        throw new ConflictError('Specification code already used for a different item');
      }
      await tx.qcSpecification.updateMany({ where: { code: dto.code, status: 'ACTIVE' }, data: { status: 'INACTIVE' } });
      const spec = await tx.qcSpecification.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          stage: dto.stage,
          materialId: dto.materialId,
          productId: dto.productId,
          version: (last?.version ?? 0) + 1,
          tests: { create: dto.tests.map((t, i) => ({ ...t, tenantId: user.tenantId, sequence: i + 1, isMandatory: t.isMandatory ?? true })) },
        },
        include: { tests: true },
      });
      await snapshotVersion(tx, user.tenantId, 'QcSpecification', spec, user.id, dto.reason);
      await this.audit.record(tx, { entityType: 'QcSpecification', entityId: spec.id, entityLabel: `${spec.code} v${spec.version}`, action: 'CREATE', next: spec, reason: dto.reason });
      return spec;
    });
  }

  async createTestMethod(user: AuthPrincipal, dto: TestMethodDto) {
    return this.prisma.transaction(async (tx) => {
      const m = await tx.testMethod.create({ data: { ...dto, tenantId: user.tenantId } });
      await this.audit.record(tx, { entityType: 'TestMethod', entityId: m.id, entityLabel: m.code, action: 'CREATE', next: m });
      return m;
    });
  }
}
