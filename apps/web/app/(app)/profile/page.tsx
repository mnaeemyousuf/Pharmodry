'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/utils';
import { Button, Input } from '@/components/ui/primitives';
import { Field, KeyValues, PageHeader, Section } from '@/components/page';

interface Session { id: string; familyId: string; ip?: string; userAgent?: string; createdAt: string; expiresAt: string }

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<Session[]>('/auth/sessions') });
  const [p, setP] = React.useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = React.useState(false);
  if (!user) return null;
  return (
    <>
      <PageHeader title="Profile & security" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Account">
          <KeyValues
            cols={2}
            items={[
              { label: 'Name', value: user.fullName },
              { label: 'Email', value: user.email },
              { label: 'Title', value: user.title },
              { label: 'Company', value: user.tenantName },
              { label: 'Sites', value: user.sites.map((s) => s.name).join(', ') },
              { label: 'Permissions', value: `${user.permissions.length} granted` },
            ]}
          />
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-primary">Show my permissions</summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {user.permissions.map((x) => (
                <span key={x} className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                  {x}
                </span>
              ))}
            </div>
          </details>
        </Section>
        <Section title="Change password" description="At least 10 characters with upper-case, lower-case and a digit. Your password is also your electronic-signature credential — never share it.">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (p.newPassword !== p.confirm) return toast.error('Passwords do not match');
              setBusy(true);
              try {
                await api.post('/auth/change-password', { currentPassword: p.currentPassword, newPassword: p.newPassword });
                toast.success('Password changed');
                setP({ currentPassword: '', newPassword: '', confirm: '' });
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Current password" required>
              <Input type="password" autoComplete="current-password" value={p.currentPassword} onChange={(e) => setP({ ...p, currentPassword: e.target.value })} required />
            </Field>
            <Field label="New password" required>
              <Input type="password" autoComplete="new-password" value={p.newPassword} onChange={(e) => setP({ ...p, newPassword: e.target.value })} required minLength={10} />
            </Field>
            <Field label="Confirm new password" required>
              <Input type="password" autoComplete="new-password" value={p.confirm} onChange={(e) => setP({ ...p, confirm: e.target.value })} required />
            </Field>
            <Button type="submit" loading={busy}>
              Change password
            </Button>
          </form>
        </Section>
        <Section title="Active sessions" description="Devices signed in to your account. Revoke any session you do not recognise." className="xl:col-span-2">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Signed in</th>
                <th className="py-2">IP</th>
                <th className="py-2">Device</th>
                <th className="py-2">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions?.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">{fmtDateTime(s.createdAt)}</td>
                  <td className="py-2">{s.ip}</td>
                  <td className="max-w-md truncate py-2 text-xs text-muted-foreground">{s.userAgent}</td>
                  <td className="py-2">{fmtDateTime(s.expiresAt)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await api.del(`/auth/sessions/${s.familyId}`);
                          toast.success('Session revoked');
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                        qc.invalidateQueries({ queryKey: ['sessions'] });
                      }}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  );
}
