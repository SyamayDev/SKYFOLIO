/**
 * /api/lanterns — Lampion Langit Danau Toba (docs/09 bagian 5).
 * GET: lampion terbaru. POST {text, country}: disaring lokal (badwords) + klasifikasi AI opsional,
 * satu lampion per pengunjung per hari. Tanpa Upstash → disimpan di memori instans (tetap berfungsi).
 */
import { z } from 'zod';
import { moderateText } from './_lib/badwords';
import { HttpError, clientIp, hashIp, json, readJson, sameOrigin } from './_lib/http';
import { providersFromEnv, runChain } from './_lib/providers';
import { getStore } from './_lib/ratelimit';

const KEY = 'lanterns:list';
const MAX = 64;
const Body = z.object({ text: z.string().trim().min(1).max(30), country: z.string().regex(/^[A-Z]{2}$/).optional() });

export interface Lantern {
  id: string;
  text: string;
  country: string;
  seed: number;
  t: number;
}

/** Klasifikasi singkat lewat rantai AI (opsional, timeout pendek). Gagal → percaya saringan lokal. */
async function aiOk(text: string): Promise<boolean> {
  const providers = providersFromEnv();
  if (!providers.length) return true;
  const res = await runChain(
    providers,
    () => [
      {
        role: 'system',
        content:
          'You moderate short wishes written on sky lanterns on a friendly portfolio site. Reply ONLY with JSON {"say":"ok","actions":[]} if the text is safe and kind, or {"say":"no","actions":[]} if it is insulting, sexual, hateful, violent, political, spam, or contains personal data.',
      },
      { role: 'user', content: text },
    ],
    { timeoutMs: 4000 },
  ).catch(() => null);
  return !res || res.reply.say.trim().toLowerCase() !== 'no';
}

export async function GET(): Promise<Response> {
  try {
    const raw = await getStore().lrange(KEY, 32);
    const list = raw.map((r) => JSON.parse(r) as Lantern).filter((l) => l && typeof l.text === 'string');
    return json({ lanterns: list }, 200, { 'Cache-Control': 'public, max-age=30' });
  } catch {
    return json({ lanterns: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false, reason: 'forbidden' }, 403);
  let body: z.infer<typeof Body>;
  try {
    const p = Body.safeParse(await readJson(req, 1024));
    if (!p.success) return json({ ok: false, reason: 'invalid' }, 400);
    body = p.data;
  } catch (e) {
    return json({ ok: false, reason: e instanceof HttpError ? e.code : 'bad_request' }, 400);
  }
  const v = moderateText(body.text);
  if (!v.ok) return json({ ok: false, reason: v.reason });
  const store = getStore();
  const ip = await hashIp(clientIp(req));
  const day = Math.floor(Date.now() / 86_400_000);
  try {
    if ((await store.incr(`lantern:ip:${ip}:${day}`, 86_400)) > 1) return json({ ok: false, reason: 'daily_limit' });
    if (!(await aiOk(body.text))) return json({ ok: false, reason: 'bad_word' });
    const l: Lantern = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      text: body.text,
      country: body.country ?? 'ID',
      seed: Math.floor(Math.random() * 1e6),
      t: Date.now(),
    };
    await store.lpushTrim(KEY, JSON.stringify(l), MAX);
    return json({ ok: true, lantern: l });
  } catch {
    return json({ ok: false, reason: 'storage' }, 503);
  }
}
