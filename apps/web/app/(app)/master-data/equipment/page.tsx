'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import type { Equipment } from '@/lib/types';
import { Button, Input, Select } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ActionDialog, Field, PageHeader } from '@/components/page';

const CAL_TONE = { VALID: 'success', DUE_SOON: 'warning', EXPIRED: 'danger', NOT_REQUIRED: 'muted' } as const;
const TYPES = ['BALANCE', 'GRANULATOR', 'DRYER', 'TABLET_PRESS', 'BLENDER', 'ENCAPSULATOR', 'BLISTER', 'HPLC', 'DISSOLUTION'];

export default function EquipmentPage() {
  const { can, user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ siteId: user?.sites[0]?.id ?? '', code: '', description: '', type: 'TABLET_PRESS', location: '', manufacturer: '', model: '', serialNumber: '', calibrationFrequencyDays: '90', nextCalibrationDue: '' });
  return (
    <>
      <PageHeader
        title="Equipment & calibration"
        description="Equipment with expired calibration is blocked from eBMR steps (configurable BLOCK / WARN policy). Calibration due within 7 days is alerted."
        actions={
          can('equipment.manage') && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New equipment
            </Button>
          )
        }
      />
      <DataTable<Equipment>
        id="equipment"
        endpoint="/equipment"
        searchPlaceholder="Code, description, location"
        filters={[{ param: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: t.replace('_', ' ').toLowerCase() })) }]}
        rowHref={(r) => `/master-data/equipment/${r.id}`}
        columns={[
          { key: 'code', header: 'ID', sort: 'code', cell: (r) => <span className="font-mono">{r.code}</span>, csv: (r) => r.code },
          { key: 'desc', header: 'Description', cell: (r) => r.description, csv: (r) => r.description },
          { key: 'type', header: 'Type', cell: (r) => r.type.replace('_', ' ').toLowerCase(), csv: (r) => r.type },
          { key: 'loc', header: 'Location', cell: (r) => r.location, csv: (r) => r.location },
          { key: 'qual', header: 'Qualification', cell: (r) => <StatusBadge status={r.qualificationStatus} tone={r.qualificationStatus === 'QUALIFIED' ? 'success' : 'warning'} />, csv: (r) => r.qualificationStatus },
          { key: 'last', header: 'Last calibration', cell: (r) => fmtDate(r.lastCalibrationAt), csv: (r) => r.lastCalibrationAt },
          { key: 'next', header: 'Next calibration', sort: 'nextCalibrationDue', cell: (r) => fmtDate(r.nextCalibrationDue), csv: (r) => r.nextCalibrationDue },
          { key: 'cal', header: 'Calibration', cell: (r) => <StatusBadge status={r.calibrationState} tone={CAL_TONE[(r.calibrationState ?? 'NOT_REQUIRED') as keyof typeof CAL_TONE]} />, csv: (r) => r.calibrationState },
        ]}
      />
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        wide
        title="New equipment"
        submitLabel="Create"
        onSubmit={async () => {
          const e = await api.post<{ id: string }>('/equipment', {
            ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')),
            calibrationFrequencyDays: f.calibrationFrequencyDays ? Number(f.calibrationFrequencyDays) : undefined,
            nextCalibrationDue: f.nextCalibrationDue ? new Date(f.nextCalibrationDue).toISOString() : undefined,
          });
          toast.success('Equipment created');
          router.push(`/master-data/equipment/${e.id}`);
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Site" required>
            <Select value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value })}>
              {user?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment ID" required>
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
          </Field>
          <Field label="Type" required>
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ').toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" required className="md:col-span-2">
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required />
          </Field>
          <Field label="Location">
            <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <Field label="Manufacturer">
            <Input value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} />
          </Field>
          <Field label="Model">
            <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
          </Field>
          <Field label="Serial number">
            <Input value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} />
          </Field>
          <Field label="Calibration frequency (days)">
            <Input type="number" value={f.calibrationFrequencyDays} onChange={(e) => setF({ ...f, calibrationFrequencyDays: e.target.value })} />
          </Field>
          <Field label="Next calibration due">
            <Input type="date" value={f.nextCalibrationDue} onChange={(e) => setF({ ...f, nextCalibrationDue: e.target.value })} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
