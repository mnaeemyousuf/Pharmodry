import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Deviation, Prisma, Severity } from '@prisma/client';
import { DEVIATION_TRANSITIONS, OPEN_DEVIATION_STATUSES, TenantSettings } from '@pharmodry/types';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { assertTransition, ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diff } from '../audit/audit.service';
import { NumberingService, SettingsService, UserDirectory } from '../core/core.services';
import { NotificationService } from '../notifications/notification.service';
import { SignatureDto, SignatureService } from '../signatures/signature.service';

const DAY = 86_400_000;
export const FISHBONE_CATEGORIES = ['HUMAN', 'MACHINE', 'METHOD', 'MATERIAL', 'MEASUREMENT', 'ENVIRONMENT'] as const;

class CreateDeviationDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiProperty() @IsString() @MinLength(5) title: string;
  @ApiProperty() @IsString() @MinLength(10) description: string;
  @ApiProperty() @IsString() @MinLength(3) immediateAction: string;
  @ApiProperty() @IsDateString() occurredAt: string;
  @ApiPropertyOptional({ description: 'Process stage / area, e.g. COMPRESSION' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: Severity }) @IsOptional() @IsEnum(Severity) proposedSeverity?: Severity;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() batchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() equipmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() oosId?: string;
  @ApiPropertyOptional({ description: 'Submit immediately instead of saving as draft' }) @IsOptional() @IsBoolean() submit?: boolean;
}
class UpdateDraftDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(10) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() immediateAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: Severity }) @IsOptional() @IsEnum(Severity) proposedSeverity?: Severity;
}
class ClassifyDto {
  @ApiProperty({ enum: Severity }) @IsEnum(Severity) classification: Severity;
  @ApiProperty() @IsUUID() ownerId: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiProperty() @IsString() @MinLength(5) qaReviewNotes: string;
}
class InvestigationDto {
  @ApiProperty() @IsString() @MinLength(10) investigationSummary: string;
  @ApiProperty() @IsString() @MinLength(5) impactAssessment: string;
}
class WhyDto {
  @ApiProperty() @IsString() question: string;
  @ApiProperty() @IsString() answer: string;
}
class RootCauseDto {
  @ApiProperty({ type: [WhyDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => WhyDto) fiveWhys: WhyDto[];
  @ApiProperty({ description: 'HUMAN/MACHINE/METHOD/MATERIAL/MEASUREMENT/ENVIRONMENT → causes[]' }) @IsObject() fishbone: Record<string, string[]>;
  @ApiProperty({ enum: FISHBONE_CATEGORIES }) @IsString() primaryCategory: string;
  @ApiProperty() @IsString() @MinLength(10) statement: string;
}
class CapaDecisionDto {
  @ApiProperty() @IsBoolean() capaRequired: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(10) noCapaJustification?: string;
}
class CloseDeviationDto extends SignatureDto {
  @ApiProperty() @IsString() @MinLength(10) effectivenessSummary: string;
}
class CancelDto {
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export function agingOf(d: Pick<Deviation, 'status' | 'submittedAt' | 'createdAt' | 'dueDate'>, s: TenantSettings) {
  const open = (OPEN_DEVIATION_STATUSES as string[]).includes(d.status);
  const ageDays = Math.floor((Date.now() - (d.submittedAt ?? d.createdAt).getTime()) / DAY);
  const pastDue = open && !!d.dueDate && d.dueDate.getTime() < Date.now();
  const bucket = !open ? 'CLOSED' : pastDue || ageDays > s.deviationAging.overdueAfterDays ? 'OVERDUE' : ageDays > s.deviationAging.attentionAfterDays ? 'ATTENTION' : 'NORMAL';
  return { ageDays, aging: bucket, overdue: bucket === 'OVERDUE' };
}

@Injectable()
export class DeviationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationService,
    private readonly signatures: SignatureService,
    private readonly users: UserDirectory,
  ) {}

  async list(user: AuthPrincipal, q: FilterQueryDto) {
    const s = await this.settings.get(user.tenantId);
    const where: Prisma.DeviationWhereInput = {
      status: statusFilter(q) ?? (q.view === 'open' || q.view === 'overdue' ? { in: OPEN_DEVIATION_STATUSES } : undefined),
      classification: (q.severity as Severity) || undefined,
      batchId: q.batchId || undefined,
      productId: q.productId || undefined,
      siteId: q.siteId || undefined,
      category: q.type || undefined,
      ownerId: q.ownerId || undefined,
      createdAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
      ...(q.q ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    let rows = await this.prisma.db.deviation.findMany({ where, orderBy: orderBy(q, ['number', 'createdAt', 'dueDate', 'status', 'classification'], { createdAt: 'desc' }) });
    let decorated = rows.map((d) => ({ ...d, ...agingOf(d, s) }));
    if (q.view === 'overdue') decorated = decorated.filter((d) => d.overdue);
    const total = decorated.length;
    decorated = decorated.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    rows = [];
    const batches = await this.prisma.db.batch.findMany({ where: { id: { in: decorated.map((d) => d.batchId).filter(Boolean) as string[] } }, select: { id: true, batchNumber: true } });
    const withBatch = decorated.map((d) => ({ ...d, batchNumber: batches.find((b) => b.id === d.batchId)?.batchNumber ?? null }));
    return toPage(await this.users.decorate(withBatch, ['ownerId', 'reportedById']), total, q);
  }

  async get(user: AuthPrincipal, id: string) {
    const d = await this.prisma.db.deviation.findFirst({ where: { id } });
    if (!d) throw new NotFoundError('Deviation', id);
    const s = await this.settings.get(user.tenantId);
    const [rca, capas, product, batch, material, equipment, oos, signatures, site, department] = await Promise.all([
      this.prisma.db.rootCauseAnalysis.findMany({ where: { deviationId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.db.capa.findMany({ where: { deviationId: id }, include: { actions: true } }),
      d.productId ? this.prisma.db.product.findFirst({ where: { id: d.productId }, select: { id: true, code: true, genericName: true, strength: true } }) : null,
      d.batchId ? this.prisma.db.batch.findFirst({ where: { id: d.batchId }, select: { id: true, batchNumber: true, status: true } }) : null,
      d.materialId ? this.prisma.db.material.findFirst({ where: { id: d.materialId }, select: { id: true, code: true, name: true } }) : null,
      d.equipmentId ? this.prisma.db.equipment.findFirst({ where: { id: d.equipmentId }, select: { id: true, code: true, description: true } }) : null,
      d.oosId ? this.prisma.db.oosInvestigation.findFirst({ where: { id: d.oosId }, select: { id: true, number: true, status: true } }) : null,
      this.signatures.forEntity('Deviation', id),
      this.prisma.db.site.findFirst({ where: { id: d.siteId }, select: { code: true, name: true } }),
      d.departmentId ? this.prisma.db.department.findFirst({ where: { id: d.departmentId }, select: { name: true } }) : null,
    ]);
    return this.users.decorateOne(
      { ...d, ...agingOf(d, s), rootCauseAnalyses: await this.users.decorate(rca, ['createdById', 'approvedById']), capas, product, batch, material, equipment, oos, signatures, site, department },
      ['ownerId', 'reportedById', 'closedById'],
    );
  }

  private async load(tx: Tx, id: string) {
    const d = await tx.deviation.findFirst({ where: { id } });
    if (!d) throw new NotFoundError('Deviation', id);
    return d;
  }

  private async move(tx: Tx, d: Deviation, to: Deviation['status'], data: Prisma.DeviationUpdateInput, reason?: string, signatureId?: string) {
    assertTransition(DEVIATION_TRANSITIONS, 'Deviation', d.status, to);
    const after = await tx.deviation.update({ where: { id: d.id }, data: { ...data, status: to } });
    const [p, n] = diff(d, after);
    await this.audit.record(tx, { entityType: 'Deviation', entityId: d.id, entityLabel: d.number, action: signatureId ? 'APPROVE' : 'STATUS_CHANGE', previous: p, next: n, reason, signatureId });
    return after;
  }

  async create(user: AuthPrincipal, dto: CreateDeviationDto) {
    user.require('deviation.create', dto.siteId);
    if (new Date(dto.occurredAt) > new Date()) throw new ValidationError('Occurrence date cannot be in the future');
    return this.prisma.transaction(async (tx) => {
      if (dto.batchId) {
        const b = await tx.batch.findFirst({ where: { id: dto.batchId } });
        if (!b) throw new NotFoundError('Batch', dto.batchId);
        dto.productId = dto.productId ?? b.productId;
      }
      const number = await this.numbering.next(tx, user.tenantId, 'DEVIATION');
      const { submit, ...data } = dto;
      const d = await tx.deviation.create({
        data: { ...data, tenantId: user.tenantId, number, occurredAt: new Date(dto.occurredAt), reportedById: user.id, status: submit ? 'SUBMITTED' : 'DRAFT', submittedAt: submit ? new Date() : null },
      });
      if (dto.oosId) await tx.oosInvestigation.update({ where: { id: dto.oosId }, data: { deviationId: d.id } });
      await this.audit.record(tx, { entityType: 'Deviation', entityId: d.id, entityLabel: number, action: 'CREATE', next: d });
      if (submit) await this.notifySubmitted(tx, d);
      return d;
    });
  }

  private notifySubmitted(tx: Tx, d: Deviation) {
    return this.notifications.notify(tx, {
      tenantId: d.tenantId,
      event: 'ASSIGNMENT',
      severity: d.proposedSeverity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      title: `Deviation ${d.number} submitted for QA review`,
      body: d.title,
      entityType: 'Deviation',
      entityId: d.id,
      link: `/quality/deviations/${d.id}`,
      permission: 'deviation.approve',
      siteId: d.siteId,
    });
  }

  async updateDraft(user: AuthPrincipal, id: string, dto: UpdateDraftDto) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      if (d.status !== 'DRAFT') throw new ConflictError('Only drafts can be edited; later changes are recorded through the workflow');
      if (d.reportedById !== user.id && !user.has('deviation.approve', d.siteId)) throw new RuleViolationError('Only the reporter or QA may edit a draft');
      const after = await tx.deviation.update({ where: { id }, data: dto });
      const [p, n] = diff(d, after);
      await this.audit.record(tx, { entityType: 'Deviation', entityId: id, entityLabel: d.number, action: 'UPDATE', previous: p, next: n });
      return after;
    });
  }

  async submit(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.create', d.siteId);
      const after = await this.move(tx, d, 'SUBMITTED', { submittedAt: new Date() });
      await this.notifySubmitted(tx, after);
      return after;
    });
  }

  async startReview(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.approve', d.siteId);
      return this.move(tx, d, 'QA_REVIEW', {});
    });
  }

  async classify(user: AuthPrincipal, id: string, dto: ClassifyDto) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.approve', d.siteId);
      const owner = await tx.user.findFirst({ where: { id: dto.ownerId, status: 'ACTIVE' } });
      if (!owner) throw new ValidationError('Owner must be an active user');
      const s = await this.settings.get(d.tenantId, tx);
      const due = dto.dueDate ? new Date(dto.dueDate) : new Date((d.submittedAt ?? d.createdAt).getTime() + s.deviationDueDays[dto.classification] * DAY);
      const after = await this.move(tx, d, 'INVESTIGATION', { classification: dto.classification, ownerId: dto.ownerId, dueDate: due, qaReviewNotes: dto.qaReviewNotes });
      await this.notifications.notify(tx, {
        tenantId: d.tenantId,
        event: 'ASSIGNMENT',
        severity: dto.classification === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `You own deviation ${d.number} (${dto.classification})`,
        body: `${d.title}. Investigation due ${due.toISOString().slice(0, 10)}.`,
        entityType: 'Deviation',
        entityId: d.id,
        link: `/quality/deviations/${d.id}`,
        userIds: [dto.ownerId],
      });
      return after;
    });
  }

  async investigation(user: AuthPrincipal, id: string, dto: InvestigationDto) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.investigate', d.siteId);
      return this.move(tx, d, 'ROOT_CAUSE', { investigationSummary: dto.investigationSummary, impactAssessment: dto.impactAssessment });
    });
  }

  /** Saves a structured RCA. Each save is a new record (history retained). AI drafts are never stored here automatically. */
  async rootCause(user: AuthPrincipal, id: string, dto: RootCauseDto) {
    if (!(FISHBONE_CATEGORIES as readonly string[]).includes(dto.primaryCategory)) throw new ValidationError('Unknown fishbone category');
    const badKeys = Object.keys(dto.fishbone).filter((k) => !(FISHBONE_CATEGORIES as readonly string[]).includes(k));
    if (badKeys.length) throw new ValidationError(`Unknown fishbone categories: ${badKeys.join(', ')}`);
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.investigate', d.siteId);
      if (d.status !== 'ROOT_CAUSE') throw new ConflictError(`Root cause is documented during the ROOT_CAUSE phase (current: ${d.status})`);
      const rca = await tx.rootCauseAnalysis.create({
        data: {
          tenantId: d.tenantId,
          deviationId: id,
          fiveWhys: dto.fiveWhys as unknown as Prisma.InputJsonValue,
          fishbone: dto.fishbone as Prisma.InputJsonValue,
          primaryCategory: dto.primaryCategory,
          statement: dto.statement,
          createdById: user.id,
        },
      });
      await this.audit.record(tx, { entityType: 'Deviation', entityId: id, entityLabel: d.number, action: 'UPDATE', next: { rootCause: dto.statement, category: dto.primaryCategory, whys: dto.fiveWhys.length } });
      return rca;
    });
  }

  async approveRootCause(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.approve', d.siteId);
      const rca = await tx.rootCauseAnalysis.findFirst({ where: { deviationId: id }, orderBy: { createdAt: 'desc' } });
      if (!rca) throw new RuleViolationError('Document the root cause analysis before approval');
      await tx.rootCauseAnalysis.update({ where: { id: rca.id }, data: { approvedById: user.id, approvedAt: new Date() } });
      return this.move(tx, d, 'CAPA', {}, `Root cause approved: ${rca.statement}`);
    });
  }

  async capaDecision(user: AuthPrincipal, id: string, dto: CapaDecisionDto) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.approve', d.siteId);
      if (dto.capaRequired) {
        const n = await tx.capa.count({ where: { deviationId: id, status: { not: 'CANCELLED' } } });
        if (n === 0) throw new RuleViolationError('Create at least one CAPA linked to this deviation first', [{ code: 'CAPA_MISSING', message: 'No CAPA linked', href: `/quality/capa/new?deviationId=${id}` }]);
      } else {
        if (d.classification === 'CRITICAL') throw new RuleViolationError('A CAPA is mandatory for critical deviations');
        if (!dto.noCapaJustification) throw new ValidationError('Justify why no CAPA is required');
      }
      return this.move(tx, d, 'EFFECTIVENESS_CHECK', { capaRequired: dto.capaRequired, noCapaJustification: dto.noCapaJustification ?? null });
    });
  }

  async close(user: AuthPrincipal, id: string, dto: CloseDeviationDto) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      user.require('deviation.approve', d.siteId);
      assertTransition(DEVIATION_TRANSITIONS, 'Deviation', d.status, 'CLOSED');
      if (d.capaRequired) {
        const capas = await tx.capa.findMany({ where: { deviationId: id, status: { not: 'CANCELLED' } } });
        const notReady = capas.filter((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS');
        if (notReady.length) {
          throw new RuleViolationError('Linked CAPA actions must be completed before closure', notReady.map((c) => ({ code: 'CAPA_OPEN', message: `${c.number} is ${c.status}`, href: `/quality/capa/${c.id}` })));
        }
      }
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'Deviation',
        entityId: id,
        entityLabel: d.number,
        action: 'DEVIATION_CLOSURE',
        meaning: 'QA approval: deviation investigation, root cause and CAPA are adequate; deviation closed',
        record: d,
      });
      return this.move(tx, d, 'CLOSED', { effectivenessSummary: dto.effectivenessSummary, closedAt: new Date(), closedById: user.id }, dto.reason, signature.id);
    });
  }

  async cancel(user: AuthPrincipal, id: string, reason: string) {
    return this.prisma.transaction(async (tx) => {
      const d = await this.load(tx, id);
      if (!user.has('deviation.approve', d.siteId) && !(d.status === 'DRAFT' && d.reportedById === user.id)) throw new RuleViolationError('Only QA can cancel a submitted deviation');
      return this.move(tx, d, 'CANCELLED', { cancelReason: reason }, reason);
    });
  }
}

@ApiTags('deviations')
@ApiBearerAuth()
@Controller('deviations')
export class DeviationsController {
  constructor(private readonly svc: DeviationsService) {}

  @Get()
  @RequirePermissions('deviation.view')
  list(@CurrentUser() u: AuthPrincipal, @Query() q: FilterQueryDto) {
    return this.svc.list(u, q);
  }

  @Get(':id')
  @RequirePermissions('deviation.view')
  get(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(u, id);
  }

  @Post()
  @RequirePermissions('deviation.create')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: CreateDeviationDto) {
    return this.svc.create(u, dto);
  }

  @Patch(':id')
  @RequirePermissions('deviation.create')
  update(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDraftDto) {
    return this.svc.updateDraft(u, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions('deviation.create')
  submit(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.submit(u, id);
  }

  @Post(':id/start-review')
  @HttpCode(200)
  @RequirePermissions('deviation.approve')
  startReview(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.startReview(u, id);
  }

  @Post(':id/classify')
  @HttpCode(200)
  @RequirePermissions('deviation.approve')
  classify(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ClassifyDto) {
    return this.svc.classify(u, id, dto);
  }

  @Post(':id/investigation')
  @HttpCode(200)
  @RequirePermissions('deviation.investigate')
  investigation(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InvestigationDto) {
    return this.svc.investigation(u, id, dto);
  }

  @Post(':id/root-cause')
  @RequirePermissions('deviation.investigate')
  rootCause(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RootCauseDto) {
    return this.svc.rootCause(u, id, dto);
  }

  @Post(':id/approve-root-cause')
  @HttpCode(200)
  @RequirePermissions('deviation.approve')
  approveRc(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approveRootCause(u, id);
  }

  @Post(':id/capa-decision')
  @HttpCode(200)
  @RequirePermissions('deviation.approve')
  capaDecision(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CapaDecisionDto) {
    return this.svc.capaDecision(u, id, dto);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions('deviation.approve')
  close(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseDeviationDto) {
    return this.svc.close(u, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('deviation.create')
  cancel(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.svc.cancel(u, id, dto.reason);
  }
}

@Module({ controllers: [DeviationsController], providers: [DeviationsService], exports: [DeviationsService] })
export class DeviationsModule {}
