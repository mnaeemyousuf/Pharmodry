import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, SupplierStatus } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { NotFoundError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, textSearch, toPage } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diff } from '../audit/audit.service';
import { snapshotVersion } from '../master-data/master-data.service';

class SupplierDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9-]{2,30}$/) code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ description: '[{name, number, expiresAt}]' }) @IsOptional() @IsArray() certifications?: Record<string, unknown>[];
}
class UpdateSupplierDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() certifications?: Record<string, unknown>[];
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}
class SupplierStatusDto {
  @ApiProperty({ enum: SupplierStatus }) @IsEnum(SupplierStatus) status: SupplierStatus;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() requalificationDate?: string;
}
class SupplierMaterialDto {
  @ApiProperty() @IsUUID() materialId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturerName?: string;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export interface SupplierScorecard {
  onTimeDeliveryPct: number | null;
  qcRejectionPct: number | null;
  lotsReceived: number;
  lotsRejected: number;
  avgLeadTimeDays: number | null;
  deviationCount: number;
  documentationCompliancePct: number | null;
  qualityScore: number | null;
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: FilterQueryDto) {
    const where: Prisma.SupplierWhereInput = { status: statusFilter(q), OR: textSearch(q.q, ['code', 'name', 'country']) };
    const [rows, total] = await Promise.all([
      this.prisma.db.supplier.findMany({ where, include: { _count: { select: { materials: true } } }, orderBy: orderBy(q, ['code', 'name', 'status'], { name: 'asc' }), ...pageArgs(q) }),
      this.prisma.db.supplier.count({ where }),
    ]);
    const scores = await this.scorecards(rows.map((r) => r.id));
    return toPage(rows.map((r) => ({ ...r, scorecard: scores[r.id] })), total, q);
  }

  async get(id: string) {
    const s = await this.prisma.db.supplier.findFirst({ where: { id }, include: { materials: { include: { material: { select: { id: true, code: true, name: true, type: true } } } } } });
    if (!s) throw new NotFoundError('Supplier', id);
    const [scores, receipts] = await Promise.all([
      this.scorecards([id]),
      this.prisma.db.goodsReceipt.findMany({ where: { supplierId: id }, orderBy: { receivedAt: 'desc' }, take: 20, include: { lines: true } }),
    ]);
    return { ...s, scorecard: scores[id], recentReceipts: receipts };
  }

  /**
   * Deterministic supplier KPIs: on-time delivery (GRN date ≤ PO expected date), QC rejection rate
   * (lots rejected ÷ dispositioned lots), average lead time (PO order → first GRN), deviation count,
   * documentation compliance (unexpired certifications ÷ certifications).
   */
  async scorecards(ids: string[]): Promise<Record<string, SupplierScorecard>> {
    if (ids.length === 0) return {};
    const [lots, grns, suppliers, deviations] = await Promise.all([
      this.prisma.db.inventoryLot.groupBy({ by: ['supplierId', 'status'], where: { supplierId: { in: ids }, itemType: 'MATERIAL', sourceType: 'GRN' }, _count: { _all: true } }),
      this.prisma.db.goodsReceipt.findMany({ where: { supplierId: { in: ids }, status: { not: 'CANCELLED' } }, select: { supplierId: true, receivedAt: true, purchaseOrderId: true } }),
      this.prisma.db.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, certifications: true } }),
      this.prisma.db.$queryRaw<{ supplierId: string; n: bigint }[]>`
        SELECT l."supplierId", COUNT(DISTINCT d.id) AS n FROM deviations d
        JOIN inventory_lots l ON l."materialId" = d."materialId" AND l."tenantId" = d."tenantId"
        WHERE l."supplierId" = ANY(${ids}::uuid[]) AND d.status <> 'CANCELLED' GROUP BY l."supplierId"`,
    ]);
    const poIds = [...new Set(grns.map((g) => g.purchaseOrderId).filter(Boolean) as string[])];
    const pos = poIds.length ? await this.prisma.db.purchaseOrder.findMany({ where: { id: { in: poIds } }, select: { id: true, orderDate: true, expectedDate: true } }) : [];
    const poMap = new Map(pos.map((p) => [p.id, p]));
    const out: Record<string, SupplierScorecard> = {};
    for (const id of ids) {
      const ls = lots.filter((l) => l.supplierId === id);
      const rejected = ls.filter((l) => l.status === 'REJECTED').reduce((a, l) => a + l._count._all, 0);
      const dispositioned = ls.filter((l) => l.status !== 'QUARANTINE' && l.status !== 'UNDER_TEST').reduce((a, l) => a + l._count._all, 0);
      const g = grns.filter((x) => x.supplierId === id && x.purchaseOrderId && poMap.has(x.purchaseOrderId));
      const withExpected = g.filter((x) => poMap.get(x.purchaseOrderId!)!.expectedDate);
      const onTime = withExpected.filter((x) => x.receivedAt <= poMap.get(x.purchaseOrderId!)!.expectedDate!).length;
      const leadDays = g.map((x) => (x.receivedAt.getTime() - poMap.get(x.purchaseOrderId!)!.orderDate.getTime()) / 86_400_000);
      const certs = ((suppliers.find((s) => s.id === id)?.certifications ?? []) as { expiresAt?: string }[]) || [];
      const validCerts = certs.filter((c) => !c.expiresAt || new Date(c.expiresAt) > new Date()).length;
      const onTimePct = withExpected.length ? Math.round((onTime / withExpected.length) * 1000) / 10 : null;
      const rejectionPct = dispositioned ? Math.round((rejected / dispositioned) * 1000) / 10 : null;
      const docPct = certs.length ? Math.round((validCerts / certs.length) * 1000) / 10 : null;
      const parts = [onTimePct, rejectionPct === null ? null : 100 - rejectionPct, docPct].filter((x): x is number => x !== null);
      out[id] = {
        onTimeDeliveryPct: onTimePct,
        qcRejectionPct: rejectionPct,
        lotsReceived: ls.reduce((a, l) => a + l._count._all, 0),
        lotsRejected: rejected,
        avgLeadTimeDays: leadDays.length ? Math.round((leadDays.reduce((a, b) => a + b, 0) / leadDays.length) * 10) / 10 : null,
        deviationCount: Number(deviations.find((d) => d.supplierId === id)?.n ?? 0),
        documentationCompliancePct: docPct,
        qualityScore: parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10 : null,
      };
    }
    return out;
  }

  async create(user: AuthPrincipal, dto: SupplierDto) {
    return this.prisma.transaction(async (tx) => {
      const s = await tx.supplier.create({ data: { ...dto, certifications: (dto.certifications ?? []) as Prisma.InputJsonValue, tenantId: user.tenantId } });
      await snapshotVersion(tx, user.tenantId, 'Supplier', s, user.id, 'Initial version');
      await this.audit.record(tx, { entityType: 'Supplier', entityId: s.id, entityLabel: s.code, action: 'CREATE', next: s });
      return s;
    });
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateSupplierDto) {
    const { reason, certifications, ...data } = dto;
    return this.prisma.transaction(async (tx) => {
      const before = await tx.supplier.findFirst({ where: { id } });
      if (!before) throw new NotFoundError('Supplier', id);
      const after = await tx.supplier.update({
        where: { id },
        data: { ...data, ...(certifications ? { certifications: certifications as Prisma.InputJsonValue } : {}), version: { increment: 1 } },
      });
      await snapshotVersion(tx, user.tenantId, 'Supplier', after, user.id, reason);
      const [p, n] = diff(before, after);
      await this.audit.record(tx, { entityType: 'Supplier', entityId: id, entityLabel: after.code, action: 'UPDATE', previous: p, next: n, reason });
      return after;
    });
  }

  async changeStatus(user: AuthPrincipal, id: string, dto: SupplierStatusDto) {
    return this.prisma.transaction(async (tx) => {
      const before = await tx.supplier.findFirst({ where: { id } });
      if (!before) throw new NotFoundError('Supplier', id);
      const approving = dto.status === 'APPROVED' || dto.status === 'CONDITIONALLY_APPROVED';
      const after = await tx.supplier.update({
        where: { id },
        data: {
          status: dto.status,
          qualificationDate: approving ? new Date() : before.qualificationDate,
          requalificationDate: dto.requalificationDate ? new Date(dto.requalificationDate) : before.requalificationDate,
          version: { increment: 1 },
        },
      });
      await snapshotVersion(tx, user.tenantId, 'Supplier', after, user.id, dto.reason);
      await this.audit.record(tx, { entityType: 'Supplier', entityId: id, entityLabel: after.code, action: 'STATUS_CHANGE', previous: { status: before.status }, next: { status: after.status }, reason: dto.reason });
      return after;
    });
  }

  async approveMaterial(user: AuthPrincipal, supplierId: string, dto: SupplierMaterialDto) {
    return this.prisma.transaction(async (tx) => {
      const [s, m] = await Promise.all([tx.supplier.findFirst({ where: { id: supplierId } }), tx.material.findFirst({ where: { id: dto.materialId } })]);
      if (!s) throw new NotFoundError('Supplier', supplierId);
      if (!m) throw new NotFoundError('Material', dto.materialId);
      const sm = await tx.supplierMaterial.upsert({
        where: { supplierId_materialId: { supplierId, materialId: dto.materialId } },
        create: { tenantId: user.tenantId, supplierId, materialId: dto.materialId, manufacturerName: dto.manufacturerName },
        update: { approved: true, approvedAt: new Date(), manufacturerName: dto.manufacturerName },
      });
      await this.audit.record(tx, { entityType: 'Supplier', entityId: supplierId, entityLabel: s.code, action: 'APPROVE', next: { approvedMaterial: m.code }, reason: dto.reason });
      return sm;
    });
  }
}

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly svc: SuppliersService) {}

  @Get()
  @RequirePermissions('supplier.view')
  list(@Query() q: FilterQueryDto) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('supplier.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermissions('supplier.manage')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: SupplierDto) {
    return this.svc.create(u, dto);
  }

  @Patch(':id')
  @RequirePermissions('supplier.manage')
  update(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto) {
    return this.svc.update(u, id, dto);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermissions('supplier.approve')
  status(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SupplierStatusDto) {
    return this.svc.changeStatus(u, id, dto);
  }

  @Post(':id/materials')
  @RequirePermissions('supplier.approve')
  approveMaterial(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SupplierMaterialDto) {
    return this.svc.approveMaterial(u, id, dto);
  }
}

@Module({ controllers: [SuppliersController], providers: [SuppliersService], exports: [SuppliersService] })
export class SuppliersModule {}
