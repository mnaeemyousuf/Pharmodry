'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BlockingReason } from '@pharmodry/types';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSuppliers } from '@/lib/hooks';
import { fmtPkr } from '@/lib/utils';
import type { Supplier } from '@/lib/types';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { Blockers, Field, PageHeader, Section } from '@/components/page';

export default function NewPoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: suppliers } = useSuppliers();
  const [h, setH] = React.useState({ siteId: user?.sites[0]?.id ?? '', supplierId: '', expectedDate: '', notes: '' });
  const [lines, setLines] = React.useState<{ materialId: string; quantity: string; unitPrice: string }[]>([{ materialId: '', quantity: '', unitPrice: '' }]);
  const [busy, setBusy] = React.useState(false);
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const { data: supplier } = useQuery({ queryKey: ['supplier', h.supplierId], queryFn: () => api.get<Supplier>(`/suppliers/${h.supplierId}`), enabled: !!h.supplierId });
  const approved = supplier?.materials?.filter((m) => m.approved) ?? [];
  const total = lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setReasons([]);
    try {
      const po = await api.post<{ id: string; number: string }>('/purchase-orders', {
        ...h,
        expectedDate: h.expectedDate ? new Date(h.expectedDate).toISOString() : undefined,
        lines: lines.filter((l) => l.materialId).map((l) => ({ materialId: l.materialId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice || 0) })),
      });
      toast.success(`${po.number} created (draft — requires approval by a different user)`);
      router.push(`/procurement/purchase-orders/${po.id}`);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.reasons.length) setReasons(e2.reasons);
      toast.error(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New purchase order" crumbs={[{ label: 'Purchase orders', href: '/procurement/purchase-orders' }, { label: 'New' }]} />
      <form onSubmit={submit} className="space-y-4">
        <Section title="Order">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Site" required>
              <Select value={h.siteId} onChange={(e) => setH({ ...h, siteId: e.target.value })}>
                {user?.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Supplier" required>
              <Select value={h.supplierId} onChange={(e) => setH({ ...h, supplierId: e.target.value })} required>
                <option value="">Select…</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status === 'BLACKLISTED' || s.status === 'SUSPENDED'}>
                    {s.name} ({s.status.replace(/_/g, ' ').toLowerCase()})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expected delivery">
              <Input type="date" value={h.expectedDate} onChange={(e) => setH({ ...h, expectedDate: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea rows={1} value={h.notes} onChange={(e) => setH({ ...h, notes: e.target.value })} />
            </Field>
          </div>
        </Section>
        <Section
          title="Lines"
          description={h.supplierId ? 'Only materials on this supplier’s approved list are shown.' : 'Select a supplier first.'}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { materialId: '', quantity: '', unitPrice: '' }])}>
              <Plus /> Add line
            </Button>
          }
        >
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_140px_40px] items-end gap-2">
                <Field label={i === 0 ? 'Material' : ''}>
                  <Select value={l.materialId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, materialId: e.target.value } : x)))} required>
                    <option value="">Select…</option>
                    {approved.map((m) => (
                      <option key={m.material.id} value={m.material.id}>
                        {m.material.code} — {m.material.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={i === 0 ? 'Quantity' : ''}>
                  <Input type="number" step="any" min="0" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} required />
                </Field>
                <Field label={i === 0 ? 'Unit price (PKR)' : ''}>
                  <Input type="number" step="any" min="0" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} />
                </Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 text-right text-sm">
            Total: <b>{fmtPkr(total)}</b>
          </div>
        </Section>
        {reasons.length > 0 && <Blockers reasons={reasons} title="Order rejected by business rules" />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create purchase order
          </Button>
        </div>
      </form>
    </>
  );
}
