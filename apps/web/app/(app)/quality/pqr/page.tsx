'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { useProducts } from '@/lib/hooks';
import { fmtDate, fmtNum, toIsoDate } from '@/lib/utils';
import { Button, Card, Input, Select, Skeleton } from '@/components/ui/primitives';
import { Callout, Empty, PageHeader, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

interface Pqr {
  product: { id: string; code: string; name: string; brand?: string; dosageForm?: string; registrationNumber?: string; gtin?: string };
  period: { from: string; to: string };
  batches: { total: number; released: number; rejected: number; inProcess: number; list: { id: string; batchNumber: string; status: string; yieldPct: number | null; withinTolerance: boolean | null; qaDecisionAt?: string }[] };
  yield: { n: number; mean: number | null; sd: number | null; min: number | null; max: number | null; outOfTolerance: number };
  qcResults: { test: string; n: number; mean: number; min: number; max: number }[];
  deviations: { total: number; open: number; bySeverity: { key: string; count: number }[]; byCategory: { key: string; count: number }[]; list: { id: string; number: string; title: string; status: string; classification?: string }[] };
  oos: { total: number; confirmed: number; invalidated: number; open: number; list: { id: string; number: string; test: string; result: string; conclusion?: string; status: string }[] };
  capas: { total: number; closed: number; effectivenessFailures: number; overdue: number; list: { id: string; number: string; status: string; problem: string }[] };
  startingMaterials: { material: string; type: string; suppliers: string[] }[];
  notCaptured: string[];
}

export default function PqrPage() {
  const { data: products } = useProducts();
  const [f, setF] = React.useState({ productId: '', from: toIsoDate(new Date(Date.now() - 365 * 86_400_000)), to: toIsoDate(new Date()) });
  React.useEffect(() => {
    if (!f.productId && products?.length) setF((x) => ({ ...x, productId: products[0].id }));
  }, [products, f.productId]);
  const { data: p, isLoading } = useQuery({
    queryKey: ['pqr', f],
    queryFn: () => api.get<Pqr>('/analytics/pqr', { productId: f.productId, from: new Date(f.from).toISOString(), to: new Date(`${f.to}T23:59:59`).toISOString() }),
    enabled: !!f.productId,
  });
  return (
    <>
      <PageHeader
        title="Product Quality Review data pack"
        description="Figures computed from batch, QC, OOS, deviation and CAPA records for the PIC/S GMP Chapter 1 product quality review. QA authors the evaluation and conclusions."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
        }
      />
      <Card className="no-print mb-4 flex flex-wrap items-end gap-3 p-3">
        <label className="text-xs text-muted-foreground">
          Product
          <Select className="mt-1 w-64" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
            {products?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code} — {x.genericName} {x.strength}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">
          From
          <Input type="date" className="mt-1 w-40" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <Input type="date" className="mt-1 w-40" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </label>
      </Card>
      {isLoading || !p ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-4">
          <Card className="p-4 text-[13px]">
            <div className="text-lg font-semibold">
              {p.product.code} — {p.product.name} {p.product.brand ? `(${p.product.brand})` : ''}
            </div>
            <div className="text-muted-foreground">
              {p.product.dosageForm} · Registration {p.product.registrationNumber ?? '—'} · GTIN {p.product.gtin ?? 'not recorded'} · Review period {fmtDate(p.period.from)} – {fmtDate(p.period.to)}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {(
              [
                ['Batches', p.batches.total],
                ['Released', p.batches.released],
                ['Rejected', p.batches.rejected],
                ['Mean yield', p.yield.mean === null ? '—' : `${p.yield.mean}%`],
                ['Yield SD', p.yield.sd ?? '—'],
                ['Deviations', p.deviations.total],
                ['OOS (confirmed)', `${p.oos.total} (${p.oos.confirmed})`],
                ['CAPAs (closed)', `${p.capas.total} (${p.capas.closed})`],
              ] as const
            ).map(([l, v]) => (
              <Card key={l} className="p-3">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="mt-1 text-lg font-semibold tabular">{v}</div>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="1. Batches manufactured">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5">Batch</th>
                    <th className="py-1.5">Status</th>
                    <th className="py-1.5 text-right">Yield</th>
                    <th className="py-1.5">QA decision</th>
                  </tr>
                </thead>
                <tbody>
                  {p.batches.list.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-1.5">
                        <Link className="font-mono text-primary hover:underline" href={`/production/batches/${b.id}`}>
                          {b.batchNumber}
                        </Link>
                      </td>
                      <td className="py-1.5">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className={b.withinTolerance === false ? 'py-1.5 text-right font-semibold text-warning tabular' : 'py-1.5 text-right tabular'}>{b.yieldPct === null ? '—' : `${b.yieldPct}%`}</td>
                      <td className="py-1.5">{fmtDate(b.qaDecisionAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                Yield range {p.yield.min ?? '—'}–{p.yield.max ?? '—'}%, {p.yield.outOfTolerance} batch(es) outside tolerance.
              </p>
            </Section>
            <Section title="2. Finished-product QC results (approved samples)">
              {p.qcResults.length ? (
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5">Test</th>
                      <th className="py-1.5 text-right">n</th>
                      <th className="py-1.5 text-right">Mean</th>
                      <th className="py-1.5 text-right">Min</th>
                      <th className="py-1.5 text-right">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.qcResults.map((t) => (
                      <tr key={t.test} className="border-b last:border-0">
                        <td className="py-1.5">{t.test}</td>
                        <td className="py-1.5 text-right tabular">{t.n}</td>
                        <td className="py-1.5 text-right tabular">{fmtNum(t.mean)}</td>
                        <td className="py-1.5 text-right tabular">{fmtNum(t.min)}</td>
                        <td className="py-1.5 text-right tabular">{fmtNum(t.max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty>No approved finished-product results in the period.</Empty>
              )}
            </Section>
            <Section title="3. Deviations">
              <p className="mb-2 text-[12.5px]">
                By severity: {p.deviations.bySeverity.map((s) => `${s.key.toLowerCase()} ${s.count}`).join(', ') || '—'} · by stage: {p.deviations.byCategory.map((s) => `${s.key.toLowerCase()} ${s.count}`).join(', ') || '—'} · open {p.deviations.open}
              </p>
              {p.deviations.list.map((d) => (
                <Link key={d.id} href={`/quality/deviations/${d.id}`} className="block text-[12.5px] text-primary hover:underline">
                  {d.number} — {d.title} ({d.status.toLowerCase()})
                </Link>
              ))}
            </Section>
            <Section title="4. OOS investigations">
              <p className="mb-2 text-[12.5px]">
                Confirmed {p.oos.confirmed} · invalidated (lab error) {p.oos.invalidated} · open {p.oos.open}
              </p>
              {p.oos.list.map((o) => (
                <Link key={o.id} href={`/quality/oos/${o.id}`} className="block text-[12.5px] text-primary hover:underline">
                  {o.number} — {o.test}: {o.result} ({o.conclusion?.toLowerCase().replace(/_/g, ' ') ?? o.status.toLowerCase()})
                </Link>
              ))}
            </Section>
            <Section title="5. CAPAs">
              <p className="mb-2 text-[12.5px]">
                Closed {p.capas.closed} of {p.capas.total} · effectiveness failures {p.capas.effectivenessFailures} · overdue {p.capas.overdue}
              </p>
              {p.capas.list.map((c) => (
                <Link key={c.id} href={`/quality/capa/${c.id}`} className="block text-[12.5px] text-primary hover:underline">
                  {c.number} — {c.problem} ({c.status.toLowerCase()})
                </Link>
              ))}
            </Section>
            <Section title="6. Starting materials and suppliers">
              {p.startingMaterials.map((m) => (
                <div key={m.material} className="text-[12.5px]">
                  <b>{m.material}</b> ({m.type.toLowerCase()}): {m.suppliers.join(', ') || 'legacy / migrated lots'}
                </div>
              ))}
            </Section>
          </div>
          <Callout tone="warning" title="Sections not captured in this release">
            {p.notCaptured.join(' · ')}. Add these from their source systems before approving the PQR.
          </Callout>
        </div>
      )}
    </>
  );
}
