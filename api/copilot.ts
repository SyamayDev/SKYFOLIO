/**
 * POST /api/copilot — Piko + rantai AI gratis (docs/06 bagian 2.2–2.3, docs/10).
 * Tanpa key apa pun → {"mode":"offline"} dan klien menjawab dari FAQ. Semua input divalidasi zod,
 * dibatasi lajunya per IP (hash + garam) dan global per hari.
 */
import { z } from 'zod';
import { COPILOT_NAME, IDS, KNOWLEDGE } from './_generated/knowledge.js';
import { HttpError, clientIp, hashIp, json, readJson, sameOrigin } from './_lib/http.js';
import { providersFromEnv, runChain, type ChatMsg, type Provider } from './_lib/providers.js';
import { allow } from './_lib/ratelimit.js';
import { MAX_REPLY_CHARS, systemPrompt } from './_lib/systemPrompt.js';

const Body = z.object({
  message: z.string().trim().min(1).max(300),
  lang: z.enum(['id', 'en']).default('id'),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(300) }))
    .max(6)
    .default([]),
  context: z
    .object({ zone: z.string().max(40).nullable().optional(), regime: z.string().max(20).optional(), chatter: z.string().max(10).optional() })
    .partial()
    .default({}),
});

const PANELS = new Set(['profile', 'projects', 'skills', 'timeline', 'contact', 'certificates', 'passport', 'settings', 'map']);

/** Validasi aksi di server (klien memvalidasi lagi terhadap konten). */
export function sanitizeActions(raw: { tool: string; args: Record<string, unknown> }[]): { tool: string; args: Record<string, string> }[] {
  const out: { tool: string; args: Record<string, string> }[] = [];
  const s = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 64) : '');
  for (const a of raw) {
    const g = a.args ?? {};
    let ok: Record<string, string> | null = null;
    switch (a.tool) {
      case 'fly_to_zone':
        ok = IDS.zones.includes(s(g.zoneId)) ? { zoneId: s(g.zoneId) } : null;
        break;
      case 'fly_to_project':
        ok = IDS.projects.includes(s(g.projectId)) || /^featured:[1-3]$/.test(s(g.projectId)) ? { projectId: s(g.projectId) } : null;
        break;
      case 'fly_to_landmark':
        ok = IDS.landmarks.includes(s(g.landmarkId)) ? { landmarkId: s(g.landmarkId) } : null;
        break;
      case 'open_link':
        ok = IDS.links.includes(s(g.linkId)) ? { linkId: s(g.linkId) } : null;
        break;
      case 'show_panel':
        ok = PANELS.has(s(g.panel)) ? { panel: s(g.panel) } : null;
        break;
      case 'open_cv':
        ok = { lang: s(g.lang) === 'en' ? 'en' : 'id' };
        break;
      case 'start_tour':
        ok = { kind: 'recruiter' };
        break;
      case 'set_weather':
        ok = ['real', 'clear', 'rain', 'storm', 'snow'].includes(s(g.kind)) ? { kind: s(g.kind) } : null;
        break;
      case 'set_time':
        ok = ['real', 'day', 'sunset', 'night'].includes(s(g.mode)) ? { mode: s(g.mode) } : null;
        break;
      case 'go_to_space':
      case 'go_to_moon':
        ok = {};
        break;
      case 'play_radio':
        ok = ['syamay', 'funkot', 'timur', 'gurun', 'energi'].includes(s(g.stationId)) ? { stationId: s(g.stationId) } : null;
        break;
      case 'emote':
        ok = ['wave', 'cheer', 'think', 'sleepy', 'wow'].includes(s(g.type)) ? { type: s(g.type) } : null;
        break;
    }
    if (ok && !out.some((x) => x.tool === a.tool)) out.push({ tool: a.tool, args: ok });
    if (out.length >= 2) break;
  }
  return out;
}

/** Inti handler, bisa diuji tanpa HTTP (penyedia & fetch disuntikkan). */
export async function handleCopilot(
  req: Request,
  deps: { providers?: Provider[]; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: 'invalid_input' }, 400);
    body = parsed.data;
  } catch (e) {
    return json({ error: e instanceof HttpError ? e.code : 'bad_request' }, e instanceof HttpError ? e.status : 400);
  }
  const providers = deps.providers ?? providersFromEnv();
  if (!providers.length) return json({ mode: 'offline', reason: 'no_provider' });
  if (!(await allow(await hashIp(clientIp(req))))) return json({ mode: 'offline', reason: 'limit' });

  const build = (strict: boolean): ChatMsg[] => [
    { role: 'system', content: systemPrompt({ name: COPILOT_NAME, lang: body.lang, knowledge: KNOWLEDGE, ids: IDS, context: body.context, strict }) },
    ...body.history.map((h) => ({ role: h.role, content: h.content }) as ChatMsg),
    { role: 'user', content: body.message },
  ];
  const result = await runChain(providers, build, { timeoutMs: deps.timeoutMs, fetchImpl: deps.fetchImpl, log: (m) => console.warn(`[copilot] ${m}`) });
  if (!result) return json({ mode: 'offline', reason: 'providers_failed' });
  const say = result.reply.say.replace(/\s+/g, ' ').trim().slice(0, MAX_REPLY_CHARS);
  return json({ mode: 'ai', say, actions: sanitizeActions(result.reply.actions), provider: result.provider });
}

export async function POST(req: Request): Promise<Response> {
  return handleCopilot(req);
}

export async function GET(): Promise<Response> {
  return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
}
