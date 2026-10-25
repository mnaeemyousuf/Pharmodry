'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMaterials } from '@/lib/hooks';
import { fmtDate } from '@/lib/utils';
import type { Supplier } from '@/lib/types';
import { Button, Card, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActionDialog, AuditHistory, DetailHeader, Empty, Field, KeyValues, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Attachments } from '@/components/attachments';
import { VersionHistory } from '@/components/versions';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: s } = useQuery({ queryKey: ['supplier', id], queryFn: () => api.get<Supplier>(`/suppliers/${id}`) });
  const { data: materials } = useMaterials();
  const [dialog, setDialog] = React.useState<null | 'status' | 'material'>(null);
  const [f, setF] = React.useState({ status: '', requalificationDate: '', reason: '', materialId: '', manufacturerName: '' });
  if (!s) return <Skeleton className="h-96" />;
  const sc = s.scorecard;
  const refresh = () => ['supplier', 'audit', 'versions', 'suppliers-all'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const kpi = (label: string, v: React.ReactNode, hint?: string) => (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular">{v}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Suppliers', href: '/master-data/suppliers' }, { label: s.code }]}
        title={s.code}
        status={s.status}
        subtitle={`${s.name} · ${s.country}`}
        meta={[
          { label: 'Contact', value: s.contactName },
          { label: 'Email', value: s.email },
          { label: 'Phone', value: s.phone },
          { label: 'Qualified', value: fmtDate(s.qualificationDate) },
          { label: 'Requalification due', value: fmtDate(s.requalificationDate) },
          { label: 'Version', value: `v${s.version}` },
        ]}
        actions={
          <>
            {can('supplier.approve') && (
              <>
                <Button variant="outline" onClick={() => { setF({ ...f, status: s.status, reason: '' }); setDialog('status'); }}>
                  <BadgeCheck /> Change qualification status
                </Button>
                <Button variant="outline" onClick={() => { setF({ ...f, materialId: '', reason: '' }); setDialog('material'); }}>
                  <Plus /> Approve material
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpi('Quality score', sc?.qualityScore ?? '—', 'Mean of OTD, acceptance, documentation')}
        {kpi('On-time delivery', sc?.onTimeDeliveryPct === null || sc?.onTimeDeliveryPct === undefined ? '—' : `${sc.onTimeDeliveryPct}%`, 'GRN date ≤ PO expected date')}
        {kpi('QC rejection rate', sc?.qcRejectionPct === null || sc?.qcRejectionPct === undefined ? '—' : `${sc.qcRejectionPct}%`, `${sc?.lotsRejected ?? 0} of ${sc?.lotsReceived ?? 0} lots`)}
        {kpi('Avg lead time', sc?.avgLeadTimeDays === null || sc?.avgLeadTimeDays === undefined ? '—' : `${sc.avgLeadTimeDays} d`, 'PO → GRN')}
        {kpi('Related deviations', sc?.deviationCount ?? 0)}
        {kpi('Documentation compliance', sc?.documentationCompliancePct === null || sc?.documentationCompliancePct === undefined ? '—' : `${sc.documentationCompliancePct}%`, 'Unexpired certificates')}
      </div>
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Approved materials</TabsTrigger>
          <TabsTrigger value="certs">Certifications</TabsTrigger>
          <TabsTrigger value="receipts">Recent receipts</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="versions">Version history</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <Section title="Approved materials">
            {s.materials?.length ? (
              s.materials.map((m) => (
                <Link key={m.id} href={`/master-data/materials/${m.material.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-mono text-[13px]">{m.material.code}</span>
                  <span className="text-[13px]">{m.material.name}</span>
                  <StatusBadge status={m.approved ? 'APPROVED' : 'SUSPENDED'} />
                  {m.manufacturerName && <span className="ml-auto text-xs text-muted-foreground">Manufacturer: {m.manufacturerName}</span>}
                </Link>
              ))
            ) : (
              <Empty>No materials approved for this supplier.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="certs">
          <Section title="Certifications">
            {s.certifications.length ? (
              <table className="w-full text-[13px]">
                <tbody>
                  {s.certifications.map((c, i) => {
                    const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 font-medium">{c.name}</td>
                        <td className="py-2">{c.number}</td>
                        <td className="py-2">expires {fmtDate(c.expiresAt)}</td>
                        <td className="py-2">{expired ? <StatusBadge status="EXPIRED" /> : <StatusBadge status="ACTIVE" label="Valid" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty>No certifications recorded.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="receipts">
          <Section title="Recent goods receipts">
            {s.recentReceipts?.length ? (
              s.recentReceipts.map((r) => (
                <Link key={r.id} href={`/inventory/receipts/${r.id}`} className="mb-2 flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/50">
                  <span className="font-mono text-[13px]">{r.number}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(r.receivedAt)}</span>
                  <StatusBadge status={r.status} />
                </Link>
              ))
            ) : (
              <Empty>No receipts recorded in Pharmodry yet.</Empty>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="docs">
          <Section title="Qualification documents" description="Audit reports, questionnaires, certificates.">
            <Attachments entityType="Supplier" entityId={s.id} canUpload={can('supplier.manage')} />
          </Section>
        </TabsContent>
        <TabsContent value="versions">
          <Section title="Version history">
            <VersionHistory entityType="Supplier" entityId={s.id} />
          </Section>
        </TabsContent>
        <TabsContent value="audit">
          <Section title="Audit trail">
            <AuditHistory entityId={s.id} />
          </Section>
        </TabsContent>
      </Tabs>
      <Section title="Address" className="mt-4">
        <KeyValues items={[{ label: 'Address', value: s.address }]} />
      </Section>
      <ActionDialog
        open={dialog === 'status'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Change qualification status"
        description="Only APPROVED or CONDITIONALLY APPROVED suppliers can be used for purchase orders and goods receipts."
        submitLabel="Change status"
        onSubmit={async () => {
          await api.post(`/suppliers/${id}/status`, { status: f.status, reason: f.reason, requalificationDate: f.requalificationDate ? new Date(f.requalificationDate).toISOString() : undefined });
          toast.success('Supplier status changed');
          refresh();
        }}
      >
        <Field label="New status" required>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {['PENDING_QUALIFICATION', 'APPROVED', 'CONDITIONALLY_APPROVED', 'SUSPENDED', 'BLACKLISTED'].map((x) => (
              <option key={x} value={x}>
                {x.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Requalification date">
          <Input type="date" value={f.requalificationDate} onChange={(e) => setF({ ...f, requalificationDate: e.target.value })} />
        </Field>
        <Field label="Reason / basis (audit, questionnaire, sample evaluation…)" required>
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'material'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve material for this supplier"
        submitLabel="Approve"
        onSubmit={async () => {
          await api.post(`/suppliers/${id}/materials`, { materialId: f.materialId, manufacturerName: f.manufacturerName || undefined, reason: f.reason });
          toast.success('Material approved for supplier');
          refresh();
        }}
      >
        <Field label="Material" required>
          <Select value={f.materialId} onChange={(e) => setF({ ...f, materialId: e.target.value })} required>
            <option value="">Select…</option>
            {materials?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Manufacturer (if different from supplier)">
          <Input value={f.manufacturerName} onChange={(e) => setF({ ...f, manufacturerName: e.target.value })} />
        </Field>
        <Field label="Reason / basis" required>
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
    </>
  );
}
