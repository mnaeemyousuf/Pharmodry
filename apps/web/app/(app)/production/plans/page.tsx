'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { statusOptions } from '@/lib/hooks';
import { cn, fmtDate, fmtNum } from '@/lib/utils';
import type { Plan } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

export default function PlansPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Production plans"
        description="Plan quantities and batches per product. Achievement = released batch output ÷ planned quantity."
        actions={
          can('production.plan.manage') && (
            <Button asChild>
              <Link href="/production/plans/new">
                <Plus /> New plan
              </Link>
            </Button>
          )
        }
      />
      <DataTable<Plan>
        id="plans"
        endpoint="/production-plans"
        filters={[{ param: 'status', label: 'Status', options: statusOptions(['DRAFT', 'APPROVED', 'CLOSED']) }]}
        rowHref={(r) => `/production/plans/${r.id}`}
        columns={[
          { key: 'number', header: 'Plan', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'name', header: 'Name', cell: (r) => r.name, csv: (r) => r.name },
          { key: 'period', header: 'Period', sort: 'periodStart', cell: (r) => `${fmtDate(r.periodStart)} – ${fmtDate(r.periodEnd)}` },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'batches', header: 'Batches (released / created / planned)', cell: (r) => `${r.progress.batchesReleased} / ${r.progress.batchesCreated} / ${r.progress.batchesPlanned}` },
          { key: 'planned', header: 'Planned qty', className: 'text-right tabular', cell: (r) => fmtNum(r.progress.plannedQuantity), csv: (r) => r.progress.plannedQuantity },
          {
            key: 'ach',
            header: 'Achievement',
            className: 'w-48',
            cell: (r) => (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', r.progress.achievementPct >= 95 ? 'bg-success' : r.progress.achievementPct >= 70 ? 'bg-warning' : 'bg-danger')} style={{ width: `${Math.min(100, r.progress.achievementPct)}%` }} />
                </div>
                <span className="w-12 text-right text-xs tabular">{r.progress.achievementPct}%</span>
              </div>
            ),
            csv: (r) => r.progress.achievementPct,
          },
        ]}
      />
    </>
  );
}
