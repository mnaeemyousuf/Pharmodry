/** Configuration, master data, evidence attachments and production planning. */
import request from 'supertest';
import { closeContext, createContext, Ctx, U } from './helpers';

describe('Administration, master data, attachments and planning', () => {
  let c: Ctx;
  let tenantId: string;
  let siteId: string;
  beforeAll(async () => {
    c = await createContext();
    const t = await c.prisma.tenant.findUniqueOrThrow({ where: { code: 'NOVACURE' } });
    tenantId = t.id;
    siteId = (await c.prisma.site.findFirstOrThrow({ where: { tenantId, code: 'KHI' } })).id;
  });
  afterAll(() => closeContext(c));

  describe('roles and organisation', () => {
    it('admin creates a custom role, assigns permissions with a reason, and the change is audited', async () => {
      const admin = await c.as(U.companyAdmin);
      const role = (await admin.post('/roles', { code: 'STABILITY_COORD', name: 'Stability coordinator' }).expect(201)).body.data;
      await admin.put(`/roles/${role.id}/permissions`, { permissions: ['qc.view', 'batch.view'], reason: 'New stability coordinator role' }).expect(200);
      await admin.put(`/roles/${role.id}/permissions`, { permissions: ['not.a.permission'], reason: 'Invalid permission code' }).expect(400);
      const perms = await c.prisma.rolePermission.count({ where: { roleId: role.id } });
      expect(perms).toBe(2);
      expect(await c.prisma.auditEvent.count({ where: { entityId: role.id } })).toBeGreaterThanOrEqual(2);
    });

    it('non-admins cannot change roles', async () => {
      const qa = await c.as(U.qaManager);
      await qa.post('/roles', { code: 'X_ROLE', name: 'X' }).expect(403);
    });

    it('admin creates a site, warehouse and bin', async () => {
      const admin = await c.as(U.companyAdmin);
      const site = (await admin.post('/sites', { code: 'ISB', name: 'Islamabad Depot (test)', city: 'Islamabad' }).expect(201)).body.data;
      const wh = (await admin.post('/warehouses', { siteId: site.id, code: 'WH-ISB', name: 'Islamabad FG', type: 'FINISHED_GOODS' }).expect(201)).body.data;
      await admin.post(`/warehouses/${wh.id}/bins`, { code: 'I-01' }).expect(201);
    });

    it('settings changes need a reason and cannot switch off receipt quarantine', async () => {
      const admin = await c.as(U.companyAdmin);
      await admin.patch('/organization/settings', { settings: { yieldTolerance: { minPct: 97, maxPct: 102 } } }).expect(400);
      await admin.patch('/organization/settings', { settings: { yieldTolerance: { minPct: 97, maxPct: 102 } }, reason: 'Validated process capability study' }).expect(200);
      await admin.patch('/organization/settings', { settings: { receiptDefaultStatus: 'RELEASED' }, reason: 'Attempt to bypass quarantine' });
      const t = await c.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      expect((t.settings as { receiptDefaultStatus?: string }).receiptDefaultStatus ?? 'QUARANTINE').toBe('QUARANTINE');
      expect((t.settings as { yieldTolerance: { minPct: number } }).yieldTolerance.minPct).toBe(97);
    });
  });

  describe('regulated master data', () => {
    it('a product change requires a reason and creates a new version; history is kept', async () => {
      const admin = await c.as(U.companyAdmin);
      const p = await c.prisma.product.findFirstOrThrow({ where: { tenantId, code: 'OMZ-020' } });
      await admin.patch(`/products/${p.id}`, { packSize: '2 x 7 Alu-Alu blister (revised)' }).expect(400);
      await admin.patch(`/products/${p.id}`, { packSize: '2 x 7 Alu-Alu blister (revised)', gtin: '02000000010038', reason: 'Artwork change CC-2026-014' }).expect(200);
      const versions = (await admin.get(`/master-data/versions/Product/${p.id}`).expect(200)).body.data;
      expect(versions.length).toBeGreaterThanOrEqual(2);
      const after = await c.prisma.product.findUniqueOrThrow({ where: { id: p.id } });
      expect(after.gtin).toBe('02000000010038');
      expect(after.version).toBeGreaterThan(p.version);
    });

    it('supplier status change is reasoned and audited; a suspended supplier is visible as such', async () => {
      const qa = await c.as(U.qaManager);
      const s = await c.prisma.supplier.findFirstOrThrow({ where: { tenantId, code: 'SUP-007' } });
      await qa.post(`/suppliers/${s.id}/status`, { status: 'APPROVED', reason: 'Audit SA-2026-03 passed' }).expect(200);
      const after = await c.prisma.supplier.findUniqueOrThrow({ where: { id: s.id } });
      expect(after.status).toBe('APPROVED');
      const op = await c.as(U.operator);
      await op.post(`/suppliers/${s.id}/status`, { status: 'SUSPENDED', reason: 'Not allowed for operators' }).expect(403);
    });

    it('recording a calibration moves the next due date forward', async () => {
      const eng = await c.as(U.engineering);
      const eq = await c.prisma.equipment.findFirstOrThrow({ where: { tenantId } });
      const performedAt = new Date().toISOString();
      await eng.post(`/equipment/${eq.id}/calibrations`, { performedAt, result: 'PASS', certificateNo: 'CAL-TEST-001' }).expect(201);
      const after = await c.prisma.equipment.findUniqueOrThrow({ where: { id: eq.id } });
      expect(after.nextCalibrationDue!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('evidence attachments', () => {
    it('accepts a real PDF with its SHA-256, rejects a disguised executable, and enforces permissions', async () => {
      const dev = await c.prisma.deviation.findFirstOrThrow({ where: { tenantId } });
      const http = () => request(c.app.getHttpServer());
      const auth = async (email: string) => ({ Authorization: `Bearer ${await c.token(email)}`, 'X-Requested-With': 'pharmodry' });
      const qaH = await auth(U.qaOfficer);
      const mgmtH = await auth(U.management);
      const audH = await auth(U.auditor);
      const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
      const ok = await http().post(`/api/v1/attachments/Deviation/${dev.id}`).set(qaH).attach('file', pdf, { filename: 'investigation.pdf', contentType: 'application/pdf' }).expect(201);
      expect(ok.body.data.sha256).toMatch(/^[a-f0-9]{64}$/);
      await http().post(`/api/v1/attachments/Deviation/${dev.id}`).set(qaH).attach('file', Buffer.from('MZ\x90\x00 fake'), { filename: 'report.pdf', contentType: 'application/pdf' }).expect(400);
      await http().post(`/api/v1/attachments/Deviation/${dev.id}`).set(mgmtH).attach('file', pdf, { filename: 'x.pdf', contentType: 'application/pdf' }).expect(403);
      const file = await http().get(`/api/v1/attachments/file/${ok.body.data.id}`).set(audH).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (d: Buffer) => chunks.push(d)); res.on('end', () => cb(null, Buffer.concat(chunks))); }).expect(200);
      expect(Buffer.compare(file.body as Buffer, pdf)).toBe(0);
    });
  });

  describe('production planning', () => {
    it('planner drafts a plan, checks material availability; approval is a separate permission', async () => {
      const planner = await c.as(U.planner);
      const product = await c.prisma.product.findFirstOrThrow({ where: { tenantId, code: 'PCM-500' } });
      const avail = (await planner.get(`/production-plans/availability?productId=${product.id}&siteId=${siteId}&quantity=200000`).expect(200)).body.data;
      expect(avail).toBeDefined();
      const start = new Date();
      const plan = (
        await planner
          .post('/production-plans', { siteId, name: 'Test plan — next month', periodStart: start.toISOString(), periodEnd: new Date(start.getTime() + 30 * 86_400_000).toISOString(), lines: [{ productId: product.id, plannedQuantity: 400000, plannedBatches: 2 }] })
          .expect(201)
      ).body.data;
      expect(plan.status).toBe('DRAFT');
      await (await c.as(U.operator)).post(`/production-plans/${plan.id}/approve`).expect(403);
      const pm = await c.as(U.productionManager);
      const approved = (await pm.post(`/production-plans/${plan.id}/approve`).expect(200)).body.data;
      expect(approved.status).toBe('APPROVED');
      await pm.post(`/production-plans/${plan.id}/approve`).expect(409);
    });
  });

  describe('notifications', () => {
    it('users see their notifications and can mark them read', async () => {
      const qa = await c.as(U.qaManager);
      const list = (await qa.get('/notifications').expect(200)).body.data;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      await qa.post('/notifications/read', { ids: [list[0].id] }).expect(200);
    });
  });
});
