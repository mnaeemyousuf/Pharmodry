'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, ChevronLeft, ChevronRight, Columns3, Download, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, Input, Select, Skeleton } from '@/components/ui/primitives';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Server sort field; omit if not sortable. */
  sort?: string;
  /** Plain value for client-side CSV export. */
  csv?: (row: T) => unknown;
  className?: string;
  hidden?: boolean;
}

export interface FilterDef {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface DataTableProps<T> {
  id: string;
  endpoint: string;
  columns: Column<T>[];
  filters?: FilterDef[];
  views?: { value: string; label: string }[];
  defaultView?: string;
  params?: Record<string, string | undefined>;
  searchPlaceholder?: string;
  rowHref?: (row: T) => string;
  /** Server-side CSV export endpoint (preferred) — otherwise current page is exported client-side. */
  exportPath?: string;
  pageSize?: number;
  emptyText?: string;
  toolbar?: React.ReactNode;
  onLoaded?: (meta: Record<string, unknown> | undefined) => void;
}

/** Per-browser preference. legacyKey: pre-rebrand key, read once so saved filters/columns are kept. */
function useLocal<T>(key: string, initial: T, legacyKey?: string): [T, (v: T) => void] {
  const [v, setV] = React.useState<T>(initial);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
      if (raw) setV(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [key, legacyKey]);
  const set = (nv: T) => {
    setV(nv);
    try {
      localStorage.setItem(key, JSON.stringify(nv));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}

export function DataTable<T extends { id: string }>(p: DataTableProps<T>) {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(p.pageSize ?? 25);
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [sort, setSort] = React.useState<string | undefined>();
  const [view, setView] = React.useState<string | undefined>(p.defaultView ?? p.views?.[0]?.value);
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [hidden, setHidden] = useLocal<string[]>(`pmd.cols.${p.id}`, p.columns.filter((c) => c.hidden).map((c) => c.key), `p360.cols.${p.id}`);
  const [saved, setSaved] = useLocal<{ name: string; q: string; view?: string; filters: Record<string, string> }[]>(`pmd.saved.${p.id}`, [], `p360.saved.${p.id}`);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = { ...p.params, ...filters, view: view || undefined, q: debounced || undefined, sort, page, pageSize };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [p.id, p.endpoint, params],
    queryFn: () => api.page<T>(p.endpoint, params),
    placeholderData: keepPreviousData,
  });
  const onLoaded = p.onLoaded;
  React.useEffect(() => {
    if (data) onLoaded?.(data.meta);
  }, [data, onLoaded]);

  const columns = p.columns.filter((c) => !hidden.includes(c.key));
  const rows = data?.data ?? [];
  const meta = data?.meta;

  const toggleSort = (field?: string) => {
    if (!field) return;
    setSort((s) => (s === `${field}:asc` ? `${field}:desc` : s === `${field}:desc` ? undefined : `${field}:asc`));
  };

  const exportCsv = async () => {
    try {
      if (p.exportPath) {
        await api.download(p.exportPath, { ...p.params, ...filters, view, q: debounced || undefined });
        return;
      }
      const cols = p.columns.filter((c) => c.csv);
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v);
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
      };
      const csv = [cols.map((c) => esc(c.header)).join(','), ...rows.map((r) => cols.map((c) => esc(c.csv!(r))).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${p.id}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const saveCurrent = () => {
    const name = window.prompt('Name this filter');
    if (!name) return;
    setSaved([...saved.filter((s) => s.name !== name), { name, q, view, filters }]);
    toast.success(`Saved filter "${name}"`);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (debounced ? 1 : 0);

  return (
    <div className="rounded-lg border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {p.views && (
        <div className="flex gap-1 overflow-x-auto border-b px-3 pt-2 scrollbar-thin" role="tablist">
          {p.views.map((v) => (
            <button
              key={v.value}
              role="tab"
              aria-selected={view === v.value}
              onClick={() => {
                setView(v.value);
                setPage(1);
              }}
              className={cn('-mb-px whitespace-nowrap border-b-2 px-3 pb-2 text-[13px] font-medium', view === v.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.searchPlaceholder ?? 'Search…'} className="h-9 pl-8" aria-label="Search table" />
        </div>
        {p.filters?.map((f) => (
          <Select
            key={f.param}
            aria-label={f.label}
            className="h-9 w-auto min-w-[9rem]"
            value={filters[f.param] ?? ''}
            onChange={(e) => {
              setFilters({ ...filters, [f.param]: e.target.value });
              setPage(1);
            }}
          >
            <option value="">{f.label}: all</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({});
              setQ('');
            }}
          >
            <X /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {p.toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Saved filters">
                <Bookmark /> Saved
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={saveCurrent}>Save current filters…</DropdownMenuItem>
              {saved.length > 0 && <DropdownMenuSeparator />}
              {saved.map((s) => (
                <DropdownMenuItem
                  key={s.name}
                  onSelect={() => {
                    setQ(s.q);
                    setView(s.view);
                    setFilters(s.filters);
                  }}
                >
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Choose columns">
                <Columns3 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              {p.columns.map((c) => (
                <DropdownMenuCheckboxItem key={c.key} checked={!hidden.includes(c.key)} onCheckedChange={(on) => setHidden(on ? hidden.filter((h) => h !== c.key) : [...hidden, c.key])} onSelect={(e) => e.preventDefault()}>
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportCsv} aria-label="Export CSV">
            <Download /> Export
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn('whitespace-nowrap px-3 py-2.5 font-medium', c.className)}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.sort)}>
                      {c.header}
                      {sort === `${c.sort}:asc` ? <ArrowUp className="h-3 w-3" /> : sort === `${c.sort}:desc` ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(isFetching && !isLoading && 'opacity-70')}>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              rows.map((r) => {
                const href = p.rowHref?.(r);
                return (
                  <tr
                    key={r.id}
                    className={cn('border-b last:border-0 hover:bg-muted/40', href && 'cursor-pointer')}
                    onClick={(e) => {
                      if (!href || (e.target as HTMLElement).closest('a,button')) return;
                      router.push(href);
                    }}
                  >
                    {columns.map((c, i) => (
                      <td key={c.key} className={cn('px-3 py-2.5 align-middle', c.className)}>
                        {i === 0 && href ? (
                          <Link href={href} className="font-medium text-primary hover:underline">
                            {c.cell(r)}
                          </Link>
                        ) : (
                          c.cell(r)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  {error ? errorMessage(error) : (p.emptyText ?? 'No records match the current filters.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <div>{meta ? `${meta.total.toLocaleString()} record${meta.total === 1 ? '' : 's'}` : ' '}</div>
        <div className="flex items-center gap-2">
          <Select className="h-8 w-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Rows per page">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
          <span>
            Page {meta?.page ?? 1} of {meta?.totalPages ?? 1}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta || page >= meta.totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
