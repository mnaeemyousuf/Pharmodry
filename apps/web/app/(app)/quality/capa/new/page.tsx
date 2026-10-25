'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDirectory } from '@/lib/hooks';
import { toIsoDate } from '@/lib/utils';
import type { Deviation, Oos } from '@/lib/types';
import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui/primitives';
import { AiLabel, Callout, Field, PageHeader, Section } from '@/components/page';

interface Action {
  type: 'CORRECTIVE' | 'PREVENTIVE';
  description: string;
  ownerId: string;
  dueDate: string;
  aiSuggested?: boolean;
}

function NewCapaInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, can } = useAuth();
  const { data: people } = useDirectory();
  const deviationId = params.get('deviationId') ?? '';
  const oosId = params.get('oosId') ?? '';
  const { data: dev } = useQuery({ queryKey: ['deviation', deviationId], queryFn: () => api.get<Deviation>(`/deviations/${deviationId}`), enabled: !!deviationId });
  const { data: oos } = useQuery({ queryKey: ['oos', oosId], queryFn: () => api.get<Oos>(`/oos/${oosId}`), enabled: !!oosId });
  const in30 = toIsoDate(new Date(Date.now() + 30 * 86_400_000));
  const [h, setH] = React.useState({ source: deviationId ? 'DEVIATION' : oosId ? 'OOS' : 'OTHER', problemStatement: '', rootCause: '', priority: 'HIGH', ownerId: user?.id ?? '', dueDate: toIsoDate(new Date(Date.now() + 60 * 86_400_000)), effectivenessCriteria: '' });
  const [actions, setActions] = React.useState<Action[]>([]);
  const [drafts, setDrafts] = React.useState<{ corrective: string[]; preventive: string[]; effectivenessChecks: string[]; label: string } | null>(null);
  const [drafting, setDrafting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (dev) setH((x) => ({ ...x, problemStatement: x.problemStatement || `${dev.number}: ${dev.title}`, rootCause: x.rootCause || dev.rootCauseAnalyses?.find((r) => r.approvedAt)?.statement || '' }));
  }, [dev]);
  React.useEffect(() => {
    if (oos) setH((x) => ({ ...x, problemStatement: x.problemStatement || `${oos.number}: ${oos.testName} ${oos.actualResult} vs ${oos.specification}${oos.batch ? ` (batch ${oos.batch.batchNumber})` : ''}`, rootCause: x.rootCause || oos.rootCause || '' }));
  }, [oos]);

  const draft = async () => {
    setDrafting(true);
    try {
      const r = await api.post<{ drafts: { corrective: string[]; preventive: string[]; effectivenessChecks: string[] }; label: string }>('/ai/capa/draft', { deviationId: deviationId || undefined, oosId: oosId || undefined });
      setDrafts({ ...r.drafts, label: r.label });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDrafting(false);
    }
  };
  const accept = (type: Action['type'], description: string) => setActions([...actions, { type, description, ownerId: h.ownerId, dueDate: in30, aiSuggested: true }]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api.post<{ id: string; number: string }>('/capas', {
        siteId: dev?.siteId ?? oos?.siteId ?? user?.sites[0]?.id,
        ...h,
        deviationId: deviationId || undefined,
        oosId: oosId || undefined,
        dueDate: new Date(h.dueDate).toISOString(),
        actions: actions.map((a) => ({ ...a, dueDate: new Date(a.dueDate).toISOString() })),
      });
      toast.success(`${c.number} created`);
      router.push(`/quality/capa/${c.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New CAPA" crumbs={[{ label: 'CAPA', href: '/quality/capa' }, { label: 'New' }]} description={dev ? `From deviation ${dev.number}` : oos ? `From OOS ${oos.number}` : undefined} />
      <form onSubmit={submit} className="space-y-4">
        <Section title="Problem">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Source" required>
              <Select value={h.source} onChange={(e) => setH({ ...h, source: e.target.value })} disabled={!!deviationId || !!oosId}>
                {['DEVIATION', 'OOS', 'OOT', 'AUDIT', 'COMPLAINT', 'SUPPLIER', 'RECALL', 'OTHER'].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" required>
              <Select value={h.priority} onChange={(e) => setH({ ...h, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Owner" required>
              <Select value={h.ownerId} onChange={(e) => setH({ ...h, ownerId: e.target.value })} required>
                {people?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date" required>
              <Input type="date" value={h.dueDate} onChange={(e) => setH({ ...h, dueDate: e.target.value })} required />
            </Field>
            <Field label="Problem statement" required className="md:col-span-4">
              <Textarea rows={2} value={h.problemStatement} onChange={(e) => setH({ ...h, problemStatement: e.target.value })} required minLength={10} data-testid="capa-problem" />
            </Field>
            <Field label="Root cause" className="md:col-span-2">
              <Textarea rows={2} value={h.rootCause} onChange={(e) => setH({ ...h, rootCause: e.target.value })} />
            </Field>
            <Field label="Effectiveness criteria" className="md:col-span-2" hint="How will you prove the CAPA worked?">
              <Textarea rows={2} value={h.effectivenessCriteria} onChange={(e) => setH({ ...h, effectivenessCriteria: e.target.value })} />
            </Field>
          </div>
        </Section>
        {(deviationId || oosId) && can('ai.assist.use') && (
          <Section
            title="AI CAPA assistant"
            description="Drafts possible actions from the approved root cause. Select only what you agree with and edit it before saving."
            actions={
              <Button type="button" variant="outline" size="sm" onClick={draft} loading={drafting}>
                <Sparkles /> Draft suggestions
              </Button>
            }
          >
            {drafts ? (
              <div className="space-y-3 text-[13px]">
                <AiLabel text={drafts.label} />
                {(
                  [
                    ['CORRECTIVE', 'Corrective', drafts.corrective],
                    ['PREVENTIVE', 'Preventive', drafts.preventive],
                  ] as const
                ).map(([type, label, list]) => (
                  <div key={type}>
                    <div className="font-semibold">{label}</div>
                    {list.map((s, i) => (
                      <label key={i} className="mt-1 flex items-start gap-2">
                        <Checkbox checked={actions.some((a) => a.description === s)} onCheckedChange={(on) => (on ? accept(type, s) : setActions(actions.filter((a) => a.description !== s)))} />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                ))}
                {drafts.effectivenessChecks.length > 0 && (
                  <div>
                    <div className="font-semibold">Effectiveness check ideas</div>
                    {drafts.effectivenessChecks.map((s, i) => (
                      <button type="button" key={i} className="mt-1 block text-left text-primary hover:underline" onClick={() => setH({ ...h, effectivenessCriteria: s })}>
                        Use: {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Callout tone="ai">Suggestions are optional. If the AI provider is not configured, draft the actions manually below.</Callout>
            )}
          </Section>
        )}
        <Section
          title="Actions"
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => setActions([...actions, { type: 'CORRECTIVE', description: '', ownerId: h.ownerId, dueDate: in30 }])} data-testid="capa-add-action">
              <Plus /> Add action
            </Button>
          }
        >
          <div className="space-y-2">
            {actions.map((a, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-[140px_1fr_200px_150px_36px]">
                <Select value={a.type} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, type: e.target.value as Action['type'] } : x)))}>
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="PREVENTIVE">Preventive</option>
                </Select>
                <div>
                  <Input value={a.description} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Action description" required minLength={5} data-testid={`capa-action-${i}`} />
                  {a.aiSuggested && <span className="text-[11px] text-progress">AI-drafted, accepted & editable by you</span>}
                </div>
                <Select value={a.ownerId} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, ownerId: e.target.value } : x)))}>
                  {people?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </Select>
                <Input type="date" value={a.dueDate} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setActions(actions.filter((_, j) => j !== i))} aria-label="Remove action">
                  <Trash2 />
                </Button>
              </div>
            ))}
            {actions.length === 0 && <p className="text-sm text-muted-foreground">Add at least one corrective or preventive action (actions can also be added later).</p>}
          </div>
        </Section>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} data-testid="capa-submit">
            Create CAPA
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NewCapaPage() {
  return (
    <Suspense>
      <NewCapaInner />
    </Suspense>
  );
}
