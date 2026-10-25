'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { Command } from 'cmdk';
import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDateTime } from '@/lib/utils';
import { Button, Kbd } from '@/components/ui/primitives';
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { StatusBadge } from '@/components/status-badge';
import { Logo } from './logo';
import { NAV } from './nav';

interface Notification {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  // Longest matching href wins so /inventory doesn't light up on /inventory/receipts.
  const all = NAV.flatMap((g) => g.items).filter((i) => isActive(i.href));
  const active = all.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="flex h-full flex-col" aria-label="Main navigation">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
        {NAV.map((g) => {
          const items = g.items.filter((i) => (!i.perms || can(i.perms)) && (!i.all || i.all.every((p) => can(p))));
          if (items.length === 0) return null;
          return (
            <div key={g.label}>
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{g.label}</div>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] text-sidebar-foreground transition-colors hover:bg-secondary',
                        active === i.href && 'bg-sidebar-active font-medium text-accent-foreground',
                      )}
                    >
                      <i.icon className="h-4 w-4 opacity-80" />
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-3 text-[11px] text-sidebar-muted">Pharmodry v0.1 · MVP</div>
    </nav>
  );
}

function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const router = useRouter();
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get<{ hits: { type: string; id: string; title: string; subtitle: string; status?: string; href: string }[]; related: { batchId: string; batchNumber: string; counts: Record<string, number | null> } | null }>('/search', { q: debounced }),
    enabled: debounced.length >= 2,
  });
  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-sm hover:bg-secondary" data-testid="global-search">
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search batches, lots, deviations, CAPAs…</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <Command shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Type a batch number, lot, material, supplier, deviation…" className="h-12 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              {debounced.length < 2 && <div className="p-6 text-center text-sm text-muted-foreground">Search across regulated records. Try a batch number like “PCM-2026-000002”.</div>}
              {debounced.length >= 2 && !isFetching && data && data.hits.length === 0 && <Command.Empty className="p-6 text-center text-sm text-muted-foreground">No matching records you are allowed to see.</Command.Empty>}
              {data?.related && (
                <Command.Group heading={<span className="px-2 text-xs font-semibold text-muted-foreground">Batch {data.related.batchNumber} — related records</span>}>
                  <Command.Item onSelect={() => go(`/production/batches/${data.related!.batchId}`)} className="flex cursor-pointer flex-wrap gap-2 rounded-md px-3 py-2 text-xs data-[selected=true]:bg-secondary">
                    {Object.entries(data.related.counts)
                      .filter(([, v]) => v !== null)
                      .map(([k, v]) => (
                        <span key={k} className="rounded-full border px-2 py-0.5">
                          {k.replace(/([A-Z])/g, ' $1').toLowerCase()}: <b>{v}</b>
                        </span>
                      ))}
                  </Command.Item>
                </Command.Group>
              )}
              {data?.hits.map((h) => (
                <Command.Item key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}`} onSelect={() => go(h.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 data-[selected=true]:bg-secondary">
                  <span className="w-20 shrink-0 text-[11px] font-medium uppercase text-muted-foreground">{h.type}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{h.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                  </div>
                  {h.status && <StatusBadge status={h.status} />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.page<Notification>('/notifications'),
    refetchInterval: 60_000,
  });
  const unread = Number(data?.meta?.unread ?? 0);
  const markAll = async () => {
    await api.post('/notifications/read', {});
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const open = async (n: Notification) => {
    if (!n.readAt) await api.post('/notifications/read', { ids: [n.id] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    if (n.link) router.push(n.link);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications (${unread} unread)`} className="relative" data-testid="notifications">
          <Bell />
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="text-sm font-semibold">Notifications</div>
          <Button variant="ghost" size="sm" onClick={markAll}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {(data?.data ?? []).slice(0, 25).map((n) => (
            <button key={n.id} onClick={() => open(n)} className={cn('flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-secondary', !n.readAt && 'bg-accent/40')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.severity === 'CRITICAL' ? 'bg-danger' : n.severity === 'WARNING' ? 'bg-warning' : 'bg-info')} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{n.title}</span>
                <span className="block text-xs text-muted-foreground line-clamp-2">{n.body}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
              </span>
            </button>
          ))}
          {data && data.data.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>}
        </div>
        <div className="border-t px-4 py-2 text-right">
          <Link href="/notifications" className="text-xs font-medium text-primary hover:underline">
            View all &amp; preferences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.fullName.replace('Dr. ', '').split(' ').map((s) => s[0]).slice(0, 2).join('');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary" data-testid="user-menu">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials}</span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-[13px] font-medium">{user.fullName}</span>
            <span className="block text-[11px] text-muted-foreground">{user.title}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          {user.email}
          <div className="font-normal">{user.tenantName}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User /> Profile &amp; security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout()} data-testid="logout">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">
          <Logo />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <Sidebar />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent side className="max-w-[16rem] p-0">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60 print:pl-0">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <span className="hidden rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-warning xl:inline">Demo data</span>
          <ThemeToggle />
          <Notifications />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 lg:px-6">
          {/* Print-only brand header: printed reports (PQR, registers, audit trail) carry the Pharmodry identity. */}
          <div className="mb-4 hidden border-b-2 border-brand-navy pb-2 print:block" data-testid="print-brand">
            <Logo />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
