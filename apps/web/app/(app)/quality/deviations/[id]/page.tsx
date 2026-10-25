'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ListPlus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDirectory } from '@/lib/hooks';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import type { BlockingReason, Deviation } from '@/lib/types';
import { Button, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { ActionDialog, AiLabel, AuditHistory, Blockers, Callout, DetailHeader, Empty, Field, handleError, KeyValues, Section, SignatureDialog, SignatureList, Stepper } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Attachments } from '@/components/attachments';

const FISHBONE = ['HUMAN', 'MACHINE', 'METHOD', 'MATERIAL', 'MEASUREMENT', 'ENVIRONMENT'] as const;
const STEPS = ['DRAFT', 'SUBMITTED', 'QA_REVIEW', 'INVESTIGATION', 'ROOT_CAUSE', 'CAPA', 'EFFECTIVENESS_CHECK', 'CLOSED'];

interface AssistResult {
  aiGenerated: boolean;
  configured?: boolean;
  message?: string;
  label: string;
  model?: string;
  similarCases: { id: string; number: string; title: string; category: string | null; status: string; score: number; rootCause: string | null; capas: { id: string; number: string; status: string }[]; href: string }[];
  suggestions: { investigationAreas?: string[]; questions?: string[]; possibleContributingFactors?: { category: string; factor: string }[]; similarCaseNotes?: string } | null;
}

function RcaEditor({ onSave }: { onSave: (v: { fiveWhys: { question: string; answer: string }[]; fishbone: Record<string, string[]>; primaryCategory: string; statement: string }) => Promise<void> }) {
  const [whys, setWhys] = React.useState([{ question: 'Why did the deviation occur?', answer: '' }]);
  const [fish, setFish] = React.useState<Record<string, string>>({});
  const [primary, setPrimary] = React.useState('');
  const [statement, setStatement] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">5 Whys</div>
        <div className="space-y-2">
          {whys.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2">
              <Input value={w.question} onChange={(e) => setWhys(whys.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} aria-label={`Why ${i + 1} question`} />
              <Input placeholder="Because…" value={w.answer} onChange={(e) => setWhys(whys.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} aria-label={`Why ${i + 1} answer`} data-testid={`why-${i}`} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setWhys(whys.filter((_, j) => j !== i))} aria-label="Remove">
                <Trash2 />
              </Button>
            </div>
          ))}
          {whys.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setWhys([...whys, { question: `Why ${whys.length + 1}?`, answer: '' }])}>
              <Plus /> Add why
            </Button>
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fishbone (Ishikawa) — one cause per line</div>
        <div className="grid gap-2 md:grid-cols-3">
          {FISHBONE.map((c) => (
            <Field key={c} label={c.toLowerCase().replace(/^\w/, (x) => x.toUpperCase())}>
              <Textarea rows={2} value={fish[c] ?? ''} onChange={(e) => setFish({ ...fish, [c]: e.target.value })} />
            </Field>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <Field label="Primary category" required>
          <Select value={primary} onChange={(e) => setPrimary(e.target.value)} data-testid="rca-category">
            <option value="">Select…</option>
            {FISHBONE.map((c) => (
              <option key={c} value={c}>
                {c.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Root cause statement" required>
          <Textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} data-testid="rca-statement" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          loading={busy}
          data-testid="rca-save"
          onClick={async () => {
            setBusy(true);
            try {
              await onSave({
                fiveWhys: whys.filter((w) => w.answer.trim()),
                fishbone: Object.fromEntries(Object.entries(fish).map(([k, v]) => [k, v.split('\n').map((s) => s.trim()).filter(Boolean)]).filter(([, v]) => v.length)),
                primaryCategory: primary,
                statement,
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Save root cause analysis
        </Button>
      </div>
    </div>
  );
}

export default function DeviationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: d, isLoading } = useQuery({ queryKey: ['deviation', id], queryFn: () => api.get<Deviation>(`/deviations/${id}`) });
  const { data: owners } = useDirectory('deviation.investigate');
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [dialog, setDialog] = React.useState<null | 'classify' | 'investigation' | 'capaDecision' | 'close' | 'cancel'>(null);
  const [f, setF] = React.useState({ classification: '', ownerId: '', dueDate: '', notes: '', summary: '', impact: '', capaRequired: 'true', justification: '', effectiveness: '', reason: '' });
  const [assist, setAssist] = React.useState<AssistResult | null>(null);
  const [assisting, setAssisting] = React.useState(false);
  const refresh = () => ['deviation', 'audit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const post = async (path: string, body: unknown, msg: string) => {
    setReasons([]);
    try {
      await api.post(`/deviations/${id}/${path}`, body);
      toast.success(msg);
      refresh();
    } catch (e) {
      handleError(e, setReasons);
      throw e;
    }
  };
  if (isLoading || !d) return <Skeleton className="h-96" />;
  const isQa = can('deviation.approve', d.siteId);
  const isInv = can('deviation.investigate', d.siteId);
  const latestRca = d.rootCauseAnalyses?.[0];

  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Deviations', href: '/quality/deviations' }, { label: d.number }]}
        title={d.number}
        status={d.status}
        subtitle={d.title}
        meta={[
          { label: 'Classification', value: d.classification ? <StatusBadge status={d.classification} /> : d.proposedSeverity ? `${d.proposedSeverity.toLowerCase()} (proposed)` : 'Pending QA' },
          { label: 'Aging', value: <StatusBadge status={d.aging} tone={d.aging === 'OVERDUE' ? 'danger' : d.aging === 'ATTENTION' ? 'warning' : d.aging === 'CLOSED' ? 'muted' : 'success'} label={d.aging === 'CLOSED' ? 'Closed' : `${d.ageDays} days · ${d.aging.toLowerCase()}`} /> },
          { label: 'Owner', value: d.ownerName ?? 'Unassigned' },
          { label: 'Due', value: fmtDate(d.dueDate) },
          { label: 'Occurred', value: fmtDateTime(d.occurredAt) },
          { label: 'Reported by', value: d.reportedByName },
        ]}
        actions={
          <>
            {d.status === 'DRAFT' && can('deviation.create') && <Button onClick={() => post('submit', {}, 'Submitted to QA').catch(() => undefined)}>Submit to QA</Button>}
            {d.status === 'SUBMITTED' && isQa && <Button onClick={() => post('start-review', {}, 'QA review started').catch(() => undefined)} data-testid="dev-start-review">Start QA review</Button>}
            {d.status === 'QA_REVIEW' && isQa && <Button onClick={() => setDialog('classify')} data-testid="dev-classify">Classify & assign</Button>}
            {d.status === 'INVESTIGATION' && isInv && <Button onClick={() => setDialog('investigation')} data-testid="dev-investigation">Record investigation</Button>}
            {d.status === 'ROOT_CAUSE' && isQa && latestRca && (
              <Button onClick={() => post('approve-root-cause', {}, 'Root cause approved').catch(() => undefined)} data-testid="dev-approve-rc">
                Approve root cause
              </Button>
            )}
            {d.status === 'CAPA' && can('capa.create') && (
              <Button variant="outline" asChild>
                <Link href={`/quality/capa/new?deviationId=${d.id}`}>
                  <ListPlus /> Create CAPA
                </Link>
              </Button>
            )}
            {d.status === 'CAPA' && isQa && <Button onClick={() => setDialog('capaDecision')} data-testid="dev-capa-decision">Record CAPA decision</Button>}
            {d.status === 'EFFECTIVENESS_CHECK' && isQa && <Button onClick={() => setDialog('close')} data-testid="dev-close">Close (e-sign)</Button>}
            {['DRAFT', 'SUBMITTED', 'QA_REVIEW'].includes(d.status) && (isQa || d.status === 'DRAFT') && (
              <Button variant="ghost" onClick={() => setDialog('cancel')}>
                <Ban /> Cancel
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <Stepper steps={STEPS} current={d.status === 'CANCELLED' ? 'DRAFT' : d.status} />
        {reasons.length > 0 && <Blockers reasons={reasons} title="Action blocked by business rules" />}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Section title="Description">
            <p className="whitespace-pre-wrap text-[13.5px]">{d.description}</p>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Immediate action</div>
            <p className="mt-0.5 text-[13.5px]">{d.immediateAction}</p>
            {d.qaReviewNotes && (
              <>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">QA review</div>
                <p className="mt-0.5 text-[13.5px]">{d.qaReviewNotes}</p>
              </>
            )}
            {d.investigationSummary && (
              <>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investigation</div>
                <p className="mt-0.5 text-[13.5px]">{d.investigationSummary}</p>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Impact assessment</div>
                <p className="mt-0.5 text-[13.5px]">{d.impactAssessment}</p>
              </>
            )}
            {d.noCapaJustification && <p className="mt-3 text-[13px]">No CAPA required: {d.noCapaJustification}</p>}
            {d.effectivenessSummary && <p className="mt-3 text-[13px]">Effectiveness: {d.effectivenessSummary}</p>}
          </Section>
          <Section title="Root cause analysis" description="Structured 5-Whys and fishbone. Each save is kept as a new version; QA approves the final root cause.">
            {latestRca ? (
              <div className="space-y-3">
                {d.rootCauseAnalyses?.map((r, idx) => (
                  <div key={r.id} className={idx === 0 ? 'rounded-md border p-3' : 'rounded-md border border-dashed p-3 opacity-70'}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {idx === 0 ? 'Current' : 'Superseded'} · {r.createdByName} · {fmtDateTime(r.createdAt)}
                      {r.approvedAt && <StatusBadge status="APPROVED" label={`Approved by ${r.approvedByName}`} />}
                      {r.primaryCategory && <StatusBadge status={r.primaryCategory} tone="info" label={r.primaryCategory.toLowerCase()} />}
                    </div>
                    <p className="text-[13.5px] font-medium">{r.statement}</p>
                    {r.fiveWhys.length > 0 && (
                      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12.5px]">
                        {r.fiveWhys.map((w, i) => (
                          <li key={i}>
                            <span className="text-muted-foreground">{w.question}</span> {w.answer}
                          </li>
                        ))}
                      </ol>
                    )}
                    {Object.keys(r.fishbone).length > 0 && (
                      <div className="mt-2 grid gap-1 text-[12.5px] md:grid-cols-2">
                        {Object.entries(r.fishbone).map(([k, v]) => (
                          <div key={k}>
                            <b className="text-muted-foreground">{k.toLowerCase()}:</b> {v.join('; ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              d.status !== 'ROOT_CAUSE' && <Empty>Root cause is documented after the investigation phase.</Empty>
            )}
            {d.status === 'ROOT_CAUSE' && isInv && (
              <div className={latestRca ? 'mt-4 border-t pt-4' : ''}>
                <RcaEditor onSave={(v) => post('root-cause', v, 'Root cause analysis saved')} />
              </div>
            )}
          </Section>
          <Section title="CAPAs">
            {d.capas?.length ? (
              d.capas.map((c) => (
                <Link key={c.id} href={`/quality/capa/${c.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-mono text-[13px] font-medium">{c.number}</span>
                  <span className="truncate text-[13px]">{c.problemStatement}</span>
                  <StatusBadge status={c.status} />
                  <span className="ml-auto text-xs text-muted-foreground">due {fmtDate(c.dueDate)}</span>
                </Link>
              ))
            ) : (
              <Empty>No CAPAs linked.</Empty>
            )}
          </Section>
          <Section title="Evidence">
            <Attachments entityType="Deviation" entityId={d.id} canUpload={can('deviation.create') && d.status !== 'CLOSED'} />
          </Section>
        </div>
        <div className="space-y-4">
          {can('ai.assist.use') && !['CLOSED', 'CANCELLED'].includes(d.status) && (
            <Section
              title="AI investigation assistant"
              description="Suggests areas to investigate using this deviation and similar historical cases. Nothing is written to the record."
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  loading={assisting}
                  onClick={async () => {
                    setAssisting(true);
                    try {
                      setAssist(await api.post<AssistResult>(`/ai/deviations/${id}/assist`));
                    } catch (e) {
                      toast.error(errorMessage(e));
                    } finally {
                      setAssisting(false);
                    }
                  }}
                  data-testid="ai-assist"
                >
                  <Sparkles /> Analyse
                </Button>
              }
            >
              {assist ? (
                <div className="space-y-3 text-[13px]">
                  <AiLabel text={assist.label} />
                  {!assist.aiGenerated && assist.message && <Callout tone="warning">{assist.message}</Callout>}
                  {assist.suggestions && (
                    <>
                      {assist.suggestions.investigationAreas?.length ? (
                        <div>
                          <div className="font-semibold">Possible investigation areas</div>
                          <ul className="list-disc pl-5">
                            {assist.suggestions.investigationAreas.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {assist.suggestions.questions?.length ? (
                        <div>
                          <div className="font-semibold">Questions to ask</div>
                          <ul className="list-disc pl-5">
                            {assist.suggestions.questions.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {assist.suggestions.possibleContributingFactors?.length ? (
                        <div>
                          <div className="font-semibold">Possible contributing factors</div>
                          <ul className="list-disc pl-5">
                            {assist.suggestions.possibleContributingFactors.map((s, i) => (
                              <li key={i}>
                                <b>{s.category.toLowerCase()}:</b> {s.factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  )}
                  <div>
                    <div className="font-semibold">Similar historical deviations (computed by Pharmodry)</div>
                    {assist.similarCases.length ? (
                      <ul className="mt-1 space-y-1.5">
                        {assist.similarCases.map((c) => (
                          <li key={c.id} className="rounded-md border p-2">
                            <Link href={c.href} className="font-medium text-primary hover:underline">
                              {c.number}
                            </Link>{' '}
                            {c.title} <span className="text-xs text-muted-foreground">(similarity {c.score})</span>
                            {c.rootCause && <div className="text-xs">Approved root cause: {c.rootCause}</div>}
                            {c.capas.length > 0 && <div className="text-xs">CAPA: {c.capas.map((x) => `${x.number} (${x.status.toLowerCase()})`).join(', ')}</div>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">No sufficiently similar cases.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Run the assistant to see similar cases and suggested lines of enquiry. You decide what, if anything, to record.</p>
              )}
            </Section>
          )}
          <Section title="Details">
            <KeyValues
              cols={2}
              items={[
                { label: 'Site', value: d.site?.name },
                { label: 'Department', value: d.department?.name },
                { label: 'Process stage', value: d.category?.toLowerCase() },
                { label: 'Batch', value: d.batch ? <Link className="text-primary hover:underline" href={`/production/batches/${d.batch.id}`}>{d.batch.batchNumber}</Link> : '—' },
                { label: 'Product', value: d.product ? `${d.product.genericName} ${d.product.strength}` : '—' },
                { label: 'Material', value: d.material ? `${d.material.code} ${d.material.name}` : '—' },
                { label: 'Equipment', value: d.equipment ? `${d.equipment.code} ${d.equipment.description}` : '—' },
                { label: 'OOS', value: d.oos ? <Link className="text-primary hover:underline" href={`/quality/oos/${d.oos.id}`}>{d.oos.number}</Link> : '—' },
              ]}
            />
          </Section>
          <Section title="Electronic signatures">
            <SignatureList signatures={d.signatures} />
          </Section>
          <Section title="Audit trail">
            <AuditHistory entityId={d.id} />
          </Section>
        </div>
      </div>

      <ActionDialog open={dialog === 'classify'} onOpenChange={(o) => !o && setDialog(null)} title="Classify & assign" submitLabel="Classify" onSubmit={() => post('classify', { classification: f.classification, ownerId: f.ownerId, dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined, qaReviewNotes: f.notes }, 'Deviation classified')}>
        <Field label="Classification" required>
          <Select value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value })} required data-testid="dev-class-select">
            <option value="">Select…</option>
            <option value="MINOR">Minor</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </Select>
        </Field>
        <Field label="Investigation owner" required>
          <Select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })} required data-testid="dev-owner-select">
            <option value="">Select…</option>
            {owners?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} — {u.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" hint="Defaults from the classification policy if left empty">
          <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="QA review notes" required>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
      <ActionDialog open={dialog === 'investigation'} onOpenChange={(o) => !o && setDialog(null)} title="Investigation findings" submitLabel="Save & move to root cause" onSubmit={() => post('investigation', { investigationSummary: f.summary, impactAssessment: f.impact }, 'Investigation recorded')}>
        <Field label="Investigation summary" required>
          <Textarea rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} required minLength={10} />
        </Field>
        <Field label="Impact assessment" required hint="Product quality, other batches, patient safety, regulatory impact">
          <Textarea rows={3} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
      <ActionDialog open={dialog === 'capaDecision'} onOpenChange={(o) => !o && setDialog(null)} title="CAPA decision" submitLabel="Record decision" onSubmit={() => post('capa-decision', { capaRequired: f.capaRequired === 'true', noCapaJustification: f.capaRequired === 'true' ? undefined : f.justification }, 'CAPA decision recorded')}>
        <Field label="Is a CAPA required?" required>
          <Select value={f.capaRequired} onChange={(e) => setF({ ...f, capaRequired: e.target.value })}>
            <option value="true">Yes — CAPA(s) linked</option>
            <option value="false">No — justify</option>
          </Select>
        </Field>
        {f.capaRequired === 'false' && (
          <Field label="Justification" required>
            <Textarea value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} minLength={10} required />
          </Field>
        )}
      </ActionDialog>
      <SignatureDialog
        open={dialog === 'close'}
        onOpenChange={(o) => !o && setDialog(null)}
        action="Deviation closure"
        meaning="QA approval: deviation investigation, root cause and CAPA are adequate; deviation closed"
        record={`${d.number} — ${d.title}`}
        confirmLabel="Sign & close"
        extra={
          <Field label="Effectiveness summary" required>
            <Textarea value={f.effectiveness} onChange={(e) => setF({ ...f, effectiveness: e.target.value })} />
          </Field>
        }
        onSign={async (sig) => {
          await api.post(`/deviations/${id}/close`, { ...sig, effectivenessSummary: f.effectiveness });
          toast.success('Deviation closed');
          refresh();
        }}
      />
      <ActionDialog open={dialog === 'cancel'} onOpenChange={(o) => !o && setDialog(null)} title="Cancel deviation" destructive submitLabel="Cancel deviation" onSubmit={() => post('cancel', { reason: f.reason }, 'Deviation cancelled')}>
        <p className="text-sm text-muted-foreground">The record is kept with status CANCELLED and your reason; it is never deleted.</p>
        <Field label="Reason" required>
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
    </>
  );
}
