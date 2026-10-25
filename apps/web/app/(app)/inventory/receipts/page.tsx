'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSuppliers } from '@/lib/hooks';
import { fmtDateTime, fmtNum } from '@/lib/utils';
import type { Grn } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

export default function ReceiptsPage() {
  const { can } = useAuth();
  const { data: suppliers } = useSuppliers(can('supplier.view'));
  return (
    <>
      <PageHeader
        title="Goods receipts (GRN)"
        description="Every receipt line creates a lot in QUARANTINE and automatically requests a QC sample. Material only becomes usable after QA release."
        actions={
          can('inventory.receive') && (
            <Button asChild data-testid="new-grn">
              <Link href="/inventory/receipts/new">
                <Plus /> New GRN
              </Link>
            </Button>
          )
        }
      />
      <DataTable<Grn & { receivedByName?: string | null }>
        id="grns"
        endpoint="/goods-receipts"
        searchPlaceholder="GRN number or supplier batch"
        filters={can('supplier.view') ? [{ param: 'supplierId', label: 'Supplier', options: (suppliers ?? []).map((s) => ({ value: s.id, label: s.name })) }] : []}
        rowHref={(r) => `/inventory/receipts/${r.id}`}
        columns={[
          { key: 'number', header: 'GRN', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'supplier', header: 'Supplier', cell: (r) => r.supplier?.name, csv: (r) => r.supplier?.name },
          { key: 'lines', header: 'Lines', className: 'text-right', cell: (r) => r.lines.length, csv: (r) => r.lines.length },
          { key: 'qty', header: 'Total qty', className: 'text-right tabular', cell: (r) => fmtNum(r.lines.reduce((a, l) => a + l.quantity, 0)) },
          { key: 'receivedAt', header: 'Received', sort: 'receivedAt', cell: (r) => fmtDateTime(r.receivedAt), csv: (r) => r.receivedAt },
          { key: 'by', header: 'Received by', cell: (r) => r.receivedByName ?? '—' },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
        ]}
      />
    </>
  );
}
