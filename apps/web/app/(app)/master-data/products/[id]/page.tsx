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
import { fmtNum } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { Button, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActionDialog, AuditHistory, DetailHeader, Empty, Field, KeyValues, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { VersionHistory } from '@/components/versions';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: p } = useQuery({ queryKey: ['product', id], queryFn: () => api.get<Product>(`/products/${id}`) });
  const [edit, setEdit] = React.useState(false);
  const [f, setF] = React.useState({ brandName: '', packSize: '', shelfLifeMonths: '', storageConditions: '', registrationNumber: '', gtin: '', standardBatchSize: '', unitPrice: '', status: '', reason: '' });
  if (!p) return <Skeleton className="h-96" />;
  const bom = p.boms?.find((b) => b.status === 'ACTIVE');
  const routing = p.routings?.find((r) => r.status === 'ACTIVE');
  const openEdit = () => {
    setF({ brandName: p.brandName ?? '', packSize: p.packSize ?? '', shelfLifeMonths: String(p.shelfLifeMonths), storageConditions: p.storageConditions ?? '', registrationNumber: p.registrationNumber ?? '', gtin: p.gtin ?? '', standardBatchSize: String(p.standardBatchSize), unitPrice: String(p.unitPrice), status: p.status, reason: '' });
    setEdit(true);
  };
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Products', href: '/master-data/products' }, { label: p.code }]}
        title={p.code}
        status={p.status}
        subtitle={`${p.genericName} ${p.strength}${p.brandName ? ` — ${p.brandName}` : ''}`}
        meta={[
          { label: 'Dosage form', value: p.dosageForm?.name },
          { label: 'Pack size', value: p.packSize },
          { label: 'Shelf life', value: `${p.shelfLifeMonths} months` },
          { label: 'Registration', value: p.registrationNumber },
          { label: 'GTIN', value: p.gtin ?? 'Not recorded' },
          { label: 'Standard batch', value: fmtNum(p.standardBatchSize) },
          { label: 'Version', value: `v${p.version}` },
        ]}
        actions={
          can('product.manage') && (
            <Button variant="outline" onClick={openEdit}>
              <Pencil /> Edit
            </Button>
          )
        }
      />
      <Tabs defaultValue="bom">
        <TabsList>
          <TabsTrigger value="bom">Bill of materials</TabsTrigger>
          <TabsTrigger value="routing">Manufacturing template</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions">Version history</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="bom">
          <Section title={bom ? `BOM v${bom.version} — per ${fmtNum(bom.batchSize)} units` : 'BOM'} description="Material quantities are scaled to the batch size at reservation. Previous versions are retained.">
            {bom ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Material</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="py-2 text-right">Tolerance</th>
                    <th className="py-2">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.lines.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link className="text-primary hover:underline" href={`/master-data/materials/${l.materialId}`}>
                          {l.material.code}
                        </Link>{' '}
                        {l.material.name}
                      </td>
                      <td className="py-2">{l.material.type}</td>
                      <td className="py-2 text-right tabular">{fmtNum(l.quantity, 3)}</td>
                      <td className="py-2 text-right tabular">±{l.tolerancePct}%</td>
                      <td className="py-2">{l.isCritical ? 'Yes' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No active BOM.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="routing">
          <Section title={routing ? `Master eBMR template v${routing.version}` : 'Manufacturing template'} description="Copied into each new batch as its electronic batch manufacturing record.">
            {routing ? (
              <ol className="space-y-2">
                {routing.steps.map((s) => (
                  <li key={s.id} className="rounded-md border p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>
                        {s.sequence / 10}. {s.name}
                      </b>
                      {s.equipmentType && <StatusBadge status="EQUIP" tone="neutral" label={s.equipmentType.replace('_', ' ').toLowerCase()} />}
                      {s.consumesMaterials && <StatusBadge status="CONSUMES" tone="info" label="Records consumption" />}
                      {s.recordsOutput && <StatusBadge status="OUTPUT" tone="info" label="Records output" />}
                      {s.requiresVerification && <StatusBadge status="VERIFY" tone="progress" label="Supervisor verification" />}
                    </div>
                    <p className="mt-1 text-muted-foreground">{s.instructions}</p>
                    {[...s.parameters, ...s.ipcChecks].length > 0 && (
                      <div className="mt-1 text-xs">
                        {[...s.parameters.map((x) => ({ ...x, k: 'Param' })), ...s.ipcChecks.map((x) => ({ ...x, k: 'IPC' }))].map((x) => (
                          <span key={`${x.k}${x.code}`} className="mr-3">
                            {x.k}: {x.label} {x.min ?? '−'}–{x.max ?? '+'} {x.unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No active manufacturing template.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="specs">
          <Section title="Finished-product specifications">
            {p.specifications?.length ? (
              p.specifications.map((s) => (
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
              <Empty>No specification.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="details">
          <Section title="Details">
            <KeyValues
              items={[
                { label: 'Category', value: p.category?.name },
                { label: 'Batch number prefix', value: p.batchPrefix },
                { label: 'Storage conditions', value: p.storageConditions },
                { label: 'Unit price', value: `PKR ${fmtNum(p.unitPrice)}` },
              ]}
            />
          </Section>
        </TabsContent>
        <TabsContent value="versions">
          <Section title="Version history">
            <VersionHistory entityType="Product" entityId={p.id} />
          </Section>
        </TabsContent>
        <TabsContent value="audit">
          <Section title="Audit trail">
            <AuditHistory entityId={p.id} />
          </Section>
        </TabsContent>
      </Tabs>
      <ActionDialog
        open={edit}
        onOpenChange={setEdit}
        wide
        title={`Edit ${p.code}`}
        description="Regulated master data: a reason is required and a new version is created. Previous versions are never overwritten."
        submitLabel="Save new version"
        onSubmit={async () => {
          await api.patch(`/products/${id}`, {
            brandName: f.brandName || undefined,
            packSize: f.packSize || undefined,
            shelfLifeMonths: Number(f.shelfLifeMonths),
            storageConditions: f.storageConditions || undefined,
            registrationNumber: f.registrationNumber || undefined,
            gtin: f.gtin || undefined,
            standardBatchSize: Number(f.standardBatchSize),
            unitPrice: Number(f.unitPrice),
            status: f.status,
            reason: f.reason,
          });
          toast.success('Product updated (new version)');
          qc.invalidateQueries({ queryKey: ['product', id] });
          qc.invalidateQueries({ queryKey: ['versions'] });
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Brand name">
            <Input value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} />
          </Field>
          <Field label="Pack size">
            <Input value={f.packSize} onChange={(e) => setF({ ...f, packSize: e.target.value })} />
          </Field>
          <Field label="Shelf life (months)">
            <Input type="number" value={f.shelfLifeMonths} onChange={(e) => setF({ ...f, shelfLifeMonths: e.target.value })} />
          </Field>
          <Field label="Registration number">
            <Input value={f.registrationNumber} onChange={(e) => setF({ ...f, registrationNumber: e.target.value })} />
          </Field>
          <Field label="GTIN" hint="GS1 GTIN-8/12/13/14, digits only; check digit is verified">
            <Input inputMode="numeric" value={f.gtin} onChange={(e) => setF({ ...f, gtin: e.target.value.trim() })} />
          </Field>
          <Field label="Standard batch size">
            <Input type="number" value={f.standardBatchSize} onChange={(e) => setF({ ...f, standardBatchSize: e.target.value })} />
          </Field>
          <Field label="Unit price">
            <Input type="number" step="any" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <Field label="Storage conditions" className="md:col-span-2">
            <Input value={f.storageConditions} onChange={(e) => setF({ ...f, storageConditions: e.target.value })} />
          </Field>
          <Field label="Reason for change" required className="md:col-span-3">
            <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
