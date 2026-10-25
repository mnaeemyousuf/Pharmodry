-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('API', 'EXCIPIENT', 'PACKAGING', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('PENDING_QUALIFICATION', 'APPROVED', 'CONDITIONALLY_APPROVED', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS', 'QUARANTINE', 'REJECT', 'GENERAL');

-- CreateEnum
CREATE TYPE "EquipmentQualificationStatus" AS ENUM ('QUALIFIED', 'PENDING', 'NOT_QUALIFIED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('MATERIAL', 'PRODUCT');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('QUARANTINE', 'UNDER_TEST', 'RELEASED', 'REJECTED', 'BLOCKED', 'EXPIRED', 'RETURNED', 'RECALLED');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('GRN_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ISSUE_TO_PRODUCTION', 'RETURN_FROM_PRODUCTION', 'ADJUSTMENT', 'STATUS_CHANGE', 'RESERVE', 'UNRESERVE', 'QC_SAMPLING', 'FG_RECEIPT', 'DISPATCH');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'ISSUED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA', 'RELEASED', 'REJECTED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "QcStage" AS ENUM ('RAW_MATERIAL', 'PACKAGING_MATERIAL', 'IN_PROCESS', 'FINISHED_PRODUCT');

-- CreateEnum
CREATE TYPE "QcSampleStatus" AS ENUM ('REQUESTED', 'COLLECTED', 'IN_TESTING', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QcConclusion" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "SpecResultType" AS ENUM ('NUMERIC', 'TEXT', 'PASS_FAIL');

-- CreateEnum
CREATE TYPE "SpecOperator" AS ENUM ('RANGE', 'MIN', 'MAX', 'EQUALS', 'INFO');

-- CreateEnum
CREATE TYPE "QcResultStatus" AS ENUM ('ENTERED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ResultEvaluation" AS ENUM ('WITHIN_SPEC', 'OOS_CANDIDATE', 'NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "OosStatus" AS ENUM ('REPORTED', 'PRELIMINARY_INVESTIGATION', 'LAB_INVESTIGATION', 'MANUFACTURING_INVESTIGATION', 'ROOT_CAUSE', 'IMPACT_ASSESSMENT', 'CAPA', 'QA_APPROVAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "OosConclusion" AS ENUM ('CONFIRMED_OOS', 'INVALIDATED_LAB_ERROR');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'QA_REVIEW', 'INVESTIGATION', 'ROOT_CAUSE', 'CAPA', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapaSource" AS ENUM ('DEVIATION', 'OOS', 'OOT', 'AUDIT', 'COMPLAINT', 'SUPPLIER', 'RECALL', 'OTHER');

-- CreateEnum
CREATE TYPE "CapaActionType" AS ENUM ('CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaActionStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AiRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiRating" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PK',
    "regulator" TEXT NOT NULL DEFAULT 'DRAP',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PK',
    "licenseNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "departmentId" UUID,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "externalId" TEXT,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "replacedById" UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "siteId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "tenantId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("tenantId","scope")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dosage_forms" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "dosage_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "brandName" TEXT,
    "dosageFormId" UUID,
    "categoryId" UUID,
    "strength" TEXT NOT NULL,
    "packSize" TEXT,
    "shelfLifeMonths" INTEGER NOT NULL,
    "storageConditions" TEXT,
    "registrationNumber" TEXT,
    "batchPrefix" TEXT NOT NULL,
    "uomId" UUID NOT NULL,
    "standardBatchSize" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "uomId" UUID NOT NULL,
    "specificationRef" TEXT,
    "storageRequirement" TEXT,
    "retestPeriodMonths" INTEGER,
    "safetyStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 30,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lotPrefix" TEXT NOT NULL DEFAULT 'RM',
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data_versions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_data_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'PENDING_QUALIFICATION',
    "qualificationDate" TIMESTAMP(3),
    "requalificationDate" TIMESTAMP(3),
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "qualityRating" DECIMAL(5,2),
    "deliveryRating" DECIMAL(5,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_materials" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manufacturerName" TEXT,

    CONSTRAINT "supplier_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL,
    "conditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_locations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bin_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "qualificationStatus" "EquipmentQualificationStatus" NOT NULL DEFAULT 'QUALIFIED',
    "calibrationFrequencyDays" INTEGER,
    "lastCalibrationAt" TIMESTAMP(3),
    "nextCalibrationDue" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibrations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "nextDue" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,
    "certificateNo" TEXT,
    "performedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "batchSize" DECIMAL(18,4) NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bomId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "tolerancePct" DECIMAL(6,2) NOT NULL DEFAULT 2,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "stepCode" TEXT,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_steps" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "routingId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "equipmentType" TEXT,
    "expectedDurationMin" INTEGER,
    "requiresVerification" BOOLEAN NOT NULL DEFAULT true,
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "ipcChecks" JSONB NOT NULL DEFAULT '[]',
    "consumesMaterials" BOOLEAN NOT NULL DEFAULT false,
    "recordsOutput" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "routing_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_methods" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "technique" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_specifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "QcStage" NOT NULL,
    "materialId" UUID,
    "productId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_spec_tests" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "specificationId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "testMethodId" UUID,
    "resultType" "SpecResultType" NOT NULL,
    "operator" "SpecOperator" NOT NULL,
    "minValue" DECIMAL(18,4),
    "maxValue" DECIMAL(18,4),
    "expectedText" TEXT,
    "unit" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "qc_spec_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "receivedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "status" "GrnStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" UUID NOT NULL,
    "deliveryNote" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "goodsReceiptId" UUID NOT NULL,
    "poLineId" UUID,
    "materialId" UUID NOT NULL,
    "supplierBatch" TEXT NOT NULL,
    "lotId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "containers" INTEGER NOT NULL DEFAULT 1,
    "mfgDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "retestDate" TIMESTAMP(3),

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "materialId" UUID,
    "productId" UUID,
    "lotNumber" TEXT NOT NULL,
    "supplierBatch" TEXT,
    "supplierId" UUID,
    "batchId" UUID,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "retestDate" TIMESTAMP(3),
    "quantity" DECIMAL(18,4) NOT NULL,
    "reservedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uomCode" TEXT NOT NULL,
    "warehouseId" UUID NOT NULL,
    "binId" UUID,
    "status" "InventoryStatus" NOT NULL DEFAULT 'QUARANTINE',
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "dispositionById" UUID,
    "dispositionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "statusFrom" "InventoryStatus",
    "statusTo" "InventoryStatus",
    "referenceType" TEXT,
    "referenceId" UUID,
    "reason" TEXT,
    "performedById" UUID,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_reservations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plan_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "plannedQuantity" DECIMAL(18,4) NOT NULL,
    "plannedBatches" INTEGER NOT NULL,
    "demandQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "production_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "productId" UUID NOT NULL,
    "planLineId" UUID,
    "bomId" UUID NOT NULL,
    "routingId" UUID NOT NULL,
    "productionLineId" UUID,
    "plannedQuantity" DECIMAL(18,4) NOT NULL,
    "theoreticalYield" DECIMAL(18,4) NOT NULL,
    "actualYield" DECIMAL(18,4),
    "yieldPct" DECIMAL(7,2),
    "yieldWithinLimits" BOOLEAN,
    "yieldJustification" TEXT,
    "yieldDeviationId" UUID,
    "uomCode" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "qaDecisionById" UUID,
    "qaDecisionAt" TIMESTAMP(3),
    "qaDecisionComment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_steps" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "routingStepId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "equipmentType" TEXT,
    "expectedDurationMin" INTEGER,
    "requiresVerification" BOOLEAN NOT NULL,
    "consumesMaterials" BOOLEAN NOT NULL,
    "recordsOutput" BOOLEAN NOT NULL,
    "parameterDefs" JSONB NOT NULL,
    "ipcDefs" JSONB NOT NULL,
    "status" "BatchStepStatus" NOT NULL DEFAULT 'PENDING',
    "equipmentId" UUID,
    "calibrationOverrideReason" TEXT,
    "readings" JSONB NOT NULL DEFAULT '{}',
    "ipcResults" JSONB NOT NULL DEFAULT '{}',
    "outputQuantity" DECIMAL(18,4),
    "remarks" TEXT,
    "startedAt" TIMESTAMP(3),
    "startedById" UUID,
    "completedAt" TIMESTAMP(3),
    "completedById" UUID,
    "completionSignatureId" UUID,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "verificationSignatureId" UUID,
    "hasOutOfLimitReading" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "batch_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_step_corrections" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "batchStepId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "originalValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "correctedById" UUID NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_step_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_material_consumptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "batchStepId" UUID,
    "materialId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "expectedQuantity" DECIMAL(18,4) NOT NULL,
    "actualQuantity" DECIMAL(18,4) NOT NULL,
    "variancePct" DECIMAL(9,2) NOT NULL,
    "uomCode" TEXT NOT NULL,
    "recordedById" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_material_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_samples" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "stage" "QcStage" NOT NULL,
    "specificationId" UUID NOT NULL,
    "materialId" UUID,
    "productId" UUID,
    "lotId" UUID,
    "batchId" UUID,
    "status" "QcSampleStatus" NOT NULL DEFAULT 'REQUESTED',
    "conclusion" "QcConclusion",
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" UUID,
    "collectedAt" TIMESTAMP(3),
    "collectedById" UUID,
    "sampleQuantity" DECIMAL(18,4),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qc_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_results" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sampleId" UUID NOT NULL,
    "specTestId" UUID NOT NULL,
    "testName" TEXT NOT NULL,
    "resultType" "SpecResultType" NOT NULL,
    "specSnapshot" JSONB NOT NULL,
    "numericValue" DECIMAL(18,4),
    "textValue" TEXT,
    "passFail" BOOLEAN,
    "unit" TEXT,
    "evaluation" "ResultEvaluation" NOT NULL,
    "status" "QcResultStatus" NOT NULL DEFAULT 'ENTERED',
    "isRetest" BOOLEAN NOT NULL DEFAULT false,
    "instrument" TEXT,
    "analystId" UUID NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedReason" TEXT,
    "invalidatedById" UUID,
    "invalidatedAt" TIMESTAMP(3),

    CONSTRAINT "qc_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oos_investigations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "qcResultId" UUID NOT NULL,
    "sampleId" UUID NOT NULL,
    "productId" UUID,
    "materialId" UUID,
    "batchId" UUID,
    "lotId" UUID,
    "equipmentId" UUID,
    "supplierId" UUID,
    "testName" TEXT NOT NULL,
    "specification" TEXT NOT NULL,
    "actualResult" TEXT NOT NULL,
    "analystId" UUID NOT NULL,
    "instrument" TEXT,
    "method" TEXT,
    "status" "OosStatus" NOT NULL DEFAULT 'REPORTED',
    "ownerId" UUID,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "preliminaryFindings" TEXT,
    "labInvestigation" TEXT,
    "assignableLabError" BOOLEAN,
    "manufacturingInvestigation" TEXT,
    "rootCause" TEXT,
    "impactAssessment" TEXT,
    "capaJustification" TEXT,
    "conclusion" "OosConclusion",
    "deviationId" UUID,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oos_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "departmentId" UUID,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "immediateAction" TEXT NOT NULL,
    "category" TEXT,
    "proposedSeverity" "Severity",
    "classification" "Severity",
    "productId" UUID,
    "batchId" UUID,
    "materialId" UUID,
    "equipmentId" UUID,
    "oosId" UUID,
    "status" "DeviationStatus" NOT NULL DEFAULT 'DRAFT',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedById" UUID NOT NULL,
    "ownerId" UUID,
    "dueDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "qaReviewNotes" TEXT,
    "investigationSummary" TEXT,
    "impactAssessment" TEXT,
    "capaRequired" BOOLEAN,
    "noCapaJustification" TEXT,
    "effectivenessSummary" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deviations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "root_cause_analyses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "deviationId" UUID,
    "oosId" UUID,
    "fiveWhys" JSONB NOT NULL DEFAULT '[]',
    "fishbone" JSONB NOT NULL DEFAULT '{}',
    "primaryCategory" TEXT,
    "statement" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "root_cause_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capas" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "source" "CapaSource" NOT NULL,
    "deviationId" UUID,
    "oosId" UUID,
    "problemStatement" TEXT NOT NULL,
    "rootCause" TEXT,
    "priority" "Priority" NOT NULL,
    "ownerId" UUID NOT NULL,
    "departmentId" UUID,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "effectivenessCriteria" TEXT,
    "effectivenessResult" TEXT,
    "effectivenessEffective" BOOLEAN,
    "effectivenessCheckedAt" TIMESTAMP(3),
    "effectivenessCheckedById" UUID,
    "effectivenessFailures" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_actions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "capaId" UUID NOT NULL,
    "type" "CapaActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CapaActionStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_signatures" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "reason" TEXT,
    "recordHash" TEXT NOT NULL,
    "authMethod" TEXT NOT NULL DEFAULT 'PASSWORD_REAUTH',
    "ip" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electronic_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "tenantId" UUID,
    "userId" UUID,
    "userEmail" TEXT,
    "userName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "action" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "signatureId" UUID,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "feature" TEXT NOT NULL DEFAULT 'COPILOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "AiRole" NOT NULL,
    "content" TEXT,
    "intent" TEXT,
    "contextRefs" JSONB NOT NULL DEFAULT '[]',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "facts" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "redactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" "AiRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "adapter" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payloadRef" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sites_tenantId_code_key" ON "sites"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_code_key" ON "departments"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "production_lines_tenantId_code_key" ON "production_lines"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_status_idx" ON "users"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_familyId_idx" ON "sessions"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_code_key" ON "roles"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_siteId_key" ON "user_roles"("userId", "roleId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_tenantId_code_key" ON "units_of_measure"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_tenantId_code_key" ON "product_categories"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "dosage_forms_tenantId_code_key" ON "dosage_forms"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenantId_code_key" ON "products"("tenantId", "code");

-- CreateIndex
CREATE INDEX "materials_tenantId_type_idx" ON "materials"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "materials_tenantId_code_key" ON "materials"("tenantId", "code");

-- CreateIndex
CREATE INDEX "master_data_versions_tenantId_entityType_entityId_idx" ON "master_data_versions"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "master_data_versions_entityType_entityId_version_key" ON "master_data_versions"("entityType", "entityId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenantId_code_key" ON "suppliers"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_materials_supplierId_materialId_key" ON "supplier_materials"("supplierId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bin_locations_warehouseId_code_key" ON "bin_locations"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_tenantId_code_key" ON "equipment"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "boms_productId_version_key" ON "boms"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "routings_productId_version_key" ON "routings"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "routing_steps_routingId_sequence_key" ON "routing_steps"("routingId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "test_methods_tenantId_code_key" ON "test_methods"("tenantId", "code");

-- CreateIndex
CREATE INDEX "qc_specifications_tenantId_materialId_idx" ON "qc_specifications"("tenantId", "materialId");

-- CreateIndex
CREATE INDEX "qc_specifications_tenantId_productId_idx" ON "qc_specifications"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "qc_specifications_tenantId_code_version_key" ON "qc_specifications"("tenantId", "code", "version");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_status_idx" ON "purchase_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_number_key" ON "purchase_orders"("tenantId", "number");

-- CreateIndex
CREATE INDEX "goods_receipts_tenantId_receivedAt_idx" ON "goods_receipts"("tenantId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenantId_number_key" ON "goods_receipts"("tenantId", "number");

-- CreateIndex
CREATE INDEX "inventory_lots_tenantId_status_idx" ON "inventory_lots"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inventory_lots_tenantId_materialId_status_expiryDate_idx" ON "inventory_lots"("tenantId", "materialId", "status", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_lots_tenantId_productId_idx" ON "inventory_lots"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "inventory_lots_tenantId_lotNumber_idx" ON "inventory_lots"("tenantId", "lotNumber");

-- CreateIndex
CREATE INDEX "inventory_transactions_tenantId_lotId_performedAt_idx" ON "inventory_transactions"("tenantId", "lotId", "performedAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_tenantId_type_performedAt_idx" ON "inventory_transactions"("tenantId", "type", "performedAt");

-- CreateIndex
CREATE INDEX "material_reservations_tenantId_batchId_idx" ON "material_reservations"("tenantId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "production_plans_tenantId_number_key" ON "production_plans"("tenantId", "number");

-- CreateIndex
CREATE INDEX "batches_tenantId_status_idx" ON "batches"("tenantId", "status");

-- CreateIndex
CREATE INDEX "batches_tenantId_productId_createdAt_idx" ON "batches"("tenantId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "batches_tenantId_batchNumber_key" ON "batches"("tenantId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "batch_steps_batchId_sequence_key" ON "batch_steps"("batchId", "sequence");

-- CreateIndex
CREATE INDEX "batch_material_consumptions_tenantId_batchId_idx" ON "batch_material_consumptions"("tenantId", "batchId");

-- CreateIndex
CREATE INDEX "qc_samples_tenantId_status_idx" ON "qc_samples"("tenantId", "status");

-- CreateIndex
CREATE INDEX "qc_samples_tenantId_batchId_idx" ON "qc_samples"("tenantId", "batchId");

-- CreateIndex
CREATE INDEX "qc_samples_tenantId_lotId_idx" ON "qc_samples"("tenantId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "qc_samples_tenantId_number_key" ON "qc_samples"("tenantId", "number");

-- CreateIndex
CREATE INDEX "qc_results_tenantId_sampleId_idx" ON "qc_results"("tenantId", "sampleId");

-- CreateIndex
CREATE INDEX "oos_investigations_tenantId_status_idx" ON "oos_investigations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "oos_investigations_tenantId_batchId_idx" ON "oos_investigations"("tenantId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "oos_investigations_tenantId_number_key" ON "oos_investigations"("tenantId", "number");

-- CreateIndex
CREATE INDEX "deviations_tenantId_status_idx" ON "deviations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "deviations_tenantId_batchId_idx" ON "deviations"("tenantId", "batchId");

-- CreateIndex
CREATE INDEX "deviations_tenantId_createdAt_idx" ON "deviations"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deviations_tenantId_number_key" ON "deviations"("tenantId", "number");

-- CreateIndex
CREATE INDEX "root_cause_analyses_tenantId_deviationId_idx" ON "root_cause_analyses"("tenantId", "deviationId");

-- CreateIndex
CREATE INDEX "root_cause_analyses_tenantId_oosId_idx" ON "root_cause_analyses"("tenantId", "oosId");

-- CreateIndex
CREATE INDEX "capas_tenantId_status_dueDate_idx" ON "capas"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "capas_tenantId_number_key" ON "capas"("tenantId", "number");

-- CreateIndex
CREATE INDEX "attachments_tenantId_entityType_entityId_idx" ON "attachments"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "electronic_signatures_tenantId_entityType_entityId_idx" ON "electronic_signatures"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_tenantId_occurredAt_idx" ON "audit_events"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_events_tenantId_entityType_entityId_idx" ON "audit_events"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_tenantId_userId_idx" ON "audit_events"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_seq_key" ON "audit_events"("seq");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_readAt_idx" ON "notifications"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_event_key" ON "notification_preferences"("userId", "event");

-- CreateIndex
CREATE INDEX "ai_conversations_tenantId_userId_idx" ON "ai_conversations"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ai_messages_tenantId_createdAt_idx" ON "ai_messages"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_feedback_messageId_userId_key" ON "ai_feedback"("messageId", "userId");

-- CreateIndex
CREATE INDEX "integration_events_tenantId_status_idx" ON "integration_events"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_dosageFormId_fkey" FOREIGN KEY ("dosageFormId") REFERENCES "dosage_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_materials" ADD CONSTRAINT "supplier_materials_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_materials" ADD CONSTRAINT "supplier_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_locations" ADD CONSTRAINT "bin_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routings" ADD CONSTRAINT "routings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "routings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_spec_tests" ADD CONSTRAINT "qc_spec_tests_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "qc_specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_lines" ADD CONSTRAINT "production_plan_lines_planId_fkey" FOREIGN KEY ("planId") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_steps" ADD CONSTRAINT "batch_steps_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_step_corrections" ADD CONSTRAINT "batch_step_corrections_batchStepId_fkey" FOREIGN KEY ("batchStepId") REFERENCES "batch_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_material_consumptions" ADD CONSTRAINT "batch_material_consumptions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_results" ADD CONSTRAINT "qc_results_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "qc_samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
