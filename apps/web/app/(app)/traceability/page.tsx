'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowRight, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, fmtDateTime, fmtNum } from '@/lib/utils';
import { Button, Card, Input } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Callout, Empty, PageHeader, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

interface Hit { type: 'batch' | 'lot'; id: string; label: string; sub: string }
interface Forward {
  lot: { id: string; lotNumber: string; status: string; supplierBatch?: string; expiryDate: string; uom: string; onHand: number };
  material: { id: string; code: string; name: string } | null;
  supplier: { id: string; code: string; name: string } | null;
  receipt: { id: string; number: string; receivedAt: string; quantity: number } | null;
  batches: { id: string; batchNumber: string; status: string; product: string; quantityUsed: number; reservedNotYetConsumed: number; finishedGoods: { id: string; lotNumber: string; status: string; onHand: number; dispatched: number; uom: string }[] }[];
}
interface Backward {
  batch: { id: string; batchNumber: string; status: string; product: string; gs1: string | null };
  inputs: { lotId: string; lotNumber: string; material: string; materialType?: string; supplier: string; supplierBatch?: string; grn: { id: string; number: string } | null; qcRelease: { id: string; number: string; conclusion: string } | null; quantityUsed: number; reserved: number; uom: string; lotStatusNow: string }[];
}
interface Recall {
  batch: { id: string; batchNumber: string; status: string; product: string; expiryDate?: string; uom: string };
  reconciliation: { produced: number; onHand: number; dispatched: number; returned: number; adjustmentsAndSamples: number; accountedFor: number; unaccounted: number; reconciled: boolean };
  locations: { lotId: string; lotNumber: string; status: string; warehouse: string; onHand: number }[];
  movements: { id: string; at: string; type: string; quantity: number; balanceAfter: number; reason?: string; by: string | null }[];
  customers: { captured: boolean; note: string };
}

function BatchTrace({ id }: { id: string }) {
  const { can } = useAuth();
  const { data: g, error: ge } = useQuery({ queryKey: ['trace-batch', id], queryFn: () => api.get<Backward>(`/traceability/batches/${id}`), retry: false });
  const { data: r, error: re } = useQuery({ queryKey: ['trace-recall', id], queryFn: () => api.get<Recall>(`/traceability/batches/${id}/recall`), retry: false });
  if (ge || re) return <Callout tone="danger" title="Trace not available">{errorMessage(ge ?? re)}</Callout>;
  if (!g || !r) return <Empty>Loading genealogy…</Empty>;
  const rec = r.reconciliation;
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div>
          <div className="text-xs text-muted-foreground">Batch</div>
          <Link href={`/production/batches/${g.batch.id}`} className="font-mono text-lg font-semibold text-primary hover:underline">
            {g.batch.batchNumber}
          </Link>
        </div>
        <StatusBadge status={g.batch.status} />
        <div className="text-[13px]">{g.batch.product}</div>
        {g.batch.gs1 && <div className="font-mono text-xs text-muted-foreground">GS1: {g.batch.gs1}</div>}
        {can('report.export') && (
          <Button
            className="ml-auto"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await api.download(`/traceability/batches/${id}/recall/export`);
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            <Download /> Export recall reconciliation
          </Button>
        )}
      </Card>
      <Tabs defaultValue="recall">
        <TabsList>
          <TabsTrigger value="recall">Mock recall reconciliation</TabsTrigger>
          <TabsTrigger value="inputs">Backward genealogy ({g.inputs.length} input lots)</TabsTrigger>
        </TabsList>
        <TabsContent value="recall" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {(
              [
                ['Produced', rec.produced],
                ['On hand', rec.onHand],
                ['Dispatched', rec.dispatched],
                ['Returned', rec.returned],
                ['Adjustments / samples', rec.adjustmentsAndSamples],
                ['Accounted for', rec.accountedFor],
                ['Unaccounted', rec.unaccounted],
              ] as const
            ).map(([l, v]) => (
              <Card key={l} className="p-3">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className={cn('mt-1 text-lg font-semibold tabular', l === 'Unaccounted' && v !== 0 && 'text-danger')}>{fmtNum(v)}</div>
              </Card>
            ))}
          </div>
          <Callout tone={rec.reconciled ? 'success' : 'danger'} title={rec.reconciled ? 'Quantities reconcile' : 'Reconciliation gap'}>
            {rec.reconciled ? `All ${fmtNum(rec.produced)} ${r.batch.uom} produced are accounted for (on hand + dispatched ± adjustments).` : `${fmtNum(rec.unaccounted)} ${r.batch.uom} cannot be accounted for — investigate before closing the recall exercise.`}
          </Callout>
          <Callout tone="info">{r.customers.note}</Callout>
          <Section title="Current locations">
            {r.locations.map((l) => (
              <Link key={l.lotId} href={`/inventory/lots/${l.lotId}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                <span className="font-mono text-[13px]">{l.lotNumber}</span>
                <span className="text-[13px]">{l.warehouse}</span>
                <StatusBadge status={l.status} />
                <span className="ml-auto tabular">{fmtNum(l.onHand)}</span>
              </Link>
            ))}
          </Section>
          <Section title="Finished-goods movements">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">When</th>
                  <th className="py-2">Type</th>
                  <th className="py-2 text-right">Quantity</th>
                  <th className="py-2 text-right">Balance</th>
                  <th className="py-2">By / reason</th>
                </tr>
              </thead>
              <tbody>
                {r.movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2">{fmtDateTime(m.at)}</td>
                    <td className="py-2">
                      <StatusBadge status={m.type} tone="neutral" />
                    </td>
                    <td className="py-2 text-right tabular">{fmtNum(m.quantity)}</td>
                    <td className="py-2 text-right tabular">{fmtNum(m.balanceAfter)}</td>
                    <td className="py-2 text-muted-foreground">{[m.by, m.reason].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </TabsContent>
        <TabsContent value="inputs">
          <Section title="Input material lots" description="Every lot reserved for or consumed by this batch, with supplier, receipt and QC release evidence.">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Lot</th>
                    <th className="py-2 pr-3">Material</th>
                    <th className="py-2 pr-3">Supplier / supplier batch</th>
                    <th className="py-2 pr-3">GRN</th>
                    <th className="py-2 pr-3">QC</th>
                    <th className="py-2 pr-3 text-right">Used</th>
                    <th className="py-2">Lot status now</th>
                  </tr>
                </thead>
                <tbody>
                  {g.inputs.map((i) => (
                    <tr key={i.lotId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link className="font-mono text-primary hover:underline" href={`/traceability?lot=${i.lotId}`}>
                          {i.lotNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{i.material}</td>
                      <td className="py-2 pr-3">
                        {i.supplier}
                        <div className="text-xs text-muted-foreground">{i.supplierBatch}</div>
                      </td>
                      <td className="py-2 pr-3">{i.grn ? <Link className="text-primary hover:underline" href={`/inventory/receipts/${i.grn.id}`}>{i.grn.number}</Link> : 'Migrated'}</td>
                      <td className="py-2 pr-3">{i.qcRelease ? <Link className="text-primary hover:underline" href={`/quality/samples/${i.qcRelease.id}`}>{i.qcRelease.number}</Link> : '—'}</td>
                      <td className="py-2 pr-3 text-right tabular">
                        {fmtNum(i.quantityUsed || i.reserved, 3)} {i.uom}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={i.lotStatusNow} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LotTrace({ id }: { id: string }) {
  const { data: f, error } = useQuery({ queryKey: ['trace-lot', id], queryFn: () => api.get<Forward>(`/traceability/lots/${id}`), retry: false });
  if (error) return <Callout tone="danger" title="Trace not available">{errorMessage(error)}</Callout>;
  if (!f) return <Empty>Loading trace…</Empty>;
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-4 text-[13px]">
        <div>
          <div className="text-xs text-muted-foreground">Material lot</div>
          <Link href={`/inventory/lots/${f.lot.id}`} className="font-mono text-lg font-semibold text-primary hover:underline">
            {f.lot.lotNumber}
          </Link>
        </div>
        <StatusBadge status={f.lot.status} />
        <div>{f.material ? `${f.material.code} ${f.material.name}` : ''}</div>
        <div className="text-muted-foreground">Supplier: {f.supplier?.name ?? '—'} · batch {f.lot.supplierBatch ?? '—'}</div>
        <div className="text-muted-foreground">Received: {f.receipt ? `${f.receipt.number} · ${fmtDate(f.receipt.receivedAt)}` : 'migrated'}</div>
        <div className="ml-auto">
          On hand: <b>{fmtNum(f.lot.onHand)} {f.lot.uom}</b>
        </div>
      </Card>
      <Section title="Forward trace" description="Batches that reserved or consumed this lot, and the finished goods they produced.">
        {f.batches.length ? (
          <ol className="space-y-3">
            {f.batches.map((b) => (
              <li key={b.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                  <Link className="font-mono font-semibold text-primary hover:underline" href={`/traceability?batch=${b.id}`}>
                    {b.batchNumber}
                  </Link>
                  <StatusBadge status={b.status} />
                  <span>{b.product}</span>
                  <span className="ml-auto text-muted-foreground">
                    used {fmtNum(b.quantityUsed, 3)} {f.lot.uom}
                    {b.reservedNotYetConsumed ? ` · reserved ${fmtNum(b.reservedNotYetConsumed, 3)}` : ''}
                  </span>
                </div>
                {b.finishedGoods.map((g) => (
                  <div key={g.id} className="mt-2 flex items-center gap-2 pl-6 text-[12.5px]">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <Link className="font-mono text-primary hover:underline" href={`/inventory/lots/${g.id}`}>
                      FG {g.lotNumber}
                    </Link>
                    <StatusBadge status={g.status} />
                    <span className="text-muted-foreground">
                      on hand {fmtNum(g.onHand)} · dispatched {fmtNum(g.dispatched)} {g.uom}
                    </span>
                  </div>
                ))}
              </li>
            ))}
          </ol>
        ) : (
          <Empty>This lot has not been used in any batch.</Empty>
        )}
      </Section>
    </div>
  );
}

function TraceabilityInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [term, setTerm] = React.useState('');
  const { data: hits } = useQuery({ queryKey: ['trace-search', term], queryFn: () => api.get<Hit[]>('/traceability/search', { q: term }), enabled: term.length >= 2 });
  const batch = params.get('batch');
  const lot = params.get('lot');
  return (
    <>
      <PageHeader title="Traceability & mock recall" description="Backward genealogy (what went into a batch), forward trace (where a material lot went) and recall reconciliation of finished goods." />
      <form
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q);
        }}
      >
        <Input placeholder="Batch number, internal lot or supplier batch…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Trace search" data-testid="trace-search" />
        <Button type="submit">
          <Search /> Trace
        </Button>
      </form>
      {hits && (
        <Card className="mb-4 divide-y">
          {hits.length === 0 && <div className="p-4 text-sm text-muted-foreground">No batches or material lots match.</div>}
          {hits.map((h) => (
            <button key={`${h.type}-${h.id}`} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/40" onClick={() => router.push(`/traceability?${h.type}=${h.id}`)}>
              <span className="w-14 text-[11px] font-semibold uppercase text-muted-foreground">{h.type}</span>
              <span className="font-mono text-[13px] font-medium">{h.label}</span>
              <span className="text-xs text-muted-foreground">{h.sub}</span>
            </button>
          ))}
        </Card>
      )}
      {batch ? <BatchTrace id={batch} /> : lot ? <LotTrace id={lot} /> : <Empty>Search for a batch or material lot to begin. Use “Trace” on any batch or lot page as a shortcut.</Empty>}
    </>
  );
}

export default function TraceabilityPage() {
  return (
    <Suspense>
      <TraceabilityInner />
    </Suspense>
  );
}
