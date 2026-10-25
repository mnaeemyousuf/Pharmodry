/**
 * Permission catalogue. Authorization is always checked against these codes,
 * never against role names. Roles are configurable per tenant.
 */
export declare const PERMISSIONS: {
    readonly 'admin.tenant.manage': "Manage company settings and policies";
    readonly 'admin.site.manage': "Manage sites, departments, warehouses and bins";
    readonly 'admin.user.manage': "Create, deactivate and assign roles to users";
    readonly 'admin.role.manage': "Configure roles and permissions";
    readonly 'masterdata.view': "View master data";
    readonly 'product.manage': "Create and change products, BOMs and routings";
    readonly 'material.manage': "Create and change materials";
    readonly 'supplier.view': "View suppliers";
    readonly 'supplier.manage': "Create and change suppliers";
    readonly 'supplier.approve': "Change supplier qualification status";
    readonly 'equipment.manage': "Manage equipment and calibration records";
    readonly 'spec.manage': "Manage QC specifications and test methods";
    readonly 'procurement.po.view': "View purchase orders";
    readonly 'procurement.po.create': "Create purchase orders";
    readonly 'procurement.po.approve': "Approve purchase orders";
    readonly 'inventory.view': "View inventory lots and movements";
    readonly 'inventory.receive': "Receive goods (GRN)";
    readonly 'inventory.transfer': "Transfer stock between locations";
    readonly 'inventory.adjust': "Post stock adjustments";
    readonly 'inventory.issue': "Issue materials to production";
    readonly 'inventory.release': "QA disposition of material lots (release / reject)";
    readonly 'production.plan.view': "View production plans";
    readonly 'production.plan.manage': "Create and change production plans";
    readonly 'production.plan.approve': "Approve production plans";
    readonly 'batch.view': "View batches and eBMR";
    readonly 'batch.create': "Create batches";
    readonly 'batch.reserve': "Reserve and dispense materials for batches";
    readonly 'batch.start': "Start batches";
    readonly 'batch.execute': "Execute eBMR steps as operator";
    readonly 'batch.verify': "Verify eBMR steps as supervisor";
    readonly 'batch.complete': "Complete batches and record yield";
    readonly 'batch.approve': "QA release or reject batches";
    readonly 'qc.view': "View QC samples and results";
    readonly 'qc.sample.create': "Request QC samples";
    readonly 'qc.sample.collect': "Record sample collection";
    readonly 'qc.result.enter': "Enter analytical results";
    readonly 'qc.result.review': "Review analytical results";
    readonly 'qc.result.approve': "Approve QC samples";
    readonly 'oos.view': "View OOS investigations";
    readonly 'oos.create': "Report OOS investigations";
    readonly 'oos.investigate': "Record OOS investigation phases";
    readonly 'oos.approve': "QA approval / closure of OOS investigations";
    readonly 'deviation.view': "View deviations";
    readonly 'deviation.create': "Raise deviations";
    readonly 'deviation.investigate': "Investigate deviations and record root cause";
    readonly 'deviation.approve': "QA review, classification and closure of deviations";
    readonly 'capa.view': "View CAPAs";
    readonly 'capa.create': "Create CAPAs";
    readonly 'capa.manage': "Update CAPA actions and evidence";
    readonly 'capa.verify': "Record CAPA effectiveness checks";
    readonly 'capa.close': "QA closure of CAPAs";
    readonly 'audit.view': "View audit trail";
    readonly 'audit.export': "Export audit trail";
    readonly 'analytics.view': "View dashboards and analytics";
    readonly 'commandcenter.view': "View Pharma Command Center";
    readonly 'report.export': "Export reports";
    readonly 'ai.copilot.use': "Use the management copilot";
    readonly 'ai.assist.use': "Use AI investigation and CAPA assistants";
    readonly 'ai.admin': "View AI usage logs and configure AI governance";
};
export type PermissionCode = keyof typeof PERMISSIONS;
export declare const ALL_PERMISSIONS: PermissionCode[];
export interface RoleTemplate {
    code: string;
    name: string;
    description: string;
    permissions: PermissionCode[];
}
/** Default role templates seeded for new tenants. Tenants may edit them freely. */
export declare const DEFAULT_ROLES: RoleTemplate[];
