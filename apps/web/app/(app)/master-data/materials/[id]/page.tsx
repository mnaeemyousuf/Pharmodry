'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { describeSpec } from '@pharmodry/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtNum } from '@/lib/utils';
import type { Material } from '@/lib/types';
import { Button, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActionDialog, AuditHistory, DetailHeader, Empty, Field, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { VersionHistory } from '@/components/versions';

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: m } = useQuery({ queryKey: ['material', id], queryFn: () => api.get<Material>(`/materials/${id}`) });
  const [edit, setEdit] = React.useState(false);
  const [f, setF] = React.useState({ name: '', safetyStock: '', leadTimeDays: '', unitCost: '', retestPeriodMonths: '', storageRequirement: '', status: '', reason: '' });
  if (!m) return <Skeleton className="h-96" />;
  const released = (m.lots ?? []).filter((l) => l.status === 'RELEASED').reduce((a, l) => a + l.quantity - l.reservedQuantity, 0);
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Materials', href: '/master-data/materials' }, { label: m.code }]}
        title={m.code}
        status={m.status}
        subtitle={`${m.name} · ${m.type}`}
        meta={[
          { label: 'Available (released)', value: fmtNum(released) },
          { label: 'Safety stock', value: fmtNum(m.safetyStock) },
          { label: 'Lead time', value: `${m.leadTimeDays} days` },
          { label: 'Retest period', value: m.retestPeriodMonths ? `${m.retestPeriodMonths} months` : '—' },
          { label: 'Unit cost', value: `PKR ${fmtNum(m.unitCost)}` },
          { label: 'Version', value: `v${m.version}` },
        ]}
        actions={
          can('material.manage') && (
            <Button
              variant="outline"
              onClick={() => {
                setF({ name: m.name, safetyStock: String(m.safetyStock), leadTimeDays: String(m.leadTimeDays), unitCost: String(m.unitCost), retestPeriodMonths: String(m.retestPeriodMonths ?? ''), storageRequirement: m.storageRequirement ?? '', status: m.status, reason: '' });
                setEdit(true);
              }}
            >
              <Pencil /> Edit
            </Button>
          )
        }
      />
      <Tabs defaultValue="lots">
        <TabsList>
          <TabsTrigger value="lots">Lots ({m.lots?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="suppliers">Approved suppliers ({m.suppliers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="versions">Version history</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="lots">
          <Section title="Lots on hand" description="Sorted by expiry (FEFO order).">
            {m.lots?.length ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Lot</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="py-2 text-right">Reserved</th>
                    <th className="py-2">Expiry</th>
                    <th className="py-2">Retest</th>
                  </tr>
                </thead>
                <tbody>
                  {m.lots.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link className="font-mono text-primary hover:underline" href={`/inventory/lots/${l.id}`}>
                          {l.lotNumber}
                        </Link>
                      </td>
                      <td className="py-2">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="py-2 text-right tabular">
                        {fmtNum(l.quantity)} {l.uomCode}
                      </td>
                      <td className="py-2 text-right tabular">{fmtNum(l.reservedQuantity)}</td>
                      <td className="py-2">{fmtDate(l.expiryDate)}</td>
                      <td className="py-2">{fmtDate(l.retestDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No stock on hand.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="suppliers">
          <Section title="Approved suppliers" description="GRNs and purchase orders are only accepted from qualified suppliers approved for this material.">
            {m.suppliers?.length ? (
              m.suppliers.map((s) => (
                <Link key={s.id} href={`/master-data/suppliers/${s.supplier.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-medium">{s.supplier.name}</span>
                  <span className="text-xs text-muted-foreground">{s.supplier.country}</span>
                  <StatusBadge status={s.supplier.status} />
                  {s.manufacturerName && <span className="ml-auto text-xs text-muted-foreground">Manufacturer: {s.manufacturerName}</span>}
                </Link>
              ))
            ) : (
              <Empty>No approved suppliers.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="specs">
          <Section title="QC specifications">
            {m.specifications?.length ? (
              m.specifications.map((s) => (
                <div key={s.id} className="mb-3 rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2 text-[13px]">
                    <Link className="font-medium text-primary hover:underline" href={`/master-data/specifications/${s.id}`}>
                      {s.code} v{s.version}
                    </Link>
                    <StatusBadge status={s.status} />
                  </div>
                  <ul className="text-[12.5px]">
                    {s.tests.map((t) => (
                      <li key={t.id}>
                        {t.name}: {describeSpec({ ...t, minValue: t.minValue ?? null, maxValue: t.maxValue ?? null })}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <Empty>No specification — GRNs will be rejected until one exists.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="versions">
          <Section title="Version history">
            <VersionHistory entityType="Material" entityId={m.id} />
          </Section>
        </TabsContent>
        <TabsContent value="audit">
          <Section title="Audit trail">
            <AuditHistory entityId={m.id} />
          </Section>
        </TabsContent>
      </Tabs>
      <ActionDialog
        open={edit}
        onOpenChange={setEdit}
        wide
        title={`Edit ${m.code}`}
        description="A reason is required; a new version snapshot is stored."
        submitLabel="Save new version"
        onSubmit={async () => {
          await api.patch(`/materials/${id}`, {
            name: f.name,
            safetyStock: Number(f.safetyStock),
            leadTimeDays: Number(f.leadTimeDays),
            unitCost: Number(f.unitCost),
            retestPeriodMonths: f.retestPeriodMonths ? Number(f.retestPeriodMonths) : undefined,
            storageRequirement: f.storageRequirement || undefined,
            status: f.status,
            reason: f.reason,
          });
          toast.success('Material updated');
          qc.invalidateQueries({ queryKey: ['material', id] });
          qc.invalidateQueries({ queryKey: ['versions'] });
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Name" className="md:col-span-3">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Safety stock">
            <Input type="number" value={f.safetyStock} onChange={(e) => setF({ ...f, safetyStock: e.target.value })} />
          </Field>
          <Field label="Lead time (days)">
            <Input type="number" value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: e.target.value })} />
          </Field>
          <Field label="Unit cost">
            <Input type="number" step="any" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
          </Field>
          <Field label="Retest period (months)">
            <Input type="number" value={f.retestPeriodMonths} onChange={(e) => setF({ ...f, retestPeriodMonths: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <Field label="Storage requirement">
            <Input value={f.storageRequirement} onChange={(e) => setF({ ...f, storageRequirement: e.target.value })} />
          </Field>
          <Field label="Reason for change" required className="md:col-span-3">
            <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
