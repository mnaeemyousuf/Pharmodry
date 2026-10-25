/* Creates a fresh, isolated UTF-8 database for this test run, migrates it and loads the demo seed. */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

export const STATE_FILE = resolve(__dirname, '.e2e-db.json');

function adminUrl() {
  const envFile = resolve(__dirname, '..', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const base = process.env.E2E_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL (or E2E_ADMIN_DATABASE_URL) is required for e2e tests');
  const u = new URL(base);
  u.pathname = '/postgres';
  u.search = '';
  return u;
}

export default async function globalSetup() {
  const admin = adminUrl();
  const name = `pmd_e2e_${Date.now()}`;
  const client = new PrismaClient({ datasourceUrl: admin.toString() });
  await client.$executeRawUnsafe(`CREATE DATABASE ${name} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
  await client.$disconnect();
  const dbUrl = new URL(admin.toString());
  dbUrl.pathname = `/${name}`;
  // E2E_DB_SCHEMA=pharmodry runs the suite inside a named schema (as on a shared hosted database).
  if (process.env.E2E_DB_SCHEMA) dbUrl.searchParams.set('schema', process.env.E2E_DB_SCHEMA);
  const env = { ...process.env, DATABASE_URL: dbUrl.toString(), DISABLE_SCHEDULER: 'true' };
  const cwd = resolve(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'ignore' });
  execSync('node -r ts-node/register/transpile-only prisma/seed.ts', { cwd, env, stdio: 'ignore' });
  writeFileSync(STATE_FILE, JSON.stringify({ name, url: dbUrl.toString(), admin: admin.toString() }));
  process.env.DATABASE_URL = dbUrl.toString();
}

export function readState(): { name: string; url: string; admin: string } {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}
