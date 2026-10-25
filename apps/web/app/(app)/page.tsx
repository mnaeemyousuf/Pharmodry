'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import type { PermissionCode } from '@pharmodry/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, relativeDays } from '@/lib/utils';
import type { Batch, Capa, Deviation, Lot, Oos, PurchaseOrder, Sample } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

interface Queue<T> {
  key: string;
  title: string;
  hint: string;
  perm: PermissionCode | PermissionCode[];
  endpoint: string;
  params: Record<string, string | undefined>;
  href: string;
  row: (r: T) => { href: string; title: React.ReactNode; sub: React.ReactNode; status?: string };
}

function QueueCard<T extends { id: string }>({ q }: { q: Queue<T> }) {
  const { data, isLoading } = useQuery({ queryKey: ['queue', q.key, q.params], queryFn: () => api.page<T>(q.endpoint, { ...q.params, pageSize: 6 }) });
  const total = data?.meta?.total ?? 0;
  return (
    <Card className="flex flex-col" data-testid={`queue-${q.key}`}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            {q.title}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular">{isLoading ? '…' : total}</span>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{q.hint}</p>
        </div>
        <Link href={q.href} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && total === 0 && <p className="py-4 text-sm text-muted-foreground">Nothing waiting. ✓</p>}
        <ul className="divide-y">
          {(data?.data ?? []).map((r) => {
            const v = q.row(r);
            return (
              <li key={r.id}>
                <Link href={v.href} className="flex items-center gap-3 py-2 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{v.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{v.sub}</div>
                  </div>
                  {v.status && <StatusBadge status={v.status} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function MyWorkPage() {
  const { user, can } = useAuth();
  if (!user) return null;
  const queues: Queue<never>[] = [
    {
      key: 'qa-release-batches',
      title: 'Batches awaiting QA release',
      hint: 'Review the batch record and QC results, then release or reject with e-signature.',
      perm: 'batch.approve',
      endpoint: '/batches',
      params: { view: 'awaitingQa' },
      href: '/quality/release',
      row: (b: Batch) => ({ href: `/production/batches/${b.id}`, title: b.batchNumber, sub: `${b.product.genericName} ${b.product.strength}`, status: b.status }),
    },
    {
      key: 'lots-disposition',
      title: 'Material lots awaiting QA disposition',
      hint: 'Quarantined lots — release only after approved, passing QC.',
      perm: 'inventory.release',
      endpoint: '/inventory/lots',
      params: { view: 'awaitingDisposition' },
      href: '/quality/release',
      row: (l: Lot) => ({ href: `/inventory/lots/${l.id}`, title: `${l.lotNumber} · ${l.item?.name ?? ''}`, sub: `${l.quantity} ${l.uomCode} · received ${fmtDate(l.createdAt)}`, status: l.status }),
    },
    {
      key: 'qc-samples',
      title: 'Open QC samples',
      hint: 'Collect, test, review and approve against specification.',
      perm: ['qc.sample.collect', 'qc.result.enter', 'qc.result.review', 'qc.result.approve'],
      endpoint: '/qc/samples',
      params: { view: 'open' },
      href: '/quality/samples',
      row: (s: Sample) => ({ href: `/quality/samples/${s.id}`, title: `${s.number} · ${s.subject ?? ''}`, sub: `${s.stage.replace(/_/g, ' ').toLowerCase()} · requested ${relativeDays(s.requestedAt)}`, status: s.status }),
    },
    {
      key: 'oos',
      title: 'Open OOS investigations',
      hint: 'Out-of-specification results blocking release.',
      perm: ['oos.investigate', 'oos.approve'],
      endpoint: '/oos',
      params: { view: 'open' },
      href: '/quality/oos',
      row: (o: Oos) => ({ href: `/quality/oos/${o.id}`, title: `${o.number} · ${o.testName}`, sub: `${o.actualResult} vs ${o.specification}${o.batchNumber ? ` · ${o.batchNumber}` : ''}`, status: o.status }),
    },
    {
      key: 'dev-review',
      title: 'Deviations awaiting QA review',
      hint: 'Submitted deviations to triage and classify.',
      perm: 'deviation.approve',
      endpoint: '/deviations',
      params: { status: 'SUBMITTED,QA_REVIEW' },
      href: '/quality/deviations',
      row: (d: Deviation) => ({ href: `/quality/deviations/${d.id}`, title: `${d.number} · ${d.title}`, sub: `Reported ${relativeDays(d.submittedAt ?? d.createdAt)}`, status: d.status }),
    },
    {
      key: 'dev-mine',
      title: 'Deviations I own',
      hint: 'Investigations and root-cause work assigned to you.',
      perm: 'deviation.view',
      endpoint: '/deviations',
      params: { ownerId: user.id, view: 'open' },
      href: '/quality/deviations',
      row: (d: Deviation) => ({ href: `/quality/deviations/${d.id}`, title: `${d.number} · ${d.title}`, sub: d.dueDate ? `Due ${fmtDate(d.dueDate)}${d.overdue ? ' — OVERDUE' : ''}` : '', status: d.status }),
    },
    {
      key: 'capa-mine',
      title: 'CAPAs I own',
      hint: 'Corrective and preventive actions assigned to you.',
      perm: 'capa.view',
      endpoint: '/capas',
      params: { ownerId: user.id, view: 'open' },
      href: '/quality/capa',
      row: (c: Capa) => ({ href: `/quality/capa/${c.id}`, title: `${c.number} · ${c.problemStatement}`, sub: `Due ${fmtDate(c.dueDate)}${c.overdue ? ' — OVERDUE' : ''}`, status: c.status }),
    },
    {
      key: 'batches-floor',
      title: 'Batches on the shop floor',
      hint: 'Execute and verify eBMR steps.',
      perm: ['batch.execute', 'batch.verify'],
      endpoint: '/batches',
      params: { status: 'READY,IN_PROGRESS' },
      href: '/production/batches',
      row: (b: Batch) => ({ href: `/production/batches/${b.id}`, title: b.batchNumber, sub: `${b.product.genericName} ${b.product.strength}`, status: b.status }),
    },
    {
      key: 'batches-planned',
      title: 'Planned batches to prepare',
      hint: 'Reserve (FEFO) and issue released materials.',
      perm: ['batch.reserve', 'batch.create'],
      endpoint: '/batches',
      params: { status: 'PLANNED,MATERIAL_RESERVED' },
      href: '/production/batches',
      row: (b: Batch) => ({ href: `/production/batches/${b.id}`, title: b.batchNumber, sub: `Planned start ${fmtDate(b.plannedStart)}${b.delayed ? ' — DELAYED' : ''}`, status: b.status }),
    },
    {
      key: 'po-receipt',
      title: 'Purchase orders awaiting receipt',
      hint: 'Approved orders to receive into quarantine.',
      perm: ['inventory.receive', 'procurement.po.approve'],
      endpoint: '/purchase-orders',
      params: { status: 'APPROVED,PARTIALLY_RECEIVED,DRAFT' },
      href: '/procurement/purchase-orders',
      row: (p: PurchaseOrder) => ({ href: `/procurement/purchase-orders/${p.id}`, title: `${p.number} · ${p.supplier?.name ?? ''}`, sub: p.expectedDate ? `Expected ${fmtDate(p.expectedDate)}` : '', status: p.status }),
    },
  ] as unknown as Queue<never>[];
  const visible = queues.filter((q) => can(q.perm));
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Karachi' }));
  return (
    <>
      <PageHeader title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${user.fullName.split(' ').slice(user.fullName.startsWith('Dr.') ? 1 : 0, user.fullName.startsWith('Dr.') ? 2 : 1).join(' ')}`} description={`${user.title ?? ''} · ${user.tenantName}. Your work queues are listed below, based on your role permissions.`} />
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">You have no work queues. Use the navigation to view the records you have access to.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((q) => (
            <QueueCard key={q.key} q={q} />
          ))}
        </div>
      )}
    </>
  );
}
