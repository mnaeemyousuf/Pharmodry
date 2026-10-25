import { humanize, toneFor, type Tone } from '@pharmodry/ui';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-border',
  info: 'bg-info/10 text-info border-info/25',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/25',
  progress: 'bg-progress/10 text-progress border-progress/25',
  muted: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ status, label, tone, className }: { status?: string | null; label?: string; tone?: Tone; className?: string }) {
  if (!status && !label) return <span className="text-muted-foreground">—</span>;
  const t = tone ?? toneFor(status);
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium', TONE_CLASSES[t], className)} data-status={status}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label ?? humanize(status)}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: 'CRITICAL' | 'WARNING' | 'INFO' }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', severity === 'CRITICAL' ? 'bg-danger' : severity === 'WARNING' ? 'bg-warning' : 'bg-info')} />;
}
