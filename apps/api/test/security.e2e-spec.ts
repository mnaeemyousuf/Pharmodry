/** Scenario 3 — authentication, authorization, tenant/site isolation and data-integrity controls. */
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { closeContext, createContext, Ctx, days, PASSWORD, sign, U } from './helpers';

describe('Security, isolation and integrity', () => {
  let c: Ctx;
  beforeAll(async () => {
    c = await createContext();
  });
  afterAll(() => closeContext(c));
  const http = () => request(c.app.getHttpServer());

  describe('authentication', () => {
    it('rejects unauthenticated access to protected APIs', async () => {
      await http().get('/api/v1/batches').expect(401);
      await http().get('/api/v1/health').expect(200);
    });

    it('rejects wrong passwords with a generic message', async () => {
      const r = await http().post('/api/v1/auth/login').send({ email: U.auditor, password: 'wrong-password' }).expect(401);
      expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
      const unknown = await http().post('/api/v1/auth/login').send({ email: 'nobody@nowhere.test', password: 'x' }).expect(401);
      expect(unknown.body.error.message).toBe(r.body.error.message);
    });

    it('locks an account after 5 failed attempts, even for the correct password', async () => {
      const admin = await c.as(U.companyAdmin);
      const role = await c.prisma.role.findFirstOrThrow({ where: { code: 'AUDITOR', tenant: { code: 'NOVACURE' } } });
      await admin.post('/users', { email: 'lock.test@novacure.demo', fullName: 'Lock Test', password: 'LockTest12345', roles: [{ roleId: role.id }] }).expect(201);
      for (let i = 0; i < 5; i++) await http().post('/api/v1/auth/login').send({ email: 'lock.test@novacure.demo', password: 'bad' }).expect(401);
      const r = await http().post('/api/v1/auth/login').send({ email: 'lock.test@novacure.demo', password: 'LockTest12345' }).expect(401);
      expect(r.body.error.code).toBe('ACCOUNT_LOCKED');
      const user = await c.prisma.user.findFirstOrThrow({ where: { email: 'lock.test@novacure.demo' } });
      await admin.post(`/users/${user.id}/unlock`).expect(200);
      await http().post('/api/v1/auth/login').send({ email: 'lock.test@novacure.demo', password: 'LockTest12345' }).expect(200);
    });

    it('rotates refresh tokens and revokes the family when a rotated token is replayed', async () => {
      const login = await http().post('/api/v1/auth/login').send({ email: U.auditor, password: PASSWORD }).expect(200);
      const cookie = login.headers['set-cookie'] as unknown as string[];
      const old = cookie[0].split(';')[0];
      await http().post('/api/v1/auth/refresh').set('Cookie', old).expect(401); // missing anti-CSRF header
      const r1 = await http().post('/api/v1/auth/refresh').set('Cookie', old).set('X-Requested-With', 'pharmodry').expect(200);
      const fresh = (r1.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      expect(fresh).not.toBe(old);
      await http().post('/api/v1/auth/refresh').set('Cookie', old).set('X-Requested-With', 'pharmodry').expect(401); // reuse
      await http().post('/api/v1/auth/refresh').set('Cookie', fresh).set('X-Requested-With', 'pharmodry').expect(401); // family revoked
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${r1.body.data.accessToken}`).expect(401);
    });

    it('a password change signs out other sessions but keeps the current one', async () => {
      const admin = await c.as(U.companyAdmin);
      const role = await c.prisma.role.findFirstOrThrow({ where: { code: 'AUDITOR', tenant: { code: 'NOVACURE' } } });
      const email = 'pwchange.test@novacure.demo';
      await admin.post('/users', { email, fullName: 'Password Change Test', password: 'FirstPass12345', roles: [{ roleId: role.id }] }).expect(201);
      const login = async () => {
        const r = await http().post('/api/v1/auth/login').send({ email, password: 'FirstPass12345' }).expect(200);
        return { token: r.body.data.accessToken as string, cookie: (r.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
      };
      const a = await login();
      const b = await login();
      await http().post('/api/v1/auth/change-password').set('Authorization', `Bearer ${a.token}`).send({ currentPassword: 'FirstPass12345', newPassword: 'SecondPass12345' }).expect(200);
      await http().post('/api/v1/auth/refresh').set('Cookie', b.cookie).set('X-Requested-With', 'pharmodry').expect(401);
      await http().post('/api/v1/auth/refresh').set('Cookie', a.cookie).set('X-Requested-With', 'pharmodry').expect(200);
    });

    it('rebrand compatibility: pmd_rt cookie is issued; legacy p360_rt cookie and legacy header value still refresh', async () => {
      const login = await http().post('/api/v1/auth/login').send({ email: U.auditor, password: PASSWORD }).expect(200);
      const set = (login.headers['set-cookie'] as unknown as string[]).join(';');
      expect(set).toMatch(/pmd_rt=/);
      const value = /pmd_rt=([^;]+)/.exec(set)![1];
      // A session created before the rebrand presents the old cookie name and the old header value.
      const r = await http().post('/api/v1/auth/refresh').set('Cookie', `p360_rt=${value}`).set('X-Requested-With', 'pharma360').expect(200);
      expect((r.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/pmd_rt=/);
      await http().post('/api/v1/auth/refresh').set('Cookie', `p360_rt=${value}`).set('X-Requested-With', 'other').expect(401);
    });

    it('rebrand compatibility: access tokens from the old issuer stay valid; unknown issuers are rejected', async () => {
      const jwt = c.app.get(JwtService);
      const fresh = jwt.decode(await c.token(U.auditor)) as { sub: string; tid: string; fid: string };
      const payload = { sub: fresh.sub, tid: fresh.tid, fid: fresh.fid };
      const legacy = await jwt.signAsync(payload, { issuer: 'pharma360', expiresIn: 60 });
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${legacy}`).expect(200);
      const foreign = await jwt.signAsync(payload, { issuer: 'someone-else', expiresIn: 60 });
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${foreign}`).expect(401);
    });

    it('records login events in the audit trail', async () => {
      const n = await c.prisma.auditEvent.count({ where: { action: 'LOGIN_FAILED' } });
      expect(n).toBeGreaterThan(0);
    });
  });

  describe('tenant isolation', () => {
    it('a user of another company cannot read or act on NovaCure records', async () => {
      const zen = await c.as(U.zenith);
      const nova = await c.prisma.tenant.findFirstOrThrow({ where: { code: 'NOVACURE' } });
      const batch = await c.prisma.batch.findFirstOrThrow({ where: { tenantId: nova.id } });
      await zen.get(`/batches/${batch.id}`).expect(404);
      const list = await zen.get('/batches').expect(200);
      expect(list.body.data).toHaveLength(0);
      const mats = await zen.get('/materials').expect(200);
      expect(mats.body.data.map((m: { code: string }) => m.code)).toEqual(['API-ZEN-001']);
      await zen.post(`/batches/${batch.id}/qa-release`, { decision: 'RELEASE', ...sign }).expect(404);
      const supplier = await c.prisma.supplier.findFirstOrThrow({ where: { code: 'SUP-001' } });
      const zSite = await c.prisma.site.findFirstOrThrow({ where: { code: 'ZHI' } });
      await zen.post('/goods-receipts', { siteId: zSite.id, supplierId: supplier.id, lines: [] }).expect(400);
      const audit = await zen.get('/audit/events?pageSize=200').expect(200);
      const novacure = await c.prisma.tenant.findFirstOrThrow({ where: { code: 'NOVACURE' } });
      expect(audit.body.data.every((e: { tenantId: string }) => e.tenantId !== novacure.id)).toBe(true);
    });

    it('NovaCure users cannot see the other tenant’s data via search', async () => {
      const r = await (await c.as(U.qaManager)).get('/search?q=ZEN').expect(200);
      expect(r.body.data.hits).toHaveLength(0);
    });
  });

  describe('role-based access control (server-side)', () => {
    it('QC analyst cannot QA-release material or approve QC', async () => {
      const qc = await c.as(U.qcAnalyst);
      const lot = await c.prisma.inventoryLot.findFirstOrThrow({ where: { status: 'QUARANTINE', itemType: 'MATERIAL' } });
      const r = await qc.post(`/inventory/lots/${lot.id}/disposition`, { decision: 'RELEASE', ...sign }).expect(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
      const sample = await c.prisma.qcSample.findFirstOrThrow();
      await qc.post(`/qc/samples/${sample.id}/approve`, sign).expect(403);
    });
    it('operator cannot create batches, adjust stock or view the audit trail', async () => {
      const op = await c.as(U.operator);
      await op.post('/batches', {}).expect(403);
      const lot = await c.prisma.inventoryLot.findFirstOrThrow();
      await op.post(`/inventory/lots/${lot.id}/adjust`, { quantity: -1, reason: 'test test' }).expect(403);
      await op.get('/audit/events').expect(403);
    });
    it('only warehouse roles (inventory.issue) can issue materials; planners can reserve but not issue', async () => {
      const batch = await c.prisma.batch.findFirstOrThrow();
      await (await c.as(U.planner)).post(`/batches/${batch.id}/issue-materials`).expect(403);
      await (await c.as(U.supervisor)).post(`/batches/${batch.id}/issue-materials`).expect(403);
    });
    it('management viewer is read-only', async () => {
      const m = await c.as(U.management);
      await m.get('/analytics/command-center').expect(200);
      await m.post('/deviations', {}).expect(403);
    });
    it('site-scoped warehouse officer cannot receive at another site', async () => {
      const lhr = await c.prisma.site.findFirstOrThrow({ where: { code: 'LHR' } });
      const supplier = await c.prisma.supplier.findFirstOrThrow({ where: { code: 'SUP-003' } });
      const mat = await c.prisma.material.findFirstOrThrow({ where: { code: 'EXC-MCC-101' } });
      const wh = await c.prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-LHR-FG' } });
      const r = await (await c.as(U.warehouseOfficer))
        .post('/goods-receipts', { siteId: lhr.id, supplierId: supplier.id, lines: [{ materialId: mat.id, supplierBatch: 'X', quantity: 1, mfgDate: days(-5), expiryDate: days(300), warehouseId: wh.id }] })
        .expect(403);
      expect(r.body.error.message).toMatch(/for this site/);
    });
  });

  describe('data integrity', () => {
    it('the database rejects UPDATE / DELETE on audit events and e-signatures', async () => {
      await expect(c.prisma.$executeRawUnsafe(`UPDATE audit_events SET reason = 'tampered'`)).rejects.toThrow(/append-only/);
      await expect(c.prisma.$executeRawUnsafe(`DELETE FROM audit_events`)).rejects.toThrow(/append-only/);
      await expect(c.prisma.$executeRawUnsafe(`UPDATE electronic_signatures SET meaning = 'x'`)).rejects.toThrow(/append-only/);
      await expect(c.prisma.$executeRawUnsafe(`DELETE FROM inventory_transactions`)).rejects.toThrow(/append-only/);
    });
    it('a failed e-signature changes nothing (transaction rolled back) and is itself audited', async () => {
      const lot = await c.prisma.inventoryLot.findFirstOrThrow({ where: { status: 'QUARANTINE', itemType: 'MATERIAL' } });
      const before = await c.prisma.auditEvent.count({ where: { entityId: lot.id, action: 'SIGN' } });
      const r = await (await c.as(U.qaManager)).post(`/inventory/lots/${lot.id}/disposition`, { decision: 'REJECT', password: 'not-my-password', reason: 'testing rollback' }).expect(401);
      expect(r.body.error.code).toBe('SIGNATURE_INVALID');
      expect((await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } })).status).toBe(lot.status);
      expect(await c.prisma.electronicSignature.count({ where: { entityId: lot.id } })).toBe(0);
      const failed = await c.prisma.auditEvent.findFirst({ where: { entityId: lot.id, action: 'SIGN', reason: { contains: 'FAILED' } } });
      expect(failed).not.toBeNull();
      expect(await c.prisma.auditEvent.count({ where: { entityId: lot.id, action: 'SIGN' } })).toBe(before + 1);
    });
    it('input validation rejects unknown fields and malformed ids', async () => {
      const qa = await c.as(U.qaManager);
      await qa.get('/batches/not-a-uuid').expect(400);
      const r = await qa.post('/deviations', { title: 'x', hacker: true }).expect(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
    });
    it('the audit hash chain verifies', async () => {
      const v = await (await c.as(U.auditor)).get('/audit/verify').expect(200);
      expect(v.body.data.valid).toBe(true);
    });
    it('sends security headers', async () => {
      const r = await http().get('/api/v1/health');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-powered-by']).toBeUndefined();
    });
  });
});
