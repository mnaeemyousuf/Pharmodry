'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/utils';
import { Empty } from '@/components/page';

interface Version {
  id: string;
  version: number;
  reason?: string;
  createdAt: string;
  snapshot: Record<string, unknown>;
}

/** Immutable version history of regulated master data. */
export function VersionHistory({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data } = useQuery({ queryKey: ['versions', entityType, entityId], queryFn: () => api.get<Version[]>(`/master-data/versions/${entityType}/${entityId}`) });
  if (!data?.length) return <Empty>No versions recorded.</Empty>;
  return (
    <ol className="space-y-2">
      {data.map((v) => (
        <li key={v.id} className="rounded-md border p-3 text-[13px]">
          <div className="flex items-center justify-between">
            <b>Version {v.version}</b>
            <span className="text-xs text-muted-foreground">{fmtDateTime(v.createdAt)}</span>
          </div>
          {v.reason && <div className="text-muted-foreground">Reason: {v.reason}</div>}
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-primary">View snapshot</summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(v.snapshot, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ol>
  );
}
