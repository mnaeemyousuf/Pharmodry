import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = 'Asia/Karachi';

export function fmtDate(v?: string | Date | null) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
}

export function fmtDateTime(v?: string | Date | null) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function fmtNum(v?: number | null, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function fmtPkr(v?: number | null) {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1_000_000) return `PKR ${(v / 1_000_000).toFixed(2)} M`;
  if (Math.abs(v) >= 1000) return `PKR ${(v / 1000).toFixed(1)} K`;
  return `PKR ${fmtNum(v, 0)}`;
}

export function relativeDays(v?: string | Date | null) {
  if (!v) return '—';
  const days = Math.round((new Date(v).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} d` : `${-days} d ago`;
}

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
