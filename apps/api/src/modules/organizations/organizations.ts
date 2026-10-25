import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, WarehouseType } from '@prisma/client';
import { DEFAULT_TENANT_SETTINGS, mergeSettings } from '@pharmodry/types';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { NotFoundError, ValidationError } from '../../common/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diff } from '../audit/audit.service';

class UpdateSettingsDto {
  @ApiProperty({ description: 'Partial TenantSettings object' }) @IsObject() settings: Record<string, unknown>;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}
class SiteDto {
  @ApiProperty() @IsString() @MaxLength(20) code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
class DepartmentDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() siteId?: string;
}
class WarehouseDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: WarehouseType }) @IsEnum(WarehouseType) type: WarehouseType;
  @ApiPropertyOptional() @IsOptional() @IsString() conditions?: string;
}
class BinDto {
  @ApiProperty() @IsString() code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

const ALLOWED_SETTING_KEYS = new Set(Object.keys(DEFAULT_TENANT_SETTINGS).filter((k) => k !== 'receiptDefaultStatus'));

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async tenant(tenantId: string) {
    const t = await this.prisma.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return { ...t, settings: mergeSettings(t.settings) };
  }

  async updateSettings(user: AuthPrincipal, dto: UpdateSettingsDto) {
    const unknownKeys = Object.keys(dto.settings).filter((k) => !ALLOWED_SETTING_KEYS.has(k));
    if (unknownKeys.length) throw new ValidationError(`Unknown or protected settings: ${unknownKeys.join(', ')}`);
    return this.prisma.transaction(async (tx) => {
      const t = await tx.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
      const before = mergeSettings(t.settings);
      const after = mergeSettings({ ...before, ...dto.settings });
      const y = after.yieldTolerance;
      if (y.minPct <= 0 || y.maxPct <= y.minPct) throw new ValidationError('Yield tolerance must satisfy 0 < min < max');
      await tx.tenant.update({ where: { id: user.tenantId }, data: { settings: after as unknown as Prisma.InputJsonValue } });
      const [p, n] = diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
      await this.audit.record(tx, { entityType: 'TenantSettings', entityId: user.tenantId, entityLabel: t.name, action: 'UPDATE', previous: p, next: n, reason: dto.reason });
      return after;
    });
  }

  sites() {
    return this.prisma.db.site.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { warehouses: true } } } });
  }

  async createSite(user: AuthPrincipal, dto: SiteDto) {
    return this.prisma.transaction(async (tx) => {
      const site = await tx.site.create({ data: { ...dto, tenantId: user.tenantId } });
      await this.audit.record(tx, { entityType: 'Site', entityId: site.id, entityLabel: site.code, action: 'CREATE', next: site });
      return site;
    });
  }

  async updateSite(_user: AuthPrincipal, id: string, dto: Partial<SiteDto>) {
    return this.prisma.transaction(async (tx) => {
      const before = await tx.site.findFirst({ where: { id } });
      if (!before) throw new NotFoundError('Site', id);
      const after = await tx.site.update({ where: { id }, data: dto });
      const [p, n] = diff(before, after);
      await this.audit.record(tx, { entityType: 'Site', entityId: id, entityLabel: after.code, action: 'UPDATE', previous: p, next: n });
      return after;
    });
  }

  departments() {
    return this.prisma.db.department.findMany({ orderBy: { name: 'asc' } });
  }

  async createDepartment(user: AuthPrincipal, dto: DepartmentDto) {
    return this.prisma.transaction(async (tx) => {
      const d = await tx.department.create({ data: { ...dto, tenantId: user.tenantId } });
      await this.audit.record(tx, { entityType: 'Department', entityId: d.id, entityLabel: d.code, action: 'CREATE', next: d });
      return d;
    });
  }

  warehouses(siteId?: string) {
    return this.prisma.db.warehouse.findMany({
      where: { siteId: siteId || undefined },
      orderBy: { code: 'asc' },
      include: { site: { select: { code: true, name: true } }, bins: { where: { isActive: true }, orderBy: { code: 'asc' } } },
    });
  }

  async createWarehouse(user: AuthPrincipal, dto: WarehouseDto) {
    return this.prisma.transaction(async (tx) => {
      const site = await tx.site.findFirst({ where: { id: dto.siteId } });
      if (!site) throw new NotFoundError('Site', dto.siteId);
      const w = await tx.warehouse.create({ data: { ...dto, tenantId: user.tenantId } });
      await this.audit.record(tx, { entityType: 'Warehouse', entityId: w.id, entityLabel: w.code, action: 'CREATE', next: w });
      return w;
    });
  }

  async createBin(user: AuthPrincipal, warehouseId: string, dto: BinDto) {
    return this.prisma.transaction(async (tx) => {
      const w = await tx.warehouse.findFirst({ where: { id: warehouseId } });
      if (!w) throw new NotFoundError('Warehouse', warehouseId);
      const b = await tx.binLocation.create({ data: { ...dto, warehouseId, tenantId: user.tenantId } });
      await this.audit.record(tx, { entityType: 'BinLocation', entityId: b.id, entityLabel: `${w.code}/${b.code}`, action: 'CREATE', next: b });
      return b;
    });
  }

  productionLines() {
    return this.prisma.db.productionLine.findMany({ orderBy: { code: 'asc' } });
  }
}

@ApiTags('organization')
@ApiBearerAuth()
@Controller()
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  @Get('organization')
  tenant(@CurrentUser() user: AuthPrincipal) {
    return this.svc.tenant(user.tenantId);
  }

  @Patch('organization/settings')
  @RequirePermissions('admin.tenant.manage')
  updateSettings(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateSettingsDto) {
    return this.svc.updateSettings(user, dto);
  }

  @Get('sites')
  sites() {
    return this.svc.sites();
  }

  @Post('sites')
  @RequirePermissions('admin.site.manage')
  createSite(@CurrentUser() user: AuthPrincipal, @Body() dto: SiteDto) {
    return this.svc.createSite(user, dto);
  }

  @Patch('sites/:id')
  @RequirePermissions('admin.site.manage')
  updateSite(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteDto) {
    return this.svc.updateSite(user, id, dto);
  }

  @Get('departments')
  departments() {
    return this.svc.departments();
  }

  @Post('departments')
  @RequirePermissions('admin.site.manage')
  createDepartment(@CurrentUser() user: AuthPrincipal, @Body() dto: DepartmentDto) {
    return this.svc.createDepartment(user, dto);
  }

  @Get('warehouses')
  warehouses(@Query('siteId') siteId?: string) {
    return this.svc.warehouses(siteId);
  }

  @Post('warehouses')
  @RequirePermissions('admin.site.manage')
  createWarehouse(@CurrentUser() user: AuthPrincipal, @Body() dto: WarehouseDto) {
    return this.svc.createWarehouse(user, dto);
  }

  @Post('warehouses/:id/bins')
  @RequirePermissions('admin.site.manage')
  createBin(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BinDto) {
    return this.svc.createBin(user, id, dto);
  }

  @Get('production-lines')
  lines() {
    return this.svc.productionLines();
  }
}

@Module({ controllers: [OrganizationsController], providers: [OrganizationsService], exports: [OrganizationsService] })
export class OrganizationsModule {}
