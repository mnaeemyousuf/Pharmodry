import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Pharmodry!Demo26';
export const sign = { password: PASSWORD };

export interface Ctx {
  app: INestApplication;
  prisma: PrismaClient;
  token: (email: string) => Promise<string>;
  as: (email: string) => Promise<Client>;
}

export interface Client {
  get: (path: string) => request.Test;
  post: (path: string, body?: object) => request.Test;
  patch: (path: string, body?: object) => request.Test;
  put: (path: string, body?: object) => request.Test;
}

export async function createContext(): Promise<Ctx> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  const prisma = new PrismaClient();
  const tokens = new Map<string, string>();
  const token = async (email: string) => {
    if (!tokens.has(email)) {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: PASSWORD });
      if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
      tokens.set(email, res.body.data.accessToken);
    }
    return tokens.get(email)!;
  };
  const as = async (email: string): Promise<Client> => {
    const t = await token(email);
    const s = () => request(app.getHttpServer());
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${t}`).set('X-Requested-With', 'pharmodry');
    return {
      get: (p) => auth(s().get(`/api/v1${p}`)),
      post: (p, b = {}) => auth(s().post(`/api/v1${p}`)).send(b),
      patch: (p, b = {}) => auth(s().patch(`/api/v1${p}`)).send(b),
      put: (p, b = {}) => auth(s().put(`/api/v1${p}`)).send(b),
    };
  };
  return { app, prisma, token, as };
}

export async function closeContext(c: Ctx) {
  await c.prisma.$disconnect();
  await c.app.close();
}

export const U = {
  qaManager: 'qa.manager@novacure.demo',
  qaOfficer: 'qa.officer@novacure.demo',
  qcManager: 'qc.manager@novacure.demo',
  qcAnalyst: 'qc.analyst@novacure.demo',
  qcAnalyst2: 'qc.analyst2@novacure.demo',
  warehouseOfficer: 'warehouse.officer@novacure.demo',
  warehouseManager: 'warehouse.manager@novacure.demo',
  planner: 'planner@novacure.demo',
  supervisor: 'production.supervisor@novacure.demo',
  operator: 'operator@novacure.demo',
  productionManager: 'production.manager@novacure.demo',
  procurementOfficer: 'procurement.officer@novacure.demo',
  procurementManager: 'procurement.manager@novacure.demo',
  companyAdmin: 'company.admin@novacure.demo',
  auditor: 'auditor@novacure.demo',
  management: 'management@novacure.demo',
  engineering: 'engineering@novacure.demo',
  zenith: 'admin@zenith.demo',
};

export const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

interface StepDef { code: string; min?: number; max?: number }
interface Step { id: string; name: string; status: string; equipmentType?: string; consumesMaterials: boolean; recordsOutput: boolean; parameterDefs: StepDef[]; ipcDefs: StepDef[] }

const EQUIPMENT_FOR: Record<string, string> = { BALANCE: 'BAL-01', GRANULATOR: 'RMG-01', DRYER: 'FBD-01', TABLET_PRESS: 'TP-01', BLISTER: 'BLS-01', ENCAPSULATOR: 'ENC-01', BLENDER: 'BLD-01' };
const mid = (d: StepDef) => Math.round((((d.min ?? 0) + (d.max ?? (d.min ?? 0) + 2)) / 2) * 100) / 100;

/** Drives every eBMR step: operator starts/records/signs, supervisor verifies. */
export async function executeBatch(c: Ctx, batchId: string, output: number) {
  const operator = await c.as(U.operator);
  const supervisor = await c.as(U.supervisor);
  const equipment = await c.prisma.equipment.findMany();
  const batch = (await operator.get(`/batches/${batchId}`)).body.data as { steps: Step[] };
  for (const st of batch.steps) {
    const eq = st.equipmentType ? equipment.find((e) => e.code === EQUIPMENT_FOR[st.equipmentType!])?.id : undefined;
    let r = await operator.post(`/batches/${batchId}/steps/${st.id}/start`, { equipmentId: eq });
    if (r.status !== 200) throw new Error(`start ${st.name}: ${JSON.stringify(r.body)}`);
    const reservations = st.consumesMaterials ? await c.prisma.materialReservation.findMany({ where: { batchId, status: 'ISSUED' } }) : [];
    const byLot = new Map<string, number>();
    reservations.forEach((x) => byLot.set(x.lotId, (byLot.get(x.lotId) ?? 0) + Number(x.quantity)));
    r = await operator.post(`/batches/${batchId}/steps/${st.id}/complete`, {
      ...sign,
      readings: Object.fromEntries(st.parameterDefs.map((d) => [d.code, mid(d)])),
      ipcResults: Object.fromEntries(st.ipcDefs.map((d) => [d.code, d.max === 0 ? 0 : mid(d)])),
      consumptions: st.consumesMaterials ? [...byLot.entries()].map(([lotId, q]) => ({ lotId, actualQuantity: q })) : undefined,
      outputQuantity: st.recordsOutput ? output : undefined,
    });
    if (r.status !== 200) throw new Error(`complete ${st.name}: ${JSON.stringify(r.body)}`);
    r = await supervisor.post(`/batches/${batchId}/steps/${st.id}/verify`, sign);
    if (r.status !== 200) throw new Error(`verify ${st.name}: ${JSON.stringify(r.body)}`);
  }
}

/** Collect → enter results by test name → submit → review → approve. */
export async function runQc(c: Ctx, sampleId: string, values: Record<string, number | boolean>, opts: { approve?: boolean; analyst?: string } = {}) {
  const analyst = await c.as(opts.analyst ?? U.qcAnalyst);
  const manager = await c.as(U.qcManager);
  const sample = await c.prisma.qcSample.findUniqueOrThrow({ where: { id: sampleId } });
  const tests = await c.prisma.qcSpecTest.findMany({ where: { specificationId: sample.specificationId } });
  let r = await analyst.post(`/qc/samples/${sampleId}/collect`, {});
  if (r.status !== 200) throw new Error(`collect: ${JSON.stringify(r.body)}`);
  r = await analyst.post(`/qc/samples/${sampleId}/results`, {
    results: tests.map((t) => {
      const v = values[t.name];
      return t.resultType === 'NUMERIC' ? { specTestId: t.id, numericValue: typeof v === 'number' ? v : Number(t.minValue ?? 0) + 0.5 } : { specTestId: t.id, passFail: typeof v === 'boolean' ? v : true };
    }),
  });
  if (r.status !== 200) throw new Error(`results: ${JSON.stringify(r.body)}`);
  const flagged = r.body.data.flaggedOosCandidates as { id: string; number: string }[];
  if (opts.approve === false) return { flagged };
  await analyst.post(`/qc/samples/${sampleId}/submit`).expect(200);
  await manager.post(`/qc/samples/${sampleId}/review`, { decision: 'ACCEPT' }).expect(200);
  await manager.post(`/qc/samples/${sampleId}/approve`, sign).expect(200);
  return { flagged };
}
