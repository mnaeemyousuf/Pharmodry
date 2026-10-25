import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { sendCsv, toCsv } from '../../common/csv';
import { FilterQueryDto } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { SuppliersModule } from '../suppliers/suppliers';
import { AnalyticsService } from './analytics.service';
import { InventoryRiskService } from './inventory-risk.service';
import { SearchController, SearchService } from './search';
import { TraceabilityController, TraceabilityService } from './traceability';
import { PqrController, PqrService } from './pqr';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly risk: InventoryRiskService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  @RequirePermissions('analytics.view')
  dashboard(@CurrentUser() u: AuthPrincipal, @Query() q: FilterQueryDto) {
    return this.analytics.dashboard(u.tenantId, q);
  }

  @Get('command-center')
  @RequirePermissions('commandcenter.view')
  commandCenter(@CurrentUser() u: AuthPrincipal, @Query() q: FilterQueryDto) {
    return this.analytics.commandCenter(u.tenantId, q.siteId);
  }

  @Get('capa-kpis')
  @RequirePermissions('capa.view')
  capaKpis() {
    return this.analytics.capaKpis();
  }

  @Get('inventory-risk')
  @RequirePermissions('inventory.view')
  inventoryRisk(@CurrentUser() u: AuthPrincipal, @Query() q: FilterQueryDto) {
    return this.risk.materialRisks(u.tenantId, q.siteId);
  }

  @Get('expiry-risk')
  @RequirePermissions('inventory.view')
  expiryRisk(@CurrentUser() u: AuthPrincipal, @Query() q: FilterQueryDto) {
    return this.risk.expiryRisks(u.tenantId, 90, q.siteId);
  }

  @Get('expiry-risk/export')
  @RequirePermissions('inventory.view', 'report.export')
  async expiryExport(@CurrentUser() u: AuthPrincipal, @Query() q: FilterQueryDto, @Res({ passthrough: true }) res: Response) {
    const rows = await this.risk.expiryRisks(u.tenantId, 90, q.siteId);
    await this.audit.recordStandalone({ entityType: 'NearExpiryReport', action: 'EXPORT', next: { rows: rows.length } });
    return sendCsv(
      res,
      `near-expiry-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows, [
        { header: 'Lot', value: (r) => r.lotNumber },
        { header: 'Item code', value: (r) => r.itemCode },
        { header: 'Item', value: (r) => r.itemName },
        { header: 'Quantity', value: (r) => r.quantity },
        { header: 'UOM', value: (r) => r.uom },
        { header: 'Expiry', value: (r) => r.expiryDate },
        { header: 'Days to expiry', value: (r) => r.daysToExpiry },
        { header: 'Value (PKR)', value: (r) => r.value },
        { header: 'Projected use before expiry', value: (r) => r.projectedUseBeforeExpiry },
        { header: 'At-risk quantity', value: (r) => r.atRiskQuantity },
        { header: 'Recommendation (requires human review)', value: (r) => r.recommendation },
      ]),
    );
  }
}

@Module({
  imports: [SuppliersModule],
  controllers: [AnalyticsController, SearchController, TraceabilityController, PqrController],
  providers: [AnalyticsService, InventoryRiskService, SearchService, TraceabilityService, PqrService],
  exports: [AnalyticsService, InventoryRiskService],
})
export class AnalyticsModule {}
