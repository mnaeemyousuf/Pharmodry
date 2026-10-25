/**
 * Central status vocabulary. These mirror the Prisma enums (a unit test in the API
 * asserts parity) so that statuses are never hard-coded as loose strings.
 */

const values = <T extends string>(...v: T[]) => Object.freeze(Object.fromEntries(v.map((x) => [x, x])) as { [K in T]: K });

export const InventoryStatus = values('QUARANTINE', 'UNDER_TEST', 'RELEASED', 'REJECTED', 'BLOCKED', 'EXPIRED', 'RETURNED', 'RECALLED');
export type InventoryStatus = keyof typeof InventoryStatus;

export const BatchStatus = values(
  'PLANNED',
  'MATERIAL_RESERVED',
  'READY',
  'IN_PROGRESS',
  'AWAITING_QC',
  'AWAITING_QA',
  'RELEASED',
  'REJECTED',
  'CLOSED',
  'CANCELLED',
);
export type BatchStatus = keyof typeof BatchStatus;

export const BatchStepStatus = values('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');
export type BatchStepStatus = keyof typeof BatchStepStatus;

export const QcSampleStatus = values('REQUESTED', 'COLLECTED', 'IN_TESTING', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'CANCELLED');
export type QcSampleStatus = keyof typeof QcSampleStatus;

export const QcStage = values('RAW_MATERIAL', 'PACKAGING_MATERIAL', 'IN_PROCESS', 'FINISHED_PRODUCT');
export type QcStage = keyof typeof QcStage;

export const QcConclusion = values('PASS', 'FAIL');
export type QcConclusion = keyof typeof QcConclusion;

export const QcResultStatus = values('ENTERED', 'INVALIDATED');
export type QcResultStatus = keyof typeof QcResultStatus;

export const ResultEvaluation = values('WITHIN_SPEC', 'OOS_CANDIDATE', 'NOT_EVALUATED');
export type ResultEvaluation = keyof typeof ResultEvaluation;

export const SpecResultType = values('NUMERIC', 'TEXT', 'PASS_FAIL');
export type SpecResultType = keyof typeof SpecResultType;

export const SpecOperator = values('RANGE', 'MIN', 'MAX', 'EQUALS', 'INFO');
export type SpecOperator = keyof typeof SpecOperator;

export const OosStatus = values(
  'REPORTED',
  'PRELIMINARY_INVESTIGATION',
  'LAB_INVESTIGATION',
  'MANUFACTURING_INVESTIGATION',
  'ROOT_CAUSE',
  'IMPACT_ASSESSMENT',
  'CAPA',
  'QA_APPROVAL',
  'CLOSED',
);
export type OosStatus = keyof typeof OosStatus;

export const OosConclusion = values('CONFIRMED_OOS', 'INVALIDATED_LAB_ERROR');
export type OosConclusion = keyof typeof OosConclusion;

export const DeviationStatus = values(
  'DRAFT',
  'SUBMITTED',
  'QA_REVIEW',
  'INVESTIGATION',
  'ROOT_CAUSE',
  'CAPA',
  'EFFECTIVENESS_CHECK',
  'CLOSED',
  'CANCELLED',
);
export type DeviationStatus = keyof typeof DeviationStatus;

export const Severity = values('MINOR', 'MAJOR', 'CRITICAL');
export type Severity = keyof typeof Severity;

export const CapaStatus = values('OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED');
export type CapaStatus = keyof typeof CapaStatus;

export const CapaSource = values('DEVIATION', 'OOS', 'OOT', 'AUDIT', 'COMPLAINT', 'SUPPLIER', 'RECALL', 'OTHER');
export type CapaSource = keyof typeof CapaSource;

export const CapaActionType = values('CORRECTIVE', 'PREVENTIVE');
export type CapaActionType = keyof typeof CapaActionType;

export const CapaActionStatus = values('OPEN', 'COMPLETED', 'CANCELLED');
export type CapaActionStatus = keyof typeof CapaActionStatus;

export const Priority = values('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
export type Priority = keyof typeof Priority;

export const SupplierStatus = values('PENDING_QUALIFICATION', 'APPROVED', 'CONDITIONALLY_APPROVED', 'SUSPENDED', 'BLACKLISTED');
export type SupplierStatus = keyof typeof SupplierStatus;

export const MasterStatus = values('DRAFT', 'ACTIVE', 'INACTIVE');
export type MasterStatus = keyof typeof MasterStatus;

export const MaterialType = values('API', 'EXCIPIENT', 'PACKAGING', 'CONSUMABLE');
export type MaterialType = keyof typeof MaterialType;

export const WarehouseType = values('RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS', 'QUARANTINE', 'REJECT', 'GENERAL');
export type WarehouseType = keyof typeof WarehouseType;

export const PurchaseOrderStatus = values('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');
export type PurchaseOrderStatus = keyof typeof PurchaseOrderStatus;

export const GrnStatus = values('RECEIVED', 'COMPLETED', 'CANCELLED');
export type GrnStatus = keyof typeof GrnStatus;

export const ProductionPlanStatus = values('DRAFT', 'APPROVED', 'CLOSED');
export type ProductionPlanStatus = keyof typeof ProductionPlanStatus;

export const ItemType = values('MATERIAL', 'PRODUCT');
export type ItemType = keyof typeof ItemType;

export const InventoryTxnType = values(
  'GRN_RECEIPT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ISSUE_TO_PRODUCTION',
  'RETURN_FROM_PRODUCTION',
  'ADJUSTMENT',
  'STATUS_CHANGE',
  'RESERVE',
  'UNRESERVE',
  'QC_SAMPLING',
  'FG_RECEIPT',
  'DISPATCH',
);
export type InventoryTxnType = keyof typeof InventoryTxnType;

export const ReservationStatus = values('ACTIVE', 'ISSUED', 'RELEASED');
export type ReservationStatus = keyof typeof ReservationStatus;

export const EquipmentQualificationStatus = values('QUALIFIED', 'PENDING', 'NOT_QUALIFIED', 'RETIRED');
export type EquipmentQualificationStatus = keyof typeof EquipmentQualificationStatus;

export const AuditAction = values(
  'CREATE',
  'UPDATE',
  'VOID',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'EXPORT',
  'SIGN',
  'STATUS_CHANGE',
  'CORRECTION',
);
export type AuditAction = keyof typeof AuditAction;

export const NotificationSeverity = values('INFO', 'WARNING', 'CRITICAL');
export type NotificationSeverity = keyof typeof NotificationSeverity;

export const NotificationEvent = values(
  'CAPA_OVERDUE',
  'DEVIATION_OVERDUE',
  'BATCH_AWAITING_QA',
  'QC_RESULT_FAILED',
  'QC_SAMPLE_REQUESTED',
  'MATERIAL_NEAR_EXPIRY',
  'MATERIAL_EXPIRED',
  'LOW_STOCK',
  'CALIBRATION_DUE',
  'LOT_AWAITING_DISPOSITION',
  'BATCH_RELEASED',
  'OOS_REPORTED',
  'ASSIGNMENT',
);
export type NotificationEvent = keyof typeof NotificationEvent;

/** Allowed state transitions. Services must call `assertTransition` instead of writing statuses freely. */
export const BATCH_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
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

export const DEVIATION_TRANSITIONS: Record<DeviationStatus, DeviationStatus[]> = {
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

export const OOS_SEQUENCE: OosStatus[] = [
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

export const CAPA_TRANSITIONS: Record<CapaStatus, CapaStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['EFFECTIVENESS_CHECK', 'CANCELLED'],
  EFFECTIVENESS_CHECK: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
};

export const QC_SAMPLE_TRANSITIONS: Record<QcSampleStatus, QcSampleStatus[]> = {
  REQUESTED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['IN_TESTING', 'CANCELLED'],
  IN_TESTING: ['SUBMITTED'],
  SUBMITTED: ['REVIEWED', 'IN_TESTING'],
  REVIEWED: ['APPROVED', 'IN_TESTING'],
  APPROVED: [],
  CANCELLED: [],
};

export function canTransition<S extends string>(table: Record<S, S[]>, from: S, to: S): boolean {
  return (table[from] ?? []).includes(to);
}

/** Lots in these statuses may be consumed by production. Only RELEASED. */
export const CONSUMABLE_INVENTORY_STATUSES: InventoryStatus[] = ['RELEASED'];

export const OPEN_DEVIATION_STATUSES: DeviationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'QA_REVIEW',
  'INVESTIGATION',
  'ROOT_CAUSE',
  'CAPA',
  'EFFECTIVENESS_CHECK',
];
export const OPEN_CAPA_STATUSES: CapaStatus[] = ['OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK'];
export const OPEN_OOS_STATUSES: OosStatus[] = OOS_SEQUENCE.filter((s) => s !== 'CLOSED');
