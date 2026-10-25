'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { describeSpec } from '@pharmodry/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import type { Spec } from '@/lib/types';
import { Card, Input, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

export default function SpecificationsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['specs'], queryFn: () => api.get<Spec[]>('/specifications') });
  const [q, setQ] = React.useState('');
  const rows = (data ?? []).filter((s) => !q || `${s.code} ${s.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="QC specifications" description="Versioned acceptance criteria. Results are evaluated against a snapshot of the specification at the time of entry; superseded versions remain on record." />
      <Input className="mb-3 max-w-xs" placeholder="Filter specifications…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Link href={`/master-data/specifications/${s.id}`} className="font-mono font-medium text-primary hover:underline">
                  {s.code} v{s.version}
                </Link>
                <StatusBadge status={s.status} />
                <span className="text-xs text-muted-foreground">{s.stage.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="ml-auto text-xs text-muted-foreground">{fmtDate(s.createdAt)}</span>
              </div>
              <div className="mb-2 text-[13px]">{s.name}</div>
              <table className="w-full text-[12.5px]">
                <tbody>
                  {s.tests.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-1 pr-2">{t.name}</td>
                      <td className="py-1 text-muted-foreground">{describeSpec({ ...t, minValue: t.minValue ?? null, maxValue: t.maxValue ?? null })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
