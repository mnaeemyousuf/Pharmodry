/*
 * Pharmodry demo seed — FICTIONAL data for NovaCure Pharmaceuticals Pvt Ltd.
 *   npm run db:reset   (drops & recreates the dev schema, then seeds)
 * Refuses to run when NODE_ENV=production. Demo password comes from SEED_DEMO_PASSWORD
 * (development-only default documented in docs/DEMO/DEMO_DATA_GUIDE.md).
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(__dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.DISABLE_SCHEDULER = 'true';

import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/modules/audit/audit.service';
import { seedHistory, seedQualityHistory } from './seed/history';
import { seedLive } from './seed/live';
import { DEMO_USERS, seedMasterData, seedPermissions, seedTenant } from './seed/master';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to load demo data in production');
  }
  const password = process.env.SEED_DEMO_PASSWORD ?? 'Pharmodry!Demo26';
  const prisma = new PrismaClient();
  const started = Date.now();
  const log = (m: string) => console.log(`  ${m}`);
  if (await prisma.tenant.findUnique({ where: { code: 'NOVACURE' } })) {
    console.log('Demo tenant already exists. Run `npm run db:reset` to rebuild the demo environment.');
    await prisma.$disconnect();
    return;
  }
  console.log('Seeding permissions and tenants…');
  await seedPermissions(prisma);
  const nova = await seedTenant(prisma, {
    code: 'NOVACURE',
    name: 'NovaCure Pharmaceuticals',
    legalName: 'NovaCure Pharmaceuticals Pvt Ltd (fictional demo company)',
    password,
    users: DEMO_USERS,
    siteDefs: [
      { code: 'KHI', name: 'Karachi Manufacturing Plant', city: 'Karachi', licenseNo: 'DML-000123 (demo)' },
      { code: 'LHR', name: 'Lahore Distribution Centre', city: 'Lahore' },
    ],
  });
  // Second tenant for isolation demonstrations/tests.
  const zenith = await seedTenant(prisma, {
    code: 'ZENITH',
    name: 'Zenith Laboratories',
    legalName: 'Zenith Laboratories (fictional second tenant)',
    password,
    users: [{ key: 'admin', email: 'admin@zenith.demo', fullName: 'Zenith Administrator', title: 'Administrator', role: 'SUPER_ADMIN', dept: 'MGT' }],
    siteDefs: [{ code: 'ZHI', name: 'Zenith Plant 1', city: 'Hyderabad' }],
  });
  const zUom = await prisma.unitOfMeasure.create({ data: { tenantId: zenith.tenant.id, code: 'KG', name: 'Kilogram' } });
  await prisma.material.create({ data: { tenantId: zenith.tenant.id, code: 'API-ZEN-001', name: 'Zenith confidential API', type: 'API', uomId: zUom.id } });

  console.log('Seeding master data…');
  const m = await seedMasterData(prisma, nova.tenant.id, nova.sites, nova.users);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const audit = app.get(AuditService);
    const ctx = { prisma, audit, tenantId: nova.tenant.id, site: nova.sites.KHI, users: nova.users, m };
    console.log('Loading six months of legacy history…');
    const { batchIds } = await seedHistory(ctx);
    await seedQualityHistory(ctx, batchIds);
    console.log('Running today’s demo scenarios through the application services…');
    const live = await seedLive(app, prisma, { tenantId: nova.tenant.id, users: nova.users, sites: nova.sites, m }, password, log);
    console.log(`\nDemo environment ready in ${Math.round((Date.now() - started) / 1000)} s`);
    console.log(`  Released batch: ${live.batchA} · OOS batch: ${live.batchB} · Blocked (shortage): ${live.batchC} · In progress: ${live.batchD}`);
    console.log(`  Log in with any demo account (e.g. qa.manager@novacure.demo). Password: SEED_DEMO_PASSWORD (dev default documented in docs/DEMO).`);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
