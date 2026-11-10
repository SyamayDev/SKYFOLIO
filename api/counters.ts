/**
 * /api/counters — counter global (docs/09 bagian 6): total km semua pengunjung, penerbangan, penerjun
 * Kawah Nekat (Phoenix tiap kelipatan 100), kunjungan. Input dijepit & dibatasi supaya tidak bisa digelembungkan.
 */
import { z } from 'zod';
import { HttpError, clientIp, hashIp, json, readJson, sameOrigin } from './_lib/http';
import { getStore } from './_lib/ratelimit';

const Body = z.object({ event: z.enum(['visit', 'flight', 'km', 'dive']), km: z.number().min(0).max(500).optional() });

async function totals(): Promise<{ km: number; flights: number; divers: number; visits: number }> {
  const s = getStore();
  const [km, flights, divers, visits] = await Promise.all(['ctr:km', 'ctr:flights', 'ctr:divers', 'ctr:visits'].map((k) => s.get(k)));
  return { km: Number(km ?? 0), flights: Number(flights ?? 0), divers: Number(divers ?? 0), visits: Number(visits ?? 0) };
}

export async function GET(): Promise<Response> {
  try {
    return json(await totals(), 200, { 'Cache-Control': 'public, max-age=60' });
  } catch {
    return json({ km: 0, flights: 0, divers: 0, visits: 0, offline: true });
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false }, 403);
  let body: z.infer<typeof Body>;
  try {
    const p = Body.safeParse(await readJson(req, 512));
    if (!p.success) return json({ ok: false }, 400);
    body = p.data;
  } catch (e) {
    return json({ ok: false }, e instanceof HttpError ? e.status : 400);
  }
  const s = getStore();
  try {
    const ip = await hashIp(clientIp(req));
    const hour = Math.floor(Date.now() / 3_600_000);
    if ((await s.incr(`ctr:rl:${ip}:${hour}`, 3600)) > 120) return json({ ok: false, reason: 'limit' }, 429);
    let divers: number | undefined;
    if (body.event === 'visit') await s.incrBy('ctr:visits', 1);
    else if (body.event === 'flight') await s.incrBy('ctr:flights', 1);
    else if (body.event === 'km') await s.incrBy('ctr:km', Math.min(500, body.km ?? 0));
    else divers = await s.incrBy('ctr:divers', 1);
    return json({ ok: true, ...(divers !== undefined ? { divers } : {}) });
  } catch {
    return json({ ok: false, reason: 'storage' }, 503);
  }
}
