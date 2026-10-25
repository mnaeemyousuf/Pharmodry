'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ClipboardPlus, Link2, ListPlus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDirectory } from '@/lib/hooks';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import type { BlockingReason, Deviation, Oos } from '@/lib/types';
import { Button, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { ActionDialog, AuditHistory, Blockers, Callout, DetailHeader, Field, handleError, KeyValues, Section, SignatureDialog, SignatureList, Stepper } from '@/components/page';

const PHASE_FIELD: Record<string, { field: string; label: string; hint: string }> = {
  PRELIMINARY_INVESTIGATION: { field: 'preliminaryFindings', label: 'Preliminary investigation findings', hint: 'Analyst/supervisor checks: calculations, dilutions, sample identity, instrument log, obvious errors.' },
  LAB_INVESTIGATION: { field: 'labInvestigation', label: 'Laboratory investigation (Phase I)', hint: 'Hypothesis testing: standards, reagents, apparatus, re-measurement of original preparations.' },
  MANUFACTURING_INVESTIGATION: { field: 'manufacturingInvestigation', label: 'Manufacturing investigation (Phase II)', hint: 'Batch record review, process parameters, equipment, materials, environment. “N/A — lab error” is acceptable when Phase I found an assignable cause.' },
  ROOT_CAUSE: { field: 'rootCause', label: 'Root cause', hint: 'The established root cause with supporting evidence. AI suggestions are never recorded here automatically.' },
  IMPACT_ASSESSMENT: { field: 'impactAssessment', label: 'Impact assessment', hint: 'Impact on this batch, other batches, released product, stability and patients.' },
};

export default function OosDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({ queryKey: ['oos', id], queryFn: () => api.get<Oos>(`/oos/${id}`) });
  const { data: owners } = useDirectory('oos.investigate');
  const { data: devs } = useQuery({ queryKey: ['devs-open-for-link'], queryFn: () => api.page<Deviation>('/deviations', { view: 'open', pageSize: 100 }).then((r) => r.data) });
  const [text, setText] = React.useState('');
  const [labError, setLabError] = React.useState<'' | 'true' | 'false'>('');
  const [ownerId, setOwnerId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [dialog, setDialog] = React.useState<null | 'link' | 'CONFIRMED_OOS' | 'INVALIDATED_LAB_ERROR'>(null);
  const [devId, setDevId] = React.useState('');
  const refresh = () => ['oos', 'audit', 'sample', 'batch'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  React.useEffect(() => {
    setText('');
    setLabError('');
  }, [o?.status]);
  if (isLoading || !o) return <Skeleton className="h-96" />;

  const phase = PHASE_FIELD[o.status];
  const canInvestigate = can('oos.investigate', o.siteId) && !['QA_APPROVAL', 'CLOSED'].includes(o.status);
  const advance = async () => {
    setBusy(true);
    setReasons([]);
    try {
      const body: Record<string, unknown> = {};
      if (o.status === 'REPORTED') body.ownerId = ownerId || undefined;
      if (phase) body[phase.field] = text;
      if (o.status === 'LAB_INVESTIGATION') body.assignableLabError = labError === 'true';
      if (o.status === 'CAPA' && text) body.capaJustification = text;
      await api.post(`/oos/${id}/advance`, body);
      toast.success('Investigation phase completed');
      refresh();
    } catch (e) {
      handleError(e, setReasons);
    } finally {
      setBusy(false);
    }
  };
  const history: [string, string | undefined | null][] = [
    ['Preliminary investigation', o.preliminaryFindings],
    ['Laboratory investigation', o.labInvestigation ? `${o.labInvestigation}${o.assignableLabError === null || o.assignableLabError === undefined ? '' : o.assignableLabError ? ' — Assignable laboratory error identified.' : ' — No assignable laboratory error.'}` : null],
    ['Manufacturing investigation', o.manufacturingInvestigation],
    ['Root cause', o.rootCause],
    ['Impact assessment', o.impactAssessment],
    ['CAPA justification', o.capaJustification],
  ];

  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'OOS investigations', href: '/quality/oos' }, { label: o.number }]}
        title={o.number}
        status={o.status}
        subtitle={`${o.testName}: result ${o.actualResult} vs specification ${o.specification}`}
        meta={[
          { label: 'Product / material', value: o.product ? `${o.product.genericName} ${o.product.strength}` : o.material ? `${o.material.code} ${o.material.name}` : '—' },
          { label: 'Batch', value: o.batch ? <Link className="text-primary hover:underline" href={`/production/batches/${o.batch.id}`}>{o.batch.batchNumber}</Link> : '—' },
          { label: 'Lot', value: o.lot ? <Link className="text-primary hover:underline" href={`/inventory/lots/${o.lot.id}`}>{o.lot.lotNumber}</Link> : '—' },
          { label: 'QC sample', value: o.sample ? <Link className="text-primary hover:underline" href={`/quality/samples/${o.sample.id}`}>{o.sample.number}</Link> : '—' },
          { label: 'Owner', value: o.ownerName ?? 'Unassigned' },
          { label: 'Due', value: <span className={o.overdue ? 'text-danger' : ''}>{fmtDate(o.dueDate)}</span> },
        ]}
        actions={
          <>
            {can('oos.investigate') && !o.deviation && (
              <>
                <Button variant="outline" onClick={() => setDialog('link')}>
                  <Link2 /> Link deviation
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/quality/deviations/new?oosId=${o.id}${o.batch ? `&batchId=${o.batch.id}` : ''}`}>
                    <ClipboardPlus /> Raise deviation
                  </Link>
                </Button>
              </>
            )}
            {can('capa.create') && o.status !== 'CLOSED' && (
              <Button variant="outline" asChild>
                <Link href={`/quality/capa/new?oosId=${o.id}`}>
                  <ListPlus /> Create CAPA
                </Link>
              </Button>
            )}
            {o.status === 'QA_APPROVAL' && can('oos.approve') && (
              <>
                <Button onClick={() => setDialog('CONFIRMED_OOS')} data-testid="oos-confirm">
                  <ShieldCheck /> Conclude: confirmed OOS
                </Button>
                <Button variant="outline" onClick={() => setDialog('INVALIDATED_LAB_ERROR')} disabled={!o.assignableLabError} title={o.assignableLabError ? undefined : 'Only possible when the lab investigation identified an assignable error'}>
                  Conclude: invalidated (lab error)
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <Stepper steps={o.phases ?? []} current={o.status} />
        <Callout tone="warning">Pharmodry flagged this result automatically because it is outside the specification. It has <b>not</b> decided whether it is a true OOS. That conclusion is a QA decision recorded with an electronic signature after investigation.</Callout>
        {reasons.length > 0 && <Blockers reasons={reasons} title="Phase cannot be completed" />}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {canInvestigate && (
            <Section title={`Current phase: ${o.status.replace(/_/g, ' ').toLowerCase()}`} description={phase?.hint ?? (o.status === 'REPORTED' ? 'Assign an investigation owner to begin.' : o.status === 'CAPA' ? 'Create a CAPA from this OOS (button above) or justify why none is required.' : undefined)}>
              <div className="space-y-3">
                {o.status === 'REPORTED' && (
                  <Field label="Investigation owner">
                    <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                      <option value="">Me</option>
                      {owners?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} — {u.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {phase && (
                  <Field label={phase.label} required>
                    <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} data-testid="oos-phase-text" />
                  </Field>
                )}
                {o.status === 'LAB_INVESTIGATION' && (
                  <Field label="Was an assignable laboratory error identified?" required>
                    <Select value={labError} onChange={(e) => setLabError(e.target.value as '' | 'true' | 'false')} data-testid="oos-lab-error">
                      <option value="">Select…</option>
                      <option value="false">No — result stands; proceed to manufacturing investigation</option>
                      <option value="true">Yes — assignable laboratory error (retest may be authorised by QA)</option>
                    </Select>
                  </Field>
                )}
                {o.status === 'CAPA' && (
                  <Field label="Justification if no CAPA is required" hint={`${o.capas?.length ?? 0} CAPA(s) linked`}>
                    <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
                  </Field>
                )}
                <div className="flex justify-end">
                  <Button onClick={advance} loading={busy} data-testid="oos-advance">
                    Complete phase <ArrowRight />
                  </Button>
                </div>
              </div>
            </Section>
          )}
          <Section title="Investigation record">
            <div className="space-y-3">
              {history.map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{value}</p>
                  </div>
                ) : null,
              )}
              {o.conclusion && (
                <Callout tone={o.conclusion === 'CONFIRMED_OOS' ? 'danger' : 'warning'} title={`QA conclusion: ${o.conclusion.replace(/_/g, ' ').toLowerCase()}`}>
                  Closed by {o.closedByName} on {fmtDateTime(o.closedAt)}.
                </Callout>
              )}
            </div>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Details">
            <KeyValues
              cols={2}
              items={[
                { label: 'Test', value: o.testName },
                { label: 'Specification', value: o.specification },
                { label: 'Result', value: <b className="text-danger">{o.actualResult}</b> },
                { label: 'Analyst', value: o.analystName },
                { label: 'Instrument', value: o.instrument },
                { label: 'Reported', value: fmtDateTime(o.createdAt) },
              ]}
            />
          </Section>
          <Section title="Linked records">
            <div className="space-y-2 text-[13px]">
              <div>
                Deviation:{' '}
                {o.deviation ? (
                  <Link className="text-primary hover:underline" href={`/quality/deviations/${o.deviation.id}`}>
                    {o.deviation.number} — {o.deviation.title}
                  </Link>
                ) : (
                  'none'
                )}
              </div>
              <div>
                CAPAs:{' '}
                {o.capas?.length
                  ? o.capas.map((c) => (
                      <Link key={c.id} className="mr-2 text-primary hover:underline" href={`/quality/capa/${c.id}`}>
                        {c.number}
                      </Link>
                    ))
                  : 'none'}
              </div>
              <div>Equipment: {o.equipment ? `${o.equipment.code} ${o.equipment.description}` : '—'}</div>
            </div>
          </Section>
          <Section title="Electronic signatures">
            <SignatureList signatures={o.signatures} />
          </Section>
          <Section title="Audit trail">
            <AuditHistory entityId={o.id} />
          </Section>
        </div>
      </div>
      <ActionDialog
        open={dialog === 'link'}
        onOpenChange={(o2) => !o2 && setDialog(null)}
        title="Link an existing deviation"
        submitLabel="Link"
        onSubmit={async () => {
          await api.post(`/oos/${id}/link-deviation`, { deviationId: devId });
          toast.success('Deviation linked');
          refresh();
        }}
      >
        <Field label="Deviation" required>
          <Select value={devId} onChange={(e) => setDevId(e.target.value)} required>
            <option value="">Select…</option>
            {devs?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} — {d.title}
              </option>
            ))}
          </Select>
        </Field>
      </ActionDialog>
      <SignatureDialog
        open={dialog === 'CONFIRMED_OOS' || dialog === 'INVALIDATED_LAB_ERROR'}
        onOpenChange={(o2) => !o2 && setDialog(null)}
        action="OOS investigation QA conclusion"
        meaning={dialog === 'CONFIRMED_OOS' ? 'QA approval: OOS confirmed — result is valid and out of specification' : 'QA approval: result invalidated due to assignable laboratory error; retest authorised'}
        record={`${o.number} — ${o.testName}`}
        reasonRequired
        reasonLabel="Justification for the conclusion"
        confirmLabel="Sign conclusion"
        onSign={async (sig) => {
          await api.post(`/oos/${id}/qa-approve`, { conclusion: dialog, ...sig });
          toast.success('OOS investigation closed');
          refresh();
        }}
      />
    </>
  );
}
