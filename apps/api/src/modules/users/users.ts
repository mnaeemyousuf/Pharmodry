import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { ALL_PERMISSIONS, PERMISSIONS } from '@pharmodry/types';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { ListQueryDto, orderBy, pageArgs, statusFilter, textSearch, toPage } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diff } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';

class RoleAssignmentDto {
  @ApiProperty() @IsUUID() roleId: string;
  @ApiPropertyOptional({ description: 'Restrict role to a site; omit for all sites' }) @IsOptional() @IsUUID() siteId?: string;
}
class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(2) fullName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiProperty({ description: 'Initial password (≥10 chars, upper/lower/digit)' }) @IsString() password: string;
  @ApiProperty({ type: [RoleAssignmentDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => RoleAssignmentDto) roles: RoleAssignmentDto[];
}
class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}
class SetRolesDto {
  @ApiProperty({ type: [RoleAssignmentDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => RoleAssignmentDto) roles: RoleAssignmentDto[];
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}
class ResetPasswordDto {
  @ApiProperty() @IsString() password: string;
}
class RoleDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}
class RolePermissionsDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayUnique() @IsIn(ALL_PERMISSIONS, { each: true }) permissions: string[];
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  title: true,
  status: true,
  departmentId: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  department: { select: { name: true } },
  roles: { select: { id: true, siteId: true, role: { select: { id: true, code: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}

  async list(q: ListQueryDto) {
    const where = { status: statusFilter<UserStatus>(q), OR: textSearch(q.q, ['fullName', 'email', 'title']) };
    const [rows, total] = await Promise.all([
      this.prisma.db.user.findMany({ where, select: userSelect, orderBy: orderBy(q, ['fullName', 'email', 'createdAt'], { fullName: 'asc' }), ...pageArgs(q) }),
      this.prisma.db.user.count({ where }),
    ]);
    return toPage(rows, total, q);
  }

  /** Minimal directory for owner/assignee pickers (any authenticated user). */
  directory(permission?: string) {
    return this.prisma.db.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(permission ? { roles: { some: { role: { permissions: { some: { permission: { code: permission } } } } } } } : {}),
      },
      select: { id: true, fullName: true, title: true, email: true },
      orderBy: { fullName: 'asc' },
    });
  }

  private async validateRoles(roles: RoleAssignmentDto[]) {
    const roleIds = [...new Set(roles.map((r) => r.roleId))];
    const found = await this.prisma.db.role.count({ where: { id: { in: roleIds } } });
    if (found !== roleIds.length) throw new ValidationError('One or more roles do not exist');
    const siteIds = [...new Set(roles.map((r) => r.siteId).filter(Boolean) as string[])];
    if (siteIds.length && (await this.prisma.db.site.count({ where: { id: { in: siteIds } } })) !== siteIds.length) {
      throw new ValidationError('One or more sites do not exist');
    }
  }

  async create(admin: AuthPrincipal, dto: CreateUserDto) {
    const policy = this.passwords.validatePolicy(dto.password);
    if (policy) throw new ValidationError(policy);
    await this.validateRoles(dto.roles);
    const passwordHash = await this.passwords.hash(dto.password);
    return this.prisma.transaction(async (tx) => {
      if (await tx.user.findFirst({ where: { email: dto.email.toLowerCase() } })) throw new ConflictError('Email already registered');
      const user = await tx.user.create({
        data: {
          tenantId: admin.tenantId,
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          title: dto.title,
          departmentId: dto.departmentId,
          passwordHash,
          roles: { create: dto.roles.map((r) => ({ tenantId: admin.tenantId, roleId: r.roleId, siteId: r.siteId ?? null })) },
        },
        select: userSelect,
      });
      await this.audit.record(tx, { entityType: 'User', entityId: user.id, entityLabel: user.email, action: 'CREATE', next: { ...user } });
      return user;
    });
  }

  async update(admin: AuthPrincipal, id: string, dto: UpdateUserDto) {
    const { reason, ...data } = dto;
    if (id === admin.id && data.status && data.status !== 'ACTIVE') throw new ValidationError('You cannot deactivate your own account');
    return this.prisma.transaction(async (tx) => {
      const before = await tx.user.findFirst({ where: { id }, select: userSelect });
      if (!before) throw new NotFoundError('User', id);
      const after = await tx.user.update({ where: { id }, data, select: userSelect });
      if (data.status && data.status !== 'ACTIVE') {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'DEACTIVATED' } });
      }
      const [p, n] = diff(before, after);
      await this.audit.record(tx, { entityType: 'User', entityId: id, entityLabel: after.email, action: data.status ? 'STATUS_CHANGE' : 'UPDATE', previous: p, next: n, reason });
      return after;
    });
  }

  async setRoles(admin: AuthPrincipal, id: string, dto: SetRolesDto) {
    await this.validateRoles(dto.roles);
    return this.prisma.transaction(async (tx) => {
      const before = await tx.user.findFirst({ where: { id }, select: userSelect });
      if (!before) throw new NotFoundError('User', id);
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: dto.roles.map((r) => ({ tenantId: admin.tenantId, userId: id, roleId: r.roleId, siteId: r.siteId ?? null })) });
      const after = await tx.user.findFirstOrThrow({ where: { id }, select: userSelect });
      const fmt = (u: typeof before) => u.roles.map((r) => `${r.role.code}${r.siteId ? `@${r.siteId}` : ''}`).sort();
      await this.audit.record(tx, { entityType: 'User', entityId: id, entityLabel: after.email, action: 'UPDATE', previous: { roles: fmt(before) }, next: { roles: fmt(after) }, reason: dto.reason });
      return after;
    });
  }

  async unlock(_admin: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const u = await tx.user.findFirst({ where: { id } });
      if (!u) throw new NotFoundError('User', id);
      await tx.user.update({ where: { id }, data: { lockedUntil: null, failedLoginCount: 0 } });
      await this.audit.record(tx, { entityType: 'User', entityId: id, entityLabel: u.email, action: 'UPDATE', previous: { lockedUntil: u.lockedUntil }, next: { lockedUntil: null }, reason: 'Account unlocked by administrator' });
      return { ok: true };
    });
  }

  async resetPassword(_admin: AuthPrincipal, id: string, password: string) {
    const policy = this.passwords.validatePolicy(password);
    if (policy) throw new ValidationError(policy);
    const hash = await this.passwords.hash(password);
    return this.prisma.transaction(async (tx) => {
      const u = await tx.user.findFirst({ where: { id } });
      if (!u) throw new NotFoundError('User', id);
      await tx.user.update({ where: { id }, data: { passwordHash: hash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' } });
      await this.audit.record(tx, { entityType: 'User', entityId: id, entityLabel: u.email, action: 'UPDATE', next: { password: 'reset by administrator' } });
      return { ok: true };
    });
  }

  roles() {
    return this.prisma.db.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: { select: { code: true } } } }, _count: { select: { users: true } } },
    }).then((roles) => roles.map(({ permissions, ...r }) => ({ ...r, permissions: permissions.map((p) => p.permission.code).sort() })));
  }

  permissions() {
    return Object.entries(PERMISSIONS).map(([code, description]) => ({ code, description, module: code.split('.')[0] }));
  }

  async createRole(admin: AuthPrincipal, dto: RoleDto) {
    return this.prisma.transaction(async (tx) => {
      const role = await tx.role.create({ data: { ...dto, code: dto.code.toUpperCase(), tenantId: admin.tenantId } });
      await this.audit.record(tx, { entityType: 'Role', entityId: role.id, entityLabel: role.code, action: 'CREATE', next: role });
      return role;
    });
  }

  async setRolePermissions(_admin: AuthPrincipal, roleId: string, dto: RolePermissionsDto) {
    return this.prisma.transaction(async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
      if (!role) throw new NotFoundError('Role', roleId);
      const perms = await tx.permission.findMany({ where: { code: { in: dto.permissions } } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) });
      await this.audit.record(tx, {
        entityType: 'Role',
        entityId: roleId,
        entityLabel: role.code,
        action: 'UPDATE',
        previous: { permissions: role.permissions.map((p) => p.permission.code).sort() },
        next: { permissions: [...dto.permissions].sort() },
        reason: dto.reason,
      });
      return { ok: true };
    });
  }
}

@ApiTags('users & roles')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('users')
  @RequirePermissions('admin.user.manage')
  list(@Query() q: ListQueryDto) {
    return this.svc.list(q);
  }

  @Get('users/directory')
  directory(@Query('permission') permission?: string) {
    return this.svc.directory(permission);
  }

  @Post('users')
  @RequirePermissions('admin.user.manage')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: CreateUserDto) {
    return this.svc.create(u, dto);
  }

  @Patch('users/:id')
  @RequirePermissions('admin.user.manage')
  update(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(u, id, dto);
  }

  @Put('users/:id/roles')
  @RequirePermissions('admin.user.manage')
  setRoles(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolesDto) {
    return this.svc.setRoles(u, id, dto);
  }

  @Post('users/:id/unlock')
  @HttpCode(200)
  @RequirePermissions('admin.user.manage')
  unlock(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.unlock(u, id);
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  @RequirePermissions('admin.user.manage')
  reset(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(u, id, dto.password);
  }

  @Get('roles')
  roles() {
    return this.svc.roles();
  }

  @Get('permissions')
  permissions() {
    return this.svc.permissions();
  }

  @Post('roles')
  @RequirePermissions('admin.role.manage')
  createRole(@CurrentUser() u: AuthPrincipal, @Body() dto: RoleDto) {
    return this.svc.createRole(u, dto);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('admin.role.manage')
  setPerms(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RolePermissionsDto) {
    return this.svc.setRolePermissions(u, id, dto);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
