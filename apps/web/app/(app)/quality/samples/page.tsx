'use client';

import { statusOptions } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/utils';
import type { Sample } from '@/lib/types';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page';

export default function SamplesPage() {
  return (
    <>
      <PageHeader title="QC samples" description="Sample request → collection → testing → submission → review → approval (e-signature). Results outside specification are flagged as OOS candidates and open an investigation automatically." />
      <DataTable<Sample>
        id="samples"
        endpoint="/qc/samples"
        defaultView="open"
        views={[
          { value: 'open', label: 'Open' },
          { value: 'all', label: 'All' },
        ]}
        searchPlaceholder="Sample number"
        filters={[
          { param: 'status', label: 'Status', options: statusOptions(['REQUESTED', 'COLLECTED', 'IN_TESTING', 'SUBMITTED', 'REVIEWED', 'APPROVED']) },
          { param: 'stage', label: 'Stage', options: statusOptions(['RAW_MATERIAL', 'PACKAGING_MATERIAL', 'IN_PROCESS', 'FINISHED_PRODUCT']) },
        ]}
        rowHref={(r) => `/quality/samples/${r.id}`}
        columns={[
          { key: 'number', header: 'Sample', sort: 'number', cell: (r) => <span className="font-mono">{r.number}</span>, csv: (r) => r.number },
          { key: 'subject', header: 'Subject', cell: (r) => r.subject, csv: (r) => r.subject },
          { key: 'ref', header: 'Lot / batch', cell: (r) => <span className="font-mono text-xs">{r.batch?.batchNumber ?? r.lot?.lotNumber ?? '—'}</span> },
          { key: 'stage', header: 'Stage', cell: (r) => r.stage.replace(/_/g, ' ').toLowerCase(), csv: (r) => r.stage },
          { key: 'status', header: 'Status', sort: 'status', cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
          { key: 'conclusion', header: 'Conclusion', cell: (r) => (r.conclusion ? <StatusBadge status={r.conclusion} /> : '—'), csv: (r) => r.conclusion },
          { key: 'spec', header: 'Specification', cell: (r) => `${r.specification?.code} v${r.specification?.version}`, hidden: true },
          { key: 'requested', header: 'Requested', sort: 'requestedAt', cell: (r) => fmtDateTime(r.requestedAt), csv: (r) => r.requestedAt },
        ]}
      />
    </>
  );
}
