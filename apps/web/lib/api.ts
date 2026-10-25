/**
 * Browser API client. Access tokens live only in memory; the refresh token is an httpOnly cookie.
 * All requests are same-origin (/api/v1 is proxied by Next.js), so no secrets reach the browser.
 */
import type { BlockingReason, PageMeta } from '@pharmodry/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public correlationId?: string,
  ) {
    super(message);
  }
  get reasons(): BlockingReason[] {
    const d = this.details as { reasons?: BlockingReason[] } | undefined;
    return d?.reasons ?? [];
  }
  get fieldErrors(): string[] {
    return Array.isArray(this.details) ? (this.details as string[]) : [];
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function onExpired(cb: () => void) {
  onSessionExpired = cb;
}

export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'pharmodry' } })
      .then(async (r) => {
        if (!r.ok) {
          accessToken = null;
          return false;
        }
        const body = (await r.json()) as { data: { accessToken: string } };
        accessToken = body.data.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function qs(q?: Query) {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<{ data: T; meta?: PageMeta & Record<string, unknown> }> {
  const headers: Record<string, string> = { 'X-Requested-With': 'pharmodry' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/v1${path}`, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
    const ok = await refreshSession();
    if (ok) return request<T>(method, path, body, false);
    onSessionExpired?.();
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = json.error ?? {};
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? res.statusText, e.details, e.correlationId);
  }
  return json;
}

export const api = {
  get: <T>(path: string, q?: Query) => request<T>('GET', `${path}${qs(q)}`).then((r) => r.data),
  page: <T>(path: string, q?: Query) => request<T[]>('GET', `${path}${qs(q)}`),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body).then((r) => r.data),
  del: <T>(path: string) => request<T>('DELETE', path).then((r) => r.data),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form).then((r) => r.data),
  /** Downloads a server-generated file (CSV exports) with the current token. */
  async download(path: string, q?: Query) {
    const run = () => fetch(`/api/v1${path}${qs(q)}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
    let res = await run();
    if (res.status === 401 && (await refreshSession())) res = await run();
    if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Export failed');
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'export.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.fieldErrors.length) return e.fieldErrors.join('; ');
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
