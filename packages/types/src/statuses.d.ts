/**
 * Central status vocabulary. These mirror the Prisma enums (a unit test in the API
 * asserts parity) so that statuses are never hard-coded as loose strings.
 */
export declare const InventoryStatus: Readonly<{
    QUARANTINE: "QUARANTINE";
    UNDER_TEST: "UNDER_TEST";
    RELEASED: "RELEASED";
    REJECTED: "REJECTED";
    BLOCKED: "BLOCKED";
    EXPIRED: "EXPIRED";
    RETURNED: "RETURNED";
    RECALLED: "RECALLED";
}>;
export type InventoryStatus = keyof typeof InventoryStatus;
export declare const BatchStatus: Readonly<{
    RELEASED: "RELEASED";
    REJECTED: "REJECTED";
    PLANNED: "PLANNED";
    MATERIAL_RESERVED: "MATERIAL_RESERVED";
    READY: "READY";
    IN_PROGRESS: "IN_PROGRESS";
    AWAITING_QC: "AWAITING_QC";
    AWAITING_QA: "AWAITING_QA";
    CLOSED: "CLOSED";
    CANCELLED: "CANCELLED";
}>;
export type BatchStatus = keyof typeof BatchStatus;
export declare const BatchStepStatus: Readonly<{
    IN_PROGRESS: "IN_PROGRESS";
    PENDING: "PENDING";
    COMPLETED: "COMPLETED";
    VERIFIED: "VERIFIED";
}>;
export type BatchStepStatus = keyof typeof BatchStepStatus;
export declare const QcSampleStatus: Readonly<{
    CANCELLED: "CANCELLED";
    REQUESTED: "REQUESTED";
    COLLECTED: "COLLECTED";
    IN_TESTING: "IN_TESTING";
    SUBMITTED: "SUBMITTED";
    REVIEWED: "REVIEWED";
    APPROVED: "APPROVED";
}>;
export type QcSampleStatus = keyof typeof QcSampleStatus;
export declare const QcStage: Readonly<{
    RAW_MATERIAL: "RAW_MATERIAL";
    PACKAGING_MATERIAL: "PACKAGING_MATERIAL";
    IN_PROCESS: "IN_PROCESS";
    FINISHED_PRODUCT: "FINISHED_PRODUCT";
}>;
export type QcStage = keyof typeof QcStage;
export declare const QcConclusion: Readonly<{
    PASS: "PASS";
    FAIL: "FAIL";
}>;
export type QcConclusion = keyof typeof QcConclusion;
export declare const QcResultStatus: Readonly<{
    ENTERED: "ENTERED";
    INVALIDATED: "INVALIDATED";
}>;
export type QcResultStatus = keyof typeof QcResultStatus;
export declare const ResultEvaluation: Readonly<{
    WITHIN_SPEC: "WITHIN_SPEC";
    OOS_CANDIDATE: "OOS_CANDIDATE";
    NOT_EVALUATED: "NOT_EVALUATED";
}>;
export type ResultEvaluation = keyof typeof ResultEvaluation;
export declare const SpecResultType: Readonly<{
    NUMERIC: "NUMERIC";
    TEXT: "TEXT";
    PASS_FAIL: "PASS_FAIL";
}>;
export type SpecResultType = keyof typeof SpecResultType;
export declare const SpecOperator: Readonly<{
    RANGE: "RANGE";
    MIN: "MIN";
    MAX: "MAX";
    EQUALS: "EQUALS";
    INFO: "INFO";
}>;
export type SpecOperator = keyof typeof SpecOperator;
export declare const OosStatus: Readonly<{
    CLOSED: "CLOSED";
    REPORTED: "REPORTED";
    PRELIMINARY_INVESTIGATION: "PRELIMINARY_INVESTIGATION";
    LAB_INVESTIGATION: "LAB_INVESTIGATION";
    MANUFACTURING_INVESTIGATION: "MANUFACTURING_INVESTIGATION";
    ROOT_CAUSE: "ROOT_CAUSE";
    IMPACT_ASSESSMENT: "IMPACT_ASSESSMENT";
    CAPA: "CAPA";
    QA_APPROVAL: "QA_APPROVAL";
}>;
export type OosStatus = keyof typeof OosStatus;
export declare const OosConclusion: Readonly<{
    CONFIRMED_OOS: "CONFIRMED_OOS";
    INVALIDATED_LAB_ERROR: "INVALIDATED_LAB_ERROR";
}>;
export type OosConclusion = keyof typeof OosConclusion;
export declare const DeviationStatus: Readonly<{
    CLOSED: "CLOSED";
    CANCELLED: "CANCELLED";
    SUBMITTED: "SUBMITTED";
    ROOT_CAUSE: "ROOT_CAUSE";
    CAPA: "CAPA";
    DRAFT: "DRAFT";
    QA_REVIEW: "QA_REVIEW";
    INVESTIGATION: "INVESTIGATION";
    EFFECTIVENESS_CHECK: "EFFECTIVENESS_CHECK";
}>;
export type DeviationStatus = keyof typeof DeviationStatus;
export declare const Severity: Readonly<{
    MINOR: "MINOR";
    MAJOR: "MAJOR";
    CRITICAL: "CRITICAL";
}>;
export type Severity = keyof typeof Severity;
export declare const CapaStatus: Readonly<{
    IN_PROGRESS: "IN_PROGRESS";
    CLOSED: "CLOSED";
    CANCELLED: "CANCELLED";
    EFFECTIVENESS_CHECK: "EFFECTIVENESS_CHECK";
    OPEN: "OPEN";
}>;
export type CapaStatus = keyof typeof CapaStatus;
export declare const CapaSource: Readonly<{
    DEVIATION: "DEVIATION";
    OOS: "OOS";
    OOT: "OOT";
    AUDIT: "AUDIT";
    COMPLAINT: "COMPLAINT";
    SUPPLIER: "SUPPLIER";
    RECALL: "RECALL";
    OTHER: "OTHER";
}>;
export type CapaSource = keyof typeof CapaSource;
export declare const CapaActionType: Readonly<{
    CORRECTIVE: "CORRECTIVE";
    PREVENTIVE: "PREVENTIVE";
}>;
export type CapaActionType = keyof typeof CapaActionType;
export declare const CapaActionStatus: Readonly<{
    CANCELLED: "CANCELLED";
    COMPLETED: "COMPLETED";
    OPEN: "OPEN";
}>;
export type CapaActionStatus = keyof typeof CapaActionStatus;
export declare const Priority: Readonly<{
    CRITICAL: "CRITICAL";
    LOW: "LOW";
    MEDIUM: "MEDIUM";
    HIGH: "HIGH";
}>;
export type Priority = keyof typeof Priority;
export declare const SupplierStatus: Readonly<{
    APPROVED: "APPROVED";
    PENDING_QUALIFICATION: "PENDING_QUALIFICATION";
    CONDITIONALLY_APPROVED: "CONDITIONALLY_APPROVED";
    SUSPENDED: "SUSPENDED";
    BLACKLISTED: "BLACKLISTED";
}>;
export type SupplierStatus = keyof typeof SupplierStatus;
export declare const MasterStatus: Readonly<{
    DRAFT: "DRAFT";
    ACTIVE: "ACTIVE";
    INACTIVE: "INACTIVE";
}>;
export type MasterStatus = keyof typeof MasterStatus;
export declare const MaterialType: Readonly<{
    API: "API";
    EXCIPIENT: "EXCIPIENT";
    PACKAGING: "PACKAGING";
    CONSUMABLE: "CONSUMABLE";
}>;
export type MaterialType = keyof typeof MaterialType;
export declare const WarehouseType: Readonly<{
    QUARANTINE: "QUARANTINE";
    RAW_MATERIAL: "RAW_MATERIAL";
    PACKAGING: "PACKAGING";
    FINISHED_GOODS: "FINISHED_GOODS";
    REJECT: "REJECT";
    GENERAL: "GENERAL";
}>;
export type WarehouseType = keyof typeof WarehouseType;
export declare const PurchaseOrderStatus: Readonly<{
    CLOSED: "CLOSED";
    CANCELLED: "CANCELLED";
    APPROVED: "APPROVED";
    DRAFT: "DRAFT";
    PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED";
    RECEIVED: "RECEIVED";
}>;
export type PurchaseOrderStatus = keyof typeof PurchaseOrderStatus;
export declare const GrnStatus: Readonly<{
    CANCELLED: "CANCELLED";
    COMPLETED: "COMPLETED";
    RECEIVED: "RECEIVED";
}>;
export type GrnStatus = keyof typeof GrnStatus;
export declare const ProductionPlanStatus: Readonly<{
    CLOSED: "CLOSED";
    APPROVED: "APPROVED";
    DRAFT: "DRAFT";
}>;
export type ProductionPlanStatus = keyof typeof ProductionPlanStatus;
export declare const ItemType: Readonly<{
    MATERIAL: "MATERIAL";
    PRODUCT: "PRODUCT";
}>;
export type ItemType = keyof typeof ItemType;
export declare const InventoryTxnType: Readonly<{
    GRN_RECEIPT: "GRN_RECEIPT";
    TRANSFER_OUT: "TRANSFER_OUT";
    TRANSFER_IN: "TRANSFER_IN";
    ISSUE_TO_PRODUCTION: "ISSUE_TO_PRODUCTION";
    RETURN_FROM_PRODUCTION: "RETURN_FROM_PRODUCTION";
    ADJUSTMENT: "ADJUSTMENT";
    STATUS_CHANGE: "STATUS_CHANGE";
    RESERVE: "RESERVE";
    UNRESERVE: "UNRESERVE";
    QC_SAMPLING: "QC_SAMPLING";
    FG_RECEIPT: "FG_RECEIPT";
    DISPATCH: "DISPATCH";
}>;
export type InventoryTxnType = keyof typeof InventoryTxnType;
export declare const ReservationStatus: Readonly<{
    RELEASED: "RELEASED";
    ACTIVE: "ACTIVE";
    ISSUED: "ISSUED";
}>;
export type ReservationStatus = keyof typeof ReservationStatus;
export declare const EquipmentQualificationStatus: Readonly<{
    PENDING: "PENDING";
    QUALIFIED: "QUALIFIED";
    NOT_QUALIFIED: "NOT_QUALIFIED";
    RETIRED: "RETIRED";
}>;
export type EquipmentQualificationStatus = keyof typeof EquipmentQualificationStatus;
export declare const AuditAction: Readonly<{
    REJECT: "REJECT";
    STATUS_CHANGE: "STATUS_CHANGE";
    CREATE: "CREATE";
    UPDATE: "UPDATE";
    VOID: "VOID";
    APPROVE: "APPROVE";
    LOGIN: "LOGIN";
    LOGIN_FAILED: "LOGIN_FAILED";
    LOGOUT: "LOGOUT";
    EXPORT: "EXPORT";
    SIGN: "SIGN";
    CORRECTION: "CORRECTION";
}>;
export type AuditAction = keyof typeof AuditAction;
export declare const NotificationSeverity: Readonly<{
    INFO: "INFO";
    CRITICAL: "CRITICAL";
    WARNING: "WARNING";
}>;
export type NotificationSeverity = keyof typeof NotificationSeverity;
export declare const NotificationEvent: Readonly<{
    CAPA_OVERDUE: "CAPA_OVERDUE";
    DEVIATION_OVERDUE: "DEVIATION_OVERDUE";
    BATCH_AWAITING_QA: "BATCH_AWAITING_QA";
    QC_RESULT_FAILED: "QC_RESULT_FAILED";
    QC_SAMPLE_REQUESTED: "QC_SAMPLE_REQUESTED";
    MATERIAL_NEAR_EXPIRY: "MATERIAL_NEAR_EXPIRY";
    MATERIAL_EXPIRED: "MATERIAL_EXPIRED";
    LOW_STOCK: "LOW_STOCK";
    CALIBRATION_DUE: "CALIBRATION_DUE";
    LOT_AWAITING_DISPOSITION: "LOT_AWAITING_DISPOSITION";
    BATCH_RELEASED: "BATCH_RELEASED";
    OOS_REPORTED: "OOS_REPORTED";
    ASSIGNMENT: "ASSIGNMENT";
}>;
export type NotificationEvent = keyof typeof NotificationEvent;
/** Allowed state transitions. Services must call `assertTransition` instead of writing statuses freely. */
export declare const BATCH_TRANSITIONS: Record<BatchStatus, BatchStatus[]>;
export declare const DEVIATION_TRANSITIONS: Record<DeviationStatus, DeviationStatus[]>;
export declare const OOS_SEQUENCE: OosStatus[];
export declare const CAPA_TRANSITIONS: Record<CapaStatus, CapaStatus[]>;
export declare const QC_SAMPLE_TRANSITIONS: Record<QcSampleStatus, QcSampleStatus[]>;
export declare function canTransition<S extends string>(table: Record<S, S[]>, from: S, to: S): boolean;
/** Lots in these statuses may be consumed by production. Only RELEASED. */
export declare const CONSUMABLE_INVENTORY_STATUSES: InventoryStatus[];
export declare const OPEN_DEVIATION_STATUSES: DeviationStatus[];
export declare const OPEN_CAPA_STATUSES: CapaStatus[];
export declare const OPEN_OOS_STATUSES: OosStatus[];
