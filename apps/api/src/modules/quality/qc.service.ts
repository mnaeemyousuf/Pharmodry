import { Injectable } from '@nestjs/common';
import { Prisma, QcResult, QcSample } from '@prisma/client';
import { BATCH_TRANSITIONS, describeSpec, evaluateResult, OPEN_OOS_STATUSES, QC_SAMPLE_TRANSITIONS, type SpecLimit } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { assertTransition, ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserDirectory } from '../core/core.services';
import { InventoryLedger } from '../inventory/ledger.service';
import { NotificationService } from '../notifications/notification.service';
import { SignatureDto, SignatureService } from '../signatures/signature.service';
import { OosService } from './oos.service';
import { CollectSampleDto, EnterResultsDto, ReviewDto } from './quality.dto';

const num = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : Number(d));

@Injectable()
export class QcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signatures: SignatureService,
    private readonly ledger: InventoryLedger,
    private readonly notifications: NotificationService,
    private readonly users: UserDirectory,
    private readonly oos: OosService,
  ) {}

  async list(q: FilterQueryDto) {
    const where: Prisma.QcSampleWhereInput = {
      status: statusFilter(q) ?? (q.view === 'open' ? { notIn: ['APPROVED', 'CANCELLED'] } : undefined),
      stage: (q.stage as Prisma.EnumQcStageFilter['equals']) || undefined,
      batchId: q.batchId || undefined,
      lotId: q.lotId || undefined,
      siteId: q.siteId || undefined,
      ...(q.q ? { number: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.qcSample.findMany({ where, orderBy: orderBy(q, ['number', 'requestedAt', 'status'], { requestedAt: 'desc' }), ...pageArgs(q) }),
      this.prisma.db.qcSample.count({ where }),
    ]);
    return toPage(await this.withSubjects(rows), total, q);
  }

  private async withSubjects<T extends QcSample>(rows: T[]) {
    const [materials, products, lots, batches, specs] = await Promise.all([
      this.prisma.db.material.findMany({ where: { id: { in: rows.map((r) => r.materialId).filter(Boolean) as string[] } }, select: { id: true, code: true, name: true } }),
      this.prisma.db.product.findMany({ where: { id: { in: rows.map((r) => r.productId).filter(Boolean) as string[] } }, select: { id: true, code: true, genericName: true, strength: true } }),
      this.prisma.db.inventoryLot.findMany({ where: { id: { in: rows.map((r) => r.lotId).filter(Boolean) as string[] } }, select: { id: true, lotNumber: true, status: true } }),
      this.prisma.db.batch.findMany({ where: { id: { in: rows.map((r) => r.batchId).filter(Boolean) as string[] } }, select: { id: true, batchNumber: true, status: true } }),
      this.prisma.db.qcSpecification.findMany({ where: { id: { in: rows.map((r) => r.specificationId) } }, select: { id: true, code: true, version: true, name: true } }),
    ]);
    const m = new Map(materials.map((x) => [x.id, x]));
    const p = new Map(products.map((x) => [x.id, x]));
    const l = new Map(lots.map((x) => [x.id, x]));
    const b = new Map(batches.map((x) => [x.id, x]));
    const s = new Map(specs.map((x) => [x.id, x]));
    return rows.map((r) => {
      const mat = r.materialId ? m.get(r.materialId) : undefined;
      const prod = r.productId ? p.get(r.productId) : undefined;
      return {
        ...r,
        subject: mat ? `${mat.code} — ${mat.name}` : prod ? `${prod.code} — ${prod.genericName} ${prod.strength}` : '—',
        lot: r.lotId ? l.get(r.lotId) : null,
        batch: r.batchId ? b.get(r.batchId) : null,
        specification: s.get(r.specificationId),
      };
    });
  }

  async get(id: string) {
    const sample = await this.prisma.db.qcSample.findFirst({ where: { id }, include: { results: { orderBy: { enteredAt: 'asc' } } } });
    if (!sample) throw new NotFoundError('QC sample', id);
    const [[withSubject], spec, oos, signatures] = await Promise.all([
      this.withSubjects([sample]),
      this.prisma.db.qcSpecification.findFirstOrThrow({ where: { id: sample.specificationId }, include: { tests: { orderBy: { sequence: 'asc' } } } }),
      this.prisma.db.oosInvestigation.findMany({ where: { sampleId: id }, select: { id: true, number: true, status: true, conclusion: true, qcResultId: true, testName: true } }),
      this.signatures.forEntity('QcSample', id),
    ]);
    const results = await this.users.decorate(sample.results, ['analystId', 'invalidatedById']);
    const tests = spec.tests.map((t) => ({
      ...t,
      specText: describeSpec({ ...t, minValue: num(t.minValue), maxValue: num(t.maxValue) } as SpecLimit),
      current: results.find((r) => r.specTestId === t.id && r.status === 'ENTERED') ?? null,
      history: results.filter((r) => r.specTestId === t.id),
    }));
    return this.users.decorateOne({ ...withSubject, spec: { id: spec.id, code: spec.code, name: spec.name, version: spec.version }, tests, oos, signatures }, [
      'requestedById',
      'collectedById',
      'reviewedById',
      'approvedById',
    ]);
  }

  async collect(user: AuthPrincipal, id: string, dto: CollectSampleDto) {
    return this.prisma.transaction(async (tx) => {
      const s = await this.load(tx, id);
      user.require('qc.sample.collect', s.siteId);
      assertTransition(QC_SAMPLE_TRANSITIONS, 'QC sample', s.status, 'COLLECTED');
      if (s.lotId) {
        const lot = await tx.inventoryLot.findFirstOrThrow({ where: { id: s.lotId } });
        if (dto.sampleQuantity) {
          await this.ledger.post(tx, { lotId: lot.id, type: 'QC_SAMPLING', quantity: -dto.sampleQuantity, referenceType: 'QcSample', referenceId: s.id, performedById: user.id, reason: `Sample ${s.number}` });
        }
        if (lot.status === 'QUARANTINE') {
          await this.ledger.post(tx, { lotId: lot.id, type: 'STATUS_CHANGE', statusTo: 'UNDER_TEST', referenceType: 'QcSample', referenceId: s.id, performedById: user.id, reason: `Sampled (${s.number})` });
        }
      }
      const after = await tx.qcSample.update({ where: { id }, data: { status: 'COLLECTED', collectedAt: new Date(), collectedById: user.id, sampleQuantity: dto.sampleQuantity, remarks: dto.remarks } });
      await this.audit.record(tx, { entityType: 'QcSample', entityId: id, entityLabel: s.number, action: 'STATUS_CHANGE', previous: { status: s.status }, next: { status: 'COLLECTED', sampleQuantity: dto.sampleQuantity ?? null } });
      return after;
    });
  }

  private async load(tx: Tx, id: string) {
    const s = await tx.qcSample.findFirst({ where: { id } });
    if (!s) throw new NotFoundError('QC sample', id);
    return s;
  }

  /**
   * Records analytical results. Each value is compared with the specification snapshot;
   * failures are flagged as OOS candidates and an OOS investigation is opened immediately.
   * Values are never overwritten: a replacement invalidates the earlier result with a reason.
   */
  async enterResults(user: AuthPrincipal, id: string, dto: EnterResultsDto) {
    return this.prisma.transaction(async (tx) => {
      const s = await this.load(tx, id);
      user.require('qc.result.enter', s.siteId);
      if (s.status !== 'COLLECTED' && s.status !== 'IN_TESTING') throw new ConflictError(`Results cannot be entered while sample is ${s.status}`);
      const tests = await tx.qcSpecTest.findMany({ where: { specificationId: s.specificationId } });
      const flagged: QcResult[] = [];
      for (const r of dto.results) {
        const t = tests.find((x) => x.id === r.specTestId);
        if (!t) throw new ValidationError(`Test ${r.specTestId} is not part of this specification`);
        if (t.resultType === 'NUMERIC' && (r.numericValue === undefined || r.numericValue === null)) throw new ValidationError(`${t.name}: numeric value required`);
        if (t.resultType === 'PASS_FAIL' && typeof r.passFail !== 'boolean') throw new ValidationError(`${t.name}: pass/fail required`);
        if (t.resultType === 'TEXT' && !r.textValue) throw new ValidationError(`${t.name}: text result required`);
        const previous = await tx.qcResult.findFirst({ where: { sampleId: id, specTestId: t.id, status: 'ENTERED' } });
        const openOos = previous ? await tx.oosInvestigation.findFirst({ where: { qcResultId: previous.id, status: { in: OPEN_OOS_STATUSES } } }) : null;
        if (openOos) throw new RuleViolationError(`${t.name} is under OOS investigation ${openOos.number}; it cannot be replaced until the investigation concludes`, [{ code: 'OOS_OPEN', message: openOos.number, href: `/quality/oos/${openOos.id}` }]);
        if (previous) {
          if (!r.correctionReason) throw new ValidationError(`${t.name} already has a result; a correction reason is required to replace it`);
          await tx.qcResult.update({ where: { id: previous.id }, data: { status: 'INVALIDATED', invalidatedReason: r.correctionReason, invalidatedById: user.id, invalidatedAt: new Date() } });
        }
        const priorInvalidated = await tx.qcResult.count({ where: { sampleId: id, specTestId: t.id, status: 'INVALIDATED' } });
        const limit: SpecLimit = { resultType: t.resultType, operator: t.operator, minValue: num(t.minValue), maxValue: num(t.maxValue), expectedText: t.expectedText, unit: t.unit };
        const evaluation = evaluateResult(limit, r);
        const created = await tx.qcResult.create({
          data: {
            tenantId: s.tenantId,
            sampleId: id,
            specTestId: t.id,
            testName: t.name,
            resultType: t.resultType,
            specSnapshot: { ...limit, text: describeSpec(limit) } as Prisma.InputJsonValue,
            numericValue: r.numericValue,
            textValue: r.textValue,
            passFail: r.passFail,
            unit: t.unit,
            evaluation,
            instrument: r.instrument,
            analystId: user.id,
            isRetest: priorInvalidated > 0,
          },
        });
        await this.audit.record(tx, {
          entityType: 'QcResult',
          entityId: created.id,
          entityLabel: `${s.number} / ${t.name}`,
          action: previous ? 'CORRECTION' : 'CREATE',
          previous: previous ? { value: num(previous.numericValue) ?? previous.textValue ?? previous.passFail, evaluation: previous.evaluation } : undefined,
          next: { value: r.numericValue ?? r.textValue ?? r.passFail, evaluation, spec: describeSpec(limit), instrument: r.instrument ?? null },
          reason: r.correctionReason ?? null,
        });
        if (evaluation === 'OOS_CANDIDATE') flagged.push(created);
      }
      if (s.status === 'COLLECTED') await tx.qcSample.update({ where: { id }, data: { status: 'IN_TESTING' } });
      const opened = [];
      for (const r of flagged) opened.push(await this.oos.openFromResult(tx, user, s, r));
      return { flaggedOosCandidates: opened.map((o) => ({ id: o.id, number: o.number, test: o.testName })) };
    });
  }

  async submit(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const s = await this.load(tx, id);
      user.require('qc.result.enter', s.siteId);
      assertTransition(QC_SAMPLE_TRANSITIONS, 'QC sample', s.status, 'SUBMITTED');
      const [tests, results] = await Promise.all([
        tx.qcSpecTest.findMany({ where: { specificationId: s.specificationId, isMandatory: true } }),
        tx.qcResult.findMany({ where: { sampleId: id, status: 'ENTERED' } }),
      ]);
      const missing = tests.filter((t) => !results.some((r) => r.specTestId === t.id));
      if (missing.length) throw new RuleViolationError('Mandatory tests without results', missing.map((t) => ({ code: 'MISSING_RESULT', message: t.name })));
      const after = await tx.qcSample.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
      await this.audit.record(tx, { entityType: 'QcSample', entityId: id, entityLabel: s.number, action: 'STATUS_CHANGE', previous: { status: s.status }, next: { status: 'SUBMITTED' } });
      return after;
    });
  }

  async review(user: AuthPrincipal, id: string, dto: ReviewDto) {
    return this.prisma.transaction(async (tx) => {
      const s = await this.load(tx, id);
      user.require('qc.result.review', s.siteId);
      const to = dto.decision === 'ACCEPT' ? 'REVIEWED' : 'IN_TESTING';
      assertTransition(QC_SAMPLE_TRANSITIONS, 'QC sample', s.status, to);
      if (s.status !== 'SUBMITTED') throw new ConflictError('Only submitted samples can be reviewed');
      const analysts = await tx.qcResult.findMany({ where: { sampleId: id, status: 'ENTERED' }, select: { analystId: true } });
      if (dto.decision === 'ACCEPT' && analysts.some((a) => a.analystId === user.id)) {
        throw new RuleViolationError('Segregation of duties: a reviewer cannot review their own results');
      }
      if (dto.decision === 'RETURN' && !dto.comment) throw new ValidationError('A comment is required when returning results');
      const after = await tx.qcSample.update({ where: { id }, data: { status: to, reviewedAt: dto.decision === 'ACCEPT' ? new Date() : null, reviewedById: dto.decision === 'ACCEPT' ? user.id : null } });
      await this.audit.record(tx, { entityType: 'QcSample', entityId: id, entityLabel: s.number, action: dto.decision === 'ACCEPT' ? 'APPROVE' : 'REJECT', previous: { status: s.status }, next: { status: to, review: dto.decision }, reason: dto.comment });
      return after;
    });
  }

  /**
   * QC approval with e-signature. Conclusion is derived from current (non-invalidated) results.
   * Open OOS investigations block approval; a confirmed OOS yields conclusion FAIL.
   */
  async approve(user: AuthPrincipal, id: string, dto: SignatureDto) {
    return this.prisma.transaction(async (tx) => {
      const s = await this.load(tx, id);
      user.require('qc.result.approve', s.siteId);
      assertTransition(QC_SAMPLE_TRANSITIONS, 'QC sample', s.status, 'APPROVED');
      const results = await tx.qcResult.findMany({ where: { sampleId: id, status: 'ENTERED' } });
      if (results.some((r) => r.analystId === user.id)) throw new RuleViolationError('Segregation of duties: an analyst cannot approve their own results');
      const oos = await tx.oosInvestigation.findMany({ where: { sampleId: id } });
      const open = oos.filter((o) => o.status !== 'CLOSED');
      if (open.length) {
        throw new RuleViolationError('QC approval blocked by open OOS investigation(s)', open.map((o) => ({ code: 'OOS_OPEN', message: `${o.number} — ${o.testName} (${o.status})`, href: `/quality/oos/${o.id}` })), 'OOS_BLOCKING');
      }
      const failing = results.filter((r) => r.evaluation === 'OOS_CANDIDATE');
      const conclusion = failing.length > 0 ? 'FAIL' : 'PASS';
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'QcSample',
        entityId: id,
        entityLabel: s.number,
        action: 'QC_RESULT_APPROVAL',
        meaning: `QC approval: results verified against specification; conclusion ${conclusion}`,
        record: { sample: s, results },
      });
      const after = await tx.qcSample.update({ where: { id }, data: { status: 'APPROVED', conclusion, approvedAt: new Date(), approvedById: user.id } });
      await this.audit.record(tx, { entityType: 'QcSample', entityId: id, entityLabel: s.number, action: 'APPROVE', previous: { status: s.status }, next: { status: 'APPROVED', conclusion }, signatureId: signature.id, reason: dto.reason });

      if (s.lotId) {
        await this.notifications.notify(tx, {
          tenantId: s.tenantId,
          event: conclusion === 'PASS' ? 'LOT_AWAITING_DISPOSITION' : 'QC_RESULT_FAILED',
          severity: conclusion === 'PASS' ? 'INFO' : 'CRITICAL',
          title: `${s.number} approved — ${conclusion}`,
          body: conclusion === 'PASS' ? 'Lot is ready for QA disposition.' : 'QC concluded FAIL. Lot should be rejected by QA.',
          entityType: 'InventoryLot',
          entityId: s.lotId,
          link: `/inventory/lots/${s.lotId}`,
          permission: 'inventory.release',
          siteId: s.siteId,
        });
      }
      if (s.batchId && s.stage === 'FINISHED_PRODUCT') await this.promoteBatch(tx, s.batchId, conclusion);
      return after;
    });
  }

  /** Moves a batch to AWAITING_QA once every finished-product sample is approved. */
  private async promoteBatch(tx: Tx, batchId: string, conclusion: 'PASS' | 'FAIL') {
    const batch = await tx.batch.findFirstOrThrow({ where: { id: batchId } });
    if (batch.status !== 'AWAITING_QC') return;
    const pending = await tx.qcSample.count({ where: { batchId, stage: 'FINISHED_PRODUCT', status: { notIn: ['APPROVED', 'CANCELLED'] } } });
    if (pending > 0) return;
    assertTransition(BATCH_TRANSITIONS, 'Batch', batch.status, 'AWAITING_QA');
    await tx.batch.update({ where: { id: batchId }, data: { status: 'AWAITING_QA', version: { increment: 1 } } });
    await this.audit.record(tx, { entityType: 'Batch', entityId: batchId, entityLabel: batch.batchNumber, action: 'STATUS_CHANGE', previous: { status: 'AWAITING_QC' }, next: { status: 'AWAITING_QA', qcConclusion: conclusion } });
    await this.notifications.notify(tx, {
      tenantId: batch.tenantId,
      event: 'BATCH_AWAITING_QA',
      severity: conclusion === 'PASS' ? 'INFO' : 'WARNING',
      title: `Batch ${batch.batchNumber} awaiting QA ${conclusion === 'PASS' ? 'release' : 'decision (QC FAIL)'}`,
      body: `Finished product QC concluded ${conclusion}.`,
      entityType: 'Batch',
      entityId: batchId,
      link: `/production/batches/${batchId}`,
      permission: 'batch.approve',
      siteId: batch.siteId,
    });
  }
}
