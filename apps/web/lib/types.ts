/** Client-side shapes of API responses (Decimals arrive as numbers). */
import type { BlockingReason, Citation } from '@pharmodry/types';

export type ID = string;

export interface Site { id: ID; code: string; name: string; city?: string; isActive?: boolean }
export interface Warehouse { id: ID; code: string; name: string; type: string; siteId: ID; conditions?: string; site?: { code: string; name: string }; bins: { id: ID; code: string; description?: string }[] }
export interface UserLite { id: ID; fullName: string; title?: string; email: string }
export interface Lookup { id: ID; code: string; name: string }

export interface Product {
  id: ID; code: string; genericName: string; brandName?: string; strength: string; packSize?: string; shelfLifeMonths: number; storageConditions?: string;
  registrationNumber?: string; gtin?: string | null; batchPrefix: string; standardBatchSize: number; unitPrice: number; status: string; version: number; uomId: ID;
  dosageForm?: Lookup; category?: Lookup; createdAt: string; updatedAt: string;
  boms?: { id: ID; version: number; status: string; batchSize: number; lines: { id: ID; materialId: ID; quantity: number; tolerancePct: number; isCritical: boolean; material: { code: string; name: string; type: string } }[] }[];
  routings?: { id: ID; version: number; status: string; steps: RoutingStep[] }[];
  specifications?: Spec[];
}
export interface ParamDef { code: string; label: string; unit?: string; min?: number; max?: number; required?: boolean }
export interface RoutingStep { id: ID; sequence: number; code: string; name: string; instructions: string; equipmentType?: string; expectedDurationMin?: number; requiresVerification: boolean; consumesMaterials: boolean; recordsOutput: boolean; parameters: ParamDef[]; ipcChecks: ParamDef[] }
export interface SpecTest { id: ID; sequence: number; name: string; resultType: 'NUMERIC' | 'TEXT' | 'PASS_FAIL'; operator: 'RANGE' | 'MIN' | 'MAX' | 'EQUALS' | 'INFO'; minValue?: number | null; maxValue?: number | null; expectedText?: string | null; unit?: string | null; isMandatory: boolean }
export interface Spec { id: ID; code: string; name: string; stage: string; version: number; status: string; materialId?: ID; productId?: ID; tests: SpecTest[]; createdAt: string }

export interface Material {
  id: ID; code: string; name: string; type: string; uomId: ID; specificationRef?: string; storageRequirement?: string; retestPeriodMonths?: number; safetyStock: number; leadTimeDays: number;
  unitCost: number; status: string; version: number; lotPrefix: string; stock?: { released: number; quarantine: number; total: number };
  suppliers?: { id: ID; approved: boolean; manufacturerName?: string; supplier: { id: ID; code: string; name: string; status: string; country: string } }[];
  lots?: Lot[]; specifications?: Spec[];
}

export interface Scorecard { onTimeDeliveryPct: number | null; qcRejectionPct: number | null; lotsReceived: number; lotsRejected: number; avgLeadTimeDays: number | null; deviationCount: number; documentationCompliancePct: number | null; qualityScore: number | null }
export interface Supplier {
  id: ID; code: string; name: string; country: string; contactName?: string; email?: string; phone?: string; address?: string; status: string; qualificationDate?: string; requalificationDate?: string;
  certifications: { name: string; number?: string; expiresAt?: string }[]; version: number; scorecard?: Scorecard; _count?: { materials: number };
  materials?: { id: ID; approved: boolean; manufacturerName?: string; material: { id: ID; code: string; name: string; type: string } }[];
  recentReceipts?: { id: ID; number: string; receivedAt: string; status: string; lines: { quantity: number }[] }[];
}

export interface Equipment {
  id: ID; code: string; description: string; type: string; department?: string; location?: string; manufacturer?: string; model?: string; serialNumber?: string;
  qualificationStatus: string; calibrationFrequencyDays?: number; lastCalibrationAt?: string; nextCalibrationDue?: string; calibrationState?: string; isActive: boolean;
  calibrations?: { id: ID; performedAt: string; nextDue: string; result: string; certificateNo?: string }[];
}

export interface Lot {
  id: ID; lotNumber: string; itemType: 'MATERIAL' | 'PRODUCT'; materialId?: ID; productId?: ID; supplierBatch?: string; batchId?: ID; mfgDate?: string; expiryDate: string; retestDate?: string;
  quantity: number; reservedQuantity: number; uomCode: string; status: string; warehouseId: ID; binId?: ID; unitCost: number; sourceType: string; createdAt: string;
  dispositionAt?: string; dispositionByName?: string | null;
  item?: { id: ID; code: string; name: string; kind: string } | null; warehouse?: { id: ID; code: string; name: string } | null; bin?: { id: ID; code: string } | null; daysToExpiry?: number;
  supplier?: { id: ID; code: string; name: string } | null;
  transactions?: Txn[]; samples?: Sample[]; oos?: { id: ID; number: string; status: string; testName: string }[]; usedInBatches?: { id: ID; batchNumber: string; status: string }[];
  siblings?: { id: ID; warehouseId: ID; quantity: number; status: string }[];
}
export interface Txn { id: ID; type: string; quantity: number; balanceAfter: number; statusFrom?: string; statusTo?: string; referenceType?: string; referenceId?: string; reason?: string; performedAt: string; performedByName?: string | null; lot?: { lotNumber: string } }

export interface Sample {
  id: ID; number: string; stage: string; status: string; conclusion?: string | null; requestedAt: string; collectedAt?: string; approvedAt?: string; specificationId: ID; lotId?: ID; batchId?: ID; siteId: ID;
  subject?: string; lot?: { id: ID; lotNumber: string; status: string } | null; batch?: { id: ID; batchNumber: string; status: string } | null; specification?: { code: string; version: number; name: string };
  requestedByName?: string | null; collectedByName?: string | null; reviewedByName?: string | null; approvedByName?: string | null; reviewedAt?: string; sampleQuantity?: number; remarks?: string;
  spec?: { id: ID; code: string; name: string; version: number };
  tests?: (SpecTest & { specText: string; current: Result | null; history: Result[] })[];
  oos?: { id: ID; number: string; status: string; conclusion?: string; qcResultId: ID; testName: string }[];
  signatures?: SignatureRec[];
}
export interface Result { id: ID; specTestId: ID; testName: string; numericValue?: number | null; textValue?: string | null; passFail?: boolean | null; unit?: string | null; evaluation: string; status: string; isRetest: boolean; instrument?: string | null; analystName?: string | null; enteredAt: string; invalidatedReason?: string | null }
export interface SignatureRec { id: ID; signerName: string; signerEmail: string; action: string; meaning: string; reason?: string; signedAt: string; authMethod: string }

export interface BatchStep {
  id: ID; sequence: number; code: string; name: string; instructions: string; equipmentType?: string; expectedDurationMin?: number; requiresVerification: boolean; consumesMaterials: boolean; recordsOutput: boolean;
  parameterDefs: ParamDef[]; ipcDefs: ParamDef[]; status: string; readings: Record<string, number | string>; ipcResults: Record<string, number | string>; outputQuantity?: number | null; remarks?: string | null;
  startedAt?: string; completedAt?: string; verifiedAt?: string; startedByName?: string | null; completedByName?: string | null; verifiedByName?: string | null; hasOutOfLimitReading: boolean;
  equipment?: { id: ID; code: string; description: string } | null; calibrationOverrideReason?: string | null;
  corrections: { id: ID; field: string; originalValue: unknown; newValue: unknown; reason: string; correctedAt: string; correctedByName?: string | null }[];
}
export interface Batch {
  id: ID; batchNumber: string; status: string; productId: ID; plannedQuantity: number; theoreticalYield: number; actualYield?: number | null; yieldPct?: number | null; yieldWithinLimits?: boolean | null; yieldJustification?: string | null;
  uomCode: string; plannedStart: string; plannedEnd?: string; actualStart?: string; actualEnd?: string; mfgDate?: string; expiryDate?: string; qaDecisionAt?: string; qaDecisionComment?: string; createdAt: string; siteId: ID; delayed?: boolean;
  product: { id?: ID; code: string; genericName: string; strength: string; brandName?: string; gtin?: string | null; dosageForm?: Lookup };
  site?: { code: string; name: string }; createdByName?: string | null; qaDecisionByName?: string | null;
  steps?: BatchStep[];
  consumptions?: { id: ID; materialId: ID; lotId: ID; expectedQuantity: number; actualQuantity: number; variancePct: number; uomCode: string; recordedAt: string; recordedByName?: string | null; lot?: { lotNumber: string } }[];
  requirements?: { materialId: ID; code: string; name: string; type: string; required: number; reserved: number; consumed: number; tolerancePct: number; lots: { id: ID; lotId: ID; quantity: number; status: string; lot?: { lotNumber: string; status: string; expiryDate: string } }[] }[];
  samples?: Sample[]; oos?: { id: ID; number: string; status: string; conclusion?: string; testName: string; actualResult: string; specification: string }[];
  deviations?: { id: ID; number: string; title: string; status: string; classification?: string }[]; capas?: { id: ID; number: string; status: string; problemStatement: string }[];
  finishedGoods?: Lot[]; signatures?: SignatureRec[]; yieldTolerance?: { minPct: number; maxPct: number };
}

export interface Deviation {
  id: ID; number: string; title: string; description: string; immediateAction: string; category?: string; proposedSeverity?: string; classification?: string; status: string; occurredAt: string; dueDate?: string; createdAt: string; submittedAt?: string;
  ageDays: number; aging: string; overdue: boolean; ownerId?: ID; ownerName?: string | null; reportedByName?: string | null; batchNumber?: string | null; siteId: ID;
  qaReviewNotes?: string; investigationSummary?: string; impactAssessment?: string; capaRequired?: boolean | null; noCapaJustification?: string; effectivenessSummary?: string; closedAt?: string; closedByName?: string | null;
  product?: { id: ID; code: string; genericName: string; strength: string } | null; batch?: { id: ID; batchNumber: string; status: string } | null; material?: { id: ID; code: string; name: string } | null;
  equipment?: { id: ID; code: string; description: string } | null; oos?: { id: ID; number: string; status: string } | null; site?: { code: string; name: string }; department?: { name: string } | null;
  rootCauseAnalyses?: { id: ID; fiveWhys: { question: string; answer: string }[]; fishbone: Record<string, string[]>; primaryCategory?: string; statement: string; createdAt: string; createdByName?: string | null; approvedAt?: string; approvedByName?: string | null }[];
  capas?: Capa[]; signatures?: SignatureRec[];
}
export interface CapaAction { id: ID; type: string; description: string; ownerId: ID; ownerName?: string | null; dueDate: string; status: string; evidence?: string; aiSuggested: boolean; completedAt?: string; completedByName?: string | null }
export interface Capa {
  id: ID; number: string; source: string; problemStatement: string; rootCause?: string; priority: string; ownerId: ID; ownerName?: string | null; dueDate: string; status: string; overdue?: boolean; ageDays?: number; createdAt: string; siteId: ID;
  effectivenessCriteria?: string; effectivenessResult?: string; effectivenessEffective?: boolean | null; effectivenessCheckedAt?: string; effectivenessFailures: number; closedAt?: string; closedByName?: string | null;
  actions?: CapaAction[]; actionsTotal?: number; actionsDone?: number; deviation?: { id: ID; number: string; title: string; status: string } | null; oos?: { id: ID; number: string; testName: string; status: string } | null; signatures?: SignatureRec[];
  department?: { name: string } | null; createdByName?: string | null;
}
export interface Oos {
  id: ID; number: string; testName: string; specification: string; actualResult: string; status: string; conclusion?: string | null; dueDate: string; createdAt: string; siteId: ID; ageDays?: number; overdue?: boolean;
  ownerId?: ID; ownerName?: string | null; analystName?: string | null; instrument?: string; method?: string; batchNumber?: string | null; lotNumber?: string | null;
  preliminaryFindings?: string; labInvestigation?: string; assignableLabError?: boolean | null; manufacturingInvestigation?: string; rootCause?: string; impactAssessment?: string; capaJustification?: string; closedAt?: string; closedByName?: string | null;
  sample?: { id: ID; number: string; status: string; stage: string } | null; batch?: { id: ID; batchNumber: string; status: string } | null; lot?: { id: ID; lotNumber: string; status: string } | null;
  product?: { id: ID; code: string; genericName: string; strength: string } | null; material?: { id: ID; code: string; name: string } | null; deviation?: { id: ID; number: string; title: string; status: string } | null;
  capas?: { id: ID; number: string; status: string; problemStatement: string }[]; signatures?: SignatureRec[]; phases?: string[]; equipment?: { id: ID; code: string; description: string } | null;
}

export interface PurchaseOrder { id: ID; number: string; status: string; orderDate: string; expectedDate?: string; supplierId: ID; siteId: ID; notes?: string; supplier?: { id?: ID; code: string; name: string } | null; totalValue?: number; createdByName?: string | null; approvedByName?: string | null; approvedAt?: string; lines: { id: ID; materialId: ID; quantity: number; receivedQuantity: number; unitPrice: number; material?: { id: ID; code: string; name: string } }[]; receipts?: { id: ID; number: string; receivedAt: string; status: string }[] }
export interface Grn { id: ID; number: string; status: string; receivedAt: string; supplierId: ID; siteId: ID; deliveryNote?: string; remarks?: string; supplier?: { id: ID; code: string; name: string } | null; purchaseOrder?: { id: ID; number: string } | null; receivedByName?: string | null; lines: { id: ID; materialId: ID; supplierBatch: string; quantity: number; containers: number; mfgDate: string; expiryDate: string; retestDate?: string; lotId: ID; lot?: Lot; material?: { id: ID; code: string; name: string; type: string }; samples?: { id: ID; number: string; status: string; conclusion?: string }[] }[] }
export interface Plan { id: ID; number: string; name: string; status: string; periodStart: string; periodEnd: string; siteId: ID; createdByName?: string | null; approvedByName?: string | null; progress: { plannedQuantity: number; releasedQuantity: number; achievementPct: number; batchesPlanned: number; batchesCreated: number; batchesReleased: number }; lines: PlanLine[] }
export interface Availability { feasible: boolean; quantity: number; bomVersion: number; lines: { materialId: ID; code: string; name: string; type: string; required: number; available: number; quarantine: number; onOrder: number; shortage: number; sufficient: boolean }[] }
export interface PlanLine { id: ID; productId: ID; plannedQuantity: number; plannedBatches: number; demandQuantity: number; product?: { id: ID; code: string; genericName: string; strength: string; standardBatchSize: number }; batches?: { id: ID; batchNumber: string; status: string; plannedQuantity: number; actualYield?: number; plannedStart: string }[]; finishedGoodsAvailable?: number; availability?: Availability }

export interface ExceptionItem { id: string; section: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'; title: string; why: string; process: string; owner: string | null; ageDays: number | null; href: string }
export interface CopilotAnswer { conversationId: ID; messageId: ID; intent: string; answer: string; aiGenerated: boolean; label: string; citations: Citation[]; facts: unknown; rows: Record<string, unknown>[]; model?: string | null }
export type { BlockingReason, Citation };
