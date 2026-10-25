'use client';

import Link from 'next/link';
import { statusOptions } from '@/lib/hooks';
import { fmtDateTime, fmtNum } from '@/lib/utils';
import type { Txn } from '@/lib/types';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

type Row = Txn & { lotId: string; lot: { lotNumber: string } };

export default function MovementsPage() {
  return (
    <>
      <PageHeader title="Stock movements" description="Append-only inventory ledger: receipts, transfers, issues, returns, adjustments, status changes, reservations and dispatches." />
      <DataTable<Row>
        id="movements"
        endpoint="/inventory/movements"
        filters={[{ param: 'type', label: 'Type', options: statusOptions(['GRN_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ISSUE_TO_PRODUCTION', 'RETURN_FROM_PRODUCTION', 'ADJUSTMENT', 'STATUS_CHANGE', 'RESERVE', 'UNRESERVE', 'QC_SAMPLING', 'FG_RECEIPT', 'DISPATCH']) }]}
        columns={[
          { key: 'when', header: 'When', cell: (r) => fmtDateTime(r.performedAt), csv: (r) => r.performedAt },
          { key: 'lot', header: 'Lot', cell: (r) => <Link className="font-mono text-primary hover:underline" href={`/inventory/lots/${r.lotId}`}>{r.lot.lotNumber}</Link>, csv: (r) => r.lot.lotNumber },
          { key: 'type', header: 'Type', cell: (r) => <StatusBadge status={r.type} tone="neutral" />, csv: (r) => r.type },
          { key: 'qty', header: 'Quantity', className: 'text-right tabular', cell: (r) => `${r.quantity > 0 ? '+' : ''}${fmtNum(r.quantity)}`, csv: (r) => r.quantity },
          { key: 'bal', header: 'Balance after', className: 'text-right tabular', cell: (r) => fmtNum(r.balanceAfter), csv: (r) => r.balanceAfter },
          { key: 'status', header: 'Status change', cell: (r) => (r.statusTo ? `${r.statusFrom ?? '—'} → ${r.statusTo}` : '—'), csv: (r) => r.statusTo },
          { key: 'by', header: 'By', cell: (r) => r.performedByName ?? 'System', csv: (r) => r.performedByName },
          { key: 'reason', header: 'Reason', cell: (r) => <span className="text-muted-foreground">{r.reason ?? r.referenceType ?? ''}</span>, csv: (r) => r.reason },
        ]}
      />
    </>
  );
}
