'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtNum } from '@/lib/utils';
import type { Grn } from '@/lib/types';
import { Skeleton } from '@/components/ui/primitives';
import { AuditHistory, DetailHeader, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

export default function GrnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: g } = useQuery({ queryKey: ['grn', id], queryFn: () => api.get<Grn>(`/goods-receipts/${id}`) });
  if (!g) return <Skeleton className="h-96" />;
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Goods receipts', href: '/inventory/receipts' }, { label: g.number }]}
        title={g.number}
        status={g.status}
        subtitle={g.supplier?.name}
        meta={[
          { label: 'Supplier', value: g.supplier ? <Link className="text-primary hover:underline" href={`/master-data/suppliers/${g.supplier.id}`}>{g.supplier.code}</Link> : '—' },
          { label: 'Purchase order', value: g.purchaseOrder ? <Link className="text-primary hover:underline" href={`/procurement/purchase-orders/${g.purchaseOrder.id}`}>{g.purchaseOrder.number}</Link> : '—' },
          { label: 'Delivery note', value: g.deliveryNote },
          { label: 'Received', value: fmtDateTime(g.receivedAt) },
          { label: 'Received by', value: g.receivedByName },
          { label: 'Lines', value: g.lines.length },
        ]}
      />
      <Section title="Lots received" description="Lots remain in quarantine until QC approval and QA release.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Lot</th>
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Supplier batch</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3">Mfg / Expiry</th>
                <th className="py-2 pr-3">Lot status</th>
                <th className="py-2">QC sample</th>
              </tr>
            </thead>
            <tbody>
              {g.lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <Link className="font-mono font-medium text-primary hover:underline" href={`/inventory/lots/${l.lotId}`}>
                      {l.lot?.lotNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    {l.material?.code} <span className="text-muted-foreground">{l.material?.name}</span>
                  </td>
                  <td className="py-2 pr-3">{l.supplierBatch}</td>
                  <td className="py-2 pr-3 text-right tabular">
                    {fmtNum(l.quantity)} {l.lot?.uomCode}
                  </td>
                  <td className="py-2 pr-3">
                    {fmtDate(l.mfgDate)} / {fmtDate(l.expiryDate)}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={l.lot?.status} />
                  </td>
                  <td className="py-2">
                    {l.samples?.map((s) => (
                      <Link key={s.id} href={`/quality/samples/${s.id}`} className="mr-2 inline-flex items-center gap-1.5 text-primary hover:underline">
                        {s.number} <StatusBadge status={s.status} />
                      </Link>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Audit trail" className="mt-4">
        <AuditHistory entityId={g.id} extraIds={g.lines.map((l) => l.lotId)} />
      </Section>
    </>
  );
}
