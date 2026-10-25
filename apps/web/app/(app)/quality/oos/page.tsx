'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmtDate } from '@/lib/utils';
import type { Oos } from '@/lib/types';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

function OosInner() {
  const params = useSearchParams();
  return (
    <>
      <PageHeader title="OOS investigations" description="Out-of-specification results are reported automatically when a QC result falls outside its specification. Investigations progress through defined phases; the conclusion is a QA decision with e-signature." />
      <DataTable<Oos>
        id="oos"
        endpoint="/oos"
        defaultView={params.get('view') ?? 'open'}
        views={[
          { value: 'open', label: 'Open' },
          { value: 'all', label: 'All' },
        ]}
        searchPlaceholder="OOS number or test"
        rowHref={(r) => `/quality/oos/${r.id}`}
        columns={[
          { key: 'number', header: 'OOS', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'test', header: 'Test', cell: (r) => r.testName, csv: (r) => r.testName },
          { key: 'result', header: 'Result vs spec', cell: (r) => <span><b className="text-danger">{r.actualResult}</b> <span className="text-muted-foreground">(spec {r.specification})</span></span>, csv: (r) => `${r.actualResult} / ${r.specification}` },
          { key: 'ref', header: 'Batch / lot', cell: (r) => <span className="font-mono text-xs">{r.batchNumber ?? r.lotNumber ?? '—'}</span> },
          { key: 'status', header: 'Phase', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'conclusion', header: 'Conclusion', cell: (r) => (r.conclusion ? <StatusBadge status={r.conclusion} /> : '—'), csv: (r) => r.conclusion },
          { key: 'owner', header: 'Owner', cell: (r) => r.ownerName ?? 'Unassigned', csv: (r) => r.ownerName },
          { key: 'due', header: 'Due', sort: 'dueDate', cell: (r) => <span className={r.overdue ? 'font-semibold text-danger' : ''}>{fmtDate(r.dueDate)}</span>, csv: (r) => r.dueDate },
        ]}
      />
    </>
  );
}

export default function OosPage() {
  return (
    <Suspense>
      <OosInner />
    </Suspense>
  );
}
