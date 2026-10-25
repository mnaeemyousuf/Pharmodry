'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { statusOptions, useProducts } from '@/lib/hooks';
import { cn, fmtDate, fmtNum } from '@/lib/utils';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

function BatchesInner() {
  const { can } = useAuth();
  const params = useSearchParams();
  const { data: products } = useProducts();
  return (
    <>
      <PageHeader
        title="Batches & eBMR"
        description="Batch lifecycle: Planned → Material reserved → Ready → In progress → Awaiting QC → Awaiting QA → Released / Rejected → Closed."
        actions={
          can('batch.create') && (
            <Button asChild>
              <Link href="/production/batches/new">
                <Plus /> New batch
              </Link>
            </Button>
          )
        }
      />
      <DataTable<Batch>
        id="batches"
        endpoint="/batches"
        exportPath={can('report.export') ? '/batches/export' : undefined}
        defaultView={params.get('view') ?? 'all'}
        views={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'awaitingQa', label: 'Awaiting QA' },
          { value: 'delayed', label: 'Delayed' },
        ]}
        searchPlaceholder="Batch number"
        filters={[
          { param: 'status', label: 'Status', options: statusOptions(['PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA', 'RELEASED', 'REJECTED', 'CLOSED', 'CANCELLED']) },
          { param: 'productId', label: 'Product', options: (products ?? []).map((p) => ({ value: p.id, label: `${p.genericName} ${p.strength}` })) },
        ]}
        rowHref={(r) => `/production/batches/${r.id}`}
        columns={[
          { key: 'batch', header: 'Batch', sort: 'batchNumber', cell: (r) => <span className="font-mono">{r.batchNumber}</span>, csv: (r) => r.batchNumber },
          { key: 'product', header: 'Product', cell: (r) => `${r.product.genericName} ${r.product.strength}`, csv: (r) => `${r.product.genericName} ${r.product.strength}` },
          { key: 'status', header: 'Status', sort: 'status', cell: (r) => <span className="flex items-center gap-1.5"><StatusBadge status={r.status} />{r.delayed && <StatusBadge status="WARNING" label="Delayed" />}</span>, csv: (r) => r.status },
          { key: 'planned', header: 'Planned qty', className: 'text-right tabular', cell: (r) => `${fmtNum(r.plannedQuantity)} ${r.uomCode}`, csv: (r) => r.plannedQuantity },
          { key: 'yield', header: 'Yield', sort: 'yieldPct', className: 'text-right tabular', cell: (r) => (r.yieldPct === null || r.yieldPct === undefined ? '—' : <span className={cn(r.yieldWithinLimits === false && 'font-semibold text-warning')}>{r.yieldPct}%</span>), csv: (r) => r.yieldPct },
          { key: 'start', header: 'Planned start', sort: 'plannedStart', cell: (r) => fmtDate(r.plannedStart), csv: (r) => r.plannedStart },
          { key: 'qa', header: 'QA decision', cell: (r) => fmtDate(r.qaDecisionAt), csv: (r) => r.qaDecisionAt },
        ]}
      />
    </>
  );
}

export default function BatchesPage() {
  return (
    <Suspense>
      <BatchesInner />
    </Suspense>
  );
}
