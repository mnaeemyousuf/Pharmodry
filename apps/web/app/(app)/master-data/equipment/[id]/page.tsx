'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, toIsoDate } from '@/lib/utils';
import type { Equipment } from '@/lib/types';
import { Button, Input, Skeleton } from '@/components/ui/primitives';
import { ActionDialog, AuditHistory, Callout, DetailHeader, Empty, Field, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: e } = useQuery({ queryKey: ['equipment', id], queryFn: () => api.get<Equipment>(`/equipment/${id}`) });
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ performedAt: toIsoDate(new Date()), result: 'PASS — within tolerance', certificateNo: '', nextDue: '' });
  if (!e) return <Skeleton className="h-96" />;
  const expired = e.nextCalibrationDue && new Date(e.nextCalibrationDue) < new Date();
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Equipment', href: '/master-data/equipment' }, { label: e.code }]}
        title={e.code}
        status={e.qualificationStatus}
        subtitle={`${e.description} · ${e.type.replace('_', ' ').toLowerCase()}`}
        meta={[
          { label: 'Location', value: e.location },
          { label: 'Manufacturer / model', value: `${e.manufacturer ?? '—'} / ${e.model ?? '—'}` },
          { label: 'Serial number', value: e.serialNumber },
          { label: 'Frequency', value: e.calibrationFrequencyDays ? `${e.calibrationFrequencyDays} days` : '—' },
          { label: 'Last calibration', value: fmtDate(e.lastCalibrationAt) },
          { label: 'Next due', value: <span className={expired ? 'font-semibold text-danger' : ''}>{fmtDate(e.nextCalibrationDue)}</span> },
        ]}
        actions={
          can('equipment.manage') && (
            <Button onClick={() => setOpen(true)}>
              <Gauge /> Record calibration
            </Button>
          )
        }
      />
      {expired && (
        <div className="mb-4">
          <Callout tone="danger" title="Calibration expired">
            This equipment cannot be selected for eBMR steps under the BLOCK policy until a calibration is recorded.
          </Callout>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Calibration history">
          {e.calibrations?.length ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Performed</th>
                  <th className="py-2">Result</th>
                  <th className="py-2">Certificate</th>
                  <th className="py-2">Next due</th>
                </tr>
              </thead>
              <tbody>
                {e.calibrations.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">{fmtDate(c.performedAt)}</td>
                    <td className="py-2">
                      <StatusBadge status={c.result.startsWith('PASS') ? 'PASS' : 'FAIL'} label={c.result} />
                    </td>
                    <td className="py-2">{c.certificateNo ?? '—'}</td>
                    <td className="py-2">{fmtDate(c.nextDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No calibrations recorded.</Empty>
          )}
        </Section>
        <Section title="Audit trail">
          <AuditHistory entityId={e.id} />
        </Section>
      </div>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Record calibration"
        description="Next due defaults to performed date + calibration frequency."
        submitLabel="Record"
        onSubmit={async () => {
          await api.post(`/equipment/${id}/calibrations`, { performedAt: new Date(f.performedAt).toISOString(), result: f.result, certificateNo: f.certificateNo || undefined, nextDue: f.nextDue ? new Date(f.nextDue).toISOString() : undefined });
          toast.success('Calibration recorded');
          qc.invalidateQueries({ queryKey: ['equipment', id] });
          qc.invalidateQueries({ queryKey: ['equipment-all'] });
          qc.invalidateQueries({ queryKey: ['audit'] });
        }}
      >
        <Field label="Performed on" required>
          <Input type="date" max={toIsoDate(new Date())} value={f.performedAt} onChange={(ev) => setF({ ...f, performedAt: ev.target.value })} required />
        </Field>
        <Field label="Result" required>
          <Input value={f.result} onChange={(ev) => setF({ ...f, result: ev.target.value })} required />
        </Field>
        <Field label="Certificate number">
          <Input value={f.certificateNo} onChange={(ev) => setF({ ...f, certificateNo: ev.target.value })} />
        </Field>
        <Field label="Next due (optional override)">
          <Input type="date" value={f.nextDue} onChange={(ev) => setF({ ...f, nextDue: ev.target.value })} />
        </Field>
      </ActionDialog>
    </>
  );
}
