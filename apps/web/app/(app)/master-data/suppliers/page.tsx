'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { statusOptions } from '@/lib/hooks';
import { fmtDate } from '@/lib/utils';
import type { Supplier } from '@/lib/types';
import { Button, Input } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ActionDialog, Field, PageHeader } from '@/components/page';

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

export default function SuppliersPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ code: '', name: '', country: 'Pakistan', contactName: '', email: '', phone: '', address: '' });
  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Qualification status, approved materials and computed scorecards (on-time delivery, QC rejection, lead time, deviations, documentation compliance)."
        actions={
          can('supplier.manage') && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New supplier
            </Button>
          )
        }
      />
      <DataTable<Supplier>
        id="suppliers"
        endpoint="/suppliers"
        searchPlaceholder="Code, name or country"
        filters={[{ param: 'status', label: 'Status', options: statusOptions(['PENDING_QUALIFICATION', 'APPROVED', 'CONDITIONALLY_APPROVED', 'SUSPENDED', 'BLACKLISTED']) }]}
        rowHref={(r) => `/master-data/suppliers/${r.id}`}
        columns={[
          { key: 'code', header: 'Code', sort: 'code', cell: (r) => <span className="font-mono">{r.code}</span>, csv: (r) => r.code },
          { key: 'name', header: 'Name', sort: 'name', cell: (r) => r.name, csv: (r) => r.name },
          { key: 'country', header: 'Country', cell: (r) => r.country, csv: (r) => r.country },
          { key: 'status', header: 'Status', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'materials', header: 'Materials', className: 'text-right', cell: (r) => r._count?.materials ?? 0 },
          { key: 'score', header: 'Quality score', className: 'text-right tabular', cell: (r) => r.scorecard?.qualityScore ?? '—', csv: (r) => r.scorecard?.qualityScore },
          { key: 'otd', header: 'On-time', className: 'text-right tabular', cell: (r) => pct(r.scorecard?.onTimeDeliveryPct), csv: (r) => r.scorecard?.onTimeDeliveryPct },
          { key: 'rej', header: 'QC rejection', className: 'text-right tabular', cell: (r) => <span className={(r.scorecard?.qcRejectionPct ?? 0) >= 10 ? 'font-semibold text-danger' : ''}>{pct(r.scorecard?.qcRejectionPct)}</span>, csv: (r) => r.scorecard?.qcRejectionPct },
          { key: 'requal', header: 'Requalification', cell: (r) => fmtDate(r.requalificationDate), csv: (r) => r.requalificationDate },
        ]}
      />
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title="New supplier"
        description="New suppliers start as PENDING QUALIFICATION and cannot deliver GMP material until approved by QA."
        submitLabel="Create supplier"
        onSubmit={async () => {
          const s = await api.post<{ id: string }>('/suppliers', { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), code: f.code.toUpperCase() });
          toast.success('Supplier created');
          router.push(`/master-data/suppliers/${s.id}`);
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code" required>
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
          </Field>
          <Field label="Country" required>
            <Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} required />
          </Field>
          <Field label="Name" required className="md:col-span-2">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </Field>
          <Field label="Contact name">
            <Input value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
