'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useProducts } from '@/lib/hooks';
import { toIsoDate } from '@/lib/utils';
import { Button, Input, Select } from '@/components/ui/primitives';
import { Field, PageHeader, Section } from '@/components/page';

export default function NewPlanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: products } = useProducts();
  const now = new Date();
  const [h, setH] = React.useState({
    siteId: user?.sites[0]?.id ?? '',
    name: `Production plan ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
    periodStart: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    periodEnd: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  });
  const [lines, setLines] = React.useState([{ productId: '', plannedBatches: '1', plannedQuantity: '', demandQuantity: '' }]);
  const [busy, setBusy] = React.useState(false);

  const setLine = (i: number, patch: Partial<(typeof lines)[number]>) =>
    setLines(
      lines.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        const p = products?.find((x) => x.id === next.productId);
        if (p && (patch.productId !== undefined || patch.plannedBatches !== undefined)) next.plannedQuantity = String(Number(next.plannedBatches || 0) * p.standardBatchSize);
        return next;
      }),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const plan = await api.post<{ id: string; number: string }>('/production-plans', {
        ...h,
        periodStart: new Date(h.periodStart).toISOString(),
        periodEnd: new Date(h.periodEnd).toISOString(),
        lines: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, plannedBatches: Number(l.plannedBatches), plannedQuantity: Number(l.plannedQuantity), demandQuantity: Number(l.demandQuantity || 0) })),
      });
      toast.success(`${plan.number} created as draft`);
      router.push(`/production/plans/${plan.id}`);
    } catch (e2) {
      toast.error(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New production plan" crumbs={[{ label: 'Production plans', href: '/production/plans' }, { label: 'New' }]} />
      <form onSubmit={submit} className="space-y-4">
        <Section title="Plan">
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
            <Field label="Name" required>
              <Input value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} required />
            </Field>
            <Field label="Period start" required>
              <Input type="date" value={h.periodStart} onChange={(e) => setH({ ...h, periodStart: e.target.value })} required />
            </Field>
            <Field label="Period end" required>
              <Input type="date" value={h.periodEnd} onChange={(e) => setH({ ...h, periodEnd: e.target.value })} required />
            </Field>
          </div>
        </Section>
        <Section
          title="Products"
          description="Planned quantity defaults to batches × standard batch size."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { productId: '', plannedBatches: '1', plannedQuantity: '', demandQuantity: '' }])}>
              <Plus /> Add product
            </Button>
          }
        >
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_160px_160px_40px] items-end gap-2">
                <Field label={i === 0 ? 'Product' : ''}>
                  <Select value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })} required>
                    <option value="">Select…</option>
                    {products?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.genericName} {p.strength}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={i === 0 ? 'Batches' : ''}>
                  <Input type="number" min={1} value={l.plannedBatches} onChange={(e) => setLine(i, { plannedBatches: e.target.value })} required />
                </Field>
                <Field label={i === 0 ? 'Planned quantity' : ''}>
                  <Input type="number" min={1} value={l.plannedQuantity} onChange={(e) => setLine(i, { plannedQuantity: e.target.value })} required />
                </Field>
                <Field label={i === 0 ? 'Demand (forecast)' : ''}>
                  <Input type="number" min={0} value={l.demandQuantity} onChange={(e) => setLine(i, { demandQuantity: e.target.value })} />
                </Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove">
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </Section>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create plan
          </Button>
        </div>
      </form>
    </>
  );
}
