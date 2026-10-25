"use strict";
/**
 * Central status vocabulary. These mirror the Prisma enums (a unit test in the API
 * asserts parity) so that statuses are never hard-coded as loose strings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_OOS_STATUSES = exports.OPEN_CAPA_STATUSES = exports.OPEN_DEVIATION_STATUSES = exports.CONSUMABLE_INVENTORY_STATUSES = exports.QC_SAMPLE_TRANSITIONS = exports.CAPA_TRANSITIONS = exports.OOS_SEQUENCE = exports.DEVIATION_TRANSITIONS = exports.BATCH_TRANSITIONS = exports.NotificationEvent = exports.NotificationSeverity = exports.AuditAction = exports.EquipmentQualificationStatus = exports.ReservationStatus = exports.InventoryTxnType = exports.ItemType = exports.ProductionPlanStatus = exports.GrnStatus = exports.PurchaseOrderStatus = exports.WarehouseType = exports.MaterialType = exports.MasterStatus = exports.SupplierStatus = exports.Priority = exports.CapaActionStatus = exports.CapaActionType = exports.CapaSource = exports.CapaStatus = exports.Severity = exports.DeviationStatus = exports.OosConclusion = exports.OosStatus = exports.SpecOperator = exports.SpecResultType = exports.ResultEvaluation = exports.QcResultStatus = exports.QcConclusion = exports.QcStage = exports.QcSampleStatus = exports.BatchStepStatus = exports.BatchStatus = exports.InventoryStatus = void 0;
exports.canTransition = canTransition;
const values = (...v) => Object.freeze(Object.fromEntries(v.map((x) => [x, x])));
exports.InventoryStatus = values('QUARANTINE', 'UNDER_TEST', 'RELEASED', 'REJECTED', 'BLOCKED', 'EXPIRED', 'RETURNED', 'RECALLED');
exports.BatchStatus = values('PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA', 'RELEASED', 'REJECTED', 'CLOSED', 'CANCELLED');
exports.BatchStepStatus = values('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');
exports.QcSampleStatus = values('REQUESTED', 'COLLECTED', 'IN_TESTING', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'CANCELLED');
exports.QcStage = values('RAW_MATERIAL', 'PACKAGING_MATERIAL', 'IN_PROCESS', 'FINISHED_PRODUCT');
exports.QcConclusion = values('PASS', 'FAIL');
exports.QcResultStatus = values('ENTERED', 'INVALIDATED');
exports.ResultEvaluation = values('WITHIN_SPEC', 'OOS_CANDIDATE', 'NOT_EVALUATED');
exports.SpecResultType = values('NUMERIC', 'TEXT', 'PASS_FAIL');
exports.SpecOperator = values('RANGE', 'MIN', 'MAX', 'EQUALS', 'INFO');
exports.OosStatus = values('REPORTED', 'PRELIMINARY_INVESTIGATION', 'LAB_INVESTIGATION', 'MANUFACTURING_INVESTIGATION', 'ROOT_CAUSE', 'IMPACT_ASSESSMENT', 'CAPA', 'QA_APPROVAL', 'CLOSED');
exports.OosConclusion = values('CONFIRMED_OOS', 'INVALIDATED_LAB_ERROR');
exports.DeviationStatus = values('DRAFT', 'SUBMITTED', 'QA_REVIEW', 'INVESTIGATION', 'ROOT_CAUSE', 'CAPA', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED');
exports.Severity = values('MINOR', 'MAJOR', 'CRITICAL');
exports.CapaStatus = values('OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED');
exports.CapaSource = values('DEVIATION', 'OOS', 'OOT', 'AUDIT', 'COMPLAINT', 'SUPPLIER', 'RECALL', 'OTHER');
exports.CapaActionType = values('CORRECTIVE', 'PREVENTIVE');
exports.CapaActionStatus = values('OPEN', 'COMPLETED', 'CANCELLED');
exports.Priority = values('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
exports.SupplierStatus = values('PENDING_QUALIFICATION', 'APPROVED', 'CONDITIONALLY_APPROVED', 'SUSPENDED', 'BLACKLISTED');
exports.MasterStatus = values('DRAFT', 'ACTIVE', 'INACTIVE');
exports.MaterialType = values('API', 'EXCIPIENT', 'PACKAGING', 'CONSUMABLE');
exports.WarehouseType = values('RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS', 'QUARANTINE', 'REJECT', 'GENERAL');
exports.PurchaseOrderStatus = values('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');
exports.GrnStatus = values('RECEIVED', 'COMPLETED', 'CANCELLED');
exports.ProductionPlanStatus = values('DRAFT', 'APPROVED', 'CLOSED');
exports.ItemType = values('MATERIAL', 'PRODUCT');
exports.InventoryTxnType = values('GRN_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ISSUE_TO_PRODUCTION', 'RETURN_FROM_PRODUCTION', 'ADJUSTMENT', 'STATUS_CHANGE', 'RESERVE', 'UNRESERVE', 'QC_SAMPLING', 'FG_RECEIPT', 'DISPATCH');
exports.ReservationStatus = values('ACTIVE', 'ISSUED', 'RELEASED');
exports.EquipmentQualificationStatus = values('QUALIFIED', 'PENDING', 'NOT_QUALIFIED', 'RETIRED');
exports.AuditAction = values('CREATE', 'UPDATE', 'VOID', 'APPROVE', 'REJECT', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'EXPORT', 'SIGN', 'STATUS_CHANGE', 'CORRECTION');
exports.NotificationSeverity = values('INFO', 'WARNING', 'CRITICAL');
exports.NotificationEvent = values('CAPA_OVERDUE', 'DEVIATION_OVERDUE', 'BATCH_AWAITING_QA', 'QC_RESULT_FAILED', 'QC_SAMPLE_REQUESTED', 'MATERIAL_NEAR_EXPIRY', 'MATERIAL_EXPIRED', 'LOW_STOCK', 'CALIBRATION_DUE', 'LOT_AWAITING_DISPOSITION', 'BATCH_RELEASED', 'OOS_REPORTED', 'ASSIGNMENT');
/** Allowed state transitions. Services must call `assertTransition` instead of writing statuses freely. */
exports.BATCH_TRANSITIONS = {
    PLANNED: ['MATERIAL_RESERVED', 'CANCELLED'],
    MATERIAL_RESERVED: ['READY', 'PLANNED', 'CANCELLED'],
    READY: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['AWAITING_QC'],
    AWAITING_QC: ['AWAITING_QA'],
    AWAITING_QA: ['RELEASED', 'REJECTED'],
    RELEASED: ['CLOSED'],
    REJECTED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
};
exports.DEVIATION_TRANSITIONS = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['QA_REVIEW', 'CANCELLED'],
    QA_REVIEW: ['INVESTIGATION', 'CANCELLED'],
    INVESTIGATION: ['ROOT_CAUSE'],
    ROOT_CAUSE: ['CAPA'],
    CAPA: ['EFFECTIVENESS_CHECK'],
    EFFECTIVENESS_CHECK: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
};
exports.OOS_SEQUENCE = [
    'REPORTED',
    'PRELIMINARY_INVESTIGATION',
    'LAB_INVESTIGATION',
    'MANUFACTURING_INVESTIGATION',
    'ROOT_CAUSE',
    'IMPACT_ASSESSMENT',
    'CAPA',
    'QA_APPROVAL',
    'CLOSED',
];
exports.CAPA_TRANSITIONS = {
    OPEN: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['EFFECTIVENESS_CHECK', 'CANCELLED'],
    EFFECTIVENESS_CHECK: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: [],
    CANCELLED: [],
};
exports.QC_SAMPLE_TRANSITIONS = {
    REQUESTED: ['COLLECTED', 'CANCELLED'],
    COLLECTED: ['IN_TESTING', 'CANCELLED'],
    IN_TESTING: ['SUBMITTED'],
    SUBMITTED: ['REVIEWED', 'IN_TESTING'],
    REVIEWED: ['APPROVED', 'IN_TESTING'],
    APPROVED: [],
    CANCELLED: [],
};
function canTransition(table, from, to) {
    return (table[from] ?? []).includes(to);
}
/** Lots in these statuses may be consumed by production. Only RELEASED. */
exports.CONSUMABLE_INVENTORY_STATUSES = ['RELEASED'];
exports.OPEN_DEVIATION_STATUSES = [
    'DRAFT',
    'SUBMITTED',
    'QA_REVIEW',
    'INVESTIGATION',
    'ROOT_CAUSE',
    'CAPA',
    'EFFECTIVENESS_CHECK',
];
exports.OPEN_CAPA_STATUSES = ['OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK'];
exports.OPEN_OOS_STATUSES = exports.OOS_SEQUENCE.filter((s) => s !== 'CLOSED');
//# sourceMappingURL=statuses.js.map