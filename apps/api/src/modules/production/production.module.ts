import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { sendCsv, toCsv } from '../../common/csv';
import { FilterQueryDto } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { InventoryModule } from '../inventory/inventory.module';
import { SignatureDto } from '../signatures/signature.service';
import { BatchesService } from './batches.service';
import { EbmrService } from './ebmr.service';
import { PlansService } from './plans.service';
import { AvailabilityQueryDto, CompleteBatchDto, CompleteStepDto, CorrectStepDto, CreateBatchDto, CreatePlanDto, QaDecisionDto, ReasonDto, StartStepDto } from './production.dto';

@ApiTags('production planning')
@ApiBearerAuth()
@Controller('production-plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequirePermissions('production.plan.view')
  list(@Query() q: FilterQueryDto) {
    return this.plans.list(q);
  }

  @Get('availability')
  @RequirePermissions('production.plan.view')
  availability(@Query() q: AvailabilityQueryDto) {
    return this.plans.availability(q.productId, q.siteId, q.quantity);
  }

  @Get(':id')
  @RequirePermissions('production.plan.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(id);
  }

  @Post()
  @RequirePermissions('production.plan.manage')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: CreatePlanDto) {
    return this.plans.create(u, dto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('production.plan.approve')
  approve(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.approve(u, id);
  }
}

@ApiTags('batches & eBMR')
@ApiBearerAuth()
@Controller('batches')
export class BatchesController {
  constructor(
    private readonly batches: BatchesService,
    private readonly ebmr: EbmrService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('batch.view')
  list(@Query() q: FilterQueryDto) {
    return this.batches.list(q);
  }

  @Get('export')
  @RequirePermissions('batch.view', 'report.export')
  async export(@Query() q: FilterQueryDto, @Res({ passthrough: true }) res: Response) {
    const page = await this.batches.list({ ...q, page: 1, pageSize: 200 } as FilterQueryDto);
    await this.audit.recordStandalone({ entityType: 'BatchReport', action: 'EXPORT', next: { rows: page.data.length } });
    return sendCsv(
      res,
      `batch-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(page.data, [
        { header: 'Batch', value: (r) => r.batchNumber },
        { header: 'Product', value: (r) => `${r.product.code} ${r.product.genericName} ${r.product.strength}` },
        { header: 'Status', value: (r) => r.status },
        { header: 'Planned qty', value: (r) => r.plannedQuantity },
        { header: 'Actual yield', value: (r) => r.actualYield },
        { header: 'Yield %', value: (r) => r.yieldPct },
        { header: 'Planned start', value: (r) => r.plannedStart },
        { header: 'Actual start', value: (r) => r.actualStart },
        { header: 'Actual end', value: (r) => r.actualEnd },
        { header: 'QA decision at', value: (r) => r.qaDecisionAt },
        { header: 'Expiry', value: (r) => r.expiryDate },
        { header: 'Delayed', value: (r) => (r.delayed ? 'Yes' : 'No') },
      ]),
    );
  }

  @Get(':id')
  @RequirePermissions('batch.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.batches.get(id);
  }

  @Get(':id/release-blockers')
  @RequirePermissions('batch.view')
  blockers(@Param('id', ParseUUIDPipe) id: string) {
    return this.batches.getReleaseBlockers(id);
  }

  @Post()
  @RequirePermissions('batch.create')
  create(@CurrentUser() u: AuthPrincipal, @Body() dto: CreateBatchDto) {
    return this.batches.create(u, dto);
  }

  @Post(':id/reserve')
  @HttpCode(200)
  @RequirePermissions('batch.reserve')
  reserve(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.batches.reserve(u, id);
  }

  @Post(':id/unreserve')
  @HttpCode(200)
  @RequirePermissions('batch.reserve')
  unreserve(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.batches.unreserve(u, id, dto.reason);
  }

  @Post(':id/issue-materials')
  @HttpCode(200)
  @RequirePermissions('inventory.issue')
  issue(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.batches.issue(u, id);
  }

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermissions('batch.start')
  start(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.batches.start(u, id);
  }

  @Post(':id/steps/:stepId/start')
  @HttpCode(200)
  @RequirePermissions('batch.execute')
  startStep(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Param('stepId', ParseUUIDPipe) stepId: string, @Body() dto: StartStepDto) {
    return this.ebmr.startStep(u, id, stepId, dto);
  }

  @Post(':id/steps/:stepId/complete')
  @HttpCode(200)
  @RequirePermissions('batch.execute')
  completeStep(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Param('stepId', ParseUUIDPipe) stepId: string, @Body() dto: CompleteStepDto) {
    return this.ebmr.completeStep(u, id, stepId, dto);
  }

  @Post(':id/steps/:stepId/verify')
  @HttpCode(200)
  @RequirePermissions('batch.verify')
  verifyStep(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Param('stepId', ParseUUIDPipe) stepId: string, @Body() dto: SignatureDto) {
    return this.ebmr.verifyStep(u, id, stepId, dto);
  }

  @Post(':id/steps/:stepId/corrections')
  @RequirePermissions('batch.execute')
  correct(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Param('stepId', ParseUUIDPipe) stepId: string, @Body() dto: CorrectStepDto) {
    return this.ebmr.correctStep(u, id, stepId, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermissions('batch.complete')
  complete(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteBatchDto) {
    return this.batches.complete(u, id, dto);
  }

  @Post(':id/qa-release')
  @HttpCode(200)
  @RequirePermissions('batch.approve')
  qaRelease(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QaDecisionDto) {
    return this.batches.qaDecision(u, id, dto);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions('batch.approve')
  close(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.batches.close(u, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('batch.create')
  cancel(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.batches.cancel(u, id, dto.reason);
  }
}

@Module({ imports: [InventoryModule], controllers: [PlansController, BatchesController], providers: [PlansService, BatchesService, EbmrService], exports: [PlansService, BatchesService] })
export class ProductionModule {}
