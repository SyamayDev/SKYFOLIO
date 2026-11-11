/**
 * Rantai AI gratis (docs/06 bagian 2.2): Groq → Gemini → Cloudflare Workers AI. Ketiganya punya endpoint
 * kompatibel OpenAI chat completions. Penyedia tanpa key/model di env dilewati. Timeout 8 detik per
 * penyedia; balasan wajib JSON {say, actions} — gagal parse → ulang sekali dengan instruksi lebih ketat →
 * penyedia berikutnya.
 *
 * Endpoint (dicek dari dokumentasi resmi, Nov 2026):
 * - Groq:       https://api.groq.com/openai/v1/chat/completions
 * - Gemini:     https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
 * - Cloudflare: https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/v1/chat/completions
 */
import { z } from 'zod';

export interface Provider {
  name: 'groq' | 'gemini' | 'cloudflare';
  url: string;
  key: string;
  model: string;
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const ReplySchema = z.object({
  say: z.string().min(1).max(2000),
  actions: z.array(z.object({ tool: z.string().max(40), args: z.record(z.string(), z.unknown()).default({}) })).max(6).default([]),
});
export type Reply = z.infer<typeof ReplySchema>;

export function providersFromEnv(env: Record<string, string | undefined> = process.env): Provider[] {
  const out: Provider[] = [];
  if (env.GROQ_API_KEY && env.GROQ_MODEL) out.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: env.GROQ_API_KEY, model: env.GROQ_MODEL });
  if (env.GEMINI_API_KEY && env.GEMINI_MODEL)
    out.push({ name: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
  if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN && env.CF_AI_MODEL)
    out.push({
      name: 'cloudflare',
      url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/ai/v1/chat/completions`,
      key: env.CF_API_TOKEN,
      model: env.CF_AI_MODEL,
    });
  return out;
}

/** Ambil objek JSON pertama dari teks (model kadang membungkus dengan ```json atau kalimat). */
export function parseReply(text: string): Reply | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const r = ReplySchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * Model penalaran (Groq gpt-oss, Gemini 2.5/3.x, Qwen3, DeepSeek-R1) memakai token "berpikir" dari jatah yang
 * sama dengan jawaban. Dengan jatah kecil, JSON jawaban bisa terpotong, jadi jatahnya dibesarkan dan usaha
 * berpikirnya diminta rendah (lebih cepat).
 */
export function isReasoningModel(model: string): boolean {
  return /gpt-oss|gemini-(2\.5|[3-9])|qwen3|deepseek-r1/i.test(model);
}

export function requestBody(p: Provider, messages: ChatMsg[], plain = false): Record<string, unknown> {
  const body: Record<string, unknown> = { model: p.model, messages, temperature: 0.4, max_tokens: 260 };
  if (!plain && isReasoningModel(p.model)) {
    body.max_tokens = 1200;
    if (p.name !== 'cloudflare') body.reasoning_effort = 'low';
  }
  return body;
}

export async function callProvider(p: Provider, messages: ChatMsg[], timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const post = (body: Record<string, unknown>): Promise<Response> =>
    fetchImpl(p.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  try {
    let res = await post(requestBody(p, messages));
    // Penyedia menolak parameter penalaran (model/versi API berbeda) → ulang sekali dengan permintaan polos.
    if (res.status === 400 && isReasoningModel(p.model)) res = await post(requestBody(p, messages, true));
    if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; result?: { response?: string } };
    return j.choices?.[0]?.message?.content ?? j.result?.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export interface ChainResult {
  reply: Reply;
  provider: Provider['name'];
}

/**
 * Jalankan rantai. `build(strict)` menyusun pesan (strict = percobaan ulang setelah JSON rusak).
 * Mengembalikan null bila semua penyedia gagal.
 */
export async function runChain(
  providers: Provider[],
  build: (strict: boolean) => ChatMsg[],
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; log?: (m: string) => void } = {},
): Promise<ChainResult | null> {
  const timeout = opts.timeoutMs ?? 8000;
  for (const p of providers) {
    for (const strict of [false, true]) {
      try {
        const text = await callProvider(p, build(strict), timeout, opts.fetchImpl);
        const reply = parseReply(text);
        if (reply) return { reply, provider: p.name };
        opts.log?.(`${p.name}: JSON tidak valid${strict ? ' (ulang)' : ''}`);
      } catch (e) {
        opts.log?.(`${p.name}: ${(e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message}`);
        break; // error jaringan/HTTP/timeout → langsung penyedia berikutnya
      }
    }
  }
  return null;
}
