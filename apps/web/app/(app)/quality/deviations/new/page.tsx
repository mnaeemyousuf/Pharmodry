'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deviationCreateSchema, type DeviationCreateInput } from '@pharmodry/validation';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useEquipment, useMaterials, useProducts } from '@/lib/hooks';
import type { Batch } from '@/lib/types';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { Field, PageHeader, Section } from '@/components/page';

const STAGES = ['DISPENSING', 'GRANULATION', 'DRYING', 'COMPRESSION', 'COATING', 'ENCAPSULATION', 'BLENDING', 'PACKING', 'WAREHOUSE', 'LABORATORY', 'UTILITIES', 'OTHER'];

function NewDeviationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { data: products } = useProducts();
  const { data: materials } = useMaterials();
  const { data: equipment } = useEquipment();
  const { data: batches } = useQuery({ queryKey: ['batches-for-dev'], queryFn: () => api.page<Batch>('/batches', { pageSize: 100 }).then((r) => r.data) });
  const oosId = params.get('oosId') ?? undefined;
  const form = useForm<DeviationCreateInput>({
    resolver: zodResolver(deviationCreateSchema),
    defaultValues: {
      siteId: user?.sites[0]?.id ?? '',
      title: '',
      description: '',
      immediateAction: '',
      occurredAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
      category: '',
      batchId: params.get('batchId') ?? '',
      productId: '',
      materialId: '',
      equipmentId: '',
    },
  });
  const e = form.formState.errors;
  const submit = (submitNow: boolean) =>
    form.handleSubmit(async (v) => {
      try {
        const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined));
        const d = await api.post<{ id: string; number: string }>('/deviations', { ...clean, occurredAt: new Date(v.occurredAt).toISOString(), oosId, submit: submitNow });
        toast.success(`${d.number} ${submitNow ? 'submitted to QA' : 'saved as draft'}`);
        router.push(`/quality/deviations/${d.id}`);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    })();
  return (
    <>
      <PageHeader title="Raise a deviation" crumbs={[{ label: 'Deviations', href: '/quality/deviations' }, { label: 'New' }]} description="Record what happened as soon as possible. QA classifies severity (minor / major / critical) during review." />
      <form className="space-y-4" onSubmit={(ev) => ev.preventDefault()} noValidate>
        <Section title="What happened">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required error={e.title?.message} className="md:col-span-2">
              <Input {...form.register('title')} data-testid="dev-title" />
            </Field>
            <Field label="Description" required error={e.description?.message} className="md:col-span-2" hint="Facts only: what, where, when, how detected, quantities affected.">
              <Textarea rows={4} {...form.register('description')} data-testid="dev-description" />
            </Field>
            <Field label="Immediate action taken" required error={e.immediateAction?.message} className="md:col-span-2">
              <Textarea rows={2} {...form.register('immediateAction')} data-testid="dev-action" />
            </Field>
            <Field label="Occurred at" required error={e.occurredAt?.message}>
              <Input type="datetime-local" {...form.register('occurredAt')} />
            </Field>
            <Field label="Proposed severity" error={e.proposedSeverity?.message}>
              <Select {...form.register('proposedSeverity')}>
                <option value="">Unsure</option>
                <option value="MINOR">Minor</option>
                <option value="MAJOR">Major</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </Field>
          </div>
        </Section>
        <Section title="Where & what is affected">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Site" required error={e.siteId?.message}>
              <Select {...form.register('siteId')}>
                {user?.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Process stage">
              <Select {...form.register('category')}>
                <option value="">—</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Batch">
              <Select {...form.register('batchId')}>
                <option value="">—</option>
                {batches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} ({b.status.toLowerCase()})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Product">
              <Select {...form.register('productId')}>
                <option value="">—</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.genericName} {p.strength}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Material">
              <Select {...form.register('materialId')}>
                <option value="">—</option>
                {materials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment">
              <Select {...form.register('equipmentId')}>
                <option value="">—</option>
                {equipment?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} {x.description}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {oosId && <p className="mt-3 text-xs text-muted-foreground">This deviation will be linked to the originating OOS investigation.</p>}
        </Section>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => submit(false)} loading={form.formState.isSubmitting}>
            Save draft
          </Button>
          <Button type="button" onClick={() => submit(true)} loading={form.formState.isSubmitting} data-testid="dev-submit">
            Submit to QA
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NewDeviationPage() {
  return (
    <Suspense>
      <NewDeviationInner />
    </Suspense>
  );
}
