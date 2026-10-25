'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { humanize } from '@pharmodry/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/utils';
import { Button, Input } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Callout, ChangeList, PageHeader } from '@/components/page';

interface AuditRow {
  id: string;
  seq: string;
  occurredAt: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityLabel?: string;
  entityId?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
  signatureId?: string;
  ip?: string;
  hash: string;
}

const ACTIONS = ['CREATE', 'UPDATE', 'VOID', 'APPROVE', 'REJECT', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'EXPORT', 'SIGN', 'STATUS_CHANGE', 'CORRECTION'];
const ENTITIES = ['Batch', 'BatchStep', 'InventoryLot', 'GoodsReceipt', 'QcSample', 'QcResult', 'OosInvestigation', 'Deviation', 'Capa', 'PurchaseOrder', 'ProductionPlan', 'Product', 'Material', 'Supplier', 'Equipment', 'QcSpecification', 'User', 'Role', 'TenantSettings'];

export default function AuditTrailPage() {
  const { can } = useAuth();
  const [range, setRange] = React.useState({ from: '', to: '' });
  const { data: verify, refetch, isFetching } = useQuery({ queryKey: ['audit-verify'], queryFn: () => api.get<{ valid: boolean; checked: number; brokenAt?: { seq: string } }>('/audit/verify'), enabled: false });
  const params = { from: range.from ? new Date(range.from).toISOString() : undefined, to: range.to ? new Date(`${range.to}T23:59:59`).toISOString() : undefined };
  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Centralised, append-only record of who did what, when, with previous and new values, reasons and e-signatures. Entries cannot be edited or deleted from the application, and the database rejects any attempt to modify them."
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()} loading={isFetching} data-testid="audit-verify">
              <ShieldCheck /> Verify integrity
            </Button>
            {can('audit.export') && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api.download('/audit/export', params);
                    toast.success('Audit trail exported (the export itself is audited)');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                <Download /> Export CSV
              </Button>
            )}
          </>
        }
      />
      {verify && (
        <div className="mb-4">
          {verify.valid ? (
            <Callout tone="success" title="Hash chain verified">
              {verify.checked.toLocaleString()} events re-hashed; every event links to its predecessor. No tampering detected.
            </Callout>
          ) : (
            <Callout tone="danger" title="Integrity failure">
              <span className="inline-flex items-center gap-1">
                <ShieldX className="h-4 w-4" /> Chain broken at sequence {verify.brokenAt?.seq}. Escalate to QA and IT immediately.
              </span>
            </Callout>
          )}
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          From
          <Input type="date" className="mt-1 w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <Input type="date" className="mt-1 w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </label>
      </div>
      <DataTable<AuditRow>
        id="audit"
        endpoint="/audit/events"
        params={params}
        pageSize={50}
        searchPlaceholder="Record, user, reason…"
        filters={[
          { param: 'action', label: 'Action', options: ACTIONS.map((a) => ({ value: a, label: humanize(a) })) },
          { param: 'entityType', label: 'Record type', options: ENTITIES.map((a) => ({ value: a, label: a })) },
        ]}
        columns={[
          { key: 'seq', header: '#', className: 'tabular text-muted-foreground', cell: (r) => r.seq, csv: (r) => r.seq },
          { key: 'when', header: 'Timestamp', cell: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.occurredAt)}</span>, csv: (r) => r.occurredAt },
          { key: 'user', header: 'User', cell: (r) => r.userName ?? r.userEmail ?? 'System', csv: (r) => r.userName ?? r.userEmail },
          { key: 'action', header: 'Action', cell: (r) => <StatusBadge status={r.action} tone={r.action === 'SIGN' || r.action === 'APPROVE' ? 'success' : r.action === 'REJECT' || r.action === 'LOGIN_FAILED' ? 'danger' : r.action === 'CORRECTION' ? 'warning' : 'neutral'} label={humanize(r.action)} />, csv: (r) => r.action },
          { key: 'record', header: 'Record', cell: (r) => <span>{r.entityType} <span className="font-mono text-xs">{r.entityLabel ?? ''}</span></span>, csv: (r) => `${r.entityType} ${r.entityLabel ?? ''}` },
          { key: 'change', header: 'Change', className: 'min-w-[320px]', cell: (r) => <ChangeList previous={r.previousValue} next={r.newValue} />, csv: (r) => JSON.stringify(r.newValue) },
          { key: 'reason', header: 'Reason', cell: (r) => <span className="text-xs">{r.reason ?? ''}</span>, csv: (r) => r.reason },
          { key: 'ip', header: 'IP', cell: (r) => r.ip ?? '', hidden: true },
          { key: 'hash', header: 'Hash', cell: (r) => <span className="font-mono text-[10px] text-muted-foreground">{r.hash.slice(0, 10)}…</span>, hidden: true },
        ]}
      />
    </>
  );
}
