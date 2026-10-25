import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { sendCsv, toCsv } from '../../common/csv';
import { FilterQueryDto } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { GrnService } from './grn.service';
import { AdjustDto, BlockDto, CreateGrnDto, DispositionDto, TransferDto } from './inventory.dto';
import { InventoryService } from './inventory.service';
import { InventoryLedger } from './ledger.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly grns: GrnService,
    private readonly audit: AuditService,
  ) {}

  @Get('inventory/lots')
  @RequirePermissions('inventory.view')
  lots(@Query() q: FilterQueryDto) {
    return this.inventory.listLots(q);
  }

  @Get('inventory/lots/export')
  @RequirePermissions('inventory.view', 'report.export')
  async exportLots(@Query() q: FilterQueryDto, @Res({ passthrough: true }) res: Response) {
    const page = await this.inventory.listLots({ ...q, page: 1, pageSize: 200 } as FilterQueryDto);
    await this.audit.recordStandalone({ entityType: 'InventoryReport', action: 'EXPORT', next: { view: q.view ?? 'all', rows: page.data.length } });
    return sendCsv(
      res,
      `inventory-${q.view ?? 'status'}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(page.data, [
        { header: 'Lot', value: (r) => r.lotNumber },
        { header: 'Item code', value: (r) => r.item?.code },
        { header: 'Item', value: (r) => r.item?.name },
        { header: 'Status', value: (r) => r.status },
        { header: 'Quantity', value: (r) => r.quantity },
        { header: 'Reserved', value: (r) => r.reservedQuantity },
        { header: 'UOM', value: (r) => r.uomCode },
        { header: 'Warehouse', value: (r) => r.warehouse?.code },
        { header: 'Bin', value: (r) => r.bin?.code },
        { header: 'Supplier batch', value: (r) => r.supplierBatch },
        { header: 'Mfg date', value: (r) => r.mfgDate },
        { header: 'Expiry', value: (r) => r.expiryDate },
        { header: 'Retest', value: (r) => r.retestDate },
        { header: 'Days to expiry', value: (r) => r.daysToExpiry },
        { header: 'Value (PKR)', value: (r) => Math.round(Number(r.quantity) * Number(r.unitCost)) },
      ]),
    );
  }

  @Get('inventory/lots/:id')
  @RequirePermissions('inventory.view')
  lot(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.getLot(id);
  }

  @Get('inventory/lots/:id/release-blockers')
  @RequirePermissions('inventory.view')
  blockers(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.getReleaseBlockers(id);
  }

  @Post('inventory/lots/:id/transfer')
  @RequirePermissions('inventory.transfer')
  transfer(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferDto) {
    return this.inventory.transfer(u, id, dto);
  }

  @Post('inventory/lots/:id/adjust')
  @RequirePermissions('inventory.adjust')
  adjust(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustDto) {
    return this.inventory.adjust(u, id, dto);
  }

  @Post('inventory/lots/:id/disposition')
  @HttpCode(200)
  @RequirePermissions('inventory.release')
  disposition(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DispositionDto) {
    return this.inventory.disposition(u, id, dto);
  }

  @Post('inventory/lots/:id/block')
  @HttpCode(200)
  @RequirePermissions('inventory.release')
  block(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BlockDto) {
    return this.inventory.block(u, id, dto);
  }

  @Get('inventory/movements')
  @RequirePermissions('inventory.view')
  movements(@Query() q: FilterQueryDto) {
    return this.inventory.movements(q);
  }

  @Get('inventory/stock-summary')
  @RequirePermissions('inventory.view')
  summary(@Query('siteId') siteId?: string) {
    return this.inventory.stockSummary(siteId);
  }

  @Get('goods-receipts')
  @RequirePermissions('inventory.view')
  listGrns(@Query() q: FilterQueryDto) {
    return this.grns.list(q);
  }

  @Get('goods-receipts/:id')
  @RequirePermissions('inventory.view')
  grn(@Param('id', ParseUUIDPipe) id: string) {
    return this.grns.get(id);
  }

  @Post('goods-receipts')
  @RequirePermissions('inventory.receive')
  createGrn(@CurrentUser() u: AuthPrincipal, @Body() dto: CreateGrnDto) {
    return this.grns.create(u, dto);
  }
}

@Module({ controllers: [InventoryController], providers: [InventoryService, GrnService, InventoryLedger], exports: [InventoryService, InventoryLedger] })
export class InventoryModule {}
