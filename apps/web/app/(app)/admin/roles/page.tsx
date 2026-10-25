'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, Card, Checkbox, Input, Textarea } from '@/components/ui/primitives';
import { ActionDialog, Field, PageHeader } from '@/components/page';

interface Role { id: string; code: string; name: string; description?: string; isSystem: boolean; permissions: string[]; _count?: { users: number } }
interface Perm { code: string; description: string; module: string }

export default function RolesPage() {
  const qc = useQueryClient();
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') });
  const { data: perms } = useQuery({ queryKey: ['permissions'], queryFn: () => api.get<Perm[]>('/permissions') });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Set<string>>(new Set());
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [create, setCreate] = React.useState(false);
  const [nr, setNr] = React.useState({ code: '', name: '', description: '' });
  const role = roles?.find((r) => r.id === selected) ?? roles?.[0];
  React.useEffect(() => {
    if (role) setDraft(new Set(role.permissions));
  }, [role]);
  const modules = [...new Set((perms ?? []).map((p) => p.module))];
  const changed = role && (role.permissions.length !== draft.size || role.permissions.some((p) => !draft.has(p)));
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Authorisation is checked against permission codes (never role names), on the server, for every request. Roles may be edited per company; every change is audited with a reason."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus /> New role
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="p-2">
          <ul>
            {roles?.map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelected(r.id)} className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] hover:bg-secondary', role?.id === r.id && 'bg-accent font-medium')}>
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r._count?.users ?? 0} users</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {role && (
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{role.name}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {role.description} · <span className="font-mono">{role.code}</span> · {draft.size} permissions
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((m) => (
                <div key={m}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m}</div>
                  {perms
                    ?.filter((p) => p.module === m)
                    .map((p) => (
                      <label key={p.code} className="flex items-start gap-2 py-0.5 text-[12.5px]">
                        <Checkbox
                          checked={draft.has(p.code)}
                          onCheckedChange={(on) => {
                            const n = new Set(draft);
                            if (on) n.add(p.code);
                            else n.delete(p.code);
                            setDraft(n);
                          }}
                        />
                        <span>
                          <span className="font-mono text-[11.5px]">{p.code}</span>
                          <span className="block text-muted-foreground">{p.description}</span>
                        </span>
                      </label>
                    ))}
                </div>
              ))}
            </div>
            {changed && (
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
                <Field label="Reason for change (required)" className="min-w-[280px] flex-1">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <Button variant="outline" onClick={() => setDraft(new Set(role.permissions))}>
                  Discard
                </Button>
                <Button
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.put(`/roles/${role.id}/permissions`, { permissions: [...draft], reason });
                      toast.success('Permissions updated');
                      setReason('');
                      qc.invalidateQueries({ queryKey: ['roles'] });
                    } catch (e) {
                      toast.error(errorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Save permissions
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
      <ActionDialog
        open={create}
        onOpenChange={setCreate}
        title="New role"
        submitLabel="Create role"
        onSubmit={async () => {
          await api.post('/roles', nr);
          toast.success('Role created — now assign permissions');
          qc.invalidateQueries({ queryKey: ['roles'] });
        }}
      >
        <Field label="Code" required>
          <Input value={nr.code} onChange={(e) => setNr({ ...nr, code: e.target.value })} required />
        </Field>
        <Field label="Name" required>
          <Input value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} required />
        </Field>
        <Field label="Description">
          <Textarea value={nr.description} onChange={(e) => setNr({ ...nr, description: e.target.value })} />
        </Field>
      </ActionDialog>
    </>
  );
}
