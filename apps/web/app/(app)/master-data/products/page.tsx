'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLookups } from '@/lib/hooks';
import { fmtNum } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ActionDialog, Field, PageHeader } from '@/components/page';

export default function ProductsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const { data: lookups } = useLookups();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ code: '', genericName: '', brandName: '', dosageFormId: '', categoryId: '', strength: '', packSize: '', shelfLifeMonths: '24', storageConditions: '', registrationNumber: '', gtin: '', batchPrefix: '', uomId: '', standardBatchSize: '', unitPrice: '' });
  return (
    <>
      <PageHeader
        title="Products"
        description="Finished products with registration, shelf life and storage. Each change creates a new immutable version; BOMs and manufacturing templates are versioned separately."
        actions={
          can('product.manage') && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New product
            </Button>
          )
        }
      />
      <DataTable<Product>
        id="products"
        endpoint="/products"
        searchPlaceholder="Code, name or registration number"
        filters={[
          { param: 'status', label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] },
          { param: 'categoryId', label: 'Category', options: (lookups?.categories ?? []).map((c) => ({ value: c.id, label: c.name })) },
        ]}
        rowHref={(r) => `/master-data/products/${r.id}`}
        columns={[
          { key: 'code', header: 'Code', sort: 'code', cell: (r) => <span className="font-mono">{r.code}</span>, csv: (r) => r.code },
          { key: 'name', header: 'Generic name', sort: 'genericName', cell: (r) => `${r.genericName} ${r.strength}`, csv: (r) => `${r.genericName} ${r.strength}` },
          { key: 'brand', header: 'Brand', cell: (r) => r.brandName ?? '—', csv: (r) => r.brandName },
          { key: 'form', header: 'Dosage form', cell: (r) => r.dosageForm?.name, csv: (r) => r.dosageForm?.name },
          { key: 'cat', header: 'Category', cell: (r) => r.category?.name, csv: (r) => r.category?.name },
          { key: 'pack', header: 'Pack', cell: (r) => r.packSize ?? '—' },
          { key: 'shelf', header: 'Shelf life', cell: (r) => `${r.shelfLifeMonths} m`, csv: (r) => r.shelfLifeMonths },
          { key: 'gtin', header: 'GTIN', cell: (r) => r.gtin ?? <span className="text-warning">Missing</span>, csv: (r) => r.gtin ?? '' },
          { key: 'reg', header: 'Registration', cell: (r) => r.registrationNumber ?? '—', csv: (r) => r.registrationNumber },
          { key: 'batch', header: 'Batch size', className: 'text-right tabular', cell: (r) => fmtNum(r.standardBatchSize), hidden: true },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'version', header: 'Version', cell: (r) => `v${r.version}` },
        ]}
      />
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        wide
        title="New product"
        description="Add the BOM and manufacturing template on the product page afterwards."
        submitLabel="Create product"
        onSubmit={async () => {
          const p = await api.post<{ id: string }>('/products', {
            ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')),
            shelfLifeMonths: Number(f.shelfLifeMonths),
            standardBatchSize: Number(f.standardBatchSize),
            unitPrice: f.unitPrice ? Number(f.unitPrice) : undefined,
            code: f.code.toUpperCase(),
            batchPrefix: f.batchPrefix.toUpperCase(),
          });
          toast.success('Product created');
          router.push(`/master-data/products/${p.id}`);
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Code" required hint="e.g. PCM-500">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
          </Field>
          <Field label="Generic name" required>
            <Input value={f.genericName} onChange={(e) => setF({ ...f, genericName: e.target.value })} required />
          </Field>
          <Field label="Brand name">
            <Input value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} />
          </Field>
          <Field label="Strength" required>
            <Input value={f.strength} onChange={(e) => setF({ ...f, strength: e.target.value })} required />
          </Field>
          <Field label="Dosage form">
            <Select value={f.dosageFormId} onChange={(e) => setF({ ...f, dosageFormId: e.target.value })}>
              <option value="">—</option>
              {lookups?.dosageForms.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">—</option>
              {lookups?.categories.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pack size">
            <Input value={f.packSize} onChange={(e) => setF({ ...f, packSize: e.target.value })} />
          </Field>
          <Field label="Shelf life (months)" required>
            <Input type="number" value={f.shelfLifeMonths} onChange={(e) => setF({ ...f, shelfLifeMonths: e.target.value })} required />
          </Field>
          <Field label="Registration number">
            <Input value={f.registrationNumber} onChange={(e) => setF({ ...f, registrationNumber: e.target.value })} />
          </Field>
          <Field label="GTIN" hint="GS1 GTIN-8/12/13/14, digits only; check digit is verified">
            <Input inputMode="numeric" value={f.gtin} onChange={(e) => setF({ ...f, gtin: e.target.value.trim() })} />
          </Field>
          <Field label="Batch number prefix" required hint="2–8 letters, e.g. PCM">
            <Input value={f.batchPrefix} onChange={(e) => setF({ ...f, batchPrefix: e.target.value })} required />
          </Field>
          <Field label="Unit of measure" required>
            <Select value={f.uomId} onChange={(e) => setF({ ...f, uomId: e.target.value })} required>
              <option value="">Select…</option>
              {lookups?.uoms.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Standard batch size" required>
            <Input type="number" value={f.standardBatchSize} onChange={(e) => setF({ ...f, standardBatchSize: e.target.value })} required />
          </Field>
          <Field label="Unit price (PKR)">
            <Input type="number" step="any" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} />
          </Field>
          <Field label="Storage conditions" className="md:col-span-2">
            <Textarea rows={1} value={f.storageConditions} onChange={(e) => setF({ ...f, storageConditions: e.target.value })} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
