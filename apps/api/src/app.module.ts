import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { ClsModule } from 'nestjs-cls';
import type { Request } from 'express';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { JwtAuthGuard, PermissionsGuard } from './modules/auth/auth.guards';
import { CoreModule } from './modules/core/core.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { OrganizationsModule } from './modules/organizations/organizations';
import { ProcurementModule } from './modules/procurement/procurement';
import { SamplingModule } from './modules/sampling/sample-request.service';
import { SuppliersModule } from './modules/suppliers/suppliers';
import { UsersModule } from './modules/users/users';
import { QualityModule } from './modules/quality/quality.module';
import { ProductionModule } from './modules/production/production.module';
import { DeviationsModule } from './modules/deviations/deviations';
import { CapaModule } from './modules/capa/capa';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { JobsModule } from './modules/jobs/scans.service';
import { AiModule } from './modules/ai/ai.module';
import { AttachmentsModule } from './modules/attachments/attachments';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: Request) => {
          const h = req.headers['x-correlation-id'];
          return typeof h === 'string' && /^[\w-]{8,64}$/.test(h) ? h : randomUUID();
        },
        setup: (cls, req: Request) => {
          cls.set('ip', req.ip);
          cls.set('userAgent', req.headers['user-agent']);
        },
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600) }]),
    PrismaModule,
    CoreModule,
    SamplingModule,
    OrganizationsModule,
    UsersModule,
    MasterDataModule,
    SuppliersModule,
    ProcurementModule,
    InventoryModule,
    QualityModule,
    ProductionModule,
    DeviationsModule,
    CapaModule,
    AnalyticsModule,
    JobsModule,
    AiModule,
    AttachmentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule {}
