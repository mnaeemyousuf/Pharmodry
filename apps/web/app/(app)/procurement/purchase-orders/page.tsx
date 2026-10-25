'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { statusOptions, useSuppliers } from '@/lib/hooks';
import { fmtDate, fmtPkr } from '@/lib/utils';
import type { PurchaseOrder } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

export default function PurchaseOrdersPage() {
  const { can } = useAuth();
  const { data: suppliers } = useSuppliers();
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders may only be raised with qualified suppliers for materials on their approved list. The creator of an order cannot approve it."
        actions={
          can('procurement.po.create') && (
            <Button asChild>
              <Link href="/procurement/purchase-orders/new">
                <Plus /> New purchase order
              </Link>
            </Button>
          )
        }
      />
      <DataTable<PurchaseOrder>
        id="pos"
        endpoint="/purchase-orders"
        searchPlaceholder="PO number"
        filters={[
          { param: 'status', label: 'Status', options: statusOptions(['DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']) },
          { param: 'supplierId', label: 'Supplier', options: (suppliers ?? []).map((s) => ({ value: s.id, label: s.name })) },
        ]}
        rowHref={(r) => `/procurement/purchase-orders/${r.id}`}
        columns={[
          { key: 'number', header: 'PO', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'supplier', header: 'Supplier', cell: (r) => r.supplier?.name, csv: (r) => r.supplier?.name },
          { key: 'status', header: 'Status', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'orderDate', header: 'Ordered', sort: 'orderDate', cell: (r) => fmtDate(r.orderDate), csv: (r) => r.orderDate },
          { key: 'expected', header: 'Expected', sort: 'expectedDate', cell: (r) => fmtDate(r.expectedDate), csv: (r) => r.expectedDate },
          { key: 'value', header: 'Value', className: 'text-right tabular', cell: (r) => fmtPkr(r.totalValue), csv: (r) => r.totalValue },
        ]}
      />
    </>
  );
}
