#!/usr/bin/env node
/**
 * Production start for hosted environments (used on Render):
 *   1. derives the effective DATABASE_URL (optional schema isolation via DB_SCHEMA, SSL for hosted Postgres)
 *   2. applies pending migrations (`prisma migrate deploy` — never reset/push)
 *   3. loads the fictional demo data once, only when ALLOW_DEMO_SEED=true and the database is empty
 *   4. starts the compiled API
 *
 * Env: DATABASE_URL (required), DB_SCHEMA (e.g. "pharmodry" to share a database with other apps),
 *      ALLOW_DEMO_SEED=true (demo environments only), plus the normal API variables (docs/DEPLOYMENT.md).
 */
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set. Add it in the service environment (see docs/DEPLOYMENT.md).');
  process.exit(1);
}
const url = new URL(raw);
// A Render *internal* host (e.g. "dpg-abc123-a") only resolves inside the database's own region. When the service
// runs in another region, DB_HOST_SUFFIX (e.g. ".frankfurt-postgres.render.com") turns it into the external host;
// the credentials are identical, so the stored DATABASE_URL does not need to change.
if (process.env.DB_HOST_SUFFIX && /^dpg-[a-z0-9]+-a$/.test(url.hostname)) url.hostname += process.env.DB_HOST_SUFFIX;
if (process.env.DB_SCHEMA && !url.searchParams.has('schema')) url.searchParams.set('schema', process.env.DB_SCHEMA);
// Hosted Postgres external endpoints require TLS.
if (!url.searchParams.has('sslmode') && !['localhost', '127.0.0.1', '::1'].includes(url.hostname) && !/^dpg-[a-z0-9-]+$/.test(url.hostname)) {
  url.searchParams.set('sslmode', 'require');
}
const env = { ...process.env, DATABASE_URL: url.toString() };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: apiDir, env, stdio: 'inherit' });
const prismaBin = resolve(apiDir, '../../node_modules/prisma/build/index.js');

console.log(`[start] database host ${url.hostname}, schema ${url.searchParams.get('schema') ?? 'public'}`);
console.log('[start] applying migrations…');
try {
  run(process.execPath, [prismaBin, 'migrate', 'deploy']);
} catch {
  console.error(
    [
      '[start] Could not apply migrations — the database is not reachable or refused the connection.',
      `[start] Host: ${url.hostname}`,
      '[start] Checklist: (1) DATABASE_URL is the database URL; (2) if the database is in another Render region, its',
      '[start] Networking settings must allow external connections (inbound rule, e.g. 0.0.0.0/0 for a demo) and',
      '[start] DB_HOST_SUFFIX must be set (e.g. .frankfurt-postgres.render.com). See docs/DEPLOYMENT.md.',
    ].join('\n'),
  );
  process.exit(1);
}

if (process.env.ALLOW_DEMO_SEED === 'true') {
  console.log('[start] demo seed (skipped automatically if demo data already exists)…');
  run(process.execPath, ['-r', 'ts-node/register/transpile-only', 'prisma/seed.ts']);
}

console.log('[start] starting API…');
const child = spawn(process.execPath, ['--enable-source-maps', 'dist/main.js'], { cwd: apiDir, env, stdio: 'inherit' });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 1));
