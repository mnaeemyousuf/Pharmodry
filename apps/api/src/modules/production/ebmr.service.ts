import { Injectable } from '@nestjs/common';
import { BatchStep, Prisma } from '@prisma/client';
import { variancePct } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../core/core.services';
import { InventoryLedger } from '../inventory/ledger.service';
import { SignatureDto, SignatureService } from '../signatures/signature.service';
import { CompleteStepDto, CorrectStepDto, StartStepDto } from './production.dto';

interface ParamDef {
  code: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

function outOfLimit(defs: ParamDef[], values: Record<string, unknown>) {
  return defs.filter((d) => {
    const v = values[d.code];
    if (v === undefined || v === null || v === '') return false;
    const n = Number(v);
    if (Number.isNaN(n)) return false;
    return (d.min !== undefined && n < d.min) || (d.max !== undefined && n > d.max);
  });
}

/**
 * Electronic batch manufacturing record execution. Completed steps are frozen:
 * changes require a correction (reason, original/new value, audit) and re-verification.
 */
@Injectable()
export class EbmrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signatures: SignatureService,
    private readonly ledger: InventoryLedger,
    private readonly settings: SettingsService,
  ) {}

  private async loadStep(tx: Tx, batchId: string, stepId: string) {
    const step = await tx.batchStep.findFirst({ where: { id: stepId, batchId }, include: { batch: true } });
    if (!step) throw new NotFoundError('Batch step', stepId);
    return step;
  }

  async startStep(user: AuthPrincipal, batchId: string, stepId: string, dto: StartStepDto) {
    return this.prisma.transaction(async (tx) => {
      const step = await this.loadStep(tx, batchId, stepId);
      user.require('batch.execute', step.batch.siteId);
      if (step.batch.status !== 'IN_PROGRESS') throw new ConflictError(`Batch is ${step.batch.status}; steps can only be executed while IN_PROGRESS`);
      if (step.status !== 'PENDING') throw new ConflictError(`Step is ${step.status}`);
      const previous = await tx.batchStep.findFirst({ where: { batchId, sequence: { lt: step.sequence } }, orderBy: { sequence: 'desc' } });
      if (previous && (previous.status === 'PENDING' || previous.status === 'IN_PROGRESS')) {
        throw new RuleViolationError(`Previous step "${previous.name}" must be completed first`);
      }
      let calibrationOverrideReason: string | null = null;
      if (step.equipmentType) {
        if (!dto.equipmentId) throw new ValidationError(`Select the ${step.equipmentType} used for this step`);
        const eq = await tx.equipment.findFirst({ where: { id: dto.equipmentId } });
        if (!eq || eq.siteId !== step.batch.siteId) throw new NotFoundError('Equipment', dto.equipmentId);
        if (eq.type !== step.equipmentType) throw new ValidationError(`Equipment ${eq.code} is a ${eq.type}; this step requires ${step.equipmentType}`);
        if (eq.qualificationStatus !== 'QUALIFIED' || !eq.isActive) throw new RuleViolationError(`Equipment ${eq.code} is not qualified for GMP use (${eq.qualificationStatus})`);
        if (eq.nextCalibrationDue && eq.nextCalibrationDue < new Date()) {
          const policy = (await this.settings.get(step.batch.tenantId, tx)).calibrationPolicy;
          if (policy === 'BLOCK') {
            throw new RuleViolationError(`Equipment ${eq.code} calibration expired on ${eq.nextCalibrationDue.toISOString().slice(0, 10)}`, [
              { code: 'CALIBRATION_EXPIRED', message: eq.code, href: `/master-data/equipment/${eq.id}` },
            ], 'CALIBRATION_EXPIRED');
          }
          if (!dto.calibrationOverrideReason) throw new ValidationError(`Equipment ${eq.code} calibration has expired; a documented reason is required to proceed (WARN policy)`);
          calibrationOverrideReason = dto.calibrationOverrideReason;
        }
      }
      const after = await tx.batchStep.update({
        where: { id: stepId },
        data: { status: 'IN_PROGRESS', startedAt: new Date(), startedById: user.id, equipmentId: dto.equipmentId, calibrationOverrideReason },
      });
      await this.audit.record(tx, {
        entityType: 'BatchStep',
        entityId: stepId,
        entityLabel: `${step.batch.batchNumber} / ${step.name}`,
        action: 'STATUS_CHANGE',
        previous: { status: 'PENDING' },
        next: { status: 'IN_PROGRESS', equipmentId: dto.equipmentId ?? null },
        reason: calibrationOverrideReason,
      });
      return after;
    });
  }

  async completeStep(user: AuthPrincipal, batchId: string, stepId: string, dto: CompleteStepDto) {
    return this.prisma.transaction(async (tx) => {
      const step = await this.loadStep(tx, batchId, stepId);
      const batch = step.batch;
      user.require('batch.execute', batch.siteId);
      if (step.status !== 'IN_PROGRESS') throw new ConflictError(`Step is ${step.status}; start it first`);
      const params = (step.parameterDefs ?? []) as unknown as ParamDef[];
      const ipcs = (step.ipcDefs ?? []) as unknown as ParamDef[];
      const readings = dto.readings ?? {};
      const ipcResults = dto.ipcResults ?? {};
      const missing = [...params.filter((p) => p.required !== false && (readings[p.code] === undefined || readings[p.code] === '')), ...ipcs.filter((p) => ipcResults[p.code] === undefined || ipcResults[p.code] === '')];
      if (missing.length) throw new ValidationError(`Missing required readings: ${missing.map((m) => m.label).join(', ')}`);
      const outOfLimits = [...outOfLimit(params, readings), ...outOfLimit(ipcs, ipcResults)];
      if (outOfLimits.length && !dto.remarks) {
        throw new RuleViolationError(
          `Out-of-limit readings require remarks (and normally a deviation): ${outOfLimits.map((o) => o.label).join(', ')}`,
          outOfLimits.map((o) => ({ code: 'OUT_OF_LIMIT', message: `${o.label}: ${readings[o.code] ?? ipcResults[o.code]} (limits ${o.min ?? '−'}–${o.max ?? '+'} ${o.unit ?? ''})` })),
        );
      }
      if (step.recordsOutput && !dto.outputQuantity) throw new ValidationError('Output quantity is required for this step');

      const consumptionSummary: { lot: string; expected: number; actual: number; variancePct: number }[] = [];
      if (step.consumesMaterials) {
        const issued = await tx.materialReservation.findMany({ where: { batchId, status: 'ISSUED' } });
        const already = await tx.batchMaterialConsumption.count({ where: { batchId, batchStepId: stepId } });
        if (already) throw new ConflictError('Consumption already recorded for this step');
        const entries = dto.consumptions ?? [];
        const missingLots = issued.filter((r) => !entries.some((e) => e.lotId === r.lotId));
        if (missingLots.length) throw new ValidationError('Record actual consumption for every issued lot');
        const threshold = (await this.settings.get(batch.tenantId, tx)).consumptionVariancePct;
        let exceeded = false;
        for (const e of entries) {
          const resForLot = issued.filter((r) => r.lotId === e.lotId);
          if (resForLot.length === 0) throw new RuleViolationError('Only lots issued to this batch can be consumed');
          const expected = r4(resForLot.reduce((a, r) => a + Number(r.quantity), 0));
          const diff = r4(e.actualQuantity - expected);
          const lot = await tx.inventoryLot.findFirstOrThrow({ where: { id: e.lotId } });
          if (diff > 0) {
            if (lot.status !== 'RELEASED' || lot.expiryDate <= new Date()) throw new RuleViolationError(`Additional quantity cannot be drawn from lot ${lot.lotNumber} (${lot.status})`);
            await this.ledger.post(tx, { lotId: lot.id, type: 'ISSUE_TO_PRODUCTION', quantity: -diff, referenceType: 'Batch', referenceId: batchId, performedById: user.id, reason: `Additional issue at ${step.name}` });
          } else if (diff < 0) {
            await this.ledger.post(tx, { lotId: lot.id, type: 'RETURN_FROM_PRODUCTION', quantity: -diff, referenceType: 'Batch', referenceId: batchId, performedById: user.id, reason: `Unused quantity returned after ${step.name}` });
          }
          const v = variancePct(expected, e.actualQuantity);
          if (Math.abs(v) > threshold) exceeded = true;
          await tx.batchMaterialConsumption.create({
            data: {
              tenantId: batch.tenantId,
              batchId,
              batchStepId: stepId,
              materialId: resForLot[0].materialId,
              lotId: e.lotId,
              expectedQuantity: expected,
              actualQuantity: e.actualQuantity,
              variancePct: v,
              uomCode: lot.uomCode,
              recordedById: user.id,
            },
          });
          consumptionSummary.push({ lot: lot.lotNumber, expected, actual: e.actualQuantity, variancePct: v });
        }
        if (exceeded && !dto.remarks) {
          throw new RuleViolationError(`Consumption variance exceeds ±${threshold}%; remarks are required (raise a deviation if unexplained)`, [], 'CONSUMPTION_VARIANCE');
        }
      }
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'BatchStep',
        entityId: stepId,
        entityLabel: `${batch.batchNumber} / ${step.name}`,
        action: 'EBMR_STEP_PERFORMED',
        meaning: `Performed by: I executed "${step.name}" as recorded`,
        record: { readings, ipcResults, outputQuantity: dto.outputQuantity, consumptionSummary },
      });
      const after = await tx.batchStep.update({
        where: { id: stepId },
        data: {
          status: 'COMPLETED',
          readings: readings as Prisma.InputJsonValue,
          ipcResults: ipcResults as Prisma.InputJsonValue,
          remarks: dto.remarks,
          outputQuantity: dto.outputQuantity,
          completedAt: new Date(),
          completedById: user.id,
          completionSignatureId: signature.id,
          hasOutOfLimitReading: outOfLimits.length > 0,
        },
      });
      await this.audit.record(tx, {
        entityType: 'BatchStep',
        entityId: stepId,
        entityLabel: `${batch.batchNumber} / ${step.name}`,
        action: 'STATUS_CHANGE',
        previous: { status: 'IN_PROGRESS' },
        next: { status: 'COMPLETED', readings, ipcResults, outputQuantity: dto.outputQuantity ?? null, consumption: consumptionSummary },
        signatureId: signature.id,
        reason: dto.remarks,
      });
      return after;
    });
  }

  async verifyStep(user: AuthPrincipal, batchId: string, stepId: string, dto: SignatureDto) {
    return this.prisma.transaction(async (tx) => {
      const step = await this.loadStep(tx, batchId, stepId);
      user.require('batch.verify', step.batch.siteId);
      if (step.status !== 'COMPLETED') throw new ConflictError(`Step is ${step.status}; only completed steps can be verified`);
      if (step.completedById === user.id) throw new RuleViolationError('Segregation of duties: the operator who performed a step cannot verify it');
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'BatchStep',
        entityId: stepId,
        entityLabel: `${step.batch.batchNumber} / ${step.name}`,
        action: 'EBMR_STEP_VERIFIED',
        meaning: `Verified by: I reviewed "${step.name}" and confirm the record is complete and correct`,
        record: step,
      });
      const after = await tx.batchStep.update({ where: { id: stepId }, data: { status: 'VERIFIED', verifiedAt: new Date(), verifiedById: user.id, verificationSignatureId: signature.id } });
      await this.audit.record(tx, { entityType: 'BatchStep', entityId: stepId, entityLabel: `${step.batch.batchNumber} / ${step.name}`, action: 'APPROVE', previous: { status: 'COMPLETED' }, next: { status: 'VERIFIED' }, signatureId: signature.id });
      return after;
    });
  }

  /** Corrects a frozen value. Original value is kept in the correction log and the audit trail. */
  async correctStep(user: AuthPrincipal, batchId: string, stepId: string, dto: CorrectStepDto) {
    return this.prisma.transaction(async (tx) => {
      const step = await this.loadStep(tx, batchId, stepId);
      user.require('batch.execute', step.batch.siteId);
      if (step.status !== 'COMPLETED' && step.status !== 'VERIFIED') throw new ConflictError('Only completed steps are corrected; edit in-progress steps directly');
      if (!['IN_PROGRESS', 'AWAITING_QC'].includes(step.batch.status)) throw new ConflictError(`Batch is ${step.batch.status}; its record can no longer be corrected`);
      const [root, key] = dto.field.split('.');
      let original: unknown;
      const data: Prisma.BatchStepUpdateInput = {};
      if ((root === 'readings' || root === 'ipcResults') && key) {
        const defs = ((root === 'readings' ? step.parameterDefs : step.ipcDefs) ?? []) as unknown as ParamDef[];
        if (!defs.some((d) => d.code === key)) throw new ValidationError(`Unknown ${root} field ${key}`);
        const values = { ...((step[root as keyof BatchStep] as Record<string, unknown>) ?? {}) };
        original = values[key] ?? null;
        values[key] = dto.newValue;
        data[root] = values as Prisma.InputJsonValue;
        const out = outOfLimit(defs, values);
        data.hasOutOfLimitReading = out.length > 0;
      } else if (root === 'remarks') {
        original = step.remarks;
        data.remarks = String(dto.newValue);
      } else if (root === 'outputQuantity') {
        if (!step.recordsOutput) throw new ValidationError('This step does not record output');
        if (step.batch.status !== 'IN_PROGRESS') throw new ConflictError('Output can only be corrected before the batch is completed');
        original = step.outputQuantity === null ? null : Number(step.outputQuantity);
        const n = Number(dto.newValue);
        if (!(n > 0)) throw new ValidationError('Output must be positive');
        data.outputQuantity = n;
      } else {
        throw new ValidationError('Correctable fields: readings.<code>, ipcResults.<code>, remarks, outputQuantity');
      }
      if (step.status === 'VERIFIED') {
        data.status = 'COMPLETED';
        data.verifiedAt = null;
        data.verifiedById = null;
        data.verificationSignatureId = null;
      }
      await tx.batchStepCorrection.create({
        data: { tenantId: step.tenantId, batchStepId: stepId, field: dto.field, originalValue: original as Prisma.InputJsonValue, newValue: dto.newValue as Prisma.InputJsonValue, reason: dto.reason, correctedById: user.id },
      });
      const after = await tx.batchStep.update({ where: { id: stepId }, data });
      await this.audit.record(tx, {
        entityType: 'BatchStep',
        entityId: stepId,
        entityLabel: `${step.batch.batchNumber} / ${step.name}`,
        action: 'CORRECTION',
        previous: { [dto.field]: original },
        next: { [dto.field]: dto.newValue, ...(step.status === 'VERIFIED' ? { status: 'COMPLETED (re-verification required)' } : {}) },
        reason: dto.reason,
      });
      return after;
    });
  }
}
