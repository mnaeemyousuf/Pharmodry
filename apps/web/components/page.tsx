'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Fingerprint, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { BlockingReason } from '@pharmodry/types';
import { humanize } from '@pharmodry/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDateTime } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlays';
import { StatusBadge } from '@/components/status-badge';

export function PageHeader({ title, description, crumbs, actions, children }: { title: React.ReactNode; description?: React.ReactNode; crumbs?: { label: string; href?: string }[]; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 space-y-2">
      {crumbs && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function DetailHeader({ title, status, subtitle, meta, actions, crumbs }: { title: string; status?: string | null; subtitle?: React.ReactNode; meta: { label: string; value: React.ReactNode }[]; actions?: React.ReactNode; crumbs: { label: string; href?: string }[] }) {
  return (
    <PageHeader
      crumbs={crumbs}
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span className="font-mono">{title}</span>
          {status && <StatusBadge status={status} className="text-xs" />}
        </span>
      }
      description={subtitle}
      actions={actions}
    >
      <Card className="mt-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
          {meta.map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</dt>
              <dd className="mt-0.5 truncate text-[13.5px] font-medium">{m.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </PageHeader>
  );
}

export function KeyValues({ items, cols = 3 }: { items: { label: string; value: React.ReactNode }[]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="mt-0.5 text-[13.5px]">{i.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, description, actions, children, className }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'ai'; title?: string; children: React.ReactNode }) {
  const map = {
    info: ['border-info/30 bg-info/5 text-info', Info],
    warning: ['border-warning/40 bg-warning/5 text-warning', AlertTriangle],
    danger: ['border-danger/30 bg-danger/5 text-danger', AlertTriangle],
    success: ['border-success/30 bg-success/5 text-success', ShieldCheck],
    ai: ['border-progress/30 bg-progress/5 text-progress', Sparkles],
  } as const;
  const [cls, Icon] = map[tone];
  return (
    <div className={cn('flex gap-3 rounded-md border px-4 py-3 text-[13px]', cls)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-foreground/90">
        {title && <div className="mb-0.5 font-semibold text-foreground">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Blockers({ reasons, title = 'Release is blocked' }: { reasons: BlockingReason[]; title?: string }) {
  if (!reasons.length) return null;
  return (
    <Callout tone="danger" title={title}>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {reasons.map((r, i) => (
          <li key={i}>
            {r.href ? (
              <Link href={r.href} className="underline underline-offset-2">
                {r.message}
              </Link>
            ) : (
              r.message
            )}
          </li>
        ))}
      </ul>
    </Callout>
  );
}

/** Shows server-side rule violations (blocking reasons) or a toast. */
export function handleError(e: unknown, setReasons?: (r: BlockingReason[]) => void) {
  if (e instanceof ApiError && e.reasons.length && setReasons) {
    setReasons(e.reasons);
    toast.error(e.message);
    return;
  }
  toast.error(errorMessage(e));
}

/**
 * Electronic signature dialog (21 CFR Part 11 concepts): shows what is signed, the meaning,
 * the signer identity and time, and requires password re-entry.
 */
export function SignatureDialog({
  open,
  onOpenChange,
  action,
  meaning,
  record,
  reasonRequired,
  reasonLabel = 'Reason / comment',
  extra,
  confirmLabel = 'Sign',
  destructive,
  onSign,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  action: string;
  meaning: string;
  record: string;
  reasonRequired?: boolean;
  reasonLabel?: string;
  extra?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onSign: (sig: { password: string; reason?: string }) => Promise<unknown>;
}) {
  const { user } = useAuth();
  const [password, setPassword] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    if (open) {
      setPassword('');
      setReason('');
      setErr(null);
      setReasons([]);
      setNow(new Date());
    }
  }, [open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reasonRequired && reason.trim().length < 5) {
      setErr('A reason of at least 5 characters is required');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSign({ password, reason: reason || undefined });
      onOpenChange(false);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.reasons.length) setReasons(e2.reasons);
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader title={<span className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> Electronic signature</span>} description="Your signature is legally binding within your company's validated procedures." />
          <DialogBody className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-[13px]">
              <div className="grid grid-cols-[110px_1fr] gap-y-1.5">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium">{action}</span>
                <span className="text-muted-foreground">Record</span>
                <span className="font-mono">{record}</span>
                <span className="text-muted-foreground">Meaning</span>
                <span>{meaning}</span>
                <span className="text-muted-foreground">Signer</span>
                <span>
                  {user?.fullName} <span className="text-muted-foreground">({user?.email})</span>
                </span>
                <span className="text-muted-foreground">Date / time</span>
                <span>{fmtDateTime(now)} (server time recorded on signing)</span>
              </div>
            </div>
            {extra}
            <div className="space-y-1.5">
              <Label htmlFor="sig-reason">
                {reasonLabel}
                {reasonRequired && ' *'}
              </Label>
              <Textarea id="sig-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sig-password">Re-enter your password *</Label>
              <Input id="sig-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {reasons.length > 0 && <Blockers reasons={reasons} title="Action blocked by business rules" />}
            {err && reasons.length === 0 && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} loading={busy} disabled={!password} data-testid="sign-submit">
              <Fingerprint /> {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Generic form dialog for workflow actions that need a few fields (reason, notes…). */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Save',
  children,
  onSubmit,
  destructive,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  children: React.ReactNode;
  onSubmit: () => Promise<unknown>;
  destructive?: boolean;
  wide?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [reasons, setReasons] = React.useState<BlockingReason[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setReasons([]);
      setErr(null);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide={wide}>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await onSubmit();
              onOpenChange(false);
            } catch (e2) {
              if (e2 instanceof ApiError && e2.reasons.length) setReasons(e2.reasons);
              setErr(errorMessage(e2));
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader title={title} description={description} />
          <DialogBody className="space-y-4">
            {children}
            {reasons.length > 0 && <Blockers reasons={reasons} title="Action blocked by business rules" />}
            {err && reasons.length === 0 && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} loading={busy} data-testid="action-submit">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, error, hint, required, children, className }: { label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  const autoId = React.useId();
  // Associate the label with a single form control child (accessibility + testability).
  const child = React.Children.count(children) === 1 && React.isValidElement<{ id?: string }>(children) ? children : null;
  const id = child ? (child.props.id ?? autoId) : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {child ? React.cloneElement(child, { id }) : children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface AuditEvent {
  id: string;
  seq: string;
  occurredAt: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityLabel?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  signatureId?: string | null;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function ChangeList({ previous, next }: { previous?: Record<string, unknown> | null; next?: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})])].slice(0, 12);
  if (!keys.length) return null;
  return (
    <div className="mt-1.5 overflow-hidden rounded border text-xs">
      {keys.map((k) => (
        <div key={k} className="grid grid-cols-[140px_1fr_1fr] border-b last:border-0">
          <div className="bg-muted/50 px-2 py-1 font-medium">{k}</div>
          <div className="truncate px-2 py-1 text-muted-foreground line-through decoration-danger/50" title={renderValue(previous?.[k])}>
            {previous && k in previous ? renderValue(previous[k]) : ''}
          </div>
          <div className="truncate px-2 py-1" title={renderValue(next?.[k])}>
            {renderValue(next?.[k])}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-record audit history timeline (read-only). */
export function AuditHistory({ entityId, extraIds = [] }: { entityId: string; extraIds?: string[] }) {
  const { can } = useAuth();
  const ids = [entityId, ...extraIds];
  const { data, isLoading } = useQuery({
    queryKey: ['audit', ids],
    queryFn: async () => (await Promise.all(ids.map((id) => api.page<AuditEvent>('/audit/events', { entityId: id, pageSize: 200 })))).flatMap((r) => r.data).sort((a, b) => Number(b.seq) - Number(a.seq)),
    enabled: can('audit.view'),
  });
  if (!can('audit.view')) return <Empty>Viewing the audit trail requires the audit.view permission.</Empty>;
  if (isLoading) return <Empty>Loading audit trail…</Empty>;
  if (!data?.length) return <Empty>No audit events.</Empty>;
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {data.map((e) => (
        <li key={e.id} className="relative">
          <span className={cn('absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card', e.signatureId ? 'bg-primary' : e.action === 'REJECT' || e.action === 'VOID' ? 'bg-danger' : 'bg-muted-foreground/50')} />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <StatusBadge status={e.action} tone={e.action === 'SIGN' || e.action === 'APPROVE' ? 'success' : e.action === 'REJECT' ? 'danger' : e.action === 'CORRECTION' ? 'warning' : 'neutral'} label={humanize(e.action)} />
            <span className="font-medium">{e.userName ?? e.userEmail ?? 'System'}</span>
            <span className="text-muted-foreground">{fmtDateTime(e.occurredAt)}</span>
            {e.entityLabel && <span className="text-xs text-muted-foreground">· {e.entityType} {e.entityLabel}</span>}
            {e.signatureId && (
              <span className="inline-flex items-center gap-1 text-xs text-primary">
                <Fingerprint className="h-3 w-3" /> e-signed
              </span>
            )}
          </div>
          {e.reason && <div className="mt-1 text-xs text-muted-foreground">Reason: {e.reason}</div>}
          <ChangeList previous={e.previousValue} next={e.newValue} />
        </li>
      ))}
    </ol>
  );
}

interface Signature {
  id: string;
  signerName: string;
  signerEmail: string;
  action: string;
  meaning: string;
  reason?: string;
  signedAt: string;
  authMethod: string;
}

export function SignatureList({ signatures }: { signatures?: Signature[] }) {
  if (!signatures?.length) return <Empty>No electronic signatures recorded yet.</Empty>;
  return (
    <div className="space-y-2">
      {signatures.map((s) => (
        <div key={s.id} className="flex gap-3 rounded-md border p-3">
          <Fingerprint className="mt-0.5 h-5 w-5 text-primary" />
          <div className="min-w-0 text-[13px]">
            <div className="font-medium">
              {humanize(s.action)} — {s.signerName}
            </div>
            <div className="text-muted-foreground">{s.meaning}</div>
            {s.reason && <div className="mt-0.5">Comment: {s.reason}</div>}
            <div className="mt-1 text-xs text-muted-foreground">
              {fmtDateTime(s.signedAt)} · {s.signerEmail} · {s.authMethod === 'PASSWORD_REAUTH' ? 'password re-authentication' : 'migrated record'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mutation helper: runs an API call, toasts, and refreshes related queries. */
export function useAction<TVars>(fn: (v: TVars) => Promise<unknown>, opts: { success?: string; invalidate?: unknown[][] } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (opts.success) toast.success(opts.success);
      (opts.invalidate ?? []).forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function AiLabel({ text }: { text?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-progress/30 bg-progress/10 px-2.5 py-0.5 text-[11.5px] font-medium text-progress">
      <Sparkles className="h-3 w-3" /> {text ?? 'AI-generated suggestion — requires QA review'}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-y-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center">
          <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium', i < idx ? 'bg-success/10 text-success' : i === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <span className="tabular">{i + 1}</span> {humanize(s)}
          </span>
          {i < steps.length - 1 && <span className={cn('mx-1 h-px w-4', i < idx ? 'bg-success' : 'bg-border')} />}
        </li>
      ))}
    </ol>
  );
}
