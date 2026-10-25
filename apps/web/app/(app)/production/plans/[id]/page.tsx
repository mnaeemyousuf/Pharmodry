'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CheckCircle, Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, fmtNum, toIsoDate } from '@/lib/utils';
import type { Plan, PlanLine } from '@/lib/types';
import { Button, Input, Skeleton } from '@/components/ui/primitives';
import { ActionDialog, AuditHistory, DetailHeader, Field, handleError, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: plan } = useQuery({ queryKey: ['plan', id], queryFn: () => api.get<Plan>(`/production-plans/${id}`) });
  const [newFor, setNewFor] = React.useState<PlanLine | null>(null);
  const [start, setStart] = React.useState(toIsoDate(new Date(Date.now() + 86_400_000)));
  const [busy, setBusy] = React.useState(false);
  if (!plan) return <Skeleton className="h-96" />;
  const approve = async () => {
    setBusy(true);
    try {
      await api.post(`/production-plans/${id}/approve`);
      toast.success('Plan approved');
      qc.invalidateQueries({ queryKey: ['plan', id] });
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Production plans', href: '/production/plans' }, { label: plan.number }]}
        title={plan.number}
        status={plan.status}
        subtitle={plan.name}
        meta={[
          { label: 'Period', value: `${fmtDate(plan.periodStart)} – ${fmtDate(plan.periodEnd)}` },
          { label: 'Planned quantity', value: fmtNum(plan.progress.plannedQuantity) },
          { label: 'Released quantity', value: fmtNum(plan.progress.releasedQuantity) },
          { label: 'Achievement', value: `${plan.progress.achievementPct}%` },
          { label: 'Created by', value: plan.createdByName },
          { label: 'Approved by', value: plan.approvedByName },
        ]}
        actions={
          plan.status === 'DRAFT' &&
          can('production.plan.approve') && (
            <Button onClick={approve} loading={busy}>
              <CheckCircle2 /> Approve plan
            </Button>
          )
        }
      />
      <div className="space-y-4">
        {plan.lines.map((l) => (
          <Section
            key={l.id}
            title={`${l.product?.code} · ${l.product?.genericName} ${l.product?.strength}`}
            description={`${l.plannedBatches} batch(es) · ${fmtNum(l.plannedQuantity)} planned · demand ${fmtNum(l.demandQuantity)} · finished goods available ${fmtNum(l.finishedGoodsAvailable)}`}
            actions={
              plan.status === 'APPROVED' &&
              can('batch.create') && (
                <Button size="sm" onClick={() => setNewFor(l)} data-testid={`create-batch-${l.product?.code}`}>
                  <Plus /> Create batch
                </Button>
              )
            }
          >
            <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batches</div>
                {l.batches?.length ? (
                  <ul className="divide-y rounded-md border">
                    {l.batches.map((b) => (
                      <li key={b.id}>
                        <Link href={`/production/batches/${b.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                          <span className="font-mono text-[13px] font-medium text-primary">{b.batchNumber}</span>
                          <StatusBadge status={b.status} />
                          <span className="ml-auto text-xs text-muted-foreground">start {fmtDate(b.plannedStart)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No batches yet.</p>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Material availability per batch (BOM v{l.availability?.bomVersion})
                  {l.availability && (l.availability.feasible ? <StatusBadge status="PASS" label="Feasible" /> : <StatusBadge status="FAIL" label="Shortage" />)}
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5">Material</th>
                      <th className="py-1.5 text-right">Required</th>
                      <th className="py-1.5 text-right">Released avail.</th>
                      <th className="py-1.5 text-right">Quarantine</th>
                      <th className="py-1.5 text-right">On order</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {l.availability?.lines.map((m) => (
                      <tr key={m.materialId} className="border-b last:border-0">
                        <td className="py-1.5">
                          <Link className="hover:underline" href={`/master-data/materials/${m.materialId}`}>
                            {m.code}
                          </Link>
                        </td>
                        <td className="py-1.5 text-right tabular">{fmtNum(m.required)}</td>
                        <td className={cn('py-1.5 text-right tabular', !m.sufficient && 'font-semibold text-danger')}>{fmtNum(m.available)}</td>
                        <td className="py-1.5 text-right tabular">{fmtNum(m.quarantine)}</td>
                        <td className="py-1.5 text-right tabular">{fmtNum(m.onOrder)}</td>
                        <td className="py-1.5 pl-2">{m.sufficient ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        ))}
        <Section title="Audit trail">
          <AuditHistory entityId={plan.id} />
        </Section>
      </div>
      <ActionDialog
        open={!!newFor}
        onOpenChange={(o) => !o && setNewFor(null)}
        title={`Create batch — ${newFor?.product?.genericName ?? ''} ${newFor?.product?.strength ?? ''}`}
        description="The batch number is generated from the configured numbering rule; the eBMR is instantiated from the active manufacturing template and BOM."
        submitLabel="Create batch"
        onSubmit={async () => {
          const b = await api.post<{ id: string; batchNumber: string }>('/batches', { siteId: plan.siteId, productId: newFor!.productId, planLineId: newFor!.id, plannedStart: new Date(start).toISOString() });
          toast.success(`Batch ${b.batchNumber} created`);
          router.push(`/production/batches/${b.id}`);
        }}
      >
        <Field label="Planned start" required>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <p className="text-xs text-muted-foreground">Batch size: {fmtNum(newFor?.product?.standardBatchSize)} (standard).</p>
      </ActionDialog>
    </>
  );
}
