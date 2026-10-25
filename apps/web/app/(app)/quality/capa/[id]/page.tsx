'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDirectory } from '@/lib/hooks';
import { fmtDate, fmtDateTime, toIsoDate } from '@/lib/utils';
import type { BlockingReason, Capa, CapaAction } from '@/lib/types';
import { Button, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { ActionDialog, AuditHistory, Blockers, Callout, DetailHeader, Field, handleError, KeyValues, Section, SignatureDialog, SignatureList, Stepper } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Attachments } from '@/components/attachments';

export default function CapaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const { data: c, isLoading } = useQuery({ queryKey: ['capa', id], queryFn: () => api.get<Capa>(`/capas/${id}`) });
  const { data: people } = useDirectory();
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [dialog, setDialog] = React.useState<null | 'complete' | 'add' | 'effectiveness' | 'close' | 'cancel'>(null);
  const [action, setAction] = React.useState<CapaAction | null>(null);
  const [f, setF] = React.useState({ evidence: '', type: 'CORRECTIVE', description: '', ownerId: '', dueDate: toIsoDate(new Date(Date.now() + 30 * 86_400_000)), effective: 'true', result: '', reason: '' });
  const refresh = () => ['capa', 'audit', 'capa-kpis'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (isLoading || !c) return <Skeleton className="h-96" />;
  const open = (c.actions ?? []).filter((a) => a.status === 'OPEN').length;

  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'CAPA', href: '/quality/capa' }, { label: c.number }]}
        title={c.number}
        status={c.status}
        subtitle={c.problemStatement}
        meta={[
          { label: 'Source', value: c.deviation ? <Link className="text-primary hover:underline" href={`/quality/deviations/${c.deviation.id}`}>{c.deviation.number}</Link> : c.oos ? <Link className="text-primary hover:underline" href={`/quality/oos/${c.oos.id}`}>{c.oos.number}</Link> : c.source.toLowerCase() },
          { label: 'Priority', value: <StatusBadge status={c.priority} /> },
          { label: 'Owner', value: c.ownerName },
          { label: 'Due', value: <span className={c.overdue ? 'font-semibold text-danger' : ''}>{fmtDate(c.dueDate)}{c.overdue ? ' (overdue)' : ''}</span> },
          { label: 'Actions', value: `${(c.actions?.length ?? 0) - open} / ${c.actions?.length ?? 0} complete` },
          { label: 'Effectiveness failures', value: c.effectivenessFailures },
        ]}
        actions={
          <>
            {['OPEN', 'IN_PROGRESS'].includes(c.status) && can('capa.manage') && (
              <Button variant="outline" onClick={() => { setF({ ...f, description: '', ownerId: c.ownerId }); setDialog('add'); }}>
                <Plus /> Add action
              </Button>
            )}
            {c.status === 'IN_PROGRESS' && can('capa.manage') && (
              <Button
                onClick={async () => {
                  setReasons([]);
                  try {
                    await api.post(`/capas/${id}/submit-effectiveness`);
                    toast.success('Submitted for effectiveness check');
                    refresh();
                  } catch (e) {
                    handleError(e, setReasons);
                  }
                }}
                data-testid="capa-submit-eff"
              >
                <ClipboardCheck /> Submit for effectiveness check
              </Button>
            )}
            {c.status === 'EFFECTIVENESS_CHECK' && can('capa.verify') && c.effectivenessEffective !== true && (
              <Button onClick={() => setDialog('effectiveness')} data-testid="capa-effectiveness">
                Record effectiveness check
              </Button>
            )}
            {c.status === 'EFFECTIVENESS_CHECK' && c.effectivenessEffective === true && can('capa.close') && (
              <Button onClick={() => setDialog('close')} data-testid="capa-close">
                <ShieldCheck /> Close (e-sign)
              </Button>
            )}
            {['OPEN', 'IN_PROGRESS'].includes(c.status) && can('capa.close') && (
              <Button variant="ghost" onClick={() => setDialog('cancel')}>
                Cancel
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <Stepper steps={['OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK', 'CLOSED']} current={c.status === 'CANCELLED' ? 'OPEN' : c.status} />
        {reasons.length > 0 && <Blockers reasons={reasons} title="Action blocked" />}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Section title="Actions">
            <div className="space-y-2">
              {c.actions?.map((a) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={a.type} tone={a.type === 'CORRECTIVE' ? 'info' : 'progress'} label={a.type.toLowerCase()} />
                    <StatusBadge status={a.status} />
                    {a.aiSuggested && <StatusBadge status="AI" tone="progress" label="AI-drafted, human-accepted" />}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {a.ownerName} · due {fmtDate(a.dueDate)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px]">{a.description}</p>
                  {a.evidence && (
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      Evidence: {a.evidence} — {a.completedByName}, {fmtDateTime(a.completedAt)}
                    </p>
                  )}
                  {a.status === 'OPEN' && (a.ownerId === user?.id || can('capa.manage')) && ['OPEN', 'IN_PROGRESS'].includes(c.status) && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => { setAction(a); setF({ ...f, evidence: '' }); setDialog('complete'); }} data-testid={`complete-action-${a.id}`}>
                      <CheckCircle2 /> Mark complete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Section>
          <Section title="Effectiveness">
            <KeyValues
              cols={2}
              items={[
                { label: 'Criteria', value: c.effectivenessCriteria },
                { label: 'Result', value: c.effectivenessResult },
                { label: 'Effective?', value: c.effectivenessEffective === null || c.effectivenessEffective === undefined ? 'Not yet checked' : c.effectivenessEffective ? 'Yes' : 'No' },
                { label: 'Checked', value: fmtDateTime(c.effectivenessCheckedAt) },
              ]}
            />
            {c.status === 'CLOSED' && (
              <div className="mt-3">
                <Callout tone="success" title="Closed">
                  {c.closedByName} · {fmtDateTime(c.closedAt)}
                </Callout>
              </div>
            )}
          </Section>
          <Section title="Evidence">
            <Attachments entityType="Capa" entityId={c.id} canUpload={can('capa.manage') && c.status !== 'CLOSED'} />
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Details">
            <KeyValues
              cols={2}
              items={[
                { label: 'Root cause', value: c.rootCause },
                { label: 'Department', value: c.department?.name },
                { label: 'Created', value: `${c.createdByName ?? ''} · ${fmtDate(c.createdAt)}` },
                { label: 'Source', value: c.source.toLowerCase() },
              ]}
            />
          </Section>
          <Section title="Electronic signatures">
            <SignatureList signatures={c.signatures} />
          </Section>
          <Section title="Audit trail">
            <AuditHistory entityId={c.id} />
          </Section>
        </div>
      </div>
      <ActionDialog
        open={dialog === 'complete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Complete action"
        description={action?.description}
        submitLabel="Mark complete"
        onSubmit={async () => {
          await api.post(`/capas/${id}/actions/${action!.id}/complete`, { evidence: f.evidence });
          toast.success('Action completed');
          refresh();
        }}
      >
        <Field label="Objective evidence" required hint="What was done and where the evidence is (attach documents under Evidence)">
          <Textarea value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} required minLength={5} data-testid="action-evidence" />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'add'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Add action"
        submitLabel="Add action"
        onSubmit={async () => {
          await api.post(`/capas/${id}/actions`, { type: f.type, description: f.description, ownerId: f.ownerId, dueDate: new Date(f.dueDate).toISOString() });
          toast.success('Action added');
          refresh();
        }}
      >
        <Field label="Type" required>
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="CORRECTIVE">Corrective</option>
            <option value="PREVENTIVE">Preventive</option>
          </Select>
        </Field>
        <Field label="Description" required>
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required minLength={5} />
        </Field>
        <Field label="Owner" required>
          <Select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })} required>
            {people?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" required>
          <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} required />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'effectiveness'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Effectiveness check"
        description="A failed check returns the CAPA to In Progress and is counted in the effectiveness-failure KPI."
        submitLabel="Record result"
        onSubmit={async () => {
          await api.post(`/capas/${id}/effectiveness`, { effective: f.effective === 'true', result: f.result });
          toast.success('Effectiveness recorded');
          refresh();
        }}
      >
        <Field label="Was the CAPA effective?" required>
          <Select value={f.effective} onChange={(e) => setF({ ...f, effective: e.target.value })}>
            <option value="true">Yes — criteria met</option>
            <option value="false">No — return to In Progress</option>
          </Select>
        </Field>
        <Field label="Result / evidence" required>
          <Textarea value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} required minLength={10} data-testid="eff-result" />
        </Field>
      </ActionDialog>
      <SignatureDialog
        open={dialog === 'close'}
        onOpenChange={(o) => !o && setDialog(null)}
        action="CAPA closure"
        meaning="QA approval: CAPA actions implemented and verified effective; CAPA closed"
        record={`${c.number} — ${c.problemStatement.slice(0, 80)}`}
        confirmLabel="Sign & close"
        onSign={async (sig) => {
          await api.post(`/capas/${id}/close`, sig);
          toast.success('CAPA closed');
          refresh();
        }}
      />
      <ActionDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cancel CAPA"
        destructive
        submitLabel="Cancel CAPA"
        onSubmit={async () => {
          await api.post(`/capas/${id}/cancel`, { reason: f.reason });
          toast.success('CAPA cancelled');
          refresh();
        }}
      >
        <Field label="Reason" required>
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
    </>
  );
}
