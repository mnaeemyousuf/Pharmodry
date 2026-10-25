/* Drops the database created by this test run (set E2E_KEEP_DB=true to keep it for inspection). */
import { existsSync, unlinkSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { readState, STATE_FILE } from './global-setup';

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const s = readState();
  unlinkSync(STATE_FILE);
  if (process.env.E2E_KEEP_DB === 'true' || !s.name.startsWith('pmd_e2e_')) return;
  const client = new PrismaClient({ datasourceUrl: s.admin });
  await client.$executeRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${s.name}' AND pid <> pg_backend_pid()`);
  await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${s.name}`);
  await client.$disconnect();
}
