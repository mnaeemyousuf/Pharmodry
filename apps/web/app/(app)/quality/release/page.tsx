'use client';

import { useAuth } from '@/lib/auth';
import { fmtDate, fmtNum } from '@/lib/utils';
import type { Batch, Lot } from '@/lib/types';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Section } from '@/components/page';

export default function ReleaseQueuePage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="QA release" description="Disposition queue. Release requires approved, passing QC, no open OOS or deviations, and an electronic signature. Rules are enforced by the server." />
      <div className="space-y-6">
        {can('batch.approve') && (
          <Section title="Batches awaiting QC / QA">
            <DataTable<Batch>
              id="release-batches"
              endpoint="/batches"
              params={{ status: 'AWAITING_QC,AWAITING_QA' }}
              rowHref={(r) => `/production/batches/${r.id}`}
              columns={[
                { key: 'batch', header: 'Batch', cell: (r) => <span className="font-mono">{r.batchNumber}</span>, csv: (r) => r.batchNumber },
                { key: 'product', header: 'Product', cell: (r) => `${r.product.genericName} ${r.product.strength}` },
                { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
                { key: 'yield', header: 'Yield', className: 'text-right', cell: (r) => (r.yieldPct ? `${r.yieldPct}%` : '—') },
                { key: 'end', header: 'Manufacturing ended', cell: (r) => fmtDate(r.actualEnd) },
              ]}
            />
          </Section>
        )}
        {can('inventory.release') && (
          <Section title="Material lots awaiting disposition">
            <DataTable<Lot>
              id="release-lots"
              endpoint="/inventory/lots"
              params={{ view: 'awaitingDisposition' }}
              rowHref={(r) => `/inventory/lots/${r.id}`}
              columns={[
                { key: 'lot', header: 'Lot', cell: (r) => <span className="font-mono">{r.lotNumber}</span>, csv: (r) => r.lotNumber },
                { key: 'item', header: 'Material', cell: (r) => `${r.item?.code} ${r.item?.name}` },
                { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
                { key: 'qty', header: 'Quantity', className: 'text-right tabular', cell: (r) => `${fmtNum(r.quantity)} ${r.uomCode}` },
                { key: 'received', header: 'Received', cell: (r) => fmtDate(r.createdAt) },
                { key: 'expiry', header: 'Expiry', cell: (r) => fmtDate(r.expiryDate) },
              ]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
