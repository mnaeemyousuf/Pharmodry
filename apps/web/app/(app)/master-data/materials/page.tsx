'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLookups } from '@/lib/hooks';
import { fmtNum } from '@/lib/utils';
import type { Material } from '@/lib/types';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ActionDialog, Field, PageHeader } from '@/components/page';

export default function MaterialsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const { data: lookups } = useLookups();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ code: '', name: '', type: 'EXCIPIENT', uomId: '', specificationRef: '', storageRequirement: '', retestPeriodMonths: '', safetyStock: '0', leadTimeDays: '30', unitCost: '0', lotPrefix: 'RM' });
  return (
    <>
      <PageHeader
        title="Materials"
        description="APIs, excipients and packaging materials. Released stock excludes quarantine, rejected, blocked and expired lots."
        actions={
          can('material.manage') && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New material
            </Button>
          )
        }
      />
      <DataTable<Material>
        id="materials"
        endpoint="/materials"
        searchPlaceholder="Code or name"
        filters={[
          { param: 'type', label: 'Type', options: [{ value: 'API', label: 'API' }, { value: 'EXCIPIENT', label: 'Excipient' }, { value: 'PACKAGING', label: 'Packaging' }, { value: 'CONSUMABLE', label: 'Consumable' }] },
          { param: 'status', label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] },
        ]}
        rowHref={(r) => `/master-data/materials/${r.id}`}
        columns={[
          { key: 'code', header: 'Code', sort: 'code', cell: (r) => <span className="font-mono">{r.code}</span>, csv: (r) => r.code },
          { key: 'name', header: 'Name', sort: 'name', cell: (r) => r.name, csv: (r) => r.name },
          { key: 'type', header: 'Type', sort: 'type', cell: (r) => r.type, csv: (r) => r.type },
          { key: 'released', header: 'Released', className: 'text-right tabular', cell: (r) => <span className={r.stock && r.stock.released < r.safetyStock ? 'font-semibold text-warning' : ''}>{fmtNum(r.stock?.released)}</span>, csv: (r) => r.stock?.released },
          { key: 'quarantine', header: 'Quarantine', className: 'text-right tabular', cell: (r) => fmtNum(r.stock?.quarantine), csv: (r) => r.stock?.quarantine },
          { key: 'safety', header: 'Safety stock', className: 'text-right tabular', cell: (r) => fmtNum(r.safetyStock), csv: (r) => r.safetyStock },
          { key: 'lead', header: 'Lead time', className: 'text-right', cell: (r) => `${r.leadTimeDays} d`, csv: (r) => r.leadTimeDays },
          { key: 'retest', header: 'Retest period', cell: (r) => (r.retestPeriodMonths ? `${r.retestPeriodMonths} m` : '—'), hidden: true },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
        ]}
      />
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        wide
        title="New material"
        description="Approve suppliers for the material and create its QC specification before receiving it."
        submitLabel="Create material"
        onSubmit={async () => {
          const m = await api.post<{ id: string }>('/materials', {
            ...f,
            code: f.code.toUpperCase(),
            lotPrefix: f.lotPrefix.toUpperCase(),
            retestPeriodMonths: f.retestPeriodMonths ? Number(f.retestPeriodMonths) : undefined,
            safetyStock: Number(f.safetyStock),
            leadTimeDays: Number(f.leadTimeDays),
            unitCost: Number(f.unitCost),
            specificationRef: f.specificationRef || undefined,
            storageRequirement: f.storageRequirement || undefined,
          });
          toast.success('Material created');
          router.push(`/master-data/materials/${m.id}`);
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Code" required hint="e.g. EXC-LAC-001">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
          </Field>
          <Field label="Name" required className="md:col-span-2">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </Field>
          <Field label="Type" required>
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="API">API</option>
              <option value="EXCIPIENT">Excipient</option>
              <option value="PACKAGING">Packaging</option>
              <option value="CONSUMABLE">Consumable</option>
            </Select>
          </Field>
          <Field label="Unit of measure" required>
            <Select value={f.uomId} onChange={(e) => setF({ ...f, uomId: e.target.value })} required>
              <option value="">Select…</option>
              {lookups?.uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Internal lot prefix" hint="1–4 letters">
            <Input value={f.lotPrefix} onChange={(e) => setF({ ...f, lotPrefix: e.target.value })} />
          </Field>
          <Field label="Retest period (months)">
            <Input type="number" value={f.retestPeriodMonths} onChange={(e) => setF({ ...f, retestPeriodMonths: e.target.value })} />
          </Field>
          <Field label="Safety stock">
            <Input type="number" value={f.safetyStock} onChange={(e) => setF({ ...f, safetyStock: e.target.value })} />
          </Field>
          <Field label="Supplier lead time (days)">
            <Input type="number" value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: e.target.value })} />
          </Field>
          <Field label="Unit cost (PKR)">
            <Input type="number" step="any" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
          </Field>
          <Field label="Specification reference" className="md:col-span-2">
            <Input value={f.specificationRef} onChange={(e) => setF({ ...f, specificationRef: e.target.value })} />
          </Field>
          <Field label="Storage requirement" className="md:col-span-3">
            <Textarea rows={1} value={f.storageRequirement} onChange={(e) => setF({ ...f, storageRequirement: e.target.value })} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
