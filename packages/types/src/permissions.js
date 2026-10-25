"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROLES = exports.ALL_PERMISSIONS = exports.PERMISSIONS = void 0;
/**
 * Permission catalogue. Authorization is always checked against these codes,
 * never against role names. Roles are configurable per tenant.
 */
exports.PERMISSIONS = {
    // Administration
    'admin.tenant.manage': 'Manage company settings and policies',
    'admin.site.manage': 'Manage sites, departments, warehouses and bins',
    'admin.user.manage': 'Create, deactivate and assign roles to users',
    'admin.role.manage': 'Configure roles and permissions',
    // Master data
    'masterdata.view': 'View master data',
    'product.manage': 'Create and change products, BOMs and routings',
    'material.manage': 'Create and change materials',
    'supplier.view': 'View suppliers',
    'supplier.manage': 'Create and change suppliers',
    'supplier.approve': 'Change supplier qualification status',
    'equipment.manage': 'Manage equipment and calibration records',
    'spec.manage': 'Manage QC specifications and test methods',
    // Procurement
    'procurement.po.view': 'View purchase orders',
    'procurement.po.create': 'Create purchase orders',
    'procurement.po.approve': 'Approve purchase orders',
    // Inventory
    'inventory.view': 'View inventory lots and movements',
    'inventory.receive': 'Receive goods (GRN)',
    'inventory.transfer': 'Transfer stock between locations',
    'inventory.adjust': 'Post stock adjustments',
    'inventory.issue': 'Issue materials to production',
    'inventory.release': 'QA disposition of material lots (release / reject)',
    // Production
    'production.plan.view': 'View production plans',
    'production.plan.manage': 'Create and change production plans',
    'production.plan.approve': 'Approve production plans',
    'batch.view': 'View batches and eBMR',
    'batch.create': 'Create batches',
    'batch.reserve': 'Reserve and dispense materials for batches',
    'batch.start': 'Start batches',
    'batch.execute': 'Execute eBMR steps as operator',
    'batch.verify': 'Verify eBMR steps as supervisor',
    'batch.complete': 'Complete batches and record yield',
    'batch.approve': 'QA release or reject batches',
    // QC
    'qc.view': 'View QC samples and results',
    'qc.sample.create': 'Request QC samples',
    'qc.sample.collect': 'Record sample collection',
    'qc.result.enter': 'Enter analytical results',
    'qc.result.review': 'Review analytical results',
    'qc.result.approve': 'Approve QC samples',
    // OOS
    'oos.view': 'View OOS investigations',
    'oos.create': 'Report OOS investigations',
    'oos.investigate': 'Record OOS investigation phases',
    'oos.approve': 'QA approval / closure of OOS investigations',
    // Deviation
    'deviation.view': 'View deviations',
    'deviation.create': 'Raise deviations',
    'deviation.investigate': 'Investigate deviations and record root cause',
    'deviation.approve': 'QA review, classification and closure of deviations',
    // CAPA
    'capa.view': 'View CAPAs',
    'capa.create': 'Create CAPAs',
    'capa.manage': 'Update CAPA actions and evidence',
    'capa.verify': 'Record CAPA effectiveness checks',
    'capa.close': 'QA closure of CAPAs',
    // Oversight
    'audit.view': 'View audit trail',
    'audit.export': 'Export audit trail',
    'analytics.view': 'View dashboards and analytics',
    'commandcenter.view': 'View Pharma Command Center',
    'report.export': 'Export reports',
    // AI
    'ai.copilot.use': 'Use the management copilot',
    'ai.assist.use': 'Use AI investigation and CAPA assistants',
    'ai.admin': 'View AI usage logs and configure AI governance',
};
exports.ALL_PERMISSIONS = Object.keys(exports.PERMISSIONS);
const VIEW_ALL = exports.ALL_PERMISSIONS.filter((p) => p.endsWith('.view') || p === 'commandcenter.view' || p === 'analytics.view');
const pick = (...p) => p;
/** Default role templates seeded for new tenants. Tenants may edit them freely. */
exports.DEFAULT_ROLES = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Platform super administrator', permissions: exports.ALL_PERMISSIONS },
    {
        code: 'COMPANY_ADMIN',
        name: 'Company Admin',
        description: 'Company configuration, users and master data',
        permissions: [
            ...VIEW_ALL,
            ...pick('admin.tenant.manage', 'admin.site.manage', 'admin.user.manage', 'admin.role.manage', 'product.manage', 'material.manage', 'supplier.manage', 'equipment.manage', 'ai.admin', 'ai.copilot.use'),
        ],
    },
    {
        code: 'PLANT_MANAGER',
        name: 'Plant Manager',
        description: 'Site leadership with full visibility',
        permissions: [...VIEW_ALL, ...pick('production.plan.approve', 'report.export', 'ai.copilot.use', 'ai.assist.use')],
    },
    {
        code: 'PRODUCTION_MANAGER',
        name: 'Production Manager',
        description: 'Owns production plans and batch execution',
        permissions: [
            ...VIEW_ALL,
            ...pick('production.plan.manage', 'production.plan.approve', 'batch.create', 'batch.reserve', 'batch.start', 'batch.execute', 'batch.verify', 'batch.complete', 'deviation.create', 'ai.copilot.use', 'ai.assist.use', 'report.export'),
        ],
    },
    {
        code: 'PRODUCTION_SUPERVISOR',
        name: 'Production Supervisor',
        description: 'Supervises execution and verifies eBMR steps',
        permissions: pick('masterdata.view', 'inventory.view', 'production.plan.view', 'batch.view', 'batch.reserve', 'batch.start', 'batch.execute', 'batch.verify', 'batch.complete', 'qc.view', 'deviation.view', 'deviation.create', 'capa.view'),
    },
    {
        code: 'PRODUCTION_OPERATOR',
        name: 'Production Operator',
        description: 'Executes eBMR steps',
        permissions: pick('masterdata.view', 'batch.view', 'batch.execute', 'deviation.create', 'deviation.view'),
    },
    {
        code: 'SUPPLY_CHAIN_PLANNER',
        name: 'Supply Chain Planner',
        description: 'Production planning and material availability',
        permissions: pick('masterdata.view', 'supplier.view', 'inventory.view', 'procurement.po.view', 'production.plan.view', 'production.plan.manage', 'batch.view', 'batch.create', 'batch.reserve', 'analytics.view', 'commandcenter.view', 'ai.copilot.use'),
    },
    {
        code: 'QA_MANAGER',
        name: 'QA Manager',
        description: 'Quality assurance leadership, release authority',
        permissions: [
            ...VIEW_ALL,
            ...pick('inventory.release', 'batch.approve', 'qc.result.approve', 'oos.create', 'oos.investigate', 'oos.approve', 'deviation.create', 'deviation.investigate', 'deviation.approve', 'capa.create', 'capa.manage', 'capa.verify', 'capa.close', 'supplier.approve', 'spec.manage', 'audit.export', 'report.export', 'ai.copilot.use', 'ai.assist.use'),
        ],
    },
    {
        code: 'QA_OFFICER',
        name: 'QA Officer',
        description: 'Quality events and material disposition',
        permissions: [
            ...VIEW_ALL,
            ...pick('inventory.release', 'oos.create', 'oos.investigate', 'deviation.create', 'deviation.investigate', 'capa.create', 'capa.manage', 'capa.verify', 'ai.assist.use'),
        ],
    },
    {
        code: 'QC_MANAGER',
        name: 'QC Manager',
        description: 'QC laboratory leadership',
        permissions: pick('masterdata.view', 'inventory.view', 'batch.view', 'qc.view', 'qc.sample.create', 'qc.sample.collect', 'qc.result.enter', 'qc.result.review', 'qc.result.approve', 'oos.view', 'oos.create', 'oos.investigate', 'deviation.view', 'deviation.create', 'capa.view', 'capa.manage', 'spec.manage', 'analytics.view', 'ai.assist.use'),
    },
    {
        code: 'QC_ANALYST',
        name: 'QC Analyst',
        description: 'Performs sampling and testing',
        permissions: pick('masterdata.view', 'inventory.view', 'batch.view', 'qc.view', 'qc.sample.collect', 'qc.result.enter', 'oos.view', 'oos.create', 'deviation.view', 'deviation.create'),
    },
    {
        code: 'WAREHOUSE_MANAGER',
        name: 'Warehouse Manager',
        description: 'Warehouse operations',
        permissions: pick('masterdata.view', 'supplier.view', 'procurement.po.view', 'inventory.view', 'inventory.receive', 'inventory.transfer', 'inventory.adjust', 'inventory.issue', 'batch.view', 'batch.reserve', 'deviation.view', 'deviation.create', 'qc.sample.create', 'commandcenter.view', 'report.export'),
    },
    {
        code: 'WAREHOUSE_OFFICER',
        name: 'Warehouse Officer',
        description: 'Receiving, put-away and issue',
        permissions: pick('masterdata.view', 'supplier.view', 'procurement.po.view', 'inventory.view', 'inventory.receive', 'inventory.transfer', 'inventory.issue', 'batch.view', 'batch.reserve', 'deviation.create', 'deviation.view'),
    },
    {
        code: 'PROCUREMENT_MANAGER',
        name: 'Procurement Manager',
        description: 'Purchasing leadership',
        permissions: pick('masterdata.view', 'supplier.view', 'supplier.manage', 'procurement.po.view', 'procurement.po.create', 'procurement.po.approve', 'inventory.view', 'analytics.view', 'ai.copilot.use'),
    },
    {
        code: 'PROCUREMENT_OFFICER',
        name: 'Procurement Officer',
        description: 'Creates purchase orders',
        permissions: pick('masterdata.view', 'supplier.view', 'procurement.po.view', 'procurement.po.create', 'inventory.view'),
    },
    {
        code: 'ENGINEERING',
        name: 'Engineering / Maintenance',
        description: 'Equipment and calibration',
        permissions: pick('masterdata.view', 'equipment.manage', 'batch.view', 'deviation.view', 'deviation.create', 'capa.view', 'capa.manage'),
    },
    {
        code: 'REGULATORY_AFFAIRS',
        name: 'Regulatory Affairs Officer',
        description: 'Registrations and licences',
        permissions: pick('masterdata.view', 'product.manage', 'batch.view', 'deviation.view', 'capa.view', 'analytics.view'),
    },
    { code: 'AUDITOR', name: 'Auditor', description: 'Read-only including audit trail', permissions: [...VIEW_ALL, 'audit.export'] },
    {
        code: 'MANAGEMENT_VIEWER',
        name: 'Management Viewer',
        description: 'Executive dashboards and copilot',
        permissions: pick('masterdata.view', 'analytics.view', 'commandcenter.view', 'batch.view', 'inventory.view', 'deviation.view', 'capa.view', 'oos.view', 'qc.view', 'supplier.view', 'production.plan.view', 'ai.copilot.use'),
    },
];
//# sourceMappingURL=permissions.js.map