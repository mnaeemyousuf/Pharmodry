'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSites } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/utils';
import { Button, Input, Select, Textarea } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ActionDialog, Field, PageHeader } from '@/components/page';

interface Role { id: string; code: string; name: string; permissions: string[]; _count?: { users: number } }
interface UserRow {
  id: string;
  email: string;
  fullName: string;
  title?: string;
  status: string;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  department?: { name: string } | null;
  roles: { id: string; siteId: string | null; role: { id: string; code: string; name: string } }[];
}
type Assign = { roleId: string; siteId: string };

export default function UsersPage() {
  const qc = useQueryClient();
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') });
  const { data: sites } = useSites();
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<{ id: string; name: string }[]>('/departments') });
  const [dialog, setDialog] = React.useState<null | 'create' | 'roles' | 'status' | 'reset'>(null);
  const [user, setUser] = React.useState<UserRow | null>(null);
  const [f, setF] = React.useState({ email: '', fullName: '', title: '', departmentId: '', password: '', status: 'ACTIVE', reason: '' });
  const [assign, setAssign] = React.useState<Assign[]>([{ roleId: '', siteId: '' }]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const roleEditor = (
    <div className="space-y-2">
      {assign.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2">
          <Select value={a.roleId} onChange={(e) => setAssign(assign.map((x, j) => (j === i ? { ...x, roleId: e.target.value } : x)))} required aria-label="Role">
            <option value="">Role…</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select value={a.siteId} onChange={(e) => setAssign(assign.map((x, j) => (j === i ? { ...x, siteId: e.target.value } : x)))} aria-label="Site scope">
            <option value="">All sites</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} only
              </option>
            ))}
          </Select>
          <Button type="button" variant="ghost" size="icon" onClick={() => setAssign(assign.filter((_, j) => j !== i))} aria-label="Remove role">
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setAssign([...assign, { roleId: '', siteId: '' }])}>
        <Plus /> Add role
      </Button>
    </div>
  );
  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts are created by administrators (no self-registration). Roles can be scoped to a site. Deactivation revokes all sessions immediately; accounts are never deleted."
        actions={
          <Button onClick={() => { setF({ email: '', fullName: '', title: '', departmentId: '', password: '', status: 'ACTIVE', reason: '' }); setAssign([{ roleId: '', siteId: '' }]); setDialog('create'); }}>
            <Plus /> New user
          </Button>
        }
      />
      <DataTable<UserRow>
        id="users"
        endpoint="/users"
        searchPlaceholder="Name, email or title"
        filters={[{ param: 'status', label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] }]}
        columns={[
          { key: 'name', header: 'Name', sort: 'fullName', cell: (r) => <div><div className="font-medium">{r.fullName}</div><div className="text-xs text-muted-foreground">{r.email}</div></div>, csv: (r) => r.fullName },
          { key: 'title', header: 'Title', cell: (r) => r.title ?? '—', csv: (r) => r.title },
          { key: 'dept', header: 'Department', cell: (r) => r.department?.name ?? '—' },
          { key: 'roles', header: 'Roles', cell: (r) => <div className="flex flex-wrap gap-1">{r.roles.map((x) => <span key={x.id} className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{x.role.name}{x.siteId ? ` @${sites?.find((s) => s.id === x.siteId)?.code ?? 'site'}` : ''}</span>)}</div>, csv: (r) => r.roles.map((x) => x.role.code).join(' ') },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex gap-1"><StatusBadge status={r.status} />{r.lockedUntil && new Date(r.lockedUntil) > new Date() && <StatusBadge status="LOCKED" tone="danger" label="Locked" />}</span>, csv: (r) => r.status },
          { key: 'last', header: 'Last login', cell: (r) => fmtDateTime(r.lastLoginAt), csv: (r) => r.lastLoginAt },
          {
            key: 'actions',
            header: '',
            cell: (r) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setUser(r); setAssign(r.roles.map((x) => ({ roleId: x.role.id, siteId: x.siteId ?? '' }))); setF({ ...f, reason: '' }); setDialog('roles'); }} aria-label="Edit roles">
                  <ShieldCheck />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setUser(r); setF({ ...f, status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', reason: '' }); setDialog('status'); }} aria-label="Change status">
                  <UserCog />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setUser(r); setF({ ...f, password: '' }); setDialog('reset'); }} aria-label="Reset password">
                  <KeyRound />
                </Button>
                {r.lockedUntil && new Date(r.lockedUntil) > new Date() && (
                  <Button size="sm" variant="ghost" onClick={async () => { await api.post(`/users/${r.id}/unlock`); toast.success('Account unlocked'); refresh(); }} aria-label="Unlock">
                    <Lock />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      <ActionDialog
        open={dialog === 'create'}
        onOpenChange={(o) => !o && setDialog(null)}
        wide
        title="New user"
        description="Initial password: at least 10 characters with upper-case, lower-case and a digit. Ask the user to change it at first login (Profile → Change password)."
        submitLabel="Create user"
        onSubmit={async () => {
          await api.post('/users', { email: f.email, fullName: f.fullName, title: f.title || undefined, departmentId: f.departmentId || undefined, password: f.password, roles: assign.filter((a) => a.roleId).map((a) => ({ roleId: a.roleId, siteId: a.siteId || undefined })) });
          toast.success('User created');
          refresh();
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name" required>
            <Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </Field>
          <Field label="Job title">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Department">
            <Select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
              <option value="">—</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Initial password" required>
            <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} />
          </Field>
        </div>
        <Field label="Roles">{roleEditor}</Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'roles'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Roles — ${user?.fullName}`}
        submitLabel="Save roles"
        onSubmit={async () => {
          await api.put(`/users/${user!.id}/roles`, { roles: assign.filter((a) => a.roleId).map((a) => ({ roleId: a.roleId, siteId: a.siteId || undefined })), reason: f.reason });
          toast.success('Roles updated');
          refresh();
        }}
      >
        {roleEditor}
        <Field label="Reason for change" required>
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'status'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${f.status === 'ACTIVE' ? 'Reactivate' : 'Deactivate'} ${user?.fullName}`}
        destructive={f.status !== 'ACTIVE'}
        submitLabel={f.status === 'ACTIVE' ? 'Reactivate' : 'Deactivate'}
        onSubmit={async () => {
          await api.patch(`/users/${user!.id}`, { status: f.status, reason: f.reason });
          toast.success('User status changed');
          refresh();
        }}
      >
        <Field label="Reason" required>
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === 'reset'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reset password — ${user?.fullName}`}
        description="All of the user's sessions are revoked."
        submitLabel="Reset password"
        onSubmit={async () => {
          await api.post(`/users/${user!.id}/reset-password`, { password: f.password });
          toast.success('Password reset');
        }}
      >
        <Field label="New temporary password" required>
          <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} />
        </Field>
      </ActionDialog>
    </>
  );
}
