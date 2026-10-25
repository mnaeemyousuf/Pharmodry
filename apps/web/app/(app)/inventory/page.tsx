'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWarehouses, statusOptions } from '@/lib/hooks';
import { cn, fmtDate, fmtNum, fmtPkr } from '@/lib/utils';
import type { Lot } from '@/lib/types';
import { Button, Card } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

interface StockRow { materialId: string; code: string; name: string; type: string; released: number; available: number; reserved: number; quarantine: number; rejected: number; safetyStock: number; belowSafetyStock: boolean }
interface Risk { materialId: string; code: string; name: string; type: string; uom: string; available: number; quarantine: number; safetyStock: number; avgDailyConsumption: number; stockCoverDays: number | null; leadTimeDays: number; openPoQuantity: number; plannedDemand: number; risk: string; explanation: string }
interface Expiry { lotId: string; lotNumber: string; itemCode: string; itemName: string; quantity: number; uom: string; expiryDate: string; daysToExpiry: number; value: number; projectedUseBeforeExpiry: number; atRiskQuantity: number; recommendation: string }

function SimpleTable<T>({ rows, cols, empty }: { rows?: T[]; cols: { h: string; c: (r: T) => React.ReactNode; className?: string }[]; empty: string }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            {cols.map((c) => (
              <th key={c.h} className={cn('px-3 py-2.5 font-medium', c.className)}>
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              {cols.map((c) => (
                <td key={c.h} className={cn('px-3 py-2.5 align-top', c.className)}>
                  {c.c(r)}
                </td>
              ))}
            </tr>
          ))}
          {rows && rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-3 py-10 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function InventoryInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const { data: warehouses } = useWarehouses();
  const tab = params.get('tab') ?? 'lots';
  const [value, setValue] = React.useState<number | null>(null);
  const { data: summary } = useQuery({ queryKey: ['stock-summary'], queryFn: () => api.get<StockRow[]>('/inventory/stock-summary'), enabled: tab === 'summary' });
  const { data: risk } = useQuery({ queryKey: ['inventory-risk'], queryFn: () => api.get<Risk[]>('/analytics/inventory-risk'), enabled: tab === 'risk' });
  const { data: expiry } = useQuery({ queryKey: ['expiry-risk'], queryFn: () => api.get<Expiry[]>('/analytics/expiry-risk'), enabled: tab === 'expiry' });
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Lot-level stock by status and location. Quarantined, rejected, blocked or expired lots can never be reserved or consumed."
        actions={
          can('inventory.receive') && (
            <Button asChild>
              <Link href="/inventory/receipts/new">
                <Plus /> Receive goods (GRN)
              </Link>
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(t) => router.replace(`/inventory?tab=${t}`)}>
        <TabsList>
          <TabsTrigger value="lots">Lots</TabsTrigger>
          <TabsTrigger value="summary">Stock by material</TabsTrigger>
          <TabsTrigger value="risk">Stock-out risk</TabsTrigger>
          <TabsTrigger value="expiry">Expiry intelligence</TabsTrigger>
        </TabsList>
        <TabsContent value="lots">
          {value !== null && <p className="mb-2 text-xs text-muted-foreground">Value of lots in this view: <b className="text-foreground">{fmtPkr(value)}</b></p>}
          <DataTable<Lot>
            id="inventory-lots"
            endpoint="/inventory/lots"
            exportPath="/inventory/lots/export"
            defaultView={params.get('view') ?? 'all'}
            views={[
              { value: 'all', label: 'All on hand' },
              { value: 'available', label: 'Available (released)' },
              { value: 'awaitingDisposition', label: 'Awaiting disposition' },
              { value: 'expiring30', label: 'Expiring ≤ 30 d' },
              { value: 'expiring60', label: '≤ 60 d' },
              { value: 'expiring90', label: '≤ 90 d' },
              { value: 'expired', label: 'Expired' },
            ]}
            onLoaded={(m) => setValue(typeof m?.totalValue === 'number' ? m.totalValue : null)}
            searchPlaceholder="Lot number or supplier batch"
            filters={[
              { param: 'status', label: 'Status', options: statusOptions(['QUARANTINE', 'UNDER_TEST', 'RELEASED', 'REJECTED', 'BLOCKED', 'EXPIRED']) },
              { param: 'itemType', label: 'Type', options: [{ value: 'MATERIAL', label: 'Materials' }, { value: 'PRODUCT', label: 'Finished goods' }] },
              { param: 'warehouseId', label: 'Warehouse', options: (warehouses ?? []).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })) },
            ]}
            rowHref={(r) => `/inventory/lots/${r.id}`}
            columns={[
              { key: 'lot', header: 'Lot', sort: 'lotNumber', cell: (r) => <span className="font-mono">{r.lotNumber}</span>, csv: (r) => r.lotNumber },
              { key: 'item', header: 'Item', cell: (r) => <span>{r.item?.code} <span className="text-muted-foreground">{r.item?.name}</span></span>, csv: (r) => r.item?.name },
              { key: 'status', header: 'Status', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
              { key: 'qty', header: 'Quantity', sort: 'quantity', className: 'text-right tabular', cell: (r) => `${fmtNum(r.quantity)} ${r.uomCode}`, csv: (r) => r.quantity },
              { key: 'reserved', header: 'Reserved', className: 'text-right tabular', cell: (r) => (r.reservedQuantity ? fmtNum(r.reservedQuantity) : '—'), csv: (r) => r.reservedQuantity },
              { key: 'loc', header: 'Location', cell: (r) => `${r.warehouse?.code ?? ''}${r.bin ? ` / ${r.bin.code}` : ''}` },
              { key: 'supplierBatch', header: 'Supplier batch', cell: (r) => r.supplierBatch ?? '—', hidden: true },
              { key: 'expiry', header: 'Expiry', sort: 'expiryDate', cell: (r) => <span className={cn((r.daysToExpiry ?? 999) < 0 ? 'text-danger' : (r.daysToExpiry ?? 999) <= 90 ? 'text-warning' : '')}>{fmtDate(r.expiryDate)}</span>, csv: (r) => r.expiryDate },
              { key: 'retest', header: 'Retest', cell: (r) => fmtDate(r.retestDate), hidden: true },
            ]}
          />
        </TabsContent>
        <TabsContent value="summary">
          <SimpleTable<StockRow>
            rows={summary}
            empty="No materials"
            cols={[
              { h: 'Material', c: (r) => <Link className="font-medium text-primary hover:underline" href={`/master-data/materials/${r.materialId}`}>{r.code}</Link> },
              { h: 'Name', c: (r) => r.name },
              { h: 'Type', c: (r) => r.type },
              { h: 'Available', className: 'text-right tabular', c: (r) => <span className={r.belowSafetyStock ? 'font-semibold text-warning' : ''}>{fmtNum(r.available)}</span> },
              { h: 'Reserved', className: 'text-right tabular', c: (r) => fmtNum(r.reserved) },
              { h: 'Quarantine / test', className: 'text-right tabular', c: (r) => fmtNum(r.quarantine) },
              { h: 'Rejected / blocked / expired', className: 'text-right tabular', c: (r) => fmtNum(r.rejected) },
              { h: 'Safety stock', className: 'text-right tabular', c: (r) => fmtNum(r.safetyStock) },
              { h: '', c: (r) => (r.belowSafetyStock ? <StatusBadge status="WARNING" label="Below safety stock" /> : null) },
            ]}
          />
        </TabsContent>
        <TabsContent value="risk">
          <p className="mb-3 text-[13px] text-muted-foreground">Deterministic analysis: 90-day average consumption, released stock net of reservations and planned demand, supplier lead time and open purchase orders. No AI is used to compute these figures.</p>
          <SimpleTable<Risk>
            rows={risk}
            empty="No materials"
            cols={[
              { h: 'Risk', c: (r) => <StatusBadge status={r.risk} tone={r.risk === 'HIGH' ? 'danger' : r.risk === 'MEDIUM' ? 'warning' : 'success'} label={r.risk} /> },
              { h: 'Material', c: (r) => <Link className="font-medium text-primary hover:underline" href={`/master-data/materials/${r.materialId}`}>{r.code}</Link> },
              { h: 'Available', className: 'text-right tabular', c: (r) => `${fmtNum(r.available)} ${r.uom}` },
              { h: 'Avg / day', className: 'text-right tabular', c: (r) => fmtNum(r.avgDailyConsumption, 2) },
              { h: 'Cover (days)', className: 'text-right tabular', c: (r) => (r.stockCoverDays === null ? '—' : fmtNum(r.stockCoverDays, 0)) },
              { h: 'Lead time', className: 'text-right tabular', c: (r) => `${r.leadTimeDays} d` },
              { h: 'Open PO', className: 'text-right tabular', c: (r) => fmtNum(r.openPoQuantity) },
              { h: 'Planned demand', className: 'text-right tabular', c: (r) => fmtNum(r.plannedDemand) },
              { h: 'Explanation', className: 'max-w-md', c: (r) => <span className="text-muted-foreground">{r.explanation}</span> },
            ]}
          />
        </TabsContent>
        <TabsContent value="expiry">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">Lots expiring within 90 days (or expired), with projected consumption at current usage. Recommendations are rule-based and require human review.</p>
            <Button variant="outline" size="sm" onClick={() => api.download('/analytics/expiry-risk/export')}>
              Export near-expiry report
            </Button>
          </div>
          <SimpleTable<Expiry>
            rows={expiry}
            empty="No lots expiring within 90 days"
            cols={[
              { h: 'Lot', c: (r) => <Link className="font-mono font-medium text-primary hover:underline" href={`/inventory/lots/${r.lotId}`}>{r.lotNumber}</Link> },
              { h: 'Item', c: (r) => `${r.itemCode} ${r.itemName}` },
              { h: 'Quantity', className: 'text-right tabular', c: (r) => `${fmtNum(r.quantity)} ${r.uom}` },
              { h: 'Expires', c: (r) => <span className={r.daysToExpiry < 0 ? 'text-danger' : 'text-warning'}>{fmtDate(r.expiryDate)} ({r.daysToExpiry} d)</span> },
              { h: 'Value', className: 'text-right tabular', c: (r) => fmtPkr(r.value) },
              { h: 'At risk', className: 'text-right tabular', c: (r) => fmtNum(r.atRiskQuantity) },
              { h: 'Recommendation (requires review)', className: 'max-w-md', c: (r) => <span className="text-muted-foreground">{r.recommendation}</span> },
            ]}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryInner />
    </Suspense>
  );
}
