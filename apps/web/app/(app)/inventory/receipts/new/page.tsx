'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { grnSchema, type GrnInput } from '@pharmodry/validation';
import type { BlockingReason } from '@pharmodry/types';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMaterials, useSuppliers, useWarehouses } from '@/lib/hooks';
import { toIsoDate } from '@/lib/utils';
import type { PurchaseOrder, Supplier } from '@/lib/types';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { Blockers, Callout, Field, PageHeader, Section } from '@/components/page';

function NewGrnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { data: suppliers } = useSuppliers();
  const { data: materials } = useMaterials();
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const form = useForm<GrnInput>({
    resolver: zodResolver(grnSchema),
    defaultValues: { siteId: user?.sites[0]?.id ?? '', supplierId: '', purchaseOrderId: params.get('po') ?? '', deliveryNote: '', remarks: '', lines: [] },
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'lines' });
  const siteId = form.watch('siteId');
  const supplierId = form.watch('supplierId');
  const poId = form.watch('purchaseOrderId');
  const { data: warehouses } = useWarehouses(siteId);
  const { data: supplier } = useQuery({ queryKey: ['supplier', supplierId], queryFn: () => api.get<Supplier>(`/suppliers/${supplierId}`), enabled: !!supplierId });
  const { data: pos } = useQuery({ queryKey: ['pos-open', supplierId], queryFn: () => api.page<PurchaseOrder>('/purchase-orders', { supplierId, status: 'APPROVED,PARTIALLY_RECEIVED', pageSize: 50 }).then((r) => r.data), enabled: !!supplierId });
  const { data: po } = useQuery({ queryKey: ['po', poId], queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${poId}`), enabled: !!poId });

  React.useEffect(() => {
    if (po && !supplierId) form.setValue('supplierId', po.supplierId);
  }, [po, supplierId, form]);

  const defaultWh = (type: string) => warehouses?.find((w) => w.type === (type === 'PACKAGING' ? 'PACKAGING' : 'RAW_MATERIAL'))?.id ?? '';
  const blankLine = (materialId = '', quantity = 0, poLineId = '') => {
    const m = materials?.find((x) => x.id === materialId);
    return { materialId, poLineId, supplierBatch: '', quantity, containers: 1, mfgDate: '', expiryDate: '', retestDate: '', warehouseId: m ? defaultWh(m.type) : '', binId: '' };
  };
  const loadPo = () => {
    if (!po) return;
    replace(po.lines.filter((l) => l.quantity > l.receivedQuantity).map((l) => blankLine(l.materialId, Math.round((l.quantity - l.receivedQuantity) * 1000) / 1000, l.id)));
  };
  const approved = supplier?.materials?.filter((m) => m.approved).map((m) => m.material) ?? [];
  const notQualified = supplier && !['APPROVED', 'CONDITIONALLY_APPROVED'].includes(supplier.status);

  const onSubmit = form.handleSubmit(async (v) => {
    setReasons([]);
    try {
      const res = await api.post<{ id: string; number: string; lots: { lotNumber: string }[] }>('/goods-receipts', {
        ...v,
        purchaseOrderId: v.purchaseOrderId || undefined,
        lines: v.lines.map((l) => ({ ...l, poLineId: l.poLineId || undefined, binId: l.binId || undefined, retestDate: l.retestDate || undefined, mfgDate: new Date(l.mfgDate).toISOString(), expiryDate: new Date(l.expiryDate).toISOString() })),
      });
      toast.success(`${res.number} created — ${res.lots.length} lot(s) in QUARANTINE, QC sample(s) requested`);
      router.push(`/inventory/receipts/${res.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.reasons.length) setReasons(e.reasons);
      toast.error(errorMessage(e));
    }
  });
  const errs = form.formState.errors;

  return (
    <>
      <PageHeader title="New goods receipt" crumbs={[{ label: 'Goods receipts', href: '/inventory/receipts' }, { label: 'New' }]} description="Record supplier lot details exactly as on the container labels and certificate of analysis." />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Section title="Receipt header">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Site" required error={errs.siteId?.message}>
              <Select {...form.register('siteId')}>
                {user?.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Supplier" required error={errs.supplierId?.message} hint="Only approved / conditionally approved suppliers may deliver GMP material.">
              <Select {...form.register('supplierId')} data-testid="grn-supplier">
                <option value="">Select supplier…</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status.replace(/_/g, ' ').toLowerCase()})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Purchase order" hint="Optional — receiving against a PO updates received quantities.">
              <div className="flex gap-2">
                <Select {...form.register('purchaseOrderId')} data-testid="grn-po">
                  <option value="">No PO</option>
                  {pos?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number}
                    </option>
                  ))}
                  {po && !pos?.some((p) => p.id === po.id) && <option value={po.id}>{po.number}</option>}
                </Select>
                <Button type="button" variant="outline" disabled={!po} onClick={loadPo} data-testid="grn-load-po">
                  Load lines
                </Button>
              </div>
            </Field>
            <Field label="Delivery note / DN number">
              <Input {...form.register('deliveryNote')} />
            </Field>
            <Field label="Remarks" className="md:col-span-2">
              <Textarea rows={1} {...form.register('remarks')} />
            </Field>
          </div>
          {notQualified && (
            <div className="mt-4">
              <Callout tone="danger" title="Supplier not qualified">
                {supplier?.name} is {supplier?.status.replace(/_/g, ' ').toLowerCase()}. The server will reject this receipt.
              </Callout>
            </div>
          )}
        </Section>
        <Section
          title="Lines"
          description="Each line becomes a separate lot with its own internal lot number."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())} data-testid="grn-add-line">
              <Plus /> Add line
            </Button>
          }
        >
          {errs.lines?.message && <p className="mb-2 text-xs text-destructive">{errs.lines.message}</p>}
          <div className="space-y-3">
            {fields.map((f, i) => {
              const le = errs.lines?.[i];
              const matId = form.watch(`lines.${i}.materialId`);
              const whId = form.watch(`lines.${i}.warehouseId`);
              const wh = warehouses?.find((w) => w.id === whId);
              const mat = materials?.find((m) => m.id === matId);
              return (
                <div key={f.id} className="rounded-md border p-3" data-testid={`grn-line-${i}`}>
                  <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
                    <Field label="Material" required error={le?.materialId?.message} className="xl:col-span-2">
                      <Select
                        {...form.register(`lines.${i}.materialId`, {
                          onChange: (e) => {
                            const m = materials?.find((x) => x.id === e.target.value);
                            if (m) form.setValue(`lines.${i}.warehouseId`, defaultWh(m.type));
                          },
                        })}
                      >
                        <option value="">Select…</option>
                        {(approved.length ? approved : (materials ?? [])).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Supplier batch" required error={le?.supplierBatch?.message}>
                      <Input {...form.register(`lines.${i}.supplierBatch`)} />
                    </Field>
                    <Field label={`Quantity${mat ? ` (${mat.uomId ? '' : ''})` : ''}`} required error={le?.quantity?.message}>
                      <Input type="number" step="any" {...form.register(`lines.${i}.quantity`)} />
                    </Field>
                    <Field label="Containers" error={le?.containers?.message}>
                      <Input type="number" min={1} {...form.register(`lines.${i}.containers`)} />
                    </Field>
                    <div className="flex items-end justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove line">
                        <Trash2 />
                      </Button>
                    </div>
                    <Field label="Mfg date" required error={le?.mfgDate?.message}>
                      <Input type="date" max={toIsoDate(new Date())} {...form.register(`lines.${i}.mfgDate`)} />
                    </Field>
                    <Field label="Expiry date" required error={le?.expiryDate?.message}>
                      <Input type="date" {...form.register(`lines.${i}.expiryDate`)} />
                    </Field>
                    <Field label="Retest date" hint={mat?.retestPeriodMonths ? `Default: mfg + ${mat.retestPeriodMonths} months` : undefined}>
                      <Input type="date" {...form.register(`lines.${i}.retestDate`)} />
                    </Field>
                    <Field label="Warehouse" required error={le?.warehouseId?.message}>
                      <Select {...form.register(`lines.${i}.warehouseId`)}>
                        <option value="">Select…</option>
                        {warehouses?.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} — {w.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Bin">
                      <Select {...form.register(`lines.${i}.binId`)}>
                        <option value="">—</option>
                        {wh?.bins.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              );
            })}
            {fields.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Add a line, or select a purchase order and click “Load lines”.</p>}
          </div>
        </Section>
        {reasons.length > 0 && <Blockers reasons={reasons} title="Receipt rejected by business rules" />}
        <Callout tone="info">On saving, every lot is created with status <b>QUARANTINE</b> and a QC sample is requested against the active specification. Nothing received can be used in production until QC approves and QA releases it.</Callout>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting} data-testid="grn-submit">
            Create GRN
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NewGrnPage() {
  return (
    <Suspense>
      <NewGrnInner />
    </Suspense>
  );
}
