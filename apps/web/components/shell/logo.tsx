import * as React from 'react';
import { cn } from '@/lib/utils';

/** Pharmodry mark: a "P" whose bowl is a two-tone capsule, plus a precision dot. Masters: docs/BRAND/logo. */
export function LogoMark({ inverted, className }: { inverted?: boolean; className?: string }) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8 shrink-0', className)} aria-hidden>
      <defs>
        <clipPath id={`${id}-cap`}>
          <rect x="35" y="0" width="29" height="64" />
        </clipPath>
      </defs>
      {/* Navy badge on light surfaces; cobalt badge on dark surfaces (brand rule) */}
      <rect width="64" height="64" rx="15" className={inverted ? 'fill-brand-cobalt' : 'fill-brand-navy dark:fill-brand-cobalt'} />
      <g fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 50V16" stroke="#fff" />
        <path d="M21 16h14a11 11 0 0 1 0 22H21" stroke="#fff" />
        <path d="M21 16h14a11 11 0 0 1 0 22H21" stroke="#13B5C7" clipPath={`url(#${id}-cap)`} />
      </g>
      <circle cx="45" cy="49" r="4.5" fill="#13B5C7" />
    </svg>
  );
}

export function Logo({ inverted, compact }: { inverted?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Pharmodry — Precision in Every Batch.">
      <LogoMark inverted={inverted} />
      {!compact && (
        <div className="leading-tight">
          <div className={cn('text-[16px] font-bold tracking-tight', inverted ? 'text-white' : 'text-brand-navy dark:text-foreground')}>Pharmodry</div>
          <div className={cn('text-[11px] font-medium', inverted ? 'text-[#A9BBD9]' : 'text-muted-foreground')}>Precision in Every Batch.</div>
        </div>
      )}
    </div>
  );
}
