'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FlaskConical, Send, ShieldCheck, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { evaluateResult } from '@pharmodry/types';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDateTime } from '@/lib/utils';
import type { BlockingReason, Sample } from '@/lib/types';
import { Button, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { ActionDialog, AuditHistory, Blockers, Callout, DetailHeader, Field, handleError, Section, SignatureDialog, SignatureList, Stepper } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

type Entry = { value: string; pass: '' | 'true' | 'false'; instrument: string; correctionReason: string };

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: s, isLoading } = useQuery({ queryKey: ['sample', id], queryFn: () => api.get<Sample>(`/qc/samples/${id}`) });
  const [entries, setEntries] = React.useState<Record<string, Entry>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [dialog, setDialog] = React.useState<null | 'collect' | 'approve' | 'return'>(null);
  const [collect, setCollect] = React.useState({ sampleQuantity: '', remarks: '' });
  const [comment, setComment] = React.useState('');
  const refresh = () => ['sample', 'audit', 'lot', 'batch'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  if (isLoading || !s) return <Skeleton className="h-96" />;
  const tests = s.tests ?? [];
  const editable = (s.status === 'COLLECTED' || s.status === 'IN_TESTING') && can('qc.result.enter');
  const openOos = (s.oos ?? []).filter((o) => o.status !== 'CLOSED');
  const set = (testId: string, patch: Partial<Entry>) => setEntries({ ...entries, [testId]: { ...(entries[testId] ?? { value: '', pass: '', instrument: '', correctionReason: '' }), ...patch } });

  const saveResults = async () => {
    const results = tests
      .filter((t) => {
        const e = entries[t.id];
        return e && (t.resultType === 'PASS_FAIL' ? e.pass !== '' : e.value !== '');
      })
      .map((t) => {
        const e = entries[t.id];
        return {
          specTestId: t.id,
          numericValue: t.resultType === 'NUMERIC' ? Number(e.value) : undefined,
          textValue: t.resultType === 'TEXT' ? e.value : undefined,
          passFail: t.resultType === 'PASS_FAIL' ? e.pass === 'true' : undefined,
          instrument: e.instrument || undefined,
          correctionReason: e.correctionReason || undefined,
        };
      });
    if (!results.length) return toast.error('Enter at least one result');
    setBusy('save');
    setReasons([]);
    try {
      const r = await api.post<{ flaggedOosCandidates: { id: string; number: string; test: string }[] }>(`/qc/samples/${id}/results`, { results });
      setEntries({});
      if (r.flaggedOosCandidates.length) toast.warning(`OOS candidate flagged: ${r.flaggedOosCandidates.map((o) => `${o.test} → ${o.number}`).join(', ')}. Investigation opened; release is blocked.`, { duration: 10000 });
      else toast.success('Results recorded');
      refresh();
    } catch (e) {
      handleError(e, setReasons);
    } finally {
      setBusy(null);
    }
  };
  const act = async (key: string, path: string, body: unknown, msg: string) => {
    setBusy(key);
    setReasons([]);
    try {
      await api.post(`/qc/samples/${id}/${path}`, body);
      toast.success(msg);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.reasons.length) setReasons(e.reasons);
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'QC samples', href: '/quality/samples' }, { label: s.number }]}
        title={s.number}
        status={s.status}
        subtitle={`${s.subject} · ${s.stage.replace(/_/g, ' ').toLowerCase()}`}
        meta={[
          { label: 'Specification', value: `${s.spec?.code} v${s.spec?.version}` },
          { label: 'Lot', value: s.lot ? <Link className="text-primary hover:underline" href={`/inventory/lots/${s.lot.id}`}>{s.lot.lotNumber}</Link> : '—' },
          { label: 'Batch', value: s.batch ? <Link className="text-primary hover:underline" href={`/production/batches/${s.batch.id}`}>{s.batch.batchNumber}</Link> : '—' },
          { label: 'Collected', value: s.collectedAt ? `${s.collectedByName} · ${fmtDateTime(s.collectedAt)}` : '—' },
          { label: 'Reviewed', value: s.reviewedAt ? `${s.reviewedByName} · ${fmtDateTime(s.reviewedAt)}` : '—' },
          { label: 'Conclusion', value: s.conclusion ? <StatusBadge status={s.conclusion} /> : '—' },
        ]}
        actions={
          <>
            {s.status === 'REQUESTED' && can('qc.sample.collect') && (
              <Button onClick={() => setDialog('collect')} data-testid="sample-collect">
                <FlaskConical /> Record collection
              </Button>
            )}
            {s.status === 'IN_TESTING' && can('qc.result.enter') && (
              <Button onClick={() => act('submit', 'submit', {}, 'Submitted for review')} loading={busy === 'submit'} data-testid="sample-submit">
                <Send /> Submit for review
              </Button>
            )}
            {s.status === 'SUBMITTED' && can('qc.result.review') && (
              <>
                <Button onClick={() => act('review', 'review', { decision: 'ACCEPT' }, 'Review accepted')} loading={busy === 'review'} data-testid="sample-review">
                  <CheckCircle2 /> Accept review
                </Button>
                <Button variant="outline" onClick={() => setDialog('return')}>
                  <Undo2 /> Return to analyst
                </Button>
              </>
            )}
            {s.status === 'REVIEWED' && can('qc.result.approve') && (
              <Button onClick={() => setDialog('approve')} data-testid="sample-approve">
                <ShieldCheck /> Approve (e-sign)
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <Stepper steps={['REQUESTED', 'COLLECTED', 'IN_TESTING', 'SUBMITTED', 'REVIEWED', 'APPROVED']} current={s.status} />
        {openOos.length > 0 && (
          <Callout tone="danger" title="OOS investigation open — approval and release are blocked">
            {openOos.map((o) => (
              <Link key={o.id} href={`/quality/oos/${o.id}`} className="mr-3 underline">
                {o.number} ({o.testName}, {o.status.replace(/_/g, ' ').toLowerCase()})
              </Link>
            ))}
            <div className="mt-1 text-xs">The system has only flagged the result. Whether it is a confirmed OOS or a laboratory error is decided by QA after investigation.</div>
          </Callout>
        )}
        {reasons.length > 0 && <Blockers reasons={reasons} title="Action blocked by business rules" />}
      </div>
      <Section
        title="Tests & results"
        description="Specification limits are snapshotted with each result. Values are never overwritten — a replacement requires a reason and keeps the original."
        actions={
          editable && (
            <Button onClick={saveResults} loading={busy === 'save'} data-testid="save-results">
              Save results
            </Button>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Test</th>
                <th className="py-2 pr-3">Specification</th>
                <th className="py-2 pr-3">Current result</th>
                <th className="py-2 pr-3">Evaluation</th>
                {editable && <th className="py-2 pr-3">Enter result</th>}
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => {
                const e = entries[t.id];
                const preview =
                  e && (e.value !== '' || e.pass !== '')
                    ? evaluateResult(t, { numericValue: t.resultType === 'NUMERIC' && e.value !== '' ? Number(e.value) : null, textValue: e.value || null, passFail: e.pass === '' ? null : e.pass === 'true' })
                    : null;
                const cur = t.current;
                const invalid = t.history.filter((h) => h.status === 'INVALIDATED');
                return (
                  <tr key={t.id} className="border-b align-top last:border-0" data-testid={`test-row-${t.name}`}>
                    <td className="py-2.5 pr-3 font-medium">
                      {t.name}
                      {!t.isMandatory && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
                    </td>
                    <td className="py-2.5 pr-3">{t.specText}</td>
                    <td className="py-2.5 pr-3">
                      {cur ? (
                        <div>
                          <span className="font-semibold tabular">{cur.numericValue ?? cur.textValue ?? (cur.passFail ? 'Pass' : 'Fail')}</span> {cur.unit}
                          {cur.isRetest && <StatusBadge status="RETEST" tone="info" label="Retest" className="ml-1" />}
                          <div className="text-xs text-muted-foreground">
                            {cur.analystName} · {fmtDateTime(cur.enteredAt)}
                            {cur.instrument ? ` · ${cur.instrument}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {invalid.map((h) => (
                        <div key={h.id} className="mt-1 text-xs text-muted-foreground line-through" title={h.invalidatedReason ?? ''}>
                          {h.numericValue ?? h.textValue ?? (h.passFail ? 'Pass' : 'Fail')} {h.unit} — invalidated
                        </div>
                      ))}
                    </td>
                    <td className="py-2.5 pr-3">{cur ? <StatusBadge status={cur.evaluation} /> : '—'}</td>
                    {editable && (
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {t.resultType === 'PASS_FAIL' ? (
                            <Select className="w-28" value={e?.pass ?? ''} onChange={(ev) => set(t.id, { pass: ev.target.value as Entry['pass'] })} aria-label={`${t.name} result`}>
                              <option value="">—</option>
                              <option value="true">Pass</option>
                              <option value="false">Fail</option>
                            </Select>
                          ) : (
                            <Input className="w-28" type={t.resultType === 'NUMERIC' ? 'number' : 'text'} step="any" value={e?.value ?? ''} onChange={(ev) => set(t.id, { value: ev.target.value })} aria-label={`${t.name} result`} />
                          )}
                          <Input className="w-28" placeholder="Instrument" value={e?.instrument ?? ''} onChange={(ev) => set(t.id, { instrument: ev.target.value })} aria-label={`${t.name} instrument`} />
                          {preview && <StatusBadge status={preview} label={preview === 'OOS_CANDIDATE' ? 'Will flag OOS candidate' : preview === 'WITHIN_SPEC' ? 'Within spec' : 'Not evaluated'} />}
                        </div>
                        {cur && e && (e.value !== '' || e.pass !== '') && (
                          <Textarea className={cn('mt-2 min-h-[50px]')} placeholder="Correction reason (required to replace the existing result)" value={e.correctionReason} onChange={(ev) => set(t.id, { correctionReason: ev.target.value })} />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Section title="Electronic signatures">
          <SignatureList signatures={s.signatures} />
        </Section>
        <Section title="Audit trail">
          <AuditHistory entityId={s.id} extraIds={tests.flatMap((t) => t.history.map((h) => h.id))} />
        </Section>
      </div>
      <ActionDialog
        open={dialog === 'collect'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Record sample collection"
        description="Sampling moves a quarantined lot to UNDER TEST. The sampled quantity is deducted from the lot."
        submitLabel="Record collection"
        onSubmit={async () => {
          await api.post(`/qc/samples/${id}/collect`, { sampleQuantity: collect.sampleQuantity ? Number(collect.sampleQuantity) : undefined, remarks: collect.remarks || undefined });
          toast.success('Collection recorded');
          refresh();
        }}
      >
        <Field label="Quantity withdrawn (optional)">
          <Input type="number" step="any" value={collect.sampleQuantity} onChange={(e) => setCollect({ ...collect, sampleQuantity: e.target.value })} />
        </Field>
        <Field label="Remarks">
          <Textarea value={collect.remarks} onChange={(e) => setCollect({ ...collect, remarks: e.target.value })} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'return'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Return results to analyst"
        submitLabel="Return"
        onSubmit={async () => {
          await api.post(`/qc/samples/${id}/review`, { decision: 'RETURN', comment });
          toast.success('Returned to analyst');
          refresh();
        }}
      >
        <Field label="Comment" required>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} required />
        </Field>
      </ActionDialog>
      <SignatureDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        action="QC result approval"
        meaning={`QC approval: results verified against specification; conclusion ${tests.some((t) => t.current?.evaluation === 'OOS_CANDIDATE') ? 'FAIL' : 'PASS'}`}
        record={`${s.number} — ${s.subject}`}
        confirmLabel="Sign & approve"
        onSign={async (sig) => {
          await api.post(`/qc/samples/${id}/approve`, sig);
          toast.success('QC sample approved');
          refresh();
        }}
      />
    </>
  );
}
