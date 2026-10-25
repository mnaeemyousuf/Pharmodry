import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { FilterQueryDto } from '../../common/pagination';
import { InventoryModule } from '../inventory/inventory.module';
import { SignatureDto } from '../signatures/signature.service';
import { OosService } from './oos.service';
import { QcService } from './qc.service';
import { CollectSampleDto, EnterResultsDto, LinkDeviationDto, OosAdvanceDto, OosApproveDto, ReviewDto } from './quality.dto';

@ApiTags('quality control')
@ApiBearerAuth()
@Controller('qc/samples')
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Get()
  @RequirePermissions('qc.view')
  list(@Query() q: FilterQueryDto) {
    return this.qc.list(q);
  }

  @Get(':id')
  @RequirePermissions('qc.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.qc.get(id);
  }

  @Post(':id/collect')
  @HttpCode(200)
  @RequirePermissions('qc.sample.collect')
  collect(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CollectSampleDto) {
    return this.qc.collect(u, id, dto);
  }

  @Post(':id/results')
  @HttpCode(200)
  @RequirePermissions('qc.result.enter')
  results(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EnterResultsDto) {
    return this.qc.enterResults(u, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions('qc.result.enter')
  submit(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.qc.submit(u, id);
  }

  @Post(':id/review')
  @HttpCode(200)
  @RequirePermissions('qc.result.review')
  review(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.qc.review(u, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('qc.result.approve')
  approve(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SignatureDto) {
    return this.qc.approve(u, id, dto);
  }
}

@ApiTags('oos')
@ApiBearerAuth()
@Controller('oos')
export class OosController {
  constructor(private readonly oos: OosService) {}

  @Get()
  @RequirePermissions('oos.view')
  list(@Query() q: FilterQueryDto) {
    return this.oos.list(q);
  }

  @Get(':id')
  @RequirePermissions('oos.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.oos.get(id);
  }

  @Post(':id/advance')
  @HttpCode(200)
  @RequirePermissions('oos.investigate')
  advance(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OosAdvanceDto) {
    return this.oos.advance(u, id, dto);
  }

  @Post(':id/link-deviation')
  @HttpCode(200)
  @RequirePermissions('oos.investigate')
  link(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkDeviationDto) {
    return this.oos.linkDeviation(u, id, dto.deviationId);
  }

  @Post(':id/qa-approve')
  @HttpCode(200)
  @RequirePermissions('oos.approve')
  approve(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OosApproveDto) {
    return this.oos.approve(u, id, dto);
  }
}

@Module({ imports: [InventoryModule], controllers: [QcController, OosController], providers: [QcService, OosService], exports: [OosService] })
export class QualityModule {}
