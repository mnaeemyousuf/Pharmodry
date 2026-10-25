import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Runs once before the (parallel) capture tests: clears previous screenshots and resolves the ids of the
 * demo records every test needs (written to SCREENSHOTS/_parts/ids.json).
 */
export default async function globalSetup() {
  const out = resolve(__dirname, '../../../docs/USER_MANUALS/SCREENSHOTS');
  // CAPTURE_KEEP=true re-runs selected tests (e.g. -g workflow) without discarding other screenshots.
  if (process.env.CAPTURE_KEEP !== 'true') rmSync(out, { recursive: true, force: true });
  mkdirSync(resolve(out, '_parts'), { recursive: true });

  const base = `${process.env.BASE_URL ?? 'http://localhost:3101'}/api/v1`;
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa.manager@novacure.demo', password: process.env.SEED_DEMO_PASSWORD ?? 'Pharmodry!Demo26' }),
  });
  if (!login.ok) throw new Error(`Login for id resolution failed: ${login.status}`);
  const token = (await login.json()).data.accessToken as string;
  type R = Record<string, unknown>;
  const get = async (u: string): Promise<R[]> => (await (await fetch(`${base}${u}`, { headers: { Authorization: `Bearer ${token}` } })).json()).data;
  const batches = await get('/batches?pageSize=200');
  const byNo = (n: string) => batches.find((b) => b.batchNumber === n)?.id as string | undefined;
  const lots = await get('/inventory/lots?pageSize=200');
  const grns = await get('/goods-receipts?pageSize=50');
  const samples = await get('/qc/samples?pageSize=200');
  const oos = await get('/oos?pageSize=50');
  const devs = await get('/deviations?pageSize=200');
  const capas = await get('/capas?pageSize=200');
  const pos = await get('/purchase-orders?pageSize=50');
  const plans = await get('/production-plans?pageSize=50');
  const products = await get('/products?pageSize=50');
  const materials = await get('/materials?pageSize=50');
  const suppliers = await get('/suppliers?pageSize=50');
  const equipment = await get('/equipment?pageSize=50');
  const specs = await get('/specifications?pageSize=50');
  const ids = {
    releasedBatch: byNo('PCM-2026-000001'),
    oosBatch: byNo('PCM-2026-000002'),
    shortageBatch: byNo('AMX-2026-000001'),
    progressBatch: byNo('OMZ-2026-000001'),
    quarantineLot: lots.find((l) => l.status === 'QUARANTINE' && l.itemType === 'MATERIAL')?.id,
    releasedLot: lots.find((l) => l.status === 'RELEASED' && l.itemType === 'MATERIAL')?.id,
    grn: (grns.find((g) => g.number === 'GRN-2026-00001') ?? grns[0])?.id,
    sample: (samples.find((s) => s.status === 'REQUESTED') ?? samples[0])?.id,
    oos: (oos.find((o) => o.number === 'OOS-2026-0001') ?? oos[0])?.id,
    deviation: (devs.find((d) => d.number === 'DEV-2026-0001') ?? devs[0])?.id,
    capa: (capas.find((c) => !['CLOSED', 'CANCELLED'].includes(c.status as string)) ?? capas[0])?.id,
    po: pos[0]?.id,
    plan: plans[0]?.id,
    product: products.find((x) => x.code === 'PCM-500')?.id,
    material: materials.find((x) => x.code === 'API-PCM-001')?.id,
    supplier: suppliers.find((x) => x.code === 'SUP-001')?.id,
    equipment: equipment[0]?.id,
    spec: specs[0]?.id,
  };
  writeFileSync(resolve(out, '_parts', 'ids.json'), JSON.stringify(ids, null, 2));
  console.log('Resolved record ids for capture:', ids);
}
