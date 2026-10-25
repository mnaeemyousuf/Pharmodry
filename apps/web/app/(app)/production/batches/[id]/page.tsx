'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, ClipboardPlus, Flag, GitBranch, PackageOpen, PackagePlus, Play, Printer, Undo2, XCircle } from 'lucide-react';
import { gs1ElementString } from '@pharmodry/types';
import { toast } from 'sonner';
import type { BlockingReason } from '@pharmodry/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, fmtDateTime, fmtNum } from '@/lib/utils';
import type { Batch } from '@/lib/types';
import { Button, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActionDialog, AuditHistory, Blockers, Callout, DetailHeader, Empty, Field, handleError, KeyValues, Section, SignatureDialog, SignatureList, Stepper } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { StepCard } from '@/components/ebmr';

const LIFECYCLE = ['PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA', 'RELEASED', 'CLOSED'];

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: b, isLoading } = useQuery({ queryKey: ['batch', id], queryFn: () => api.get<Batch>(`/batches/${id}`) });
  const showBlockers = b && ['AWAITING_QC', 'AWAITING_QA'].includes(b.status);
  const { data: blockers } = useQuery({ queryKey: ['batch-blockers', id], queryFn: () => api.get<BlockingReason[]>(`/batches/${id}/release-blockers`), enabled: !!showBlockers });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [dialog, setDialog] = React.useState<null | 'RELEASE' | 'REJECT' | 'complete' | 'cancel' | 'unreserve'>(null);
  const [text, setText] = React.useState('');
  const [devId, setDevId] = React.useState('');

  const refresh = () => {
    ['batch', 'batch-blockers', 'audit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const run = async (key: string, path: string, success: string, body?: unknown) => {
    setBusy(key);
    setReasons([]);
    try {
      await api.post(`/batches/${id}/${path}`, body);
      toast.success(success);
      refresh();
    } catch (e) {
      handleError(e, setReasons);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !b) return <Skeleton className="h-[480px]" />;
  const steps = b.steps ?? [];
  const output = steps.filter((s) => s.recordsOutput).reduce((a, s) => a + Number(s.outputQuantity ?? 0), 0);
  const previewYield = output ? Math.round((output / b.theoreticalYield) * 10000) / 100 : null;
  const tol = b.yieldTolerance ?? { minPct: 98, maxPct: 102 };
  const previewOk = previewYield !== null && previewYield >= tol.minPct && previewYield <= tol.maxPct;
  const done = steps.filter((s) => s.status === 'VERIFIED' || (!s.requiresVerification && s.status === 'COMPLETED')).length;

  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Batches', href: '/production/batches' }, { label: b.batchNumber }]}
        title={b.batchNumber}
        status={b.status}
        subtitle={`${b.product.genericName} ${b.product.strength}${b.product.brandName ? ` (${b.product.brandName})` : ''} · ${b.site?.name ?? ''}`}
        meta={[
          { label: 'Batch size', value: `${fmtNum(b.plannedQuantity)} ${b.uomCode}` },
          { label: 'Actual yield', value: b.actualYield ? `${fmtNum(b.actualYield)} (${b.yieldPct}%)` : '—' },
          { label: 'Planned start', value: fmtDate(b.plannedStart) },
          { label: 'Mfg / Expiry', value: b.mfgDate ? `${fmtDate(b.mfgDate)} / ${fmtDate(b.expiryDate)}` : '—' },
          { label: 'eBMR progress', value: `${done} / ${steps.length} steps signed off` },
          { label: 'QA decision', value: b.qaDecisionAt ? `${b.qaDecisionByName} · ${fmtDate(b.qaDecisionAt)}` : '—' },
        ]}
        actions={
          <>
            {b.status === 'PLANNED' && can('batch.reserve') && (
              <Button onClick={() => run('reserve', 'reserve', 'Materials reserved (FEFO)')} loading={busy === 'reserve'} data-testid="batch-reserve">
                <PackagePlus /> Reserve materials
              </Button>
            )}
            {b.status === 'MATERIAL_RESERVED' && (can('inventory.issue') || can('batch.reserve')) && (
              <>
                {can('inventory.issue') && (
                <Button onClick={() => run('issue', 'issue-materials', 'Materials issued to production')} loading={busy === 'issue'} data-testid="batch-issue">
                  <PackageOpen /> Issue materials
                </Button>
                )}
                {can('batch.reserve') && (
                <Button variant="outline" onClick={() => { setText(''); setDialog('unreserve'); }}>
                  <Undo2 /> Release reservation
                </Button>
                )}
              </>
            )}
            {b.status === 'READY' && can('batch.start') && (
              <Button onClick={() => run('start', 'start', 'Batch started')} loading={busy === 'start'} data-testid="batch-start">
                <Play /> Start batch
              </Button>
            )}
            {b.status === 'IN_PROGRESS' && can('batch.complete') && (
              <Button onClick={() => { setText(''); setDevId(''); setDialog('complete'); }} data-testid="batch-complete">
                <Flag /> Complete manufacturing
              </Button>
            )}
            {b.status === 'AWAITING_QA' && can('batch.approve') && (
              <>
                <Button onClick={() => setDialog('RELEASE')} disabled={(blockers?.length ?? 1) > 0} data-testid="batch-release">
                  <CheckCircle2 /> QA release
                </Button>
                <Button variant="outline" onClick={() => setDialog('REJECT')} data-testid="batch-reject">
                  <XCircle /> Reject
                </Button>
              </>
            )}
            {['RELEASED', 'REJECTED'].includes(b.status) && can('batch.approve') && (
              <Button variant="outline" onClick={() => run('close', 'close', 'Batch closed')} loading={busy === 'close'}>
                Close batch
              </Button>
            )}
            {['PLANNED', 'MATERIAL_RESERVED', 'READY'].includes(b.status) && can('batch.create') && (
              <Button variant="ghost" onClick={() => { setText(''); setDialog('cancel'); }}>
                <Ban /> Cancel
              </Button>
            )}
            {can('deviation.create') && (
              <Button variant="outline" asChild>
                <Link href={`/quality/deviations/new?batchId=${b.id}`}>
                  <ClipboardPlus /> Raise deviation
                </Link>
              </Button>
            )}
            {can('inventory.view') && (
              <Button variant="outline" asChild>
                <Link href={`/traceability?batch=${b.id}`}>
                  <GitBranch /> Trace
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/production/batches/${b.id}/record`} target="_blank">
                <Printer /> Batch record
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <Stepper steps={b.status === 'REJECTED' ? [...LIFECYCLE.slice(0, 6), 'REJECTED', 'CLOSED'] : LIFECYCLE} current={b.status === 'CANCELLED' ? 'PLANNED' : b.status} />
        {reasons.length > 0 && <Blockers reasons={reasons} title="Action blocked by business rules" />}
        {showBlockers && blockers && blockers.length > 0 && <Blockers reasons={blockers} title="QA release is blocked" />}
        {b.status === 'AWAITING_QA' && blockers && blockers.length === 0 && (
          <Callout tone="success" title="Ready for QA release">
            All eBMR steps are signed and verified, finished-product QC is approved with a passing conclusion, and there are no open OOS investigations or deviations.
          </Callout>
        )}
      </div>

      <Tabs defaultValue={b.status === 'IN_PROGRESS' ? 'manufacturing' : 'overview'}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="manufacturing">Manufacturing (eBMR)</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="qc">QC ({(b.samples?.length ?? 0) + (b.oos?.length ?? 0)})</TabsTrigger>
          <TabsTrigger value="deviations">Deviations ({b.deviations?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="approvals">Approvals ({b.signatures?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Section title="Batch information">
            <KeyValues
              cols={4}
              items={[
                { label: 'Product', value: <Link className="text-primary hover:underline" href={`/master-data/products/${b.productId}`}>{b.product.code} — {b.product.genericName} {b.product.strength}</Link> },
                { label: 'Dosage form', value: b.product.dosageForm?.name },
                { label: 'Theoretical yield', value: `${fmtNum(b.theoreticalYield)} ${b.uomCode}` },
                { label: 'Yield tolerance', value: `${tol.minPct}–${tol.maxPct}%` },
                { label: 'Created by', value: `${b.createdByName ?? '—'} · ${fmtDate(b.createdAt)}` },
                { label: 'Actual start', value: fmtDateTime(b.actualStart) },
                { label: 'Actual end', value: fmtDateTime(b.actualEnd) },
                { label: 'Planned end', value: fmtDate(b.plannedEnd) },
                { label: 'GS1 data (2D DataMatrix)', value: b.product.gtin && b.expiryDate ? <span className="font-mono text-xs">{gs1ElementString(b.product.gtin, new Date(b.expiryDate), b.batchNumber)}</span> : b.product.gtin ? 'Available once expiry is set (batch start)' : <span className="text-warning">No GTIN on product</span> },
              ]}
            />
            {b.yieldPct !== null && b.yieldPct !== undefined && (
              <div className={cn('mt-4 rounded-md border p-3 text-[13px]', b.yieldWithinLimits ? 'border-success/30 bg-success/5' : 'border-warning/40 bg-warning/5')}>
                <b>Yield {b.yieldPct}%</b> ({fmtNum(b.actualYield)} of {fmtNum(b.theoreticalYield)}) — {b.yieldWithinLimits ? 'within tolerance' : 'outside tolerance'}
                {b.yieldJustification && <div className="mt-1">Justification: {b.yieldJustification}</div>}
              </div>
            )}
          </Section>
          <Section title="Finished goods">
            {b.finishedGoods?.length ? (
              b.finishedGoods.map((l) => (
                <Link key={l.id} href={`/inventory/lots/${l.id}`} className="flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50" data-testid="fg-lot">
                  <span className="font-mono text-[13px]">{l.lotNumber}</span>
                  <StatusBadge status={l.status} />
                  <span className="text-[13px]">
                    {fmtNum(l.quantity)} {l.uomCode}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">expiry {fmtDate(l.expiryDate)}</span>
                </Link>
              ))
            ) : (
              <Empty>Finished goods are booked into QUARANTINE when manufacturing is completed.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="manufacturing" className="space-y-3">
          {b.status !== 'IN_PROGRESS' && !['AWAITING_QC', 'AWAITING_QA', 'RELEASED', 'REJECTED', 'CLOSED'].includes(b.status) && <Callout tone="info">Steps can be executed once the batch is started (status IN_PROGRESS). Materials must be reserved and issued first.</Callout>}
          {steps.map((s, i) => (
            <StepCard key={s.id} batch={b} step={s} previousDone={i === 0 || ['COMPLETED', 'VERIFIED'].includes(steps[i - 1].status)} onChanged={refresh} />
          ))}
        </TabsContent>
        <TabsContent value="materials" className="space-y-4">
          <Section title="Material requirements (BOM scaled to batch size)" description="Reservations are FEFO across RELEASED lots only.">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Material</th>
                    <th className="py-2 pr-3 text-right">Required</th>
                    <th className="py-2 pr-3 text-right">Reserved / issued</th>
                    <th className="py-2 pr-3 text-right">Consumed</th>
                    <th className="py-2">Lots (FEFO)</th>
                  </tr>
                </thead>
                <tbody>
                  {b.requirements?.map((r) => (
                    <tr key={r.materialId} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3">
                        <Link className="text-primary hover:underline" href={`/master-data/materials/${r.materialId}`}>
                          {r.code}
                        </Link>{' '}
                        <span className="text-muted-foreground">{r.name}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular">{fmtNum(r.required, 3)}</td>
                      <td className="py-2 pr-3 text-right tabular">{fmtNum(r.reserved, 3)}</td>
                      <td className="py-2 pr-3 text-right tabular">{r.consumed ? fmtNum(r.consumed, 3) : '—'}</td>
                      <td className="py-2">
                        {r.lots.map((l) => (
                          <div key={l.id} className="flex items-center gap-2 text-xs">
                            <Link className="font-mono text-primary hover:underline" href={`/inventory/lots/${l.lotId}`}>
                              {l.lot?.lotNumber}
                            </Link>
                            {fmtNum(l.quantity, 3)} · exp {fmtDate(l.lot?.expiryDate)} <StatusBadge status={l.status} tone={l.status === 'ISSUED' ? 'success' : 'info'} />
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Actual consumption" description="Recorded at the dispensing step with variance against issued quantities.">
            {b.consumptions?.length ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Lot</th>
                    <th className="py-2 text-right">Expected</th>
                    <th className="py-2 text-right">Actual</th>
                    <th className="py-2 text-right">Variance</th>
                    <th className="py-2">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {b.consumptions.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 font-mono">{c.lot?.lotNumber}</td>
                      <td className="py-2 text-right tabular">{fmtNum(c.expectedQuantity, 3)}</td>
                      <td className="py-2 text-right tabular">{fmtNum(c.actualQuantity, 3)}</td>
                      <td className={cn('py-2 text-right tabular', Math.abs(c.variancePct) > 2 && 'font-semibold text-warning')}>{c.variancePct}%</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {c.recordedByName} · {fmtDateTime(c.recordedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No consumption recorded yet.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="qc" className="space-y-4">
          <Section title="QC samples">
            {b.samples?.length ? (
              b.samples.map((s) => (
                <Link key={s.id} href={`/quality/samples/${s.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-mono text-[13px] font-medium">{s.number}</span>
                  <span className="text-xs text-muted-foreground">{s.stage.replace(/_/g, ' ').toLowerCase()}</span>
                  <StatusBadge status={s.status} />
                  {s.conclusion && <StatusBadge status={s.conclusion} />}
                </Link>
              ))
            ) : (
              <Empty>A finished-product QC sample is requested automatically when manufacturing is completed.</Empty>
            )}
          </Section>
          <Section title="OOS investigations">
            {b.oos?.length ? (
              b.oos.map((o) => (
                <Link key={o.id} href={`/quality/oos/${o.id}`} className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-danger/30 px-3 py-2 hover:bg-danger/5">
                  <span className="font-mono text-[13px] font-medium">{o.number}</span>
                  <span className="text-[13px]">
                    {o.testName}: <b>{o.actualResult}</b> (spec {o.specification})
                  </span>
                  <StatusBadge status={o.status} />
                  {o.conclusion && <StatusBadge status={o.conclusion} />}
                </Link>
              ))
            ) : (
              <Empty>No OOS investigations.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="deviations" className="space-y-4">
          <Section title="Deviations">
            {b.deviations?.length ? (
              b.deviations.map((d) => (
                <Link key={d.id} href={`/quality/deviations/${d.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-mono text-[13px] font-medium">{d.number}</span>
                  <span className="text-[13px]">{d.title}</span>
                  {d.classification && <StatusBadge status={d.classification} />}
                  <StatusBadge status={d.status} />
                </Link>
              ))
            ) : (
              <Empty>No deviations raised against this batch.</Empty>
            )}
          </Section>
          <Section title="Linked CAPAs">
            {b.capas?.length ? (
              b.capas.map((c) => (
                <Link key={c.id} href={`/quality/capa/${c.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-mono text-[13px] font-medium">{c.number}</span>
                  <span className="truncate text-[13px]">{c.problemStatement}</span>
                  <StatusBadge status={c.status} />
                </Link>
              ))
            ) : (
              <Empty>No CAPAs.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="approvals">
          <Section title="Electronic signatures" description="Batch-level approvals. Step-level signatures appear in the eBMR and audit trail.">
            <SignatureList signatures={b.signatures} />
          </Section>
        </TabsContent>
        <TabsContent value="audit">
          <Section title="Audit trail" description="Batch and eBMR step events, newest first.">
            <AuditHistory entityId={b.id} extraIds={steps.map((s) => s.id)} />
          </Section>
        </TabsContent>
      </Tabs>

      <SignatureDialog
        open={dialog === 'RELEASE' || dialog === 'REJECT'}
        onOpenChange={(o) => !o && setDialog(null)}
        action={dialog === 'RELEASE' ? 'QA batch release' : 'QA batch rejection'}
        meaning={dialog === 'RELEASE' ? `QA release: batch ${b.batchNumber} reviewed against the batch record and specifications and released for distribution` : `QA rejection: batch ${b.batchNumber} rejected and must not be distributed`}
        record={`${b.batchNumber} — ${b.product.genericName} ${b.product.strength}`}
        reasonRequired={dialog === 'REJECT'}
        destructive={dialog === 'REJECT'}
        confirmLabel={dialog === 'RELEASE' ? 'Sign & release batch' : 'Sign & reject batch'}
        onSign={async (sig) => {
          await api.post(`/batches/${id}/qa-release`, { decision: dialog, ...sig });
          toast.success(dialog === 'RELEASE' ? 'Batch released — finished goods available' : 'Batch rejected');
          refresh();
        }}
      />
      <ActionDialog
        open={dialog === 'complete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Complete manufacturing"
        description="Verifies that every eBMR step is signed and verified, calculates yield, books finished goods into QUARANTINE and requests finished-product QC."
        submitLabel="Complete manufacturing"
        onSubmit={async () => {
          await api.post(`/batches/${id}/complete`, { yieldJustification: text || undefined, yieldDeviationId: devId || undefined });
          toast.success('Manufacturing completed — finished-product QC requested');
          refresh();
        }}
      >
        <div className={cn('rounded-md border p-3 text-sm', previewYield === null ? '' : previewOk ? 'border-success/30 bg-success/5' : 'border-warning/40 bg-warning/5')}>
          {previewYield === null ? 'No output recorded yet — complete the packing step first.' : `Calculated yield: ${previewYield}% (${fmtNum(output)} of ${fmtNum(b.theoreticalYield)}). Tolerance ${tol.minPct}–${tol.maxPct}%.`}
        </div>
        {previewYield !== null && !previewOk && (
          <>
            <Field label="Linked deviation (recommended)">
              <Select value={devId} onChange={(e) => setDevId(e.target.value)}>
                <option value="">— none —</option>
                {b.deviations?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.number} — {d.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Or documented justification" hint="Required when yield is outside tolerance and no deviation is linked (≥ 10 characters)">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          </>
        )}
      </ActionDialog>
      <ActionDialog
        open={dialog === 'cancel' || dialog === 'unreserve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'cancel' ? 'Cancel batch' : 'Release reservations'}
        description={dialog === 'cancel' ? 'Reserved material is released and issued material is returned to stock. The batch record is kept (never deleted).' : 'Reserved quantities are released back to available stock.'}
        destructive={dialog === 'cancel'}
        submitLabel={dialog === 'cancel' ? 'Cancel batch' : 'Release'}
        onSubmit={async () => {
          await api.post(`/batches/${id}/${dialog === 'cancel' ? 'cancel' : 'unreserve'}`, { reason: text });
          toast.success('Done');
          refresh();
        }}
      >
        <Field label="Reason" required>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} required minLength={5} />
        </Field>
      </ActionDialog>
    </>
  );
}
