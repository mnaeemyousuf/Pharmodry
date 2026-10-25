import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Capa, CapaActionType, CapaSource, Prisma, Priority } from '@prisma/client';
import { CAPA_TRANSITIONS, OPEN_CAPA_STATUSES } from '@pharmodry/types';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { assertTransition, ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diff } from '../audit/audit.service';
import { NumberingService, UserDirectory } from '../core/core.services';
import { NotificationService } from '../notifications/notification.service';
import { SignatureDto, SignatureService } from '../signatures/signature.service';

const DAY = 86_400_000;

class ActionDto {
  @ApiProperty({ enum: CapaActionType }) @IsEnum(CapaActionType) type: CapaActionType;
  @ApiProperty() @IsString() @MinLength(5) description: string;
  @ApiProperty() @IsUUID() ownerId: string;
  @ApiProperty() @IsDateString() dueDate: string;
  @ApiPropertyOptional({ description: 'Set when the user accepted an AI-drafted suggestion (traceability)' }) @IsOptional() @IsBoolean() aiSuggested?: boolean;
}
class CreateCapaDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty({ enum: CapaSource }) @IsEnum(CapaSource) source: CapaSource;
  @ApiPropertyOptional() @IsOptional() @IsUUID() deviationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() oosId?: string;
  @ApiProperty() @IsString() @MinLength(10) problemStatement: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rootCause?: string;
  @ApiProperty({ enum: Priority }) @IsEnum(Priority) priority: Priority;
  @ApiProperty() @IsUUID() ownerId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiProperty() @IsDateString() dueDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectivenessCriteria?: string;
  @ApiPropertyOptional({ type: [ActionDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActionDto) actions?: ActionDto[];
}
class CompleteActionDto {
  @ApiProperty({ description: 'Objective evidence of completion' }) @IsString() @MinLength(5) evidence: string;
}
class EffectivenessDto {
  @ApiProperty() @IsBoolean() effective: boolean;
  @ApiProperty() @IsString() @MinLength(10) result: string;
}
class CancelDto {
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

@Injectable()
export class CapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly notifications: NotificationService,
    private readonly signatures: SignatureService,
    private readonly users: UserDirectory,
  ) {}

  private decorate(c: Capa) {
    const open = (OPEN_CAPA_STATUSES as string[]).includes(c.status);
    return { ...c, overdue: open && c.dueDate < new Date(), ageDays: Math.floor((Date.now() - c.createdAt.getTime()) / DAY) };
  }

  async list(q: FilterQueryDto) {
    const where: Prisma.CapaWhereInput = {
      status: statusFilter(q) ?? (q.view === 'open' ? { in: OPEN_CAPA_STATUSES } : undefined),
      ...(q.view === 'overdue' ? { status: { in: OPEN_CAPA_STATUSES }, dueDate: { lt: new Date() } } : {}),
      priority: (q.severity as Priority) || undefined,
      ownerId: q.ownerId || undefined,
      siteId: q.siteId || undefined,
      source: (q.type as CapaSource) || undefined,
      ...(q.q ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { problemStatement: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.capa.findMany({ where, include: { actions: { select: { status: true } } }, orderBy: orderBy(q, ['number', 'dueDate', 'priority', 'status', 'createdAt'], { dueDate: 'asc' }), skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.db.capa.count({ where }),
    ]);
    const rowsOut = rows.map((c) => ({
      ...this.decorate(c),
      actionsTotal: c.actions.length,
      actionsDone: c.actions.filter((a) => a.status === 'COMPLETED').length,
    }));
    return toPage(await this.users.decorate(rowsOut, ['ownerId']), total, q);
  }

  async get(id: string) {
    const c = await this.prisma.db.capa.findFirst({ where: { id }, include: { actions: { orderBy: { createdAt: 'asc' } } } });
    if (!c) throw new NotFoundError('CAPA', id);
    const [deviation, oos, signatures, department] = await Promise.all([
      c.deviationId ? this.prisma.db.deviation.findFirst({ where: { id: c.deviationId }, select: { id: true, number: true, title: true, status: true } }) : null,
      c.oosId ? this.prisma.db.oosInvestigation.findFirst({ where: { id: c.oosId }, select: { id: true, number: true, testName: true, status: true } }) : null,
      this.signatures.forEntity('Capa', id),
      c.departmentId ? this.prisma.db.department.findFirst({ where: { id: c.departmentId }, select: { name: true } }) : null,
    ]);
    return this.users.decorateOne(
      { ...this.decorate(c), actions: await this.users.decorate(c.actions, ['ownerId', 'completedById']), deviation, oos, signatures, department },
      ['ownerId', 'createdById', 'closedById', 'effectivenessCheckedById'],
    );
  }

  private async load(tx: Tx, id: string) {
    const c = await tx.capa.findFirst({ where: { id } });
    if (!c) throw new NotFoundError('CAPA', id);
    return c;
  }

  private async move(tx: Tx, c: Capa, to: Capa['status'], data: Prisma.CapaUpdateInput = {}, reason?: string, signatureId?: string) {
    assertTransition(CAPA_TRANSITIONS, 'CAPA', c.status, to);
    const after = await tx.capa.update({ where: { id: c.id }, data: { ...data, status: to } });
    const [p, n] = diff(c, after);
    await this.audit.record(tx, { entityType: 'Capa', entityId: c.id, entityLabel: c.number, action: signatureId ? 'APPROVE' : 'STATUS_CHANGE', previous: p, next: n, reason, signatureId });
    return after;
  }

  async create(user: AuthPrincipal, dto: CreateCapaDto) {
    user.require('capa.create', dto.siteId);
    if (dto.source === 'DEVIATION' && !dto.deviationId) throw new ValidationError('A deviation-sourced CAPA must reference the deviation');
    if (dto.source === 'OOS' && !dto.oosId) throw new ValidationError('An OOS-sourced CAPA must reference the OOS investigation');
    return this.prisma.transaction(async (tx) => {
      if (dto.deviationId && !(await tx.deviation.findFirst({ where: { id: dto.deviationId } }))) throw new NotFoundError('Deviation', dto.deviationId);
      if (dto.oosId && !(await tx.oosInvestigation.findFirst({ where: { id: dto.oosId } }))) throw new NotFoundError('OOS investigation', dto.oosId);
      const userIds = [dto.ownerId, ...(dto.actions ?? []).map((a) => a.ownerId)];
      if ((await tx.user.count({ where: { id: { in: [...new Set(userIds)] }, status: 'ACTIVE' } })) !== new Set(userIds).size) throw new ValidationError('Owners must be active users');
      const number = await this.numbering.next(tx, user.tenantId, 'CAPA');
      const { actions, ...data } = dto;
      const c = await tx.capa.create({
        data: {
          ...data,
          tenantId: user.tenantId,
          number,
          dueDate: new Date(dto.dueDate),
          createdById: user.id,
          actions: {
            create: (actions ?? []).map((a) => ({ tenantId: user.tenantId, type: a.type, description: a.description, ownerId: a.ownerId, dueDate: new Date(a.dueDate), aiSuggested: a.aiSuggested ?? false })),
          },
        },
        include: { actions: true },
      });
      await this.audit.record(tx, { entityType: 'Capa', entityId: c.id, entityLabel: number, action: 'CREATE', next: c });
      await this.notifications.notify(tx, {
        tenantId: user.tenantId,
        event: 'ASSIGNMENT',
        severity: dto.priority === 'CRITICAL' || dto.priority === 'HIGH' ? 'WARNING' : 'INFO',
        title: `CAPA ${number} assigned`,
        body: dto.problemStatement.slice(0, 200),
        entityType: 'Capa',
        entityId: c.id,
        link: `/quality/capa/${c.id}`,
        userIds: [...new Set(userIds)],
      });
      return c;
    });
  }

  async addAction(user: AuthPrincipal, id: string, dto: ActionDto) {
    return this.prisma.transaction(async (tx) => {
      const c = await this.load(tx, id);
      user.require('capa.manage', c.siteId);
      if (!['OPEN', 'IN_PROGRESS'].includes(c.status)) throw new ConflictError(`Actions cannot be added while CAPA is ${c.status}`);
      const a = await tx.capaAction.create({ data: { tenantId: c.tenantId, capaId: id, type: dto.type, description: dto.description, ownerId: dto.ownerId, dueDate: new Date(dto.dueDate), aiSuggested: dto.aiSuggested ?? false } });
      await this.audit.record(tx, { entityType: 'Capa', entityId: id, entityLabel: c.number, action: 'UPDATE', next: { actionAdded: dto.description, type: dto.type, aiSuggested: dto.aiSuggested ?? false } });
      return a;
    });
  }

  async completeAction(user: AuthPrincipal, id: string, actionId: string, dto: CompleteActionDto) {
    return this.prisma.transaction(async (tx) => {
      const c = await this.load(tx, id);
      const a = await tx.capaAction.findFirst({ where: { id: actionId, capaId: id } });
      if (!a) throw new NotFoundError('CAPA action', actionId);
      if (a.ownerId !== user.id && !user.has('capa.manage', c.siteId)) throw new RuleViolationError('Only the action owner or a CAPA manager can complete this action');
      if (a.status !== 'OPEN') throw new ConflictError(`Action is ${a.status}`);
      await tx.capaAction.update({ where: { id: actionId }, data: { status: 'COMPLETED', evidence: dto.evidence, completedAt: new Date(), completedById: user.id } });
      await this.audit.record(tx, { entityType: 'Capa', entityId: id, entityLabel: c.number, action: 'UPDATE', previous: { action: a.description, status: 'OPEN' }, next: { status: 'COMPLETED', evidence: dto.evidence } });
      if (c.status === 'OPEN') await this.move(tx, c, 'IN_PROGRESS');
      return { ok: true };
    });
  }

  async submitForEffectiveness(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const c = await this.load(tx, id);
      user.require('capa.manage', c.siteId);
      const actions = await tx.capaAction.findMany({ where: { capaId: id } });
      const open = actions.filter((a) => a.status === 'OPEN');
      if (open.length) throw new RuleViolationError('All actions must be completed first', open.map((a) => ({ code: 'ACTION_OPEN', message: a.description })));
      if (!actions.some((a) => a.status === 'COMPLETED')) throw new RuleViolationError('At least one completed action is required');
      return this.move(tx, c, 'EFFECTIVENESS_CHECK');
    });
  }

  /** Effectiveness verification. A failed check returns the CAPA to IN_PROGRESS and counts as a failure. */
  async effectiveness(user: AuthPrincipal, id: string, dto: EffectivenessDto) {
    return this.prisma.transaction(async (tx) => {
      const c = await this.load(tx, id);
      user.require('capa.verify', c.siteId);
      if (c.status !== 'EFFECTIVENESS_CHECK') throw new ConflictError(`CAPA is ${c.status}`);
      const data = { effectivenessEffective: dto.effective, effectivenessResult: dto.result, effectivenessCheckedAt: new Date(), effectivenessCheckedById: user.id };
      if (dto.effective) {
        const after = await tx.capa.update({ where: { id }, data });
        await this.audit.record(tx, { entityType: 'Capa', entityId: id, entityLabel: c.number, action: 'UPDATE', next: { effectiveness: 'EFFECTIVE', result: dto.result } });
        return after;
      }
      return this.move(tx, c, 'IN_PROGRESS', { ...data, effectivenessFailures: { increment: 1 } }, `Effectiveness check failed: ${dto.result}`);
    });
  }

  async close(user: AuthPrincipal, id: string, dto: SignatureDto) {
    return this.prisma.transaction(async (tx) => {
      const c = await this.load(tx, id);
      user.require('capa.close', c.siteId);
      if (c.status !== 'EFFECTIVENESS_CHECK' || c.effectivenessEffective !== true) throw new RuleViolationError('A CAPA can only be closed after a successful effectiveness check');
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'Capa',
        entityId: id,
        entityLabel: c.number,
        action: 'CAPA_CLOSURE',
        meaning: 'QA approval: CAPA actions implemented and verified effective; CAPA closed',
        record: c,
      });
      return this.move(tx, c, 'CLOSED', { closedAt: new Date(), closedById: user.id }, dto.reason, signature.id);
    });
  }

  async cancel(user: AuthPrincipal, id: string, reason: string) {
    return this.prisma.transaction(async (tx) => {
      const c = await this.load(tx, id);
      user.require('capa.close', c.siteId);
      return this.move(tx, c, 'CANCELLED', {}, reason);
    });
  }
}

@ApiTags('capa')
@ApiBearerAuth()
@Controller('capas')
export class CapaController {
  constructor(private readonly svc: CapaService) {}

  @Get()
  @RequirePermissions('capa.view')
  list(@Query() q: FilterQueryDto) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('capa.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermissions('capa.create')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: CreateCapaDto) {
    return this.svc.create(u, dto);
  }

  @Post(':id/actions')
  @RequirePermissions('capa.manage')
  addAction(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto) {
    return this.svc.addAction(u, id, dto);
  }

  @Post(':id/actions/:actionId/complete')
  @HttpCode(200)
  completeAction(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Param('actionId', ParseUUIDPipe) actionId: string, @Body() dto: CompleteActionDto) {
    return this.svc.completeAction(u, id, actionId, dto);
  }

  @Post(':id/submit-effectiveness')
  @HttpCode(200)
  @RequirePermissions('capa.manage')
  submit(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.submitForEffectiveness(u, id);
  }

  @Post(':id/effectiveness')
  @HttpCode(200)
  @RequirePermissions('capa.verify')
  effectiveness(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EffectivenessDto) {
    return this.svc.effectiveness(u, id, dto);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions('capa.close')
  close(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SignatureDto) {
    return this.svc.close(u, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('capa.close')
  cancel(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.svc.cancel(u, id, dto.reason);
  }
}

@Module({ controllers: [CapaController], providers: [CapaService] })
export class CapaModule {}
