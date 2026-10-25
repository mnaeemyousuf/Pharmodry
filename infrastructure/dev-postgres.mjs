#!/usr/bin/env node
/**
 * Local PostgreSQL for development and tests, without Docker.
 * Uses real PostgreSQL binaries via the `embedded-postgres` package.
 *
 *   npm run db:start            # persistent dev cluster on :5433 (data in .data/pg)
 *
 * Creates UTF-8 databases `pharma360_dev` (application) and `pharma360_e2e` (automated tests). Stop with Ctrl+C.
 * Teams with Docker can use infrastructure/docker-compose.yml instead.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PG_PORT ?? 5433);
const dataDir = resolve(root, '.data', 'pg');
const user = process.env.PG_USER ?? 'pharma360';
const password = process.env.PG_PASSWORD ?? 'pharma360_dev';

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user, password, port, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {} });

const fresh = !existsSync(resolve(dataDir, 'PG_VERSION'));
if (fresh) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const db of ['pharma360_dev', 'pharma360_e2e']) {
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
  if (exists.rowCount === 0) {
    // Always UTF-8 regardless of the OS default code page (Windows clusters default to WIN1252).
    await client.query(`CREATE DATABASE ${db} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
    console.log(`created database ${db}`);
  }
}
await client.end();
console.log(`PostgreSQL ready on postgresql://${user}:***@localhost:${port} (data: ${dataDir})`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
