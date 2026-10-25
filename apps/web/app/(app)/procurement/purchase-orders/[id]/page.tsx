'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Truck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, fmtNum, fmtPkr } from '@/lib/utils';
import type { PurchaseOrder } from '@/lib/types';
import { Button, Skeleton, Textarea } from '@/components/ui/primitives';
import { ActionDialog, AuditHistory, DetailHeader, Field, handleError, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

export default function PoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const { data: po } = useQuery({ queryKey: ['po', id], queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${id}`) });
  const [cancel, setCancel] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  if (!po) return <Skeleton className="h-96" />;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['po', id] });
    qc.invalidateQueries({ queryKey: ['audit'] });
  };
  const approve = async () => {
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${id}/approve`);
      toast.success('Purchase order approved');
      refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  const total = po.lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Purchase orders', href: '/procurement/purchase-orders' }, { label: po.number }]}
        title={po.number}
        status={po.status}
        subtitle={po.supplier?.name}
        meta={[
          { label: 'Supplier', value: po.supplier ? <Link className="text-primary hover:underline" href={`/master-data/suppliers/${po.supplierId}`}>{po.supplier.code}</Link> : '—' },
          { label: 'Ordered', value: fmtDate(po.orderDate) },
          { label: 'Expected', value: fmtDate(po.expectedDate) },
          { label: 'Value', value: fmtPkr(total) },
          { label: 'Created by', value: po.createdByName },
          { label: 'Approved by', value: po.approvedByName ? `${po.approvedByName} · ${fmtDateTime(po.approvedAt)}` : '—' },
        ]}
        actions={
          <>
            {po.status === 'DRAFT' && can('procurement.po.approve') && (
              <Button onClick={approve} loading={busy}>
                <CheckCircle2 /> Approve
              </Button>
            )}
            {['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && can('inventory.receive') && (
              <Button asChild>
                <Link href={`/inventory/receipts/new?po=${po.id}`}>
                  <Truck /> Receive goods
                </Link>
              </Button>
            )}
            {['DRAFT', 'APPROVED'].includes(po.status) && can('procurement.po.approve') && (
              <Button variant="outline" onClick={() => setCancel(true)}>
                <XCircle /> Cancel
              </Button>
            )}
          </>
        }
      />
      {po.status === 'DRAFT' && user && po.createdByName === user.fullName && <p className="mb-3 text-xs text-muted-foreground">Segregation of duties: you created this order, so a different user must approve it.</p>}
      <Section title="Lines">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">Material</th>
              <th className="py-2 text-right">Ordered</th>
              <th className="py-2 text-right">Received</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="py-2">
                  {l.material?.code} <span className="text-muted-foreground">{l.material?.name}</span>
                </td>
                <td className="py-2 text-right tabular">{fmtNum(l.quantity)}</td>
                <td className="py-2 text-right tabular">{fmtNum(l.receivedQuantity)}</td>
                <td className="py-2 text-right tabular">{fmtNum(l.unitPrice)}</td>
                <td className="py-2 text-right tabular">{fmtPkr(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {po.receipts && po.receipts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            Receipts:
            {po.receipts.map((r) => (
              <Link key={r.id} href={`/inventory/receipts/${r.id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                {r.number} <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </Section>
      <Section title="Audit trail" className="mt-4">
        <AuditHistory entityId={po.id} />
      </Section>
      <ActionDialog
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel purchase order"
        destructive
        submitLabel="Cancel order"
        onSubmit={async () => {
          await api.post(`/purchase-orders/${id}/cancel`, { reason });
          toast.success('Order cancelled');
          refresh();
        }}
      >
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
        </Field>
      </ActionDialog>
    </>
  );
}
