'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { gs1ElementString } from '@pharmodry/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, fmtNum } from '@/lib/utils';
import type { Batch, Sample } from '@/lib/types';
import { Button, Skeleton } from '@/components/ui/primitives';

/** Print-friendly (browser "Save as PDF") executed batch manufacturing record. */
export default function BatchRecordPage() {
  const { id } = useParams<{ id: string }>();
  const { data: b } = useQuery({ queryKey: ['batch', id], queryFn: () => api.get<Batch>(`/batches/${id}`) });
  const { can } = useAuth();
  const canQc = can('qc.view');
  const { data: samples } = useQuery({ queryKey: ['batch-samples-full', id], queryFn: async () => Promise.all((b?.samples ?? []).map((s) => api.get<Sample>(`/qc/samples/${s.id}`))), enabled: !!b && canQc });
  if (!b) return <Skeleton className="h-96" />;
  const th = 'border px-2 py-1 text-left font-semibold bg-gray-50';
  const td = 'border px-2 py-1 align-top';
  return (
    <div className="mx-auto max-w-[900px] bg-white p-8 text-[12px] text-black shadow print:p-0 print:shadow-none">
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => window.print()}>
          <Printer /> Print / save as PDF
        </Button>
      </div>
      <header className="mb-4 border-b-2 border-brand-navy pb-2" data-testid="bmr-header">
        <div className="flex justify-between">
          <div>
            <div className="text-lg font-bold">Executed Batch Manufacturing Record</div>
            <div>Pharmodry · generated {fmtDateTime(new Date())}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-bold">{b.batchNumber}</div>
            <div>Status: {b.status}</div>
          </div>
        </div>
      </header>
      <table className="mb-4 w-full border-collapse">
        <tbody>
          <tr>
            <td className={th}>Product</td>
            <td className={td}>
              {b.product.code} — {b.product.genericName} {b.product.strength} {b.product.brandName ? `(${b.product.brandName})` : ''}
            </td>
            <td className={th}>Site</td>
            <td className={td}>{b.site?.name}</td>
          </tr>
          <tr>
            <td className={th}>Batch size</td>
            <td className={td}>
              {fmtNum(b.plannedQuantity)} {b.uomCode}
            </td>
            <td className={th}>Actual yield</td>
            <td className={td}>{b.actualYield ? `${fmtNum(b.actualYield)} (${b.yieldPct}%)` : '—'}</td>
          </tr>
          <tr>
            <td className={th}>Manufactured</td>
            <td className={td}>
              {fmtDateTime(b.actualStart)} – {fmtDateTime(b.actualEnd)}
            </td>
            <td className={th}>Expiry</td>
            <td className={td}>{fmtDate(b.expiryDate)}</td>
          </tr>
          <tr>
            <td className={th}>GS1 element string</td>
            <td className={td} colSpan={3}>
              <span className="font-mono">{b.product.gtin && b.expiryDate ? gs1ElementString(b.product.gtin, new Date(b.expiryDate), b.batchNumber) : 'Not available (no GTIN or expiry)'}</span>
            </td>
          </tr>
          <tr>
            <td className={th}>QA decision</td>
            <td className={td} colSpan={3}>
              {b.qaDecisionAt ? `${b.status} by ${b.qaDecisionByName} on ${fmtDateTime(b.qaDecisionAt)} — ${b.qaDecisionComment ?? ''}` : 'Pending'}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-1 mt-4 text-sm font-bold">1. Materials dispensed</h2>
      <table className="mb-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Material</th>
            <th className={th}>Required</th>
            <th className={th}>Lot</th>
            <th className={th}>Issued</th>
          </tr>
        </thead>
        <tbody>
          {b.requirements?.flatMap((r) =>
            r.lots.map((l, i) => (
              <tr key={l.id}>
                <td className={td}>{i === 0 ? `${r.code} ${r.name}` : ''}</td>
                <td className={td}>{i === 0 ? fmtNum(r.required, 3) : ''}</td>
                <td className={`${td} font-mono`}>{l.lot?.lotNumber}</td>
                <td className={td}>
                  {fmtNum(l.quantity, 3)} ({l.status})
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {b.consumptions && b.consumptions.length > 0 && (
        <table className="mb-4 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Lot</th>
              <th className={th}>Expected</th>
              <th className={th}>Actual</th>
              <th className={th}>Variance</th>
              <th className={th}>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {b.consumptions.map((c) => (
              <tr key={c.id}>
                <td className={`${td} font-mono`}>{c.lot?.lotNumber}</td>
                <td className={td}>{fmtNum(c.expectedQuantity, 3)}</td>
                <td className={td}>{fmtNum(c.actualQuantity, 3)}</td>
                <td className={td}>{c.variancePct}%</td>
                <td className={td}>
                  {c.recordedByName} {fmtDateTime(c.recordedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-1 mt-4 text-sm font-bold">2. Manufacturing steps</h2>
      {b.steps?.map((s) => (
        <div key={s.id} className="mb-3 break-inside-avoid border p-2">
          <div className="font-semibold">
            Step {s.sequence / 10}: {s.name} — {s.status}
          </div>
          <div className="text-[11px]">{s.instructions}</div>
          <div className="mt-1 text-[11px]">Equipment: {s.equipment ? `${s.equipment.code} ${s.equipment.description}` : '—'}</div>
          <table className="mt-1 w-full border-collapse text-[11px]">
            <tbody>
              {[...s.parameterDefs.map((d) => [d, s.readings[d.code]] as const), ...s.ipcDefs.map((d) => [d, s.ipcResults[d.code]] as const)].map(([d, v]) => (
                <tr key={d.code}>
                  <td className={td}>{d.label}</td>
                  <td className={td}>
                    {String(v ?? '—')} {d.unit}
                  </td>
                  <td className={td}>
                    Limits {d.min ?? '−'}–{d.max ?? '+'}
                  </td>
                </tr>
              ))}
              {s.recordsOutput && (
                <tr>
                  <td className={td}>Output</td>
                  <td className={td} colSpan={2}>
                    {fmtNum(s.outputQuantity)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-1 text-[11px]">
            Performed (e-signed): {s.completedByName ?? '—'} {fmtDateTime(s.completedAt)} · Verified (e-signed): {s.verifiedByName ?? '—'} {fmtDateTime(s.verifiedAt)}
          </div>
          {s.remarks && <div className="text-[11px]">Remarks: {s.remarks}</div>}
          {s.corrections.map((c) => (
            <div key={c.id} className="text-[11px] italic">
              Correction {fmtDateTime(c.correctedAt)} by {c.correctedByName}: {c.field} {String(c.originalValue)} → {String(c.newValue)} ({c.reason})
            </div>
          ))}
        </div>
      ))}

      <h2 className="mb-1 mt-4 text-sm font-bold">3. Quality control</h2>
      {!canQc && <p className="mb-3 italic">QC results are not shown: your role does not include QC access (qc.view).</p>}
      {samples?.map((s) => (
        <div key={s.id} className="mb-3 break-inside-avoid">
          <div className="font-semibold">
            {s.number} ({s.stage}) — {s.status} {s.conclusion ? `· Conclusion ${s.conclusion}` : ''}
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className={th}>Test</th>
                <th className={th}>Specification</th>
                <th className={th}>Result</th>
                <th className={th}>Evaluation</th>
                <th className={th}>Analyst</th>
              </tr>
            </thead>
            <tbody>
              {s.tests?.flatMap((t) =>
                t.history.map((r) => (
                  <tr key={r.id} className={r.status === 'INVALIDATED' ? 'line-through' : ''}>
                    <td className={td}>{t.name}</td>
                    <td className={td}>{t.specText}</td>
                    <td className={td}>{r.numericValue ?? r.textValue ?? (r.passFail === null || r.passFail === undefined ? '—' : r.passFail ? 'Pass' : 'Fail')} {r.unit}</td>
                    <td className={td}>
                      {r.evaluation}
                      {r.status === 'INVALIDATED' ? ` (invalidated: ${r.invalidatedReason})` : ''}
                    </td>
                    <td className={td}>
                      {r.analystName} {fmtDate(r.enteredAt)}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      ))}
      {b.oos && b.oos.length > 0 && <div className="mb-2">OOS investigations: {b.oos.map((o) => `${o.number} (${o.status}${o.conclusion ? `, ${o.conclusion}` : ''})`).join('; ')}</div>}

      <h2 className="mb-1 mt-4 text-sm font-bold">4. Deviations</h2>
      <div className="mb-3">{b.deviations?.length ? b.deviations.map((d) => `${d.number} ${d.title} (${d.classification ?? 'unclassified'}, ${d.status})`).join('; ') : 'None.'}</div>

      <h2 className="mb-1 mt-4 text-sm font-bold">5. Electronic signatures</h2>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {b.signatures?.map((s) => (
            <tr key={s.id}>
              <td className={td}>{fmtDateTime(s.signedAt)}</td>
              <td className={td}>{s.signerName}</td>
              <td className={td}>{s.meaning}</td>
              <td className={td}>{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-6 border-t pt-2 text-[10px] text-gray-600">
        This document is a rendering of the electronic batch record held in Pharmodry. The electronic record, its audit trail and electronic signatures remain the controlling record.
      </footer>
    </div>
  );
}
