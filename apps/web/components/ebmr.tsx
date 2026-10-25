'use client';

import * as React from 'react';
import { CheckCircle2, Circle, Clock, Fingerprint, Pencil, PlayCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useEquipment } from '@/lib/hooks';
import { cn, fmtDate, fmtDateTime, fmtNum } from '@/lib/utils';
import type { Batch, BatchStep, ParamDef } from '@/lib/types';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { ActionDialog, Callout, Field, SignatureDialog } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

const outOfLimit = (d: ParamDef, v: unknown) => {
  if (v === undefined || v === null || v === '') return false;
  const n = Number(v);
  return !Number.isNaN(n) && ((d.min !== undefined && n < d.min) || (d.max !== undefined && n > d.max));
};
const limitText = (d: ParamDef) => (d.min !== undefined && d.max !== undefined ? `${d.min}–${d.max}` : d.min !== undefined ? `≥ ${d.min}` : d.max !== undefined ? `≤ ${d.max}` : '');

function ReadingInputs({ defs, values, onChange, prefix }: { defs: ParamDef[]; values: Record<string, string>; onChange: (code: string, v: string) => void; prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {defs.map((d) => {
        const bad = outOfLimit(d, values[d.code]);
        return (
          <Field key={d.code} label={`${d.label}${d.unit ? ` (${d.unit})` : ''}`} required={d.required !== false} hint={`Limits: ${limitText(d)}`} error={bad ? `Outside limits ${limitText(d)} — remarks required; consider raising a deviation` : undefined}>
            <Input type="number" step="any" aria-invalid={bad} value={values[d.code] ?? ''} onChange={(e) => onChange(d.code, e.target.value)} data-testid={`${prefix}-${d.code}`} />
          </Field>
        );
      })}
    </div>
  );
}

function RecordedValues({ step }: { step: BatchStep }) {
  const rows = [...step.parameterDefs.map((d) => ({ d, v: step.readings[d.code], kind: 'Parameter' })), ...step.ipcDefs.map((d) => ({ d, v: step.ipcResults[d.code], kind: 'IPC' }))];
  if (!rows.length && step.outputQuantity === null) return null;
  return (
    <table className="mt-3 w-full text-[12.5px]">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 pr-3 font-medium">Check</th>
          <th className="py-1 pr-3 font-medium">Recorded</th>
          <th className="py-1 font-medium">Limits</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ d, v, kind }) => (
          <tr key={`${kind}-${d.code}`} className="border-b last:border-0">
            <td className="py-1 pr-3">
              <span className="text-muted-foreground">{kind} · </span>
              {d.label}
            </td>
            <td className={cn('py-1 pr-3 font-medium tabular', outOfLimit(d, v) && 'text-danger')}>
              {v ?? '—'} {d.unit}
              {outOfLimit(d, v) && <TriangleAlert className="ml-1 inline h-3.5 w-3.5" />}
            </td>
            <td className="py-1 text-muted-foreground">{limitText(d)}</td>
          </tr>
        ))}
        {step.recordsOutput && (
          <tr>
            <td className="py-1 pr-3">Output (good units)</td>
            <td className="py-1 pr-3 font-semibold tabular">{fmtNum(step.outputQuantity)}</td>
            <td />
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function StepCard({ batch, step, previousDone, onChanged }: { batch: Batch; step: BatchStep; previousDone: boolean; onChanged: () => void }) {
  const { can, user } = useAuth();
  const { data: equipment } = useEquipment();
  const [dialog, setDialog] = React.useState<null | 'start' | 'complete' | 'verify' | 'correct'>(null);
  const [equipmentId, setEquipmentId] = React.useState('');
  const [override, setOverride] = React.useState('');
  const [readings, setReadings] = React.useState<Record<string, string>>({});
  const [ipc, setIpc] = React.useState<Record<string, string>>({});
  const [remarks, setRemarks] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [consumption, setConsumption] = React.useState<Record<string, string>>({});
  const [corr, setCorr] = React.useState({ field: '', newValue: '', reason: '' });

  const issuedLots = (batch.requirements ?? []).flatMap((r) => r.lots.filter((l) => l.status === 'ISSUED').map((l) => ({ ...l, material: `${r.code} ${r.name}` })));
  const lotTotals = new Map<string, { lotId: string; lotNumber: string; material: string; qty: number }>();
  issuedLots.forEach((l) => {
    const cur = lotTotals.get(l.lotId);
    lotTotals.set(l.lotId, { lotId: l.lotId, lotNumber: l.lot?.lotNumber ?? '', material: l.material, qty: (cur?.qty ?? 0) + l.quantity });
  });
  const lots = [...lotTotals.values()];
  const eqOptions = (equipment ?? []).filter((e) => e.type === step.equipmentType);
  const selectedEq = eqOptions.find((e) => e.id === equipmentId);
  const calExpired = selectedEq?.calibrationState === 'EXPIRED';
  const canExecute = can('batch.execute', batch.siteId) && batch.status === 'IN_PROGRESS';

  const openComplete = () => {
    setReadings({});
    setIpc({});
    setRemarks('');
    setOutput('');
    setConsumption(Object.fromEntries(lots.map((l) => [l.lotId, String(l.qty)])));
    setDialog('complete');
  };

  const icon =
    step.status === 'VERIFIED' ? <ShieldCheck className="h-5 w-5 text-success" /> : step.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5 text-info" /> : step.status === 'IN_PROGRESS' ? <PlayCircle className="h-5 w-5 text-progress" /> : <Circle className="h-5 w-5 text-muted-foreground" />;

  return (
    <div className={cn('rounded-lg border bg-card p-4', step.status === 'IN_PROGRESS' && 'border-progress/40 ring-1 ring-progress/20')} data-testid={`step-${step.code}`}>
      <div className="flex flex-wrap items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">STEP {step.sequence / 10}</span>
            <span className="font-semibold">{step.name}</span>
            <StatusBadge status={step.status} />
            {step.hasOutOfLimitReading && <StatusBadge status="WARNING" label="Out-of-limit reading" />}
            {step.corrections.length > 0 && <StatusBadge status="CORRECTION" tone="warning" label={`${step.corrections.length} correction(s)`} />}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{step.instructions}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {step.equipmentType && <span>Equipment: {step.equipment ? `${step.equipment.code} — ${step.equipment.description}` : step.equipmentType.replace('_', ' ').toLowerCase()}</span>}
            {step.expectedDurationMin && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {step.expectedDurationMin} min
              </span>
            )}
            {step.startedAt && <span>Started {fmtDateTime(step.startedAt)} by {step.startedByName}</span>}
            {step.completedAt && (
              <span className="inline-flex items-center gap-1">
                <Fingerprint className="h-3 w-3" /> Performed by {step.completedByName} · {fmtDateTime(step.completedAt)}
              </span>
            )}
            {step.verifiedAt && (
              <span className="inline-flex items-center gap-1 text-success">
                <Fingerprint className="h-3 w-3" /> Verified by {step.verifiedByName} · {fmtDateTime(step.verifiedAt)}
              </span>
            )}
          </div>
          {step.calibrationOverrideReason && <p className="mt-1 text-xs text-warning">Calibration override: {step.calibrationOverrideReason}</p>}
          {(step.status === 'COMPLETED' || step.status === 'VERIFIED') && <RecordedValues step={step} />}
          {step.remarks && <p className="mt-2 text-[12.5px]">Remarks: {step.remarks}</p>}
          {step.corrections.length > 0 && (
            <div className="mt-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
              <div className="mb-1 font-semibold">Correction history (original values preserved)</div>
              {step.corrections.map((c) => (
                <div key={c.id}>
                  {fmtDateTime(c.correctedAt)} · {c.correctedByName}: <b>{c.field}</b> {String(c.originalValue ?? '—')} → {String(c.newValue)} — “{c.reason}”
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {step.status === 'PENDING' && canExecute && (
            <Button size="sm" onClick={() => setDialog('start')} disabled={!previousDone} title={previousDone ? undefined : 'Complete the previous step first'} data-testid={`start-${step.code}`}>
              <PlayCircle /> Start
            </Button>
          )}
          {step.status === 'IN_PROGRESS' && canExecute && (
            <Button size="sm" onClick={openComplete} data-testid={`complete-${step.code}`}>
              <Fingerprint /> Record & sign
            </Button>
          )}
          {step.status === 'COMPLETED' && step.requiresVerification && can('batch.verify', batch.siteId) && (
            <Button size="sm" variant="outline" onClick={() => setDialog('verify')} disabled={step.completedByName === user?.fullName} title={step.completedByName === user?.fullName ? 'You performed this step; a different person must verify it' : undefined} data-testid={`verify-${step.code}`}>
              <ShieldCheck /> Verify
            </Button>
          )}
          {(step.status === 'COMPLETED' || step.status === 'VERIFIED') && can('batch.execute', batch.siteId) && ['IN_PROGRESS', 'AWAITING_QC'].includes(batch.status) && (
            <Button size="sm" variant="ghost" onClick={() => { setCorr({ field: '', newValue: '', reason: '' }); setDialog('correct'); }}>
              <Pencil /> Correct
            </Button>
          )}
        </div>
      </div>

      <ActionDialog
        open={dialog === 'start'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Start step: ${step.name}`}
        description="Equipment must be qualified and within calibration. Expired calibration is blocked or requires a documented reason, depending on company policy."
        submitLabel="Start step"
        onSubmit={async () => {
          await api.post(`/batches/${batch.id}/steps/${step.id}/start`, { equipmentId: equipmentId || undefined, calibrationOverrideReason: override || undefined });
          toast.success(`${step.name} started`);
          onChanged();
        }}
      >
        {step.equipmentType ? (
          <Field label={`Equipment (${step.equipmentType.replace('_', ' ').toLowerCase()})`} required>
            <Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required data-testid="step-equipment">
              <option value="">Select…</option>
              {eqOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.description} · calibration {e.calibrationState === 'EXPIRED' ? 'EXPIRED' : `due ${fmtDate(e.nextCalibrationDue)}`}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">No equipment required for this step.</p>
        )}
        {calExpired && (
          <>
            <Callout tone="danger" title="Calibration expired">
              {selectedEq?.code} is past its calibration due date. Under the default BLOCK policy the server will refuse this step. Under WARN policy a documented reason is required.
            </Callout>
            <Field label="Override reason (WARN policy only)">
              <Textarea value={override} onChange={(e) => setOverride(e.target.value)} />
            </Field>
          </>
        )}
      </ActionDialog>

      <SignatureDialog
        open={dialog === 'complete'}
        onOpenChange={(o) => !o && setDialog(null)}
        action={`Execute eBMR step "${step.name}"`}
        meaning={`Performed by: I executed "${step.name}" as recorded`}
        record={`${batch.batchNumber} / ${step.name}`}
        reasonLabel="Signature comment (optional)"
        confirmLabel="Sign & complete step"
        extra={
          <div className="space-y-4">
            {step.parameterDefs.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Process parameters</div>
                <ReadingInputs prefix="param" defs={step.parameterDefs} values={readings} onChange={(c, v) => setReadings({ ...readings, [c]: v })} />
              </div>
            )}
            {step.ipcDefs.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">In-process controls</div>
                <ReadingInputs prefix="ipc" defs={step.ipcDefs} values={ipc} onChange={(c, v) => setIpc({ ...ipc, [c]: v })} />
              </div>
            )}
            {step.consumesMaterials && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Actual material consumption (per issued lot)</div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1">Lot / material</th>
                      <th className="py-1 text-right">Issued</th>
                      <th className="py-1 text-right">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l) => (
                      <tr key={l.lotId} className="border-b last:border-0">
                        <td className="py-1">
                          <span className="font-mono">{l.lotNumber}</span> <span className="text-muted-foreground">{l.material}</span>
                        </td>
                        <td className="py-1 text-right tabular">{fmtNum(l.qty, 3)}</td>
                        <td className="py-1 pl-2">
                          <Input className="h-8 text-right" type="number" step="any" value={consumption[l.lotId] ?? ''} onChange={(e) => setConsumption({ ...consumption, [l.lotId]: e.target.value })} data-testid={`consume-${l.lotNumber}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-muted-foreground">Unused quantity is returned to the lot; additional quantity is drawn only from RELEASED stock. Variance beyond the configured limit requires remarks.</p>
              </div>
            )}
            {step.recordsOutput && (
              <Field label={`Output — good units (${batch.uomCode})`} required hint={`Theoretical: ${fmtNum(batch.theoreticalYield)}`}>
                <Input type="number" value={output} onChange={(e) => setOutput(e.target.value)} data-testid="step-output" />
              </Field>
            )}
            <Field label="Remarks" hint="Required if any reading is out of limits or consumption variance exceeds the threshold">
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
        }
        onSign={async (sig) => {
          const num = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
          await api.post(`/batches/${batch.id}/steps/${step.id}/complete`, {
            ...sig,
            readings: num(readings),
            ipcResults: num(ipc),
            remarks: remarks || undefined,
            outputQuantity: output ? Number(output) : undefined,
            consumptions: step.consumesMaterials ? Object.entries(consumption).map(([lotId, v]) => ({ lotId, actualQuantity: Number(v) })) : undefined,
          });
          toast.success(`${step.name} completed and signed`);
          onChanged();
        }}
      />

      <SignatureDialog
        open={dialog === 'verify'}
        onOpenChange={(o) => !o && setDialog(null)}
        action={`Verify eBMR step "${step.name}"`}
        meaning={`Verified by: I reviewed "${step.name}" and confirm the record is complete and correct`}
        record={`${batch.batchNumber} / ${step.name}`}
        confirmLabel="Sign & verify"
        onSign={async (sig) => {
          await api.post(`/batches/${batch.id}/steps/${step.id}/verify`, sig);
          toast.success('Step verified');
          onChanged();
        }}
      />

      <ActionDialog
        open={dialog === 'correct'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Correct recorded value — ${step.name}`}
        description="Completed records are never overwritten silently: the original value, new value, your reason and identity are preserved. A verified step returns to COMPLETED and must be re-verified."
        submitLabel="Record correction"
        onSubmit={async () => {
          await api.post(`/batches/${batch.id}/steps/${step.id}/corrections`, { field: corr.field, newValue: corr.field === 'remarks' ? corr.newValue : Number(corr.newValue), reason: corr.reason });
          toast.success('Correction recorded');
          onChanged();
        }}
      >
        <Field label="Field" required>
          <Select value={corr.field} onChange={(e) => setCorr({ ...corr, field: e.target.value })} required>
            <option value="">Select…</option>
            {step.parameterDefs.map((d) => (
              <option key={d.code} value={`readings.${d.code}`}>
                Parameter: {d.label} (now {String(step.readings[d.code] ?? '—')})
              </option>
            ))}
            {step.ipcDefs.map((d) => (
              <option key={d.code} value={`ipcResults.${d.code}`}>
                IPC: {d.label} (now {String(step.ipcResults[d.code] ?? '—')})
              </option>
            ))}
            {step.recordsOutput && <option value="outputQuantity">Output quantity (now {fmtNum(step.outputQuantity)})</option>}
            <option value="remarks">Remarks</option>
          </Select>
        </Field>
        <Field label="New value" required>
          <Input value={corr.newValue} onChange={(e) => setCorr({ ...corr, newValue: e.target.value })} required />
        </Field>
        <Field label="Reason for correction" required>
          <Textarea value={corr.reason} onChange={(e) => setCorr({ ...corr, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
    </div>
  );
}
