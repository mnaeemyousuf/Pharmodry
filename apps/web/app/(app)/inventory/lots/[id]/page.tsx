'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Ban, CheckCircle2, GitBranch, PencilLine, XCircle } from 'lucide-react';
import Link2 from 'next/link';
import { toast } from 'sonner';
import type { BlockingReason } from '@pharmodry/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWarehouses } from '@/lib/hooks';
import { fmtDate, fmtDateTime, fmtNum, fmtPkr } from '@/lib/utils';
import type { Lot } from '@/lib/types';
import { Button, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActionDialog, AuditHistory, Blockers, Callout, DetailHeader, Empty, Field, KeyValues, Section, SignatureDialog } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

export default function LotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: lot, isLoading } = useQuery({ queryKey: ['lot', id], queryFn: () => api.get<Lot>(`/inventory/lots/${id}`) });
  const awaiting = lot?.itemType === 'MATERIAL' && (lot.status === 'QUARANTINE' || lot.status === 'UNDER_TEST');
  const { data: blockers } = useQuery({ queryKey: ['lot-blockers', id], queryFn: () => api.get<BlockingReason[]>(`/inventory/lots/${id}/release-blockers`), enabled: !!awaiting });
  const { data: warehouses } = useWarehouses();
  const [dialog, setDialog] = React.useState<null | 'RELEASE' | 'REJECT' | 'transfer' | 'adjust' | 'block'>(null);
  const [form, setForm] = React.useState({ toWarehouseId: '', toBinId: '', quantity: '', reason: '' });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lot', id] });
    qc.invalidateQueries({ queryKey: ['lot-blockers', id] });
    qc.invalidateQueries({ queryKey: ['audit'] });
  };
  if (isLoading || !lot) return <Skeleton className="h-96" />;
  const canDisposition = awaiting && can('inventory.release');
  const available = lot.quantity - lot.reservedQuantity;
  const destWh = warehouses?.find((w) => w.id === form.toWarehouseId);

  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Inventory', href: '/inventory' }, { label: lot.lotNumber }]}
        title={lot.lotNumber}
        status={lot.status}
        subtitle={`${lot.item?.code ?? ''} · ${lot.item?.name ?? ''}`}
        meta={[
          { label: 'Quantity', value: `${fmtNum(lot.quantity)} ${lot.uomCode}` },
          { label: 'Available', value: `${fmtNum(available)} ${lot.uomCode}` },
          { label: 'Location', value: `${lot.warehouse?.code ?? ''}${lot.bin ? ` / ${lot.bin.code}` : ''}` },
          { label: 'Expiry', value: <span className={(lot.daysToExpiry ?? 999) < 90 ? 'text-warning' : ''}>{fmtDate(lot.expiryDate)}</span> },
          { label: 'Retest', value: fmtDate(lot.retestDate) },
          { label: 'Value', value: fmtPkr(lot.quantity * lot.unitCost) },
        ]}
        actions={
          <>
            {canDisposition && (
              <>
                <Button onClick={() => setDialog('RELEASE')} disabled={(blockers?.length ?? 1) > 0} data-testid="lot-release">
                  <CheckCircle2 /> QA release
                </Button>
                <Button variant="outline" onClick={() => setDialog('REJECT')} data-testid="lot-reject">
                  <XCircle /> Reject
                </Button>
              </>
            )}
            {can('inventory.transfer') && lot.quantity > 0 && (
              <Button variant="outline" onClick={() => setDialog('transfer')}>
                <ArrowLeftRight /> Transfer
              </Button>
            )}
            {lot.itemType === 'MATERIAL' && can('batch.view') && (
              <Button variant="outline" asChild>
                <Link2 href={`/traceability?lot=${lot.id}`}>
                  <GitBranch /> Trace
                </Link2>
              </Button>
            )}
            {can('inventory.adjust') && (
              <Button variant="outline" onClick={() => setDialog('adjust')}>
                <PencilLine /> Adjust
              </Button>
            )}
            {can('inventory.release') && (lot.status === 'RELEASED' || lot.status === 'BLOCKED') && (
              <Button variant="outline" onClick={() => setDialog('block')}>
                <Ban /> {lot.status === 'BLOCKED' ? 'Unblock' : 'Block'}
              </Button>
            )}
          </>
        }
      />
      {awaiting && blockers && blockers.length > 0 && (
        <div className="mb-4">
          <Blockers reasons={blockers} title="This lot cannot be released yet" />
        </div>
      )}
      {awaiting && blockers && blockers.length === 0 && (
        <div className="mb-4">
          <Callout tone="success" title="Ready for QA disposition">
            QC has approved the lot with a passing conclusion and there are no open OOS investigations. An authorised QA user can release it with an electronic signature.
          </Callout>
        </div>
      )}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="movements">Movements ({lot.transactions?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="qc">QC ({lot.samples?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="usage">Used in batches ({lot.usedInBatches?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Section title="Lot details">
            <KeyValues
              items={[
                { label: 'Item type', value: lot.itemType === 'MATERIAL' ? 'Material' : 'Finished goods' },
                { label: 'Item', value: lot.item ? <Link className="text-primary hover:underline" href={lot.itemType === 'MATERIAL' ? `/master-data/materials/${lot.item.id}` : `/master-data/products/${lot.item.id}`}>{lot.item.code} — {lot.item.name}</Link> : '—' },
                { label: 'Supplier', value: lot.supplier ? <Link className="text-primary hover:underline" href={`/master-data/suppliers/${lot.supplier.id}`}>{lot.supplier.name}</Link> : '—' },
                { label: 'Supplier batch', value: lot.supplierBatch },
                { label: 'Manufacturing date', value: fmtDate(lot.mfgDate) },
                { label: 'Source', value: lot.sourceType },
                { label: 'Reserved', value: `${fmtNum(lot.reservedQuantity)} ${lot.uomCode}` },
                { label: 'Disposition', value: lot.dispositionAt ? `${lot.dispositionByName ?? ''} · ${fmtDateTime(lot.dispositionAt)}` : 'Pending' },
                { label: 'Batch', value: lot.batchId ? <Link className="text-primary hover:underline" href={`/production/batches/${lot.batchId}`}>Open batch</Link> : '—' },
              ]}
            />
            {lot.oos && lot.oos.length > 0 && (
              <div className="mt-4 space-y-1">
                {lot.oos.map((o) => (
                  <Link key={o.id} href={`/quality/oos/${o.id}`} className="flex items-center gap-2 text-[13px] text-danger hover:underline">
                    {o.number} — {o.testName} <StatusBadge status={o.status} />
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="movements">
          <Section title="Stock movement history" description="Append-only inventory ledger for this lot record.">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Balance</th>
                    <th className="py-2 pr-3">Status change</th>
                    <th className="py-2 pr-3">By</th>
                    <th className="py-2">Reason / reference</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.transactions?.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(t.performedAt)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={t.type} tone="neutral" />
                      </td>
                      <td className="py-2 pr-3 text-right tabular">{t.quantity > 0 ? '+' : ''}{fmtNum(t.quantity)}</td>
                      <td className="py-2 pr-3 text-right tabular">{fmtNum(t.balanceAfter)}</td>
                      <td className="py-2 pr-3">{t.statusTo ? `${t.statusFrom ?? '—'} → ${t.statusTo}` : '—'}</td>
                      <td className="py-2 pr-3">{t.performedByName ?? 'System'}</td>
                      <td className="py-2 text-muted-foreground">{t.reason ?? t.referenceType ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="qc">
          <Section title="QC samples">
            {lot.samples?.length ? (
              <ul className="divide-y">
                {lot.samples.map((s) => (
                  <li key={s.id}>
                    <Link href={`/quality/samples/${s.id}`} className="flex items-center gap-3 py-2 hover:bg-muted/40">
                      <span className="font-mono font-medium text-primary">{s.number}</span>
                      <span className="text-muted-foreground">{s.stage.replace(/_/g, ' ').toLowerCase()}</span>
                      <StatusBadge status={s.status} />
                      {s.conclusion && <StatusBadge status={s.conclusion} />}
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(s.requestedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No QC samples.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="usage">
          <Section title="Batch traceability" description="Batches this lot was reserved for or consumed in.">
            {lot.usedInBatches?.length ? (
              <div className="flex flex-wrap gap-2">
                {lot.usedInBatches.map((b) => (
                  <Link key={b.id} href={`/production/batches/${b.id}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 hover:border-primary/50">
                    <span className="font-mono text-[13px]">{b.batchNumber}</span>
                    <StatusBadge status={b.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>Not used in any batch yet.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="audit">
          <Section title="Audit trail">
            <AuditHistory entityId={lot.id} />
          </Section>
        </TabsContent>
      </Tabs>

      <SignatureDialog
        open={dialog === 'RELEASE' || dialog === 'REJECT'}
        onOpenChange={(o) => !o && setDialog(null)}
        action={dialog === 'RELEASE' ? 'QA release of material lot' : 'QA rejection of material lot'}
        meaning={dialog === 'RELEASE' ? 'QA approval: material lot released for use in manufacturing' : 'QA decision: material lot rejected and must not be used'}
        record={`${lot.lotNumber} — ${lot.item?.name ?? ''}`}
        reasonRequired={dialog === 'REJECT'}
        destructive={dialog === 'REJECT'}
        confirmLabel={dialog === 'RELEASE' ? 'Sign & release' : 'Sign & reject'}
        onSign={async (sig) => {
          await api.post(`/inventory/lots/${id}/disposition`, { decision: dialog, ...sig });
          toast.success(dialog === 'RELEASE' ? 'Lot released' : 'Lot rejected');
          refresh();
        }}
      />
      <ActionDialog
        open={dialog === 'transfer'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Transfer stock"
        description={`Move unreserved quantity to another location at the same site. Status (${lot.status}) is preserved.`}
        submitLabel="Transfer"
        onSubmit={async () => {
          await api.post(`/inventory/lots/${id}/transfer`, { toWarehouseId: form.toWarehouseId, toBinId: form.toBinId || undefined, quantity: Number(form.quantity), reason: form.reason });
          toast.success('Stock transferred');
          refresh();
        }}
      >
        <Field label="Destination warehouse" required>
          <Select value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value, toBinId: '' })} required>
            <option value="">Select…</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bin">
          <Select value={form.toBinId} onChange={(e) => setForm({ ...form, toBinId: e.target.value })}>
            <option value="">—</option>
            {destWh?.bins.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Quantity (max ${fmtNum(available)} ${lot.uomCode})`} required>
          <Input type="number" step="any" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
        </Field>
        <Field label="Reason" required>
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required minLength={3} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'adjust'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Stock adjustment"
        description="Use a negative quantity to reduce stock (e.g. damage, count variance). Adjustments are audited with your reason."
        submitLabel="Post adjustment"
        onSubmit={async () => {
          await api.post(`/inventory/lots/${id}/adjust`, { quantity: Number(form.quantity), reason: form.reason });
          toast.success('Adjustment posted');
          refresh();
        }}
      >
        <Field label="Quantity change (signed)" required>
          <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
        </Field>
        <Field label="Reason" required hint="At least 5 characters">
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'block'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={lot.status === 'BLOCKED' ? 'Unblock lot' : 'Block lot'}
        description={lot.status === 'BLOCKED' ? 'Return the lot to RELEASED status.' : 'Blocked lots cannot be reserved or consumed until unblocked by QA.'}
        submitLabel={lot.status === 'BLOCKED' ? 'Unblock' : 'Block'}
        destructive={lot.status !== 'BLOCKED'}
        onSubmit={async () => {
          await api.post(`/inventory/lots/${id}/block`, { action: lot.status === 'BLOCKED' ? 'UNBLOCK' : 'BLOCK', reason: form.reason });
          toast.success('Lot status updated');
          refresh();
        }}
      >
        <Field label="Reason" required>
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
    </>
  );
}
