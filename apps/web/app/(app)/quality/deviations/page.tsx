'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { statusOptions } from '@/lib/hooks';
import { fmtDate } from '@/lib/utils';
import type { Deviation } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

const AGING_TONE = { NORMAL: 'success', ATTENTION: 'warning', OVERDUE: 'danger', CLOSED: 'muted' } as const;

function DeviationsInner() {
  const { can } = useAuth();
  const params = useSearchParams();
  return (
    <>
      <PageHeader
        title="Deviations"
        description="Draft → Submitted → QA review → Investigation → Root cause → CAPA → Effectiveness check → QA closure. Aging: 0–15 days normal, 16–30 attention, > 30 overdue (configurable)."
        actions={
          can('deviation.create') && (
            <Button asChild>
              <Link href="/quality/deviations/new">
                <Plus /> Raise deviation
              </Link>
            </Button>
          )
        }
      />
      <DataTable<Deviation>
        id="deviations"
        endpoint="/deviations"
        defaultView={params.get('view') ?? 'open'}
        views={[
          { value: 'open', label: 'Open' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'all', label: 'All' },
        ]}
        searchPlaceholder="Number, title or description"
        filters={[
          { param: 'status', label: 'Status', options: statusOptions(['DRAFT', 'SUBMITTED', 'QA_REVIEW', 'INVESTIGATION', 'ROOT_CAUSE', 'CAPA', 'EFFECTIVENESS_CHECK', 'CLOSED', 'CANCELLED']) },
          { param: 'severity', label: 'Classification', options: statusOptions(['MINOR', 'MAJOR', 'CRITICAL']) },
          { param: 'type', label: 'Process stage', options: statusOptions(['DISPENSING', 'GRANULATION', 'COMPRESSION', 'ENCAPSULATION', 'PACKING', 'WAREHOUSE', 'LABORATORY']) },
        ]}
        rowHref={(r) => `/quality/deviations/${r.id}`}
        columns={[
          { key: 'number', header: 'Deviation', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'title', header: 'Title', cell: (r) => <span className="line-clamp-1 max-w-md">{r.title}</span>, csv: (r) => r.title },
          { key: 'class', header: 'Class', sort: 'classification', cell: (r) => <StatusBadge status={r.classification ?? r.proposedSeverity} label={r.classification ? undefined : r.proposedSeverity ? `${r.proposedSeverity.toLowerCase()} (proposed)` : undefined} />, csv: (r) => r.classification },
          { key: 'status', header: 'Status', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'aging', header: 'Aging', cell: (r) => <StatusBadge status={r.aging} tone={AGING_TONE[r.aging as keyof typeof AGING_TONE]} label={r.aging === 'CLOSED' ? 'Closed' : `${r.ageDays} d · ${r.aging.toLowerCase()}`} />, csv: (r) => r.ageDays },
          { key: 'stage', header: 'Stage', cell: (r) => r.category?.toLowerCase() ?? '—', csv: (r) => r.category },
          { key: 'batch', header: 'Batch', cell: (r) => <span className="font-mono text-xs">{r.batchNumber ?? '—'}</span>, csv: (r) => r.batchNumber },
          { key: 'owner', header: 'Owner', cell: (r) => r.ownerName ?? '—', csv: (r) => r.ownerName },
          { key: 'due', header: 'Due', sort: 'dueDate', cell: (r) => fmtDate(r.dueDate), csv: (r) => r.dueDate },
        ]}
      />
    </>
  );
}

export default function DeviationsPage() {
  return (
    <Suspense>
      <DeviationsInner />
    </Suspense>
  );
}
