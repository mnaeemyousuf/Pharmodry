'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Table2, BarChart3, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useLookups, useProducts, useSites } from '@/lib/hooks';
import { cn, fmtNum, fmtPkr, toIsoDate } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/page';
import { ComboChart, HBar } from '@/components/charts';

interface Dashboard {
  kpis: Record<string, number | null>;
  charts: {
    planVsActual: { month: string; planned: number; actual: number }[];
    yieldTrend: { batch: string; id: string; yieldPct: number }[];
    deviationTrend: { month: string; MINOR: number; MAJOR: number; CRITICAL: number }[];
    capaAging: { bucket: string; open: number; overdue: number }[];
    oosTrend: { month: string; oos: number; confirmed: number; invalidated: number }[];
    inventoryByStatus: { status: string; lots: number; value: number }[];
    nearExpiry: { bucket: string; lots: number; value: number }[];
    supplierRejection: { supplier: string; id: string; rejectionPct: number; lots: number }[];
    releaseCycleTime: { batch: string; id: string; hours: number }[];
  };
}

function Kpi({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: 'danger' | 'warning' | 'success' }) {
  const body = (
    <Card className={cn('h-full p-4 transition-colors', href && 'hover:border-primary/50 hover:bg-accent/30')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
        {href && <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={cn('mt-2 text-[26px] font-semibold leading-none tabular', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning', tone === 'success' && 'text-success')}>{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block" data-testid={`kpi-${label}`}>
      {body}
    </Link>
  ) : (
    body
  );
}

function ChartCard({ title, subtitle, rows, columns, children, className }: { title: string; subtitle?: string; rows: Record<string, unknown>[]; columns: [string, string][]; children: React.ReactNode; className?: string }) {
  const [table, setTable] = React.useState(false);
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-1">
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setTable(!table)} aria-label={table ? 'Show chart' : 'Show table'}>
          {table ? <BarChart3 /> : <Table2 />}
        </Button>
      </CardHeader>
      <CardContent>
        {table ? (
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {columns.map(([, h]) => (
                    <th key={h} className="py-1.5 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map(([k]) => (
                      <td key={k} className="py-1.5 pr-3 tabular">
                        {typeof r[k] === 'number' ? fmtNum(r[k] as number, 1) : String(r[k] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No data in this period.</div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export default function DashboardPage() {
  const router = useRouter();
  const { data: sites } = useSites();
  const { data: products } = useProducts();
  const { data: lookups } = useLookups();
  const [f, setF] = React.useState({ siteId: '', productId: '', categoryId: '', from: toIsoDate(new Date(Date.now() - 180 * 86_400_000)), to: toIsoDate(new Date()) });
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', f], queryFn: () => api.get<Dashboard>('/analytics/dashboard', f) });
  const k = data?.kpis ?? {};
  const c = data?.charts;
  return (
    <>
      <PageHeader title="Management dashboard" description="Operational, quality, inventory and supplier KPIs computed from live regulated records. Click any KPI to drill into the underlying records." />
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3" role="group" aria-label="Dashboard filters">
        <label className="text-xs text-muted-foreground">
          Plant
          <Select className="mt-1 w-48" value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value })}>
            <option value="">All plants</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">
          Product
          <Select className="mt-1 w-56" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
            <option value="">All products</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.genericName} {p.strength}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">
          Category
          <Select className="mt-1 w-56" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            <option value="">All categories</option>
            {lookups?.categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
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
      {isLoading || !c ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Active batches" value={k.activeBatches} href="/production/batches?view=active" hint="Planned through awaiting QA" />
            <Kpi label="Awaiting QA release" value={k.batchesAwaitingQa} href="/quality/release" tone={k.batchesAwaitingQa ? 'warning' : undefined} />
            <Kpi label="Open deviations" value={k.openDeviations} href="/quality/deviations?view=open" />
            <Kpi label="Overdue CAPAs" value={k.overdueCapas} href="/quality/capa?view=overdue" tone={k.overdueCapas ? 'danger' : 'success'} />
            <Kpi label="Open OOS" value={k.openOos} href="/quality/oos?view=open" tone={k.openOos ? 'danger' : 'success'} />
            <Kpi label="Materials at high risk" value={k.materialsAtRisk} href="/inventory?tab=risk" hint={`${k.rawMaterialStockouts ?? 0} raw-material stock-outs`} tone={k.materialsAtRisk ? 'warning' : undefined} />
            <Kpi label="Near-expiry inventory" value={fmtPkr(k.nearExpiryValue)} href="/inventory?view=expiring90" hint={`${k.nearExpiryLots} lots within 90 days`} />
            <Kpi label="Plan achievement" value={k.planAchievementPct === null ? '—' : `${k.planAchievementPct}%`} href="/production/plans" hint="Released ÷ planned, last 6 months" />
            <Kpi label="Avg batch release time" value={k.avgBatchReleaseHours === null ? '—' : `${fmtNum(k.avgBatchReleaseHours, 0)} h`} hint="Manufacturing end → QA decision" />
            <Kpi label="Supplier quality score" value={k.supplierQualityScore === null ? '—' : `${k.supplierQualityScore}`} href="/master-data/suppliers" hint="Mean of OTD, acceptance, documentation" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ChartCard title="Production plan vs actual" subtitle="Units planned vs released per month" rows={c.planVsActual.map((r) => ({ ...r, month: monthLabel(r.month) }))} columns={[['month', 'Month'], ['planned', 'Planned'], ['actual', 'Released']]}>
              <ComboChart data={c.planVsActual.map((r) => ({ ...r, month: monthLabel(r.month) }))} x="month" series={[{ key: 'planned', name: 'Planned', color: 'var(--series-1)' }, { key: 'actual', name: 'Released', color: 'var(--series-2)' }]} />
            </ChartCard>
            <ChartCard title="Batch yield trend" subtitle="Yield % per released batch; shaded band = configured tolerance (click a point to open the batch)" rows={c.yieldTrend} columns={[['batch', 'Batch'], ['yieldPct', 'Yield %']]}>
              <ComboChart data={c.yieldTrend} x="batch" unit="%" band={[98, 102]} yDomain={[95, 103]} series={[{ key: 'yieldPct', name: 'Yield %', color: 'var(--series-1)', type: 'line' }]} onClick={(r) => router.push(`/production/batches/${r.id}`)} />
            </ChartCard>
            <ChartCard title="Deviation trend" subtitle="Deviations by classification per month" rows={c.deviationTrend.map((r) => ({ ...r, month: monthLabel(r.month) }))} columns={[['month', 'Month'], ['MINOR', 'Minor'], ['MAJOR', 'Major'], ['CRITICAL', 'Critical']]}>
              <ComboChart
                data={c.deviationTrend.map((r) => ({ ...r, month: monthLabel(r.month) }))}
                x="month"
                series={[
                  { key: 'MINOR', name: 'Minor', color: 'var(--seq-250)', stack: 's' },
                  { key: 'MAJOR', name: 'Major', color: 'var(--seq-450)', stack: 's' },
                  { key: 'CRITICAL', name: 'Critical', color: 'var(--seq-650)', stack: 's' },
                ]}
              />
            </ChartCard>
            <ChartCard title="CAPA aging" subtitle="Open CAPAs by age; overdue portion highlighted" rows={c.capaAging} columns={[['bucket', 'Age'], ['open', 'Open'], ['overdue', 'Overdue']]}>
              <ComboChart
                data={c.capaAging.map((r) => ({ ...r, onTrack: r.open - r.overdue }))}
                x="bucket"
                series={[
                  { key: 'onTrack', name: 'On track', color: 'var(--series-1)', stack: 'c' },
                  { key: 'overdue', name: 'Overdue', color: 'var(--series-2)', stack: 'c' },
                ]}
              />
            </ChartCard>
            <ChartCard title="OOS trend" subtitle="OOS investigations opened per month and their QA conclusion" rows={c.oosTrend.map((r) => ({ ...r, month: monthLabel(r.month) }))} columns={[['month', 'Month'], ['oos', 'Opened'], ['confirmed', 'Confirmed'], ['invalidated', 'Invalidated']]}>
              <ComboChart
                data={c.oosTrend.map((r) => ({ ...r, month: monthLabel(r.month) }))}
                x="month"
                series={[
                  { key: 'confirmed', name: 'Confirmed OOS', color: 'var(--series-2)', stack: 'o' },
                  { key: 'invalidated', name: 'Invalidated (lab error)', color: 'var(--series-1)', stack: 'o' },
                  { key: 'oos', name: 'Opened', color: 'var(--series-3)', type: 'line' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Inventory value by status" subtitle="PKR, lots with quantity on hand" rows={c.inventoryByStatus} columns={[['status', 'Status'], ['lots', 'Lots'], ['value', 'Value (PKR)']]}>
              <HBar data={c.inventoryByStatus.map((r) => ({ ...r, status: r.status.replace(/_/g, ' ').toLowerCase() }))} label="status" value="value" />
            </ChartCard>
            <ChartCard title="Near-expiry inventory" subtitle="Value (PKR) by time to expiry" rows={c.nearExpiry} columns={[['bucket', 'Window'], ['lots', 'Lots'], ['value', 'Value (PKR)']]}>
              <ComboChart data={c.nearExpiry} x="bucket" series={[{ key: 'value', name: 'Value (PKR)', color: 'var(--series-1)' }]} onClick={() => router.push('/inventory?view=expiring90')} />
            </ChartCard>
            <ChartCard title="Supplier QC rejection rate" subtitle="% of dispositioned lots rejected" rows={c.supplierRejection} columns={[['supplier', 'Supplier'], ['rejectionPct', 'Rejection %'], ['lots', 'Lots received']]}>
              <HBar data={c.supplierRejection} label="supplier" value="rejectionPct" unit="%" />
            </ChartCard>
            <ChartCard className="xl:col-span-2" title="Batch release cycle time" subtitle="Hours from end of manufacturing to QA decision, per released batch" rows={c.releaseCycleTime} columns={[['batch', 'Batch'], ['hours', 'Hours']]}>
              <ComboChart data={c.releaseCycleTime} x="batch" unit=" h" series={[{ key: 'hours', name: 'Hours to release', color: 'var(--series-1)' }]} onClick={(r) => router.push(`/production/batches/${r.id}`)} />
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
