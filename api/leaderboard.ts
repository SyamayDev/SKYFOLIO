/**
 * /api/leaderboard — Sirkuit Langit, 10 besar harian (reset 00.00 WIB). Anti-curang sederhana (docs/09 bagian 4):
 * token sesi bertanda tangan HMAC saat lap dimulai; kiriman ditolak bila token salah/kedaluwarsa, urutan
 * cincin tidak naik, waktu di bawah batas fisik, atau lebih dari 20 kiriman per hari per IP.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { moderateText } from './_lib/badwords';
import { HttpError, clientIp, hashIp, json, readJson, sameOrigin } from './_lib/http';
import { getStore } from './_lib/ratelimit';

export const RINGS = 24;
export const MIN_LAP = 25;
const TOKEN_TTL = 20 * 60 * 1000;

const secret = (): string => process.env.LEADERBOARD_SECRET || 'skyfolio-dev-secret';
const dayWib = (t = Date.now()): number => Math.floor((t + 7 * 3_600_000) / 86_400_000);

export function signToken(now = Date.now()): string {
  const payload = `${now}.${randomBytes(6).toString('hex')}`;
  const mac = createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 32);
  return `${payload}.${mac}`;
}

export function verifyToken(token: string, now = Date.now()): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, mac] = parts as [string, string, string];
  const expect = createHmac('sha256', secret()).update(`${ts}.${nonce}`).digest('hex').slice(0, 32);
  if (mac.length !== expect.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return false;
  const t = Number(ts);
  return Number.isFinite(t) && now - t < TOKEN_TTL && now - t >= 0;
}

/** Pemeriksaan lap (murni, bisa diuji). `splits` = waktu tiap cincin 0..23 sejak start. */
export function validLap(time: number, splits: number[], tokenAgeMs: number): boolean {
  if (time < MIN_LAP || splits.length !== RINGS) return false;
  for (let i = 1; i < splits.length; i++) if (!(splits[i]! > splits[i - 1]!)) return false;
  if (splits[splits.length - 1]! >= time) return false;
  // Lap tidak mungkin lebih lama dari umur token (token diminta saat lap dimulai).
  return time * 1000 <= tokenAgeMs + 5000;
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({
    action: z.literal('submit'),
    token: z.string().max(80),
    time: z.number().min(0).max(3600),
    splits: z.array(z.number().min(0).max(3600)).max(64),
    name: z.string().trim().max(16).optional(),
  }),
]);

async function top(day = dayWib()): Promise<{ name: string; time: number }[]> {
  const raw = await getStore().zrange(`lb:${day}`, 10);
  return raw.map((r) => ({ name: r.member.split('#')[0] ?? '?', time: r.score }));
}

export async function GET(): Promise<Response> {
  try {
    return json({ day: dayWib(), top: await top() }, 200, { 'Cache-Control': 'public, max-age=20' });
  } catch {
    return json({ day: dayWib(), top: [], offline: true });
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false }, 403);
  let body: z.infer<typeof Body>;
  try {
    const p = Body.safeParse(await readJson(req, 4096));
    if (!p.success) return json({ ok: false, reason: 'invalid' }, 400);
    body = p.data;
  } catch (e) {
    return json({ ok: false }, e instanceof HttpError ? e.status : 400);
  }
  if (body.action === 'start') return json({ token: signToken() });
  if (!verifyToken(body.token)) return json({ ok: false, reason: 'token' }, 400);
  const age = Date.now() - Number(body.token.split('.')[0]);
  if (!validLap(body.time, body.splits, age)) return json({ ok: false, reason: 'lap' }, 400);
  try {
    const s = getStore();
    const ip = await hashIp(clientIp(req));
    if ((await s.incr(`lb:rl:${ip}:${dayWib()}`, 86_400)) > 20) return json({ ok: false, reason: 'limit' }, 429);
    const name = body.name && moderateText(body.name, 16).ok ? body.name : 'Captain';
    const time = Math.round(body.time * 100) / 100;
    await s.zadd(`lb:${dayWib()}`, time, `${name}#${ip.slice(0, 6)}`);
    const list = await top();
    const rank = list.findIndex((r) => r.name === name && Math.abs(r.time - time) < 0.005) + 1;
    return json({ ok: true, rank: rank || null, top: list });
  } catch {
    return json({ ok: false, reason: 'storage' }, 503);
  }
}
