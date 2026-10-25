/**
 * Same-origin proxy to the Pharmodry API. The browser never calls the API host directly and no
 * secret ever reaches the client. API_URL is read at runtime, so one build works in every environment.
 */
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const HOP_BY_HOP = ['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade'];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const api = process.env.API_URL ?? 'http://localhost:4100';
  const target = `${api}/api/v1/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  HOP_BY_HOP.forEach((h) => headers.delete(h));
  const fwd = req.headers.get('x-forwarded-for');
  headers.set('x-forwarded-for', fwd ?? '127.0.0.1');
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let res: Response;
  try {
    res = await fetch(target, { method: req.method, headers, body: hasBody ? await req.arrayBuffer() : undefined, redirect: 'manual', cache: 'no-store' });
  } catch {
    return Response.json({ error: { code: 'API_UNAVAILABLE', message: 'The Pharmodry API is not reachable. Please try again shortly.' } }, { status: 502 });
  }
  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie', 'connection'].includes(k)) out.set(k, v);
  });
  for (const c of res.headers.getSetCookie()) out.append('set-cookie', c);
  return new Response(res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
