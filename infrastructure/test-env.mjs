#!/usr/bin/env node
/**
 * Runs a command against an isolated, freshly seeded Pharmodry environment.
 *
 *   node infrastructure/test-env.mjs -- npx playwright test        (from repo root)
 *
 * 1. creates a new UTF-8 database (pmd_ui_<timestamp>) on the dev PostgreSQL, migrates and seeds it
 * 2. starts the API on :4101 and the built web app on :3101 (API_URL=http://localhost:4101)
 * 3. runs the command with BASE_URL=http://localhost:3101
 * 4. stops both servers and drops the database (KEEP_DB=true keeps it)
 *
 * Requires: dev PostgreSQL running (npm run db:start), API built (apps/api/dist), web built (apps/web/.next).
 */
import { spawn, execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/api');
const webDir = resolve(root, 'apps/web');
const pgBase = process.env.TEST_PG_URL ?? 'postgresql://pharma360:pharma360_dev@localhost:5433';
const API_PORT = Number(process.env.TEST_API_PORT ?? 4101);
const WEB_PORT = Number(process.env.TEST_WEB_PORT ?? 3101);
const dbName = process.env.TEST_DB_NAME ?? `pmd_ui_${Date.now()}`;
const dbUrl = `${pgBase}/${dbName}`;
const sep = process.argv.indexOf('--');
const cmd = sep >= 0 ? process.argv.slice(sep + 1) : ['npx', 'playwright', 'test'];

const sql = (q) => execSync(`npx prisma db execute --url "${pgBase}/postgres" --stdin`, { cwd: apiDir, input: q, stdio: ['pipe', 'ignore', 'inherit'] });
const children = [];
const start = (name, command, args, cwd, env) => {
  const p = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  p.stdout.on('data', (d) => process.env.TEST_ENV_VERBOSE && process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  children.push(p);
  return p;
};
const waitFor = async (url, label) => {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become ready at ${url}`);
};
const cleanup = () => {
  for (const c of children) c.kill();
  if (process.env.KEEP_DB !== 'true') {
    try {
      sql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbName}' AND pid <> pg_backend_pid();`);
      sql(`DROP DATABASE IF EXISTS ${dbName};`);
    } catch {
      /* best effort */
    }
  }
};

let code = 1;
try {
  if (!process.env.TEST_DB_NAME) {
    console.log(`Creating ${dbName}…`);
    sql(`CREATE DATABASE ${dbName} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;`);
    const env = { ...process.env, DATABASE_URL: dbUrl, DISABLE_SCHEDULER: 'true' };
    execSync('npx prisma migrate deploy', { cwd: apiDir, env, stdio: 'ignore' });
    console.log('Seeding demo data…');
    execSync('node -r ts-node/register/transpile-only prisma/seed.ts', { cwd: apiDir, env, stdio: 'inherit' });
  }
  start('api', process.execPath, ['dist/main.js'], apiDir, { PORT: String(API_PORT), DATABASE_URL: dbUrl, DISABLE_SCHEDULER: 'true', CORS_ORIGINS: `http://localhost:${WEB_PORT}`, LOGIN_RATE_LIMIT_PER_MINUTE: '1000', REFRESH_RATE_LIMIT_PER_MINUTE: '100000', RATE_LIMIT_PER_MINUTE: '100000', NODE_ENV: 'production', JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-env-only-secret-0123456789abcdef0123456789' });
  start('web', process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(WEB_PORT)], webDir, { API_URL: `http://localhost:${API_PORT}`, NEXT_PUBLIC_DEMO_MODE: 'true' });
  await waitFor(`http://localhost:${API_PORT}/api/v1/health`, 'API');
  await waitFor(`http://localhost:${WEB_PORT}/login`, 'Web');
  console.log(`Environment ready: web http://localhost:${WEB_PORT}, api http://localhost:${API_PORT}, db ${dbName}`);
  code = await new Promise((res) => {
    const p = spawn(cmd[0], cmd.slice(1), { cwd: process.cwd(), env: { ...process.env, BASE_URL: `http://localhost:${WEB_PORT}`, TEST_DB_URL: dbUrl }, stdio: 'inherit', shell: true });
    p.on('exit', (c) => res(c ?? 1));
  });
} catch (e) {
  console.error(e);
} finally {
  cleanup();
}
process.exit(code);
