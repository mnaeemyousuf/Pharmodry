'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser, PermissionCode } from '@pharmodry/types';
import { api, onExpired, refreshSession, setAccessToken } from './api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (p: PermissionCode | PermissionCode[], siteId?: string) => boolean;
  reload: () => Promise<void>;
}

const Ctx = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  const reload = React.useCallback(async () => {
    setUser(await api.get<AuthUser>('/auth/me'));
  }, []);

  React.useEffect(() => {
    onExpired(() => {
      setUser(null);
      setAccessToken(null);
      router.replace(`/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`);
    });
    (async () => {
      try {
        if (await refreshSession()) await reload();
      } finally {
        setLoading(false);
      }
    })();
  }, [reload, router]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const t = await api.post<{ accessToken: string }>('/auth/login', { email, password });
      setAccessToken(t.accessToken);
      await reload();
    },
    [reload],
  );

  const logout = React.useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const can = React.useCallback(
    (p: PermissionCode | PermissionCode[], siteId?: string) => {
      if (!user) return false;
      const list = Array.isArray(p) ? p : [p];
      return list.some((perm) => {
        const sites = user.sitePermissions[perm];
        if (!sites) return false;
        return !siteId || sites.includes('*') || sites.includes(siteId);
      });
    },
    [user],
  );

  return <Ctx.Provider value={{ user, loading, login, logout, can, reload }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
