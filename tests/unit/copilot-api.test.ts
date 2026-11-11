/**
 * /api/copilot dengan penyedia tiruan (docs/06 bagian 10): rantai fallback, JSON rusak, timeout,
 * batas pemakaian, validasi aksi; plus penyaring lampion dan validasi aksi di klien.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleCopilot, sanitizeActions } from '../../api/copilot';
import { moderateText } from '../../api/_lib/badwords';
import { callProvider, parseReply, requestBody, type Provider } from '../../api/_lib/providers';
import { LIMITS, setStore } from '../../api/_lib/ratelimit';
import { loadContent } from '../../scripts/lib/content';
import { validateAction, validateActions } from '../../src/ai/Actions';

const P = (name: Provider['name']): Provider => ({ name, url: `https://${name}.test/v1/chat/completions`, key: 'k', model: 'm' });
const req = (body: unknown, ip = '1.2.3.4'): Request =>
  new Request('https://skyfolio.test/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, host: 'skyfolio.test', origin: 'https://skyfolio.test' },
    body: JSON.stringify(body),
  });
const ok = (content: string): Response => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

/** fetch tiruan: peta url → urutan balasan. */
function fakeFetch(plan: Record<string, ((signal?: AbortSignal | null) => Promise<Response> | Response)[]>): { fn: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push(u);
    const host = new URL(u).hostname.split('.')[0]!;
    const q = plan[host] ?? [];
    const next = q.shift();
    if (!next) throw new Error('no plan');
    if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    return next(init?.signal);
  }) as typeof fetch;
  return { fn, calls };
}

beforeEach(() => setStore(null));
afterEach(() => setStore(null));

describe('/api/copilot', () => {
  it('tanpa penyedia → offline', async () => {
    const r = await (await handleCopilot(req({ message: 'halo', lang: 'id' }), { providers: [] })).json();
    expect(r).toEqual({ mode: 'offline', reason: 'no_provider' });
  });

  it('input tidak valid → 400', async () => {
    const r = await handleCopilot(req({ message: '', lang: 'xx' }), { providers: [P('groq')] });
    expect(r.status).toBe(400);
  });

  it('Groq gagal (500) → Gemini menjawab', async () => {
    const f = fakeFetch({ groq: [() => new Response('err', { status: 500 })], gemini: [() => ok('{"say":"Halo Kak!","actions":[{"tool":"fly_to_zone","args":{"zoneId":"post-office"}}]}')] });
    const r = await (await handleCopilot(req({ message: 'siapa kamu?', lang: 'id' }), { providers: [P('groq'), P('gemini')], fetchImpl: f.fn })).json();
    expect(r.mode).toBe('ai');
    expect(r.provider).toBe('gemini');
    expect(r.say).toBe('Halo Kak!');
    expect(r.actions).toEqual([{ tool: 'fly_to_zone', args: { zoneId: 'post-office' } }]);
  });

  it('JSON rusak → diulang sekali dengan instruksi ketat, lalu penyedia berikutnya', async () => {
    const f = fakeFetch({
      groq: [() => ok('maaf saya tidak bisa json'), () => ok('masih bukan json')],
      cloudflare: [() => ok('```json\n{"say":"Hi Captain!","actions":[]}\n```')],
    });
    const r = await (await handleCopilot(req({ message: 'hello', lang: 'en' }), { providers: [P('groq'), P('cloudflare')], fetchImpl: f.fn })).json();
    expect(f.calls.filter((c) => c.includes('groq')).length).toBe(2);
    expect(r).toMatchObject({ mode: 'ai', provider: 'cloudflare', say: 'Hi Captain!' });
  });

  it('timeout → penyedia berikutnya; semua gagal → offline', async () => {
    // Seperti fetch asli: menggantung sampai dibatalkan lewat AbortSignal.
    const hang = (signal?: AbortSignal | null): Promise<Response> =>
      new Promise((_, fail) => signal?.addEventListener('abort', () => fail(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const f = fakeFetch({ groq: [hang], gemini: [() => new Response('x', { status: 429 })] });
    const t0 = Date.now();
    const r = await (await handleCopilot(req({ message: 'tes', lang: 'id' }), { providers: [P('groq'), P('gemini')], fetchImpl: f.fn, timeoutMs: 50 })).json();
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r).toEqual({ mode: 'offline', reason: 'providers_failed' });
  });

  it('batas pemakaian per IP → offline (limit)', async () => {
    const make = (): typeof fetch => fakeFetch({ groq: Array.from({ length: 40 }, () => () => ok('{"say":"ok","actions":[]}')) }).fn;
    const fetchImpl = make();
    let last: { mode: string; reason?: string } = { mode: '' };
    for (let i = 0; i <= LIMITS.perIpHour; i++) last = await (await handleCopilot(req({ message: `q${i}`, lang: 'id' }, '9.9.9.9'), { providers: [P('groq')], fetchImpl })).json();
    expect(last).toEqual({ mode: 'offline', reason: 'limit' });
    // IP lain masih boleh.
    const other = await (await handleCopilot(req({ message: 'q', lang: 'id' }, '8.8.8.8'), { providers: [P('groq')], fetchImpl })).json();
    expect(other.mode).toBe('ai');
  });

  it('jawaban dipotong & aksi tak dikenal dibuang', async () => {
    const long = 'a'.repeat(900);
    const f = fakeFetch({ groq: [() => ok(JSON.stringify({ say: long, actions: [{ tool: 'rm_rf', args: {} }, { tool: 'open_link', args: { linkId: 'http://evil' } }, { tool: 'go_to_moon', args: {} }] }))] });
    const r = await (await handleCopilot(req({ message: 'x', lang: 'id' }), { providers: [P('groq')], fetchImpl: f.fn })).json();
    expect(r.say.length).toBeLessThanOrEqual(240);
    expect(r.actions).toEqual([{ tool: 'go_to_moon', args: {} }]);
  });

  it('origin asing ditolak', async () => {
    const r = new Request('https://skyfolio.test/api/copilot', { method: 'POST', headers: { origin: 'https://evil.example', host: 'skyfolio.test' }, body: '{}' });
    expect((await handleCopilot(r, { providers: [P('groq')] })).status).toBe(403);
  });
});

describe('model penalaran', () => {
  const groq: Provider = { name: 'groq', url: 'https://groq.test', key: 'k', model: 'openai/gpt-oss-20b' };
  it('gpt-oss/Gemini 3 dapat jatah token besar + usaha rendah; model biasa tidak', () => {
    expect(requestBody(groq, [])).toMatchObject({ max_tokens: 1200, reasoning_effort: 'low' });
    expect(requestBody({ ...groq, name: 'gemini', model: 'gemini-3.5-flash-lite' }, [])).toMatchObject({ reasoning_effort: 'low' });
    expect(requestBody({ ...groq, model: 'llama-3.1-8b-instant' }, [])).not.toHaveProperty('reasoning_effort');
    expect(requestBody({ ...groq, name: 'cloudflare', model: '@cf/openai/gpt-oss-20b' }, [])).not.toHaveProperty('reasoning_effort');
  });
  it('parameter penalaran ditolak (400) → diulang polos sekali', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fake = (async (_u: string, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(b);
      if ('reasoning_effort' in b) return new Response('bad', { status: 400 });
      return Response.json({ choices: [{ message: { content: '{"say":"halo","actions":[]}' } }] });
    }) as typeof fetch;
    expect(await callProvider(groq, [], 2000, fake)).toContain('halo');
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).not.toHaveProperty('reasoning_effort');
  });
});

describe('parser & sanitasi', () => {
  it('parseReply mengambil objek JSON dari teks campuran', () => {
    expect(parseReply('Here: {"say":"hi","actions":[]} thanks')).toEqual({ say: 'hi', actions: [] });
    expect(parseReply('no json')).toBeNull();
    expect(parseReply('{"say": 5}')).toBeNull();
  });
  it('sanitizeActions maks. 2 aksi sah', () => {
    expect(
      sanitizeActions([
        { tool: 'play_radio', args: { stationId: 'funkot' } },
        { tool: 'play_radio', args: { stationId: 'energi' } },
        { tool: 'set_time', args: { mode: 'night' } },
        { tool: 'emote', args: { type: 'cheer' } },
      ]),
    ).toEqual([
      { tool: 'play_radio', args: { stationId: 'funkot' } },
      { tool: 'set_time', args: { mode: 'night' } },
    ]);
  });
});

describe('aksi di klien', () => {
  const { content } = loadContent();
  it('menolak id yang tidak ada di konten', () => {
    expect(validateAction({ tool: 'fly_to_zone', args: { zoneId: 'mars' } }, content)).toBeNull();
    expect(validateAction({ tool: 'fly_to_zone', args: { zoneId: 'post-office' } }, content)).toEqual({ tool: 'fly_to_zone', args: { zoneId: 'post-office' } });
    expect(validateAction({ tool: 'fly_to_project', args: { projectId: 'featured:1' } }, content)).not.toBeNull();
    expect(validateAction({ tool: 'open_link', args: { linkId: 'https://evil.example' } }, content)).toBeNull();
    expect(validateAction({ tool: 'change_skin', args: { skinId: 'gold' } }, content, ['toyplane'])).toBeNull();
    expect(validateAction({ tool: 'eval', args: {} }, content)).toBeNull();
  });
  it('maks. 2 aksi', () => {
    expect(validateActions([{ tool: 'emote', args: { type: 'wave' } }, { tool: 'go_to_moon' }, { tool: 'go_to_space' }], content)).toHaveLength(2);
  });
});

describe('penjaga lampion', () => {
  it('menerima pesan wajar', () => {
    expect(moderateText('Salam dari Medan!')).toEqual({ ok: true });
    expect(moderateText('Semangat Kak Aril')).toEqual({ ok: true });
  });
  it('menolak tautan, nomor telepon, kata kasar, dan terlalu panjang', () => {
    expect(moderateText('cek www.contoh.com').reason).toBe('link');
    expect(moderateText('wa 081234567890').reason).toBe('phone');
    expect(moderateText('dasar b4ngs4t').reason).toBe('bad_word');
    expect(moderateText('F U C K').ok).toBe(true); // huruf terpisah spasi tetap lolos (bukan kata)
    expect(moderateText('fuuuck').reason).toBe('bad_word');
    expect(moderateText('x'.repeat(31)).reason).toBe('too_long');
    expect(moderateText('   ').reason).toBe('empty');
  });
});
