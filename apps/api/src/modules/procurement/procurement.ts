import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { ConflictError, NotFoundError, RuleViolationError, assertTransition } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService, UserDirectory } from '../core/core.services';

class PoLineDto {
  @ApiProperty() @IsUUID() materialId: string;
  @ApiProperty() @IsNumber() @IsPositive() quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
}
class CreatePoDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsUUID() supplierId: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [PoLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PoLineDto) lines: PoLineDto[];
}
class CancelDto {
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

const PO_TRANSITIONS = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CLOSED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
} as const satisfies Record<string, readonly string[]>;

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly users: UserDirectory,
  ) {}

  async list(q: FilterQueryDto) {
    const where: Prisma.PurchaseOrderWhereInput = {
      status: statusFilter(q),
      supplierId: q.supplierId || undefined,
      siteId: q.siteId || undefined,
      ...(q.q ? { number: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.purchaseOrder.findMany({ where, include: { lines: true }, orderBy: orderBy(q, ['number', 'orderDate', 'expectedDate', 'status'], { orderDate: 'desc' }), ...pageArgs(q) }),
      this.prisma.db.purchaseOrder.count({ where }),
    ]);
    const suppliers = await this.prisma.db.supplier.findMany({ where: { id: { in: rows.map((r) => r.supplierId) } }, select: { id: true, name: true, code: true } });
    const sm = new Map(suppliers.map((s) => [s.id, s]));
    return toPage(
      rows.map((r) => ({ ...r, supplier: sm.get(r.supplierId), totalValue: r.lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unitPrice), 0) })),
      total,
      q,
    );
  }

  async get(id: string) {
    const po = await this.prisma.db.purchaseOrder.findFirst({ where: { id }, include: { lines: true } });
    if (!po) throw new NotFoundError('Purchase order', id);
    const [supplier, materials, grns] = await Promise.all([
      this.prisma.db.supplier.findFirst({ where: { id: po.supplierId } }),
      this.prisma.db.material.findMany({ where: { id: { in: po.lines.map((l) => l.materialId) } }, select: { id: true, code: true, name: true, uomId: true } }),
      this.prisma.db.goodsReceipt.findMany({ where: { purchaseOrderId: id }, select: { id: true, number: true, receivedAt: true, status: true } }),
    ]);
    const mm = new Map(materials.map((m) => [m.id, m]));
    return this.users.decorateOne(
      { ...po, supplier, receipts: grns, lines: po.lines.map((l) => ({ ...l, material: mm.get(l.materialId) })) },
      ['createdById', 'approvedById'],
    );
  }

  async create(user: AuthPrincipal, dto: CreatePoDto) {
    user.require('procurement.po.create', dto.siteId);
    return this.prisma.transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id: dto.supplierId }, include: { materials: { where: { approved: true } } } });
      if (!supplier) throw new NotFoundError('Supplier', dto.supplierId);
      if (supplier.status === 'BLACKLISTED' || supplier.status === 'SUSPENDED') {
        throw new RuleViolationError(`Supplier ${supplier.code} is ${supplier.status}; purchase orders are not allowed`);
      }
      const approved = new Set(supplier.materials.map((m) => m.materialId));
      const unapproved = dto.lines.filter((l) => !approved.has(l.materialId));
      if (unapproved.length) throw new RuleViolationError('One or more materials are not approved for this supplier', unapproved.map((l) => ({ code: 'MATERIAL_NOT_APPROVED', message: l.materialId })));
      const number = await this.numbering.next(tx, user.tenantId, 'PO');
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: user.tenantId,
          siteId: dto.siteId,
          number,
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          notes: dto.notes,
          createdById: user.id,
          lines: { create: dto.lines.map((l) => ({ tenantId: user.tenantId, materialId: l.materialId, quantity: l.quantity, unitPrice: l.unitPrice ?? 0 })) },
        },
        include: { lines: true },
      });
      await this.audit.record(tx, { entityType: 'PurchaseOrder', entityId: po.id, entityLabel: po.number, action: 'CREATE', next: po });
      return po;
    });
  }

  async approve(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id } });
      if (!po) throw new NotFoundError('Purchase order', id);
      user.require('procurement.po.approve', po.siteId);
      assertTransition(PO_TRANSITIONS as unknown as Record<string, string[]>, 'Purchase order', po.status, 'APPROVED');
      if (po.createdById === user.id) throw new RuleViolationError('Segregation of duties: the creator of a purchase order cannot approve it');
      const after = await tx.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() } });
      await this.audit.record(tx, { entityType: 'PurchaseOrder', entityId: id, entityLabel: po.number, action: 'APPROVE', previous: { status: po.status }, next: { status: after.status } });
      return after;
    });
  }

  async cancel(user: AuthPrincipal, id: string, reason: string) {
    return this.prisma.transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id }, include: { lines: true } });
      if (!po) throw new NotFoundError('Purchase order', id);
      user.require('procurement.po.approve', po.siteId);
      if (po.lines.some((l) => Number(l.receivedQuantity) > 0)) throw new ConflictError('Cannot cancel a purchase order with receipts; close it instead');
      assertTransition(PO_TRANSITIONS as unknown as Record<string, string[]>, 'Purchase order', po.status, 'CANCELLED');
      const after = await tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      await this.audit.record(tx, { entityType: 'PurchaseOrder', entityId: id, entityLabel: po.number, action: 'VOID', previous: { status: po.status }, next: { status: 'CANCELLED' }, reason });
      return after;
    });
  }
}

@ApiTags('procurement')
@ApiBearerAuth()
@Controller('purchase-orders')
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  @Get()
  @RequirePermissions('procurement.po.view')
  list(@Query() q: FilterQueryDto) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('procurement.po.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermissions('procurement.po.create')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: CreatePoDto) {
    return this.svc.create(u, dto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('procurement.po.approve')
  approve(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approve(u, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('procurement.po.approve')
  cancel(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.svc.cancel(u, id, dto.reason);
  }
}

@Module({ controllers: [ProcurementController], providers: [ProcurementService] })
export class ProcurementModule {}
