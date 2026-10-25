'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { statusOptions } from '@/lib/hooks';
import { fmtDate } from '@/lib/utils';
import type { Capa } from '@/lib/types';
import { Button, Card } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

interface Kpis { open: number; overdue: number; avgClosureDays: number | null; effectivenessFailureRatePct: number | null; byDepartment: { department: string; open: number }[] }

function CapaInner() {
  const { can } = useAuth();
  const params = useSearchParams();
  const { data: k } = useQuery({ queryKey: ['capa-kpis'], queryFn: () => api.get<Kpis>('/analytics/capa-kpis') });
  return (
    <>
      <PageHeader
        title="CAPA"
        description="Corrective and preventive actions from deviations, OOS, OOT, audits, complaints, supplier issues and recalls. Closure requires a successful effectiveness check and QA e-signature."
        actions={
          can('capa.create') && (
            <Button asChild>
              <Link href="/quality/capa/new">
                <Plus /> New CAPA
              </Link>
            </Button>
          )
        }
      />
      {k && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Open', k.open],
            ['Overdue', k.overdue],
            ['Avg closure time', k.avgClosureDays === null ? '—' : `${k.avgClosureDays} d`],
            ['Effectiveness failure rate', k.effectivenessFailureRatePct === null ? '—' : `${k.effectivenessFailureRatePct}%`],
            ['By department', k.byDepartment.map((d) => `${d.department}: ${d.open}`).join(' · ') || '—'],
          ].map(([l, v]) => (
            <Card key={l as string} className="p-3">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="mt-1 text-lg font-semibold">{v}</div>
            </Card>
          ))}
        </div>
      )}
      <DataTable<Capa>
        id="capas"
        endpoint="/capas"
        defaultView={params.get('view') ?? 'open'}
        views={[
          { value: 'open', label: 'Open' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'all', label: 'All' },
        ]}
        searchPlaceholder="Number or problem statement"
        filters={[
          { param: 'status', label: 'Status', options: statusOptions(['OPEN', 'IN_PROGRESS', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED']) },
          { param: 'severity', label: 'Priority', options: statusOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) },
          { param: 'type', label: 'Source', options: statusOptions(['DEVIATION', 'OOS', 'OOT', 'AUDIT', 'COMPLAINT', 'SUPPLIER', 'RECALL', 'OTHER']) },
        ]}
        rowHref={(r) => `/quality/capa/${r.id}`}
        columns={[
          { key: 'number', header: 'CAPA', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'problem', header: 'Problem', cell: (r) => <span className="line-clamp-1 max-w-md">{r.problemStatement}</span>, csv: (r) => r.problemStatement },
          { key: 'source', header: 'Source', cell: (r) => r.source.toLowerCase(), csv: (r) => r.source },
          { key: 'priority', header: 'Priority', sort: 'priority', cell: (r) => <StatusBadge status={r.priority} />, csv: (r) => r.priority },
          { key: 'status', header: 'Status', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'actions', header: 'Actions', cell: (r) => `${r.actionsDone}/${r.actionsTotal}` },
          { key: 'owner', header: 'Owner', cell: (r) => r.ownerName, csv: (r) => r.ownerName },
          { key: 'due', header: 'Due', sort: 'dueDate', cell: (r) => <span className={r.overdue ? 'font-semibold text-danger' : ''}>{fmtDate(r.dueDate)}{r.overdue ? ' · overdue' : ''}</span>, csv: (r) => r.dueDate },
        ]}
      />
    </>
  );
}

export default function CapaListPage() {
  return (
    <Suspense>
      <CapaInner />
    </Suspense>
  );
}
