/* Demo master data for NovaCure Pharmaceuticals Pvt Ltd (fictional). */
import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_ROLES, DEFAULT_TENANT_SETTINGS, PERMISSIONS } from '@pharmodry/types';
import { PasswordService } from '../../src/modules/auth/password.service';

export const DAY = 86_400_000;
export const d = (offsetDays: number, hour = 9) => {
  const x = new Date(Date.now() + offsetDays * DAY);
  x.setUTCHours(hour, 0, 0, 0);
  return x;
};

export interface DemoUser {
  key: string;
  email: string;
  fullName: string;
  title: string;
  role: string;
  dept: string;
  siteScoped?: boolean;
}

export const DEMO_USERS: DemoUser[] = [
  { key: 'superAdmin', email: 'super.admin@novacure.demo', fullName: 'Imran Siddiqui', title: 'IT & Systems Head', role: 'SUPER_ADMIN', dept: 'MGT' },
  { key: 'companyAdmin', email: 'company.admin@novacure.demo', fullName: 'Ayesha Khan', title: 'Systems Administrator', role: 'COMPANY_ADMIN', dept: 'MGT' },
  { key: 'plantManager', email: 'plant.manager@novacure.demo', fullName: 'Tariq Mahmood', title: 'Plant Manager — Karachi', role: 'PLANT_MANAGER', dept: 'MGT' },
  { key: 'productionManager', email: 'production.manager@novacure.demo', fullName: 'Bilal Hussain', title: 'Production Manager', role: 'PRODUCTION_MANAGER', dept: 'PROD' },
  { key: 'supervisor', email: 'production.supervisor@novacure.demo', fullName: 'Usman Farooq', title: 'Production Supervisor — Solids', role: 'PRODUCTION_SUPERVISOR', dept: 'PROD' },
  { key: 'operator', email: 'operator@novacure.demo', fullName: 'Kamran Ali', title: 'Production Operator', role: 'PRODUCTION_OPERATOR', dept: 'PROD' },
  { key: 'operator2', email: 'operator2@novacure.demo', fullName: 'Zainab Raza', title: 'Production Operator', role: 'PRODUCTION_OPERATOR', dept: 'PROD' },
  { key: 'qaManager', email: 'qa.manager@novacure.demo', fullName: 'Dr. Nadia Qureshi', title: 'Head of Quality Assurance', role: 'QA_MANAGER', dept: 'QA' },
  { key: 'qaOfficer', email: 'qa.officer@novacure.demo', fullName: 'Hamza Sheikh', title: 'QA Officer', role: 'QA_OFFICER', dept: 'QA' },
  { key: 'qcManager', email: 'qc.manager@novacure.demo', fullName: 'Farah Javed', title: 'QC Manager', role: 'QC_MANAGER', dept: 'QC' },
  { key: 'qcAnalyst', email: 'qc.analyst@novacure.demo', fullName: 'Ali Raza', title: 'QC Analyst', role: 'QC_ANALYST', dept: 'QC' },
  { key: 'qcAnalyst2', email: 'qc.analyst2@novacure.demo', fullName: 'Sana Malik', title: 'QC Analyst', role: 'QC_ANALYST', dept: 'QC' },
  { key: 'warehouseManager', email: 'warehouse.manager@novacure.demo', fullName: 'Asif Iqbal', title: 'Warehouse Manager', role: 'WAREHOUSE_MANAGER', dept: 'WH' },
  { key: 'warehouseOfficer', email: 'warehouse.officer@novacure.demo', fullName: 'Faisal Nawaz', title: 'Warehouse Officer (Karachi)', role: 'WAREHOUSE_OFFICER', dept: 'WH', siteScoped: true },
  { key: 'procurementManager', email: 'procurement.manager@novacure.demo', fullName: 'Rabia Aslam', title: 'Procurement Manager', role: 'PROCUREMENT_MANAGER', dept: 'PROC' },
  { key: 'procurementOfficer', email: 'procurement.officer@novacure.demo', fullName: 'Junaid Akhtar', title: 'Procurement Officer', role: 'PROCUREMENT_OFFICER', dept: 'PROC' },
  { key: 'planner', email: 'planner@novacure.demo', fullName: 'Mehwish Anwar', title: 'Supply Chain Planner', role: 'SUPPLY_CHAIN_PLANNER', dept: 'SCM' },
  { key: 'engineering', email: 'engineering@novacure.demo', fullName: 'Naveed Ashraf', title: 'Engineering & Maintenance Lead', role: 'ENGINEERING', dept: 'ENG' },
  { key: 'regulatory', email: 'regulatory@novacure.demo', fullName: 'Hina Baig', title: 'Regulatory Affairs Officer', role: 'REGULATORY_AFFAIRS', dept: 'RA' },
  { key: 'auditor', email: 'auditor@novacure.demo', fullName: 'Omar Zafar', title: 'Internal Auditor', role: 'AUDITOR', dept: 'QA' },
  { key: 'management', email: 'management@novacure.demo', fullName: 'Shahid Latif', title: 'Chief Executive Officer', role: 'MANAGEMENT_VIEWER', dept: 'MGT' },
];

export type Ids = Record<string, string>;

export async function seedPermissions(prisma: PrismaClient) {
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, create: { code, description, module: code.split('.')[0] }, update: { description } });
  }
}

export async function seedTenant(prisma: PrismaClient, opts: { code: string; name: string; legalName: string; password: string; users: DemoUser[]; siteDefs: { code: string; name: string; city: string; licenseNo?: string }[] }) {
  const passwords = new PasswordService();
  const tenant = await prisma.tenant.create({
    data: { code: opts.code, name: opts.name, legalName: opts.legalName, settings: DEFAULT_TENANT_SETTINGS as unknown as Prisma.InputJsonValue },
  });
  const sites: Ids = {};
  for (const s of opts.siteDefs) sites[s.code] = (await prisma.site.create({ data: { tenantId: tenant.id, ...s } })).id;
  const perms = await prisma.permission.findMany();
  const roles: Ids = {};
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: true,
        permissions: { create: r.permissions.map((p) => ({ permissionId: perms.find((x) => x.code === p)!.id })) },
      },
    });
    roles[r.code] = role.id;
  }
  const depts: Ids = {};
  for (const [code, name] of [
    ['PROD', 'Production'],
    ['QA', 'Quality Assurance'],
    ['QC', 'Quality Control'],
    ['WH', 'Warehouse'],
    ['PROC', 'Procurement'],
    ['SCM', 'Supply Chain'],
    ['RA', 'Regulatory Affairs'],
    ['ENG', 'Engineering'],
    ['FIN', 'Finance'],
    ['MGT', 'Management'],
  ]) {
    depts[code] = (await prisma.department.create({ data: { tenantId: tenant.id, code: `${opts.code}-${code}`, name, siteId: Object.values(sites)[0] } })).id;
  }
  const hash = await passwords.hash(opts.password);
  const users: Ids = {};
  for (const u of opts.users) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: u.email,
        fullName: u.fullName,
        title: u.title,
        departmentId: depts[u.dept],
        passwordHash: hash,
        roles: { create: [{ tenantId: tenant.id, roleId: roles[u.role], siteId: u.siteScoped ? Object.values(sites)[0] : null }] },
      },
    });
    users[u.key] = user.id;
  }
  return { tenant, sites, roles, depts, users };
}

export async function seedMasterData(prisma: PrismaClient, tenantId: string, sites: Ids, users: Ids) {
  const KHI = sites.KHI;
  const LHR = sites.LHR;
  const snapshot = async (entityType: string, e: { id: string; version?: number }) =>
    prisma.masterDataVersion.create({ data: { tenantId, entityType, entityId: e.id, version: e.version ?? 1, snapshot: JSON.parse(JSON.stringify(e)), reason: 'Initial version (demo data load)', changedById: users.companyAdmin } });

  const uom: Ids = {};
  for (const [code, name] of [
    ['KG', 'Kilogram'],
    ['G', 'Gram'],
    ['TAB', 'Tablet'],
    ['CAP', 'Capsule'],
    ['TH', 'Thousand units'],
    ['EA', 'Each'],
    ['L', 'Litre'],
  ])
    uom[code] = (await prisma.unitOfMeasure.create({ data: { tenantId, code, name } })).id;

  const cat: Ids = {};
  for (const [code, name] of [
    ['ANALG', 'Analgesics & Antipyretics'],
    ['ANTIB', 'Antibiotics'],
    ['GASTRO', 'Gastrointestinal'],
  ])
    cat[code] = (await prisma.productCategory.create({ data: { tenantId, code, name } })).id;
  const df: Ids = {};
  for (const [code, name] of [
    ['TAB', 'Tablet'],
    ['CAP', 'Capsule'],
    ['SYR', 'Syrup'],
  ])
    df[code] = (await prisma.dosageForm.create({ data: { tenantId, code, name } })).id;

  // Warehouses & bins
  const wh: Ids = {};
  const bins: Ids = {};
  const whDefs: [string, string, string, string, 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS' | 'REJECT', string[]][] = [
    ['KHI', 'WH-RM', 'Raw Material Store', 'Below 25 °C, RH ≤ 60 %', 'RAW_MATERIAL', ['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'COLD-01']],
    ['KHI', 'WH-PM', 'Packaging Material Store', 'Ambient, dry', 'PACKAGING', ['P-01', 'P-02', 'P-03']],
    ['KHI', 'WH-FG', 'Finished Goods Store', 'Below 30 °C', 'FINISHED_GOODS', ['F-01', 'F-02', 'F-03']],
    ['KHI', 'WH-REJ', 'Rejected Material Cage', 'Locked, segregated', 'REJECT', ['R-01']],
    ['LHR', 'WH-LHR-FG', 'Lahore Distribution Warehouse', 'Below 30 °C', 'FINISHED_GOODS', ['L-01']],
  ];
  for (const [site, code, name, conditions, type, b] of whDefs) {
    const w = await prisma.warehouse.create({ data: { tenantId, siteId: sites[site], code, name, type, conditions } });
    wh[code] = w.id;
    for (const bc of b) bins[`${code}/${bc}`] = (await prisma.binLocation.create({ data: { tenantId, warehouseId: w.id, code: bc } })).id;
  }
  await prisma.productionLine.createMany({
    data: [
      { tenantId, siteId: KHI, code: 'KHI-SOL-1', name: 'Solid Dosage Line 1 (Tablets)', area: 'Block A' },
      { tenantId, siteId: KHI, code: 'KHI-CAP-1', name: 'Capsule Line 1', area: 'Block B' },
      { tenantId, siteId: LHR, code: 'LHR-PKG-1', name: 'Secondary Packing Line', area: 'Hall 1' },
    ],
  });

  // Materials
  const mat: Ids = {};
  const matDefs: [string, string, 'API' | 'EXCIPIENT' | 'PACKAGING', string, number, number, number, number | null, string, string][] = [
    ['API-PCM-001', 'Paracetamol (Ph. Eur.)', 'API', 'KG', 150, 42, 1250, 36, 'Store below 25 °C, protect from light', 'RM'],
    ['API-AMX-001', 'Amoxicillin Trihydrate (BP)', 'API', 'KG', 80, 60, 9800, 24, 'Store below 25 °C in tightly closed containers', 'RM'],
    ['API-OMZ-001', 'Omeprazole Enteric-Coated Pellets 8.5 %', 'API', 'KG', 40, 75, 14500, 12, '2–8 °C, protect from moisture', 'RM'],
    ['EXC-MCC-101', 'Microcrystalline Cellulose PH-101', 'EXCIPIENT', 'KG', 50, 30, 950, 36, 'Below 30 °C, dry', 'EX'],
    ['EXC-STA-001', 'Maize Starch', 'EXCIPIENT', 'KG', 30, 21, 300, 24, 'Below 30 °C, dry', 'EX'],
    ['EXC-PVP-K30', 'Povidone K30', 'EXCIPIENT', 'KG', 10, 45, 3200, 24, 'Below 25 °C, hygroscopic', 'EX'],
    ['EXC-MGS-001', 'Magnesium Stearate', 'EXCIPIENT', 'KG', 10, 30, 1800, 36, 'Below 30 °C', 'EX'],
    ['PKG-PVC-250', 'PVC Film 250 µm (clear)', 'PACKAGING', 'KG', 100, 30, 650, null, 'Ambient', 'PM'],
    ['PKG-ALU-020', 'Aluminium Blister Foil 20 µm (printed)', 'PACKAGING', 'KG', 40, 30, 2400, null, 'Ambient', 'PM'],
    ['PKG-CAP-0', 'Empty Hard Gelatin Capsules Size 0', 'PACKAGING', 'TH', 300, 45, 2600, 36, 'Below 25 °C, 35–65 % RH', 'PM'],
    ['PKG-CAP-2', 'Empty Hard Gelatin Capsules Size 2', 'PACKAGING', 'TH', 150, 45, 2100, 36, 'Below 25 °C, 35–65 % RH', 'PM'],
  ];
  for (const [code, name, type, u, safety, lead, cost, retest, storage, prefix] of matDefs) {
    const m = await prisma.material.create({
      data: { tenantId, code, name, type, uomId: uom[u], safetyStock: safety, leadTimeDays: lead, unitCost: cost, retestPeriodMonths: retest, storageRequirement: storage, specificationRef: `SPEC-${code}`, lotPrefix: prefix },
    });
    mat[code] = m.id;
    await snapshot('Material', m);
  }

  // Products
  const prod: Ids = {};
  const prodDefs: [string, string, string, string, string, string, number, string, string, string, number, number][] = [
    ['PCM-500', 'Paracetamol', 'NovaPara 500', 'TAB', '500 mg', '10 x 10 Alu-PVC blister', 36, 'Store below 30 °C, protect from moisture', 'Reg. No. 0123456 (demo)', 'PCM', 200000, 3.2],
    ['AMX-500', 'Amoxicillin', 'NovaMox 500', 'CAP', '500 mg', '2 x 10 Alu-PVC blister', 24, 'Store below 25 °C', 'Reg. No. 0234567 (demo)', 'AMX', 100000, 14.5],
    ['OMZ-020', 'Omeprazole', 'NovaZole 20', 'CAP', '20 mg', '2 x 7 Alu-Alu blister', 24, 'Store below 25 °C, protect from moisture', 'Reg. No. 0345678 (demo)', 'OMZ', 100000, 11],
  ];
  const catOf: Record<string, string> = { PCM: 'ANALG', AMX: 'ANTIB', OMZ: 'GASTRO' };
  for (const [code, generic, brand, form, strength, pack, shelf, storage, reg, prefix, size, price] of prodDefs) {
    const p = await prisma.product.create({
      data: {
        tenantId,
        code,
        genericName: generic,
        brandName: brand,
        dosageFormId: df[form],
        categoryId: cat[catOf[prefix]],
        strength,
        packSize: pack,
        shelfLifeMonths: shelf,
        storageConditions: storage,
        registrationNumber: reg,
        batchPrefix: prefix,
        gtin: { PCM: '02000000010014', AMX: '02000000010021' }[prefix] ?? null,
        uomId: uom[form === 'TAB' ? 'TAB' : 'CAP'],
        standardBatchSize: size,
        unitPrice: price,
      },
    });
    prod[prefix] = p.id;
    await snapshot('Product', p);
  }

  // BOMs (per standard batch)
  const boms: Ids = {};
  const bomDefs: Record<string, [string, number, number, boolean, string][]> = {
    PCM: [
      ['API-PCM-001', 100, 1, true, 'DISP'],
      ['EXC-MCC-101', 18, 2, false, 'DISP'],
      ['EXC-STA-001', 8, 2, false, 'DISP'],
      ['EXC-PVP-K30', 3, 2, false, 'DISP'],
      ['EXC-MGS-001', 1, 2, false, 'DISP'],
      ['PKG-PVC-250', 60, 3, false, 'DISP'],
      ['PKG-ALU-020', 15, 3, false, 'DISP'],
    ],
    AMX: [
      ['API-AMX-001', 57.4, 1, true, 'DISP'],
      ['EXC-MGS-001', 0.5, 2, false, 'DISP'],
      ['PKG-CAP-0', 101, 1, false, 'DISP'],
      ['PKG-PVC-250', 35, 3, false, 'DISP'],
      ['PKG-ALU-020', 9, 3, false, 'DISP'],
    ],
    OMZ: [
      ['API-OMZ-001', 23.5, 1, true, 'DISP'],
      ['PKG-CAP-2', 101, 1, false, 'DISP'],
      ['PKG-ALU-020', 14, 3, false, 'DISP'],
    ],
  };
  for (const [prefix, lines] of Object.entries(bomDefs)) {
    const bom = await prisma.bom.create({
      data: {
        tenantId,
        productId: prod[prefix],
        version: 1,
        batchSize: prefix === 'PCM' ? 200000 : 100000,
        lines: { create: lines.map(([m, q, tol, crit, step]) => ({ tenantId, materialId: mat[m], quantity: q, tolerancePct: tol, isCritical: crit, stepCode: step })) },
      },
      include: { lines: true },
    });
    boms[prefix] = bom.id;
    await snapshot('Bom', bom);
  }

  // Routings (master eBMR templates)
  type P = { code: string; label: string; unit?: string; min?: number; max?: number; required?: boolean };
  type S = { code: string; name: string; instructions: string; equipmentType?: string; minutes: number; consumes?: boolean; output?: boolean; params?: P[]; ipc?: P[] };
  const disp: S = { code: 'DISP', name: 'Dispensing', instructions: 'Verify line clearance and material status labels (RELEASED). Weigh each issued lot on a calibrated balance under LAF; record actual quantity per lot.', equipmentType: 'BALANCE', minutes: 90, consumes: true, params: [{ code: 'roomTemp', label: 'Room temperature', unit: '°C', min: 15, max: 25 }, { code: 'rh', label: 'Relative humidity', unit: '%', min: 30, max: 60 }] };
  const pack: (output: string) => S = (unit) => ({ code: 'PACK', name: 'Blister Packing', instructions: `Run blister packing; perform leak test every hour; record final good output in ${unit}.`, equipmentType: 'BLISTER', minutes: 360, output: true, params: [{ code: 'sealTemp', label: 'Sealing temperature', unit: '°C', min: 180, max: 210 }], ipc: [{ code: 'leakTest', label: 'Leak test failures', unit: 'blisters', min: 0, max: 0 }] });
  const routingDefs: Record<string, S[]> = {
    PCM: [
      disp,
      { code: 'GRAN', name: 'Mixing & Granulation', instructions: 'Dry mix API, MCC and starch for 10 min at slow impeller; add PVP K30 binder solution; granulate to end point.', equipmentType: 'GRANULATOR', minutes: 120, params: [{ code: 'mixTime', label: 'Dry mixing time', unit: 'min', min: 8, max: 12 }, { code: 'impeller', label: 'Impeller speed', unit: 'rpm', min: 100, max: 200 }] },
      { code: 'DRY', name: 'Drying', instructions: 'Dry granules in FBD at inlet 60 °C until LOD ≤ 2.0 %.', equipmentType: 'DRYER', minutes: 90, params: [{ code: 'inletTemp', label: 'Inlet air temperature', unit: '°C', min: 55, max: 65 }], ipc: [{ code: 'lod', label: 'Loss on drying', unit: '%', min: 0, max: 2.0 }] },
      { code: 'COMP', name: 'Compression', instructions: 'Lubricate with magnesium stearate (3 min), compress on qualified press. IPC every 30 minutes.', equipmentType: 'TABLET_PRESS', minutes: 480, params: [{ code: 'speed', label: 'Turret speed', unit: 'rpm', min: 20, max: 45 }], ipc: [{ code: 'avgWeight', label: 'Average weight', unit: 'mg', min: 637, max: 663 }, { code: 'hardness', label: 'Hardness', unit: 'kp', min: 6, max: 12 }, { code: 'friability', label: 'Friability', unit: '%', min: 0, max: 1 }] },
      pack('tablets'),
    ],
    AMX: [
      disp,
      { code: 'BLEND', name: 'Blending', instructions: 'Blend amoxicillin trihydrate with magnesium stearate in octagonal blender for 15 minutes.', equipmentType: 'BLENDER', minutes: 60, params: [{ code: 'blendTime', label: 'Blending time', unit: 'min', min: 14, max: 16 }] },
      { code: 'ENCAP', name: 'Encapsulation', instructions: 'Fill size 0 capsules on qualified encapsulator; IPC fill weight every 30 minutes.', equipmentType: 'ENCAPSULATOR', minutes: 420, ipc: [{ code: 'fillWeight', label: 'Average fill weight', unit: 'mg', min: 555, max: 595 }] },
      pack('capsules'),
    ],
    OMZ: [
      disp,
      { code: 'ENCAP', name: 'Encapsulation', instructions: 'Fill size 2 capsules with omeprazole pellets; control room RH ≤ 45 %.', equipmentType: 'ENCAPSULATOR', minutes: 360, params: [{ code: 'rh', label: 'Room RH', unit: '%', min: 20, max: 45 }], ipc: [{ code: 'fillWeight', label: 'Average fill weight', unit: 'mg', min: 225, max: 245 }] },
      pack('capsules'),
    ],
  };
  const routings: Ids = {};
  for (const [prefix, steps] of Object.entries(routingDefs)) {
    const r = await prisma.routing.create({
      data: {
        tenantId,
        productId: prod[prefix],
        version: 1,
        steps: {
          create: steps.map((s, i) => ({
            tenantId,
            sequence: (i + 1) * 10,
            code: s.code,
            name: s.name,
            instructions: s.instructions,
            equipmentType: s.equipmentType,
            expectedDurationMin: s.minutes,
            requiresVerification: true,
            consumesMaterials: !!s.consumes,
            recordsOutput: !!s.output,
            parameters: (s.params ?? []) as Prisma.InputJsonValue,
            ipcChecks: (s.ipc ?? []) as Prisma.InputJsonValue,
          })),
        },
      },
      include: { steps: true },
    });
    routings[prefix] = r.id;
    await snapshot('Routing', r);
  }

  // Equipment
  const eq: Ids = {};
  const eqDefs: [string, string, string, string, string, number, number][] = [
    ['BAL-01', 'Dispensing balance 600 kg', 'BALANCE', 'Dispensing booth 1', 'Mettler-type (demo)', 30, 20],
    ['BAL-02', 'Dispensing balance 60 kg', 'BALANCE', 'Dispensing booth 2', 'Mettler-type (demo)', 30, 25],
    ['RMG-01', 'Rapid Mixer Granulator 600 L', 'GRANULATOR', 'Granulation suite A', 'Demo Engineering', 180, 90],
    ['FBD-01', 'Fluid Bed Dryer 300 kg', 'DRYER', 'Granulation suite A', 'Demo Engineering', 180, 120],
    ['TP-01', 'Rotary Tablet Press 35-station', 'TABLET_PRESS', 'Compression room 1', 'Demo Engineering', 90, 40],
    ['TP-02', 'Rotary Tablet Press 27-station', 'TABLET_PRESS', 'Compression room 2', 'Demo Engineering', 90, -6],
    ['BLD-01', 'Octagonal Blender 500 L', 'BLENDER', 'Capsule block', 'Demo Engineering', 180, 100],
    ['ENC-01', 'Automatic Capsule Filler', 'ENCAPSULATOR', 'Capsule block', 'Demo Engineering', 90, 55],
    ['BLS-01', 'Alu-PVC Blister Machine', 'BLISTER', 'Packing hall 1', 'Demo Engineering', 90, 4],
    ['HPLC-01', 'HPLC system (QC)', 'HPLC', 'QC laboratory', 'Demo Instruments', 180, 5],
    ['DT-01', 'Dissolution tester USP II', 'DISSOLUTION', 'QC laboratory', 'Demo Instruments', 180, 70],
  ];
  for (const [code, desc, type, location, manufacturer, freq, dueIn] of eqDefs) {
    const e = await prisma.equipment.create({
      data: {
        tenantId,
        siteId: KHI,
        code,
        description: desc,
        type,
        location,
        manufacturer,
        model: `${code}-M`,
        serialNumber: `SN-${code}-2021`,
        department: type === 'HPLC' || type === 'DISSOLUTION' ? 'QC' : 'Production',
        calibrationFrequencyDays: freq,
        lastCalibrationAt: d(dueIn - freq),
        nextCalibrationDue: d(dueIn),
      },
    });
    eq[code] = e.id;
    await prisma.calibration.create({ data: { tenantId, equipmentId: e.id, performedAt: d(dueIn - freq), nextDue: d(dueIn), result: 'PASS — within tolerance', certificateNo: `CAL-${code}-${new Date().getFullYear()}`, performedById: users.engineering } });
  }

  // Test methods & specifications
  const tm: Ids = {};
  for (const [code, name, technique] of [
    ['TM-ASSAY-HPLC', 'Assay by HPLC', 'HPLC'],
    ['TM-DISS', 'Dissolution (USP Apparatus II)', 'Dissolution'],
    ['TM-LOD', 'Loss on drying', 'Gravimetric'],
    ['TM-ID-IR', 'Identification by IR', 'FTIR'],
    ['TM-DT', 'Disintegration time', 'Disintegration tester'],
    ['TM-VIS', 'Visual inspection', 'Visual'],
  ])
    tm[code] = (await prisma.testMethod.create({ data: { tenantId, code, name, technique, reference: 'In-house validated method (demo)' } })).id;

  type T = { name: string; method?: string; type: 'NUMERIC' | 'PASS_FAIL' | 'TEXT'; op: 'RANGE' | 'MIN' | 'MAX' | 'EQUALS' | 'INFO'; min?: number; max?: number; unit?: string; text?: string };
  const specs: Ids = {};
  const mkSpec = async (code: string, name: string, stage: 'RAW_MATERIAL' | 'PACKAGING_MATERIAL' | 'FINISHED_PRODUCT', target: { materialId?: string; productId?: string }, tests: T[]) => {
    const s = await prisma.qcSpecification.create({
      data: {
        tenantId,
        code,
        name,
        stage,
        ...target,
        tests: {
          create: tests.map((t, i) => ({
            tenantId,
            sequence: i + 1,
            name: t.name,
            testMethodId: t.method ? tm[t.method] : null,
            resultType: t.type,
            operator: t.op,
            minValue: t.min,
            maxValue: t.max,
            unit: t.unit,
            expectedText: t.text,
          })),
        },
      },
      include: { tests: true },
    });
    specs[code] = s.id;
    await snapshot('QcSpecification', s);
  };
  await mkSpec('SPEC-API-PCM-001', 'Paracetamol API — incoming', 'RAW_MATERIAL', { materialId: mat['API-PCM-001'] }, [
    { name: 'Identification (IR)', method: 'TM-ID-IR', type: 'PASS_FAIL', op: 'EQUALS' },
    { name: 'Assay', method: 'TM-ASSAY-HPLC', type: 'NUMERIC', op: 'RANGE', min: 99.0, max: 101.0, unit: '%' },
    { name: 'Loss on drying', method: 'TM-LOD', type: 'NUMERIC', op: 'MAX', max: 0.5, unit: '%' },
  ]);
  await mkSpec('SPEC-API-AMX-001', 'Amoxicillin trihydrate — incoming', 'RAW_MATERIAL', { materialId: mat['API-AMX-001'] }, [
    { name: 'Identification (IR)', method: 'TM-ID-IR', type: 'PASS_FAIL', op: 'EQUALS' },
    { name: 'Assay (anhydrous)', method: 'TM-ASSAY-HPLC', type: 'NUMERIC', op: 'RANGE', min: 95.0, max: 102.0, unit: '%' },
    { name: 'Water content', method: 'TM-LOD', type: 'NUMERIC', op: 'RANGE', min: 11.5, max: 14.5, unit: '%' },
  ]);
  await mkSpec('SPEC-API-OMZ-001', 'Omeprazole pellets — incoming', 'RAW_MATERIAL', { materialId: mat['API-OMZ-001'] }, [
    { name: 'Identification (HPLC)', method: 'TM-ASSAY-HPLC', type: 'PASS_FAIL', op: 'EQUALS' },
    { name: 'Assay', method: 'TM-ASSAY-HPLC', type: 'NUMERIC', op: 'RANGE', min: 7.9, max: 9.1, unit: '% w/w' },
  ]);
  for (const code of ['EXC-MCC-101', 'EXC-STA-001', 'EXC-PVP-K30', 'EXC-MGS-001']) {
    await mkSpec(`SPEC-${code}`, `${code} — incoming excipient`, 'RAW_MATERIAL', { materialId: mat[code] }, [
      { name: 'Identification', method: 'TM-ID-IR', type: 'PASS_FAIL', op: 'EQUALS' },
      { name: 'Loss on drying', method: 'TM-LOD', type: 'NUMERIC', op: 'MAX', max: code === 'EXC-STA-001' ? 15 : 7, unit: '%' },
    ]);
  }
  for (const code of ['PKG-PVC-250', 'PKG-ALU-020', 'PKG-CAP-0', 'PKG-CAP-2']) {
    await mkSpec(`SPEC-${code}`, `${code} — packaging inspection`, 'PACKAGING_MATERIAL', { materialId: mat[code] }, [
      { name: 'Visual inspection / print check', method: 'TM-VIS', type: 'PASS_FAIL', op: 'EQUALS' },
      { name: 'Dimension / thickness check', method: 'TM-VIS', type: 'PASS_FAIL', op: 'EQUALS' },
    ]);
  }
  await mkSpec('SPEC-FP-PCM-500', 'Paracetamol 500 mg tablets — release', 'FINISHED_PRODUCT', { productId: prod.PCM }, [
    { name: 'Description', method: 'TM-VIS', type: 'PASS_FAIL', op: 'EQUALS' },
    { name: 'Assay', method: 'TM-ASSAY-HPLC', type: 'NUMERIC', op: 'RANGE', min: 95.0, max: 105.0, unit: '%' },
    { name: 'Dissolution (30 min)', method: 'TM-DISS', type: 'NUMERIC', op: 'MIN', min: 80, unit: '%' },
    { name: 'Disintegration time', method: 'TM-DT', type: 'NUMERIC', op: 'MAX', max: 15, unit: 'min' },
  ]);
  await mkSpec('SPEC-FP-AMX-500', 'Amoxicillin 500 mg capsules — release', 'FINISHED_PRODUCT', { productId: prod.AMX }, [
    { name: 'Description', method: 'TM-VIS', type: 'PASS_FAIL', op: 'EQUALS' },
    { name: 'Assay', method: 'TM-ASSAY-HPLC', type: 'NUMERIC', op: 'RANGE', min: 92.5, max: 110.0, unit: '%' },
    { name: 'Dissolution (60 min)', method: 'TM-DISS', type: 'NUMERIC', op: 'MIN', min: 80, unit: '%' },
  ]);
  await mkSpec('SPEC-FP-OMZ-020', 'Omeprazole 20 mg capsules — release', 'FINISHED_PRODUCT', { productId: prod.OMZ }, [
    { name: 'Description', method: 'TM-VIS', type: 'PASS_FAIL', op: 'EQUALS' },
    { name: 'Assay', method: 'TM-ASSAY-HPLC', type: 'NUMERIC', op: 'RANGE', min: 90.0, max: 110.0, unit: '%' },
    { name: 'Acid resistance stage', method: 'TM-DISS', type: 'NUMERIC', op: 'MAX', max: 10, unit: '% released' },
  ]);

  // Suppliers (fictional)
  const sup: Ids = {};
  const supDefs: [string, string, string, string, 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'PENDING_QUALIFICATION' | 'SUSPENDED', string[], { name: string; number: string; expiresAt: string }[], number][] = [
    ['SUP-001', 'Meridian Pharmachem Co. (demo)', 'China', 'Li Wei', 'APPROVED', ['API-PCM-001'], [{ name: 'GMP certificate', number: 'GMP-CN-0091', expiresAt: d(400).toISOString() }, { name: 'ISO 9001', number: 'ISO-55120', expiresAt: d(20).toISOString() }], 300],
    ['SUP-002', 'Aurelia Lifesciences Ltd (demo)', 'India', 'R. Menon', 'APPROVED', ['API-AMX-001'], [{ name: 'WHO-GMP certificate', number: 'WHO-IN-7781', expiresAt: d(250).toISOString() }], 200],
    ['SUP-003', 'Lahore Excipients (Pvt) Ltd (demo)', 'Pakistan', 'Saad Mirza', 'APPROVED', ['EXC-MCC-101', 'EXC-STA-001', 'EXC-PVP-K30', 'EXC-MGS-001'], [{ name: 'ISO 9001', number: 'ISO-PK-332', expiresAt: d(180).toISOString() }], 365],
    ['SUP-004', 'Indus Packaging Industries (demo)', 'Pakistan', 'Nida Hasan', 'APPROVED', ['PKG-PVC-250', 'PKG-ALU-020'], [{ name: 'ISO 15378', number: 'ISO15378-118', expiresAt: d(-12).toISOString() }], 15],
    ['SUP-005', 'CapsuTech Asia Sdn Bhd (demo)', 'Malaysia', 'Tan Mei Ling', 'CONDITIONALLY_APPROVED', ['PKG-CAP-0', 'PKG-CAP-2'], [{ name: 'GMP certificate', number: 'GMP-MY-210', expiresAt: d(300).toISOString() }], 120],
    ['SUP-006', 'Gujarat Pelletech Pvt Ltd (demo)', 'India', 'P. Shah', 'APPROVED', ['API-OMZ-001'], [{ name: 'WHO-GMP certificate', number: 'WHO-IN-9902', expiresAt: d(500).toISOString() }], 220],
    ['SUP-007', 'Karachi Chemical Traders (demo)', 'Pakistan', 'Aamir Khan', 'PENDING_QUALIFICATION', [], [], 0],
    ['SUP-008', 'Delta Fine Chemicals (demo)', 'China', 'Zhang Min', 'SUSPENDED', ['API-PCM-001'], [], -40],
  ];
  for (const [code, name, country, contact, status, mats, certs, requalIn] of supDefs) {
    const s = await prisma.supplier.create({
      data: {
        tenantId,
        code,
        name,
        country,
        contactName: contact,
        email: `${code.toLowerCase()}@supplier.demo`,
        phone: '+00 000 0000000',
        status,
        qualificationDate: status === 'APPROVED' || status === 'CONDITIONALLY_APPROVED' ? d(-400) : null,
        requalificationDate: requalIn ? d(requalIn) : null,
        certifications: certs as unknown as Prisma.InputJsonValue,
        materials: { create: mats.map((m) => ({ tenantId, materialId: mat[m], manufacturerName: name.replace(' (demo)', '') })) },
      },
    });
    sup[code] = s.id;
    await snapshot('Supplier', s);
  }
  return { uom, cat, df, wh, bins, mat, prod, boms, routings, eq, specs, sup, tm };
}
