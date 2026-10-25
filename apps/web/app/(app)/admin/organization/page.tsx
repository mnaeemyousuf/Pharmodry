'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Play } from 'lucide-react';
import { toast } from 'sonner';
import type { TenantSettings } from '@pharmodry/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSites, useWarehouses } from '@/lib/hooks';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActionDialog, Callout, Field, KeyValues, PageHeader, Section } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';

interface Tenant { id: string; code: string; name: string; legalName?: string; country: string; regulator: string; timezone: string; currency: string; settings: TenantSettings }

export default function OrganizationPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: t } = useQuery({ queryKey: ['tenant'], queryFn: () => api.get<Tenant>('/organization') });
  const { data: sites } = useSites();
  const { data: warehouses } = useWarehouses();
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<{ id: string; code: string; name: string }[]>('/departments') });
  const [s, setS] = React.useState<TenantSettings | null>(null);
  const [reason, setReason] = React.useState('');
  const [dialog, setDialog] = React.useState<null | 'site' | 'wh' | 'bin' | 'dept'>(null);
  const [f, setF] = React.useState({ code: '', name: '', city: '', siteId: '', type: 'RAW_MATERIAL', warehouseId: '', description: '' });
  React.useEffect(() => {
    if (t) setS(t.settings);
  }, [t]);
  const refresh = () => ['tenant', 'sites', 'warehouses', 'departments'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (!t || !s) return null;
  const num = (v: string) => Number(v);
  return (
    <>
      <PageHeader title="Organisation" description={`${t.legalName ?? t.name} · regulator ${t.regulator} · ${t.country} · ${t.timezone} · ${t.currency}`} />
      <Tabs defaultValue="structure">
        <TabsList>
          <TabsTrigger value="structure">Sites & warehouses</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="policies">Policies & thresholds</TabsTrigger>
          <TabsTrigger value="jobs">Scheduled scans</TabsTrigger>
        </TabsList>
        <TabsContent value="structure" className="space-y-4">
          <Section
            title="Sites / plants"
            actions={
              can('admin.site.manage') && (
                <Button size="sm" variant="outline" onClick={() => { setF({ ...f, code: '', name: '', city: '' }); setDialog('site'); }}>
                  <Plus /> Site
                </Button>
              )
            }
          >
            <div className="grid gap-2 md:grid-cols-2">
              {sites?.map((x) => (
                <div key={x.id} className="rounded-md border p-3 text-[13px]">
                  <b>{x.code}</b> — {x.name} <span className="text-muted-foreground">{x.city}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title="Warehouses & bins"
            actions={
              can('admin.site.manage') && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setF({ ...f, code: '', name: '', siteId: sites?.[0]?.id ?? '' }); setDialog('wh'); }}>
                    <Plus /> Warehouse
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setF({ ...f, code: '', warehouseId: warehouses?.[0]?.id ?? '', description: '' }); setDialog('bin'); }}>
                    <Plus /> Bin
                  </Button>
                </>
              )
            }
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Warehouse</th>
                  <th className="py-2">Site</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Conditions</th>
                  <th className="py-2">Bins</th>
                </tr>
              </thead>
              <tbody>
                {warehouses?.map((w) => (
                  <tr key={w.id} className="border-b last:border-0">
                    <td className="py-2">
                      <b>{w.code}</b> {w.name}
                    </td>
                    <td className="py-2">{w.site?.code}</td>
                    <td className="py-2">
                      <StatusBadge status={w.type} tone="neutral" />
                    </td>
                    <td className="py-2 text-muted-foreground">{w.conditions}</td>
                    <td className="py-2 text-xs">{w.bins.map((b) => b.code).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </TabsContent>
        <TabsContent value="departments">
          <Section
            title="Departments"
            actions={
              can('admin.site.manage') && (
                <Button size="sm" variant="outline" onClick={() => { setF({ ...f, code: '', name: '' }); setDialog('dept'); }}>
                  <Plus /> Department
                </Button>
              )
            }
          >
            <div className="grid gap-2 md:grid-cols-3">
              {departments?.map((d) => (
                <div key={d.id} className="rounded-md border px-3 py-2 text-[13px]">
                  {d.name} <span className="text-xs text-muted-foreground">{d.code}</span>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="policies">
          <Section title="Policies & thresholds" description="Changes require a reason and are recorded in the audit trail (before/after values).">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Yield tolerance min %">
                <Input type="number" value={s.yieldTolerance.minPct} onChange={(e) => setS({ ...s, yieldTolerance: { ...s.yieldTolerance, minPct: num(e.target.value) } })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="Yield tolerance max %">
                <Input type="number" value={s.yieldTolerance.maxPct} onChange={(e) => setS({ ...s, yieldTolerance: { ...s.yieldTolerance, maxPct: num(e.target.value) } })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="Consumption variance threshold %">
                <Input type="number" value={s.consumptionVariancePct} onChange={(e) => setS({ ...s, consumptionVariancePct: num(e.target.value) })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="Deviation aging: attention after (days)">
                <Input type="number" value={s.deviationAging.attentionAfterDays} onChange={(e) => setS({ ...s, deviationAging: { ...s.deviationAging, attentionAfterDays: num(e.target.value) } })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="Deviation aging: overdue after (days)">
                <Input type="number" value={s.deviationAging.overdueAfterDays} onChange={(e) => setS({ ...s, deviationAging: { ...s.deviationAging, overdueAfterDays: num(e.target.value) } })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="QA release SLA (hours)">
                <Input type="number" value={s.qaReleaseSlaHours} onChange={(e) => setS({ ...s, qaReleaseSlaHours: num(e.target.value) })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="Expired-calibration policy">
                <Select value={s.calibrationPolicy} onChange={(e) => setS({ ...s, calibrationPolicy: e.target.value as 'BLOCK' | 'WARN' })} disabled={!can('admin.tenant.manage')}>
                  <option value="BLOCK">BLOCK — refuse use in eBMR</option>
                  <option value="WARN">WARN — allow with documented reason</option>
                </Select>
              </Field>
              <Field label="Default CAPA due (days)">
                <Input type="number" value={s.capaDefaultDueDays} onChange={(e) => setS({ ...s, capaDefaultDueDays: num(e.target.value) })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="Batch number pattern" hint="Tokens: {PREFIX} {YYYY} {YY} {MM} {SEQ:n}">
                <Input value={s.numbering.BATCH} onChange={(e) => setS({ ...s, numbering: { ...s.numbering, BATCH: e.target.value } })} disabled={!can('admin.tenant.manage')} />
              </Field>
              <Field label="AI features enabled">
                <Select value={String(s.ai.enabled)} onChange={(e) => setS({ ...s, ai: { ...s.ai, enabled: e.target.value === 'true' } })} disabled={!can('admin.tenant.manage')}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </Field>
              <Field label="Store AI prompts">
                <Select value={String(s.ai.storePrompts)} onChange={(e) => setS({ ...s, ai: { ...s.ai, storePrompts: e.target.value === 'true' } })} disabled={!can('admin.tenant.manage')}>
                  <option value="true">Yes</option>
                  <option value="false">No (answers only)</option>
                </Select>
              </Field>
              <Field label="AI log retention (days)">
                <Input type="number" value={s.ai.retentionDays} onChange={(e) => setS({ ...s, ai: { ...s.ai, retentionDays: num(e.target.value) } })} disabled={!can('admin.tenant.manage')} />
              </Field>
            </div>
            <div className="mt-3">
              <Callout tone="info">Received material always starts in QUARANTINE. This control is not configurable in this release (see VALIDATION_NOTES).</Callout>
            </div>
            {can('admin.tenant.manage') && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Field label="Reason for change" className="min-w-[320px] flex-1">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <Button
                  onClick={async () => {
                    try {
                      const { receiptDefaultStatus: _r, ...rest } = s;
                      void _r;
                      await api.patch('/organization/settings', { settings: rest, reason });
                      toast.success('Settings saved');
                      setReason('');
                      refresh();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Save settings
                </Button>
              </div>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="jobs">
          <Section title="Compliance scans" description="Run automatically on a schedule (BullMQ with Redis, or in-process). Generates expiry, low-stock, overdue, calibration and QA-backlog notifications and sets expired lots to EXPIRED.">
            <KeyValues items={[{ label: 'Expiry alert windows', value: s.expiryAlertDays.join(' / ') + ' days' }]} />
            {can('admin.tenant.manage') && (
              <Button
                className="mt-3"
                onClick={async () => {
                  try {
                    const r = await api.post<Record<string, number>>('/admin/jobs/run-scans');
                    toast.success(`Scan complete: ${Object.entries(r).filter(([k]) => k !== 'tenantId').map(([k, v]) => `${k} ${v}`).join(', ')}`);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                <Play /> Run scans now
              </Button>
            )}
          </Section>
        </TabsContent>
      </Tabs>
      <ActionDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'site' ? 'New site' : dialog === 'wh' ? 'New warehouse' : dialog === 'bin' ? 'New bin' : 'New department'}
        submitLabel="Create"
        onSubmit={async () => {
          if (dialog === 'site') await api.post('/sites', { code: f.code, name: f.name, city: f.city || undefined });
          if (dialog === 'wh') await api.post('/warehouses', { siteId: f.siteId, code: f.code, name: f.name, type: f.type });
          if (dialog === 'bin') await api.post(`/warehouses/${f.warehouseId}/bins`, { code: f.code, description: f.description || undefined });
          if (dialog === 'dept') await api.post('/departments', { code: f.code, name: f.name });
          toast.success('Created');
          refresh();
        }}
      >
        {dialog === 'wh' && (
          <>
            <Field label="Site" required>
              <Select value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value })}>
                {sites?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" required>
              <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {['RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS', 'QUARANTINE', 'REJECT', 'GENERAL'].map((x) => (
                  <option key={x} value={x}>
                    {x.replace('_', ' ').toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {dialog === 'bin' && (
          <Field label="Warehouse" required>
            <Select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })}>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} {w.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Code" required>
          <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
        </Field>
        {dialog !== 'bin' ? (
          <Field label="Name" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </Field>
        ) : (
          <Field label="Description">
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        )}
        {dialog === 'site' && (
          <Field label="City">
            <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </Field>
        )}
      </ActionDialog>
    </>
  );
}
