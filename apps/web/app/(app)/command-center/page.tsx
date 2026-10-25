'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, ArrowRight, Boxes, ClipboardCheck, Factory, FlaskConical, Info, RefreshCw, Sparkles, Truck, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSites } from '@/lib/hooks';
import { cn, fmtDateTime } from '@/lib/utils';
import type { ExceptionItem } from '@/lib/types';
import { Button, Card, Select, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/page';

interface CC {
  generatedAt: string;
  headlines: string[];
  counts: Record<string, number>;
  critical: number;
  items: ExceptionItem[];
}

const SECTIONS: { key: string; label: string; icon: typeof Factory; desc: string }[] = [
  { key: 'BATCHES', label: 'Batches at risk', icon: Factory, desc: 'Delays, release bottlenecks, OOS blocks' },
  { key: 'QUALITY', label: 'Quality issues', icon: ClipboardCheck, desc: 'OOS, overdue deviations & CAPAs' },
  { key: 'MATERIALS', label: 'Materials at risk', icon: FlaskConical, desc: 'Stock-out risk, pending disposition' },
  { key: 'INVENTORY', label: 'Inventory risks', icon: Boxes, desc: 'Expiry & slow-moving stock' },
  { key: 'COMPLIANCE', label: 'Compliance deadlines', icon: Wrench, desc: 'Calibration, requalification, certificates' },
  { key: 'SUPPLIERS', label: 'Supplier risks', icon: Truck, desc: 'Rejection rates and qualification' },
];

function SeverityIcon({ s }: { s: ExceptionItem['severity'] }) {
  if (s === 'CRITICAL') return <AlertOctagon className="h-4 w-4 text-danger" aria-label="Critical" />;
  if (s === 'WARNING') return <AlertTriangle className="h-4 w-4 text-warning" aria-label="Warning" />;
  return <Info className="h-4 w-4 text-info" aria-label="Info" />;
}

export default function CommandCenterPage() {
  const { can } = useAuth();
  const { data: sites } = useSites();
  const [siteId, setSiteId] = React.useState('');
  const [section, setSection] = React.useState<string>('ALL');
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ['command-center', siteId], queryFn: () => api.get<CC>('/analytics/command-center', { siteId }), refetchInterval: 120_000 });
  const items = (data?.items ?? []).filter((i) => section === 'ALL' || i.section === section);
  return (
    <>
      <PageHeader
        title="Pharma Command Center"
        description="What needs attention right now, why, which process it affects, who owns it and how long it has been pending."
        actions={
          <>
            <Select className="w-52" value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Plant">
              <option value="">All plants</option>
              {sites?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw /> Refresh
            </Button>
            {can('ai.copilot.use') && (
              <Button asChild variant="secondary">
                <Link href="/copilot?q=What%20is%20happening%20across%20my%20operation%20right%20now%3F">
                  <Sparkles /> Ask Copilot
                </Link>
              </Button>
            )}
          </>
        }
      />
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card className="mb-4 overflow-hidden border-l-4 border-l-primary">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Right now</div>
                <div className="mt-0.5 text-2xl font-semibold">
                  <span className="text-danger">{data.critical}</span> critical · {data.items.length} total exceptions
                </div>
              </div>
              <ul className="flex flex-1 flex-wrap gap-2" data-testid="cc-headlines">
                {data.headlines.map((h) => (
                  <li key={h} className="rounded-full border bg-secondary px-3 py-1 text-[13px] font-medium">
                    {h}
                  </li>
                ))}
              </ul>
              <div className="text-xs text-muted-foreground">Updated {fmtDateTime(data.generatedAt)}</div>
            </div>
          </Card>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {SECTIONS.map((s) => (
              <button key={s.key} onClick={() => setSection(section === s.key ? 'ALL' : s.key)} className={cn('rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50', section === s.key && 'border-primary bg-accent/40')} aria-pressed={section === s.key}>
                <div className="flex items-center justify-between">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                  <span className={cn('text-xl font-semibold tabular', data.counts[s.key] ? 'text-foreground' : 'text-muted-foreground')}>{data.counts[s.key] ?? 0}</span>
                </div>
                <div className="mt-2 text-[13px] font-medium">{s.label}</div>
                <div className="text-[11.5px] text-muted-foreground">{s.desc}</div>
              </button>
            ))}
          </div>
          <Card>
            <div className="hidden grid-cols-[28px_minmax(0,2fr)_minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1fr)_70px_28px] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
              <span />
              <span>What</span>
              <span>Why it needs attention</span>
              <span>Process affected</span>
              <span>Owner</span>
              <span className="text-right">Pending</span>
              <span />
            </div>
            <ul className="divide-y" data-testid="cc-items">
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={i.href} className="grid grid-cols-[28px_1fr_28px] items-start gap-3 px-4 py-3 hover:bg-muted/40 lg:grid-cols-[28px_minmax(0,2fr)_minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1fr)_70px_28px]">
                    <SeverityIcon s={i.severity} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium">{i.title}</div>
                      <div className="text-xs text-muted-foreground lg:hidden">{i.why}</div>
                    </div>
                    <div className="hidden text-[13px] text-foreground/85 lg:block">{i.why}</div>
                    <div className="hidden text-[13px] lg:block">{i.process}</div>
                    <div className="hidden text-[13px] lg:block">{i.owner ?? <span className="text-muted-foreground">Unassigned</span>}</div>
                    <div className="hidden text-right text-[13px] tabular lg:block">{i.ageDays === null ? '—' : `${i.ageDays} d`}</div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {items.length === 0 && <li className="px-4 py-12 text-center text-sm text-muted-foreground">No exceptions in this section. ✓</li>}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
