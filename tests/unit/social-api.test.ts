/** API sosial (docs/09 bagian 4–6): token HMAC & validasi lap, lampion, counter — dengan penyimpanan memori. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as countersGet, POST as countersPost } from '../../api/counters';
import { MIN_LAP, RINGS, signToken, validLap, verifyToken, GET as boardGet, POST as boardPost } from '../../api/leaderboard';
import { DELETE as lanternsDelete, GET as lanternsGet, POST as lanternsPost } from '../../api/lanterns';
import { setStore } from '../../api/_lib/ratelimit';

const post = (path: string, body: unknown, ip = '5.5.5.5'): Request =>
  new Request(`https://skyfolio.test/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, host: 'skyfolio.test', origin: 'https://skyfolio.test' },
    body: JSON.stringify(body),
  });

beforeEach(() => setStore(null));

describe('leaderboard', () => {
  it('token sah, dirusak, dan kedaluwarsa', () => {
    const tok = signToken();
    expect(verifyToken(tok)).toBe(true);
    expect(verifyToken(tok.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))).toBe(false);
    expect(verifyToken(signToken(Date.now() - 60 * 60 * 1000))).toBe(false);
    expect(verifyToken('x.y')).toBe(false);
  });
  it('validLap menolak lap terlalu cepat, urutan salah, atau lebih lama dari umur token', () => {
    const splits = Array.from({ length: RINGS }, (_, i) => i * 2);
    expect(validLap(60, splits, 70_000)).toBe(true);
    expect(validLap(MIN_LAP - 1, splits, 70_000)).toBe(false);
    expect(validLap(60, [...splits].reverse(), 70_000)).toBe(false);
    expect(validLap(60, splits.slice(1), 70_000)).toBe(false);
    expect(validLap(60, splits, 10_000)).toBe(false);
  });
  it('kirim lap lengkap → masuk 10 besar', async () => {
    const { token } = (await (await boardPost(post('leaderboard', { action: 'start' }))).json()) as { token: string };
    // Umur token dibuat-buat: ganti cap waktu agar seolah lap berlangsung 40 dtk (token baru dibuat lagi dengan waktu lampau).
    const old = signToken(Date.now() - 45_000);
    expect(token).toBeTruthy();
    const splits = Array.from({ length: RINGS }, (_, i) => i * 1.5);
    const r = (await (await boardPost(post('leaderboard', { action: 'submit', token: old, time: 40, splits, name: 'Kapten Uji' }))).json()) as { ok: boolean; rank: number };
    expect(r.ok).toBe(true);
    expect(r.rank).toBe(1);
    const top = (await (await boardGet()).json()) as { top: { name: string; time: number }[] };
    expect(top.top[0]).toEqual({ name: 'Kapten Uji', time: 40 });
  });
});

describe('lampion', () => {
  it('menerima pesan wajar, menolak kata kasar, satu per hari per IP', async () => {
    const ok = (await (await lanternsPost(post('lanterns', { text: 'Salam dari Medan', country: 'ID' }))).json()) as { ok: boolean };
    expect(ok.ok).toBe(true);
    const again = (await (await lanternsPost(post('lanterns', { text: 'Lagi dong' }))).json()) as { reason: string };
    expect(again.reason).toBe('daily_limit');
    const bad = (await (await lanternsPost(post('lanterns', { text: 'dasar bangsat' }, '6.6.6.6'))).json()) as { reason: string };
    expect(bad.reason).toBe('bad_word');
    const list = (await (await lanternsGet()).json()) as { lanterns: { text: string }[] };
    expect(list.lanterns.map((l) => l.text)).toEqual(['Salam dari Medan']);
  });
});

describe('hapus lampion (ADMIN_TOKEN)', () => {
  const TOKEN = 'admin-token-yang-panjang-sekali-123';
  const del = (id: string, auth?: string): Request =>
    new Request(`https://skyfolio.test/api/lanterns?id=${id}`, { method: 'DELETE', headers: auth ? { authorization: auth } : {} });
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });
  it('tanpa token / token salah / token belum diisi → 403; token benar → terhapus', async () => {
    const made = (await (await lanternsPost(post('lanterns', { text: 'Semangat Aril' }, '7.7.7.7'))).json()) as { lantern: { id: string } };
    const id = made.lantern.id;
    expect((await lanternsDelete(del(id, `Bearer ${TOKEN}`))).status).toBe(403); // ADMIN_TOKEN belum diisi
    process.env.ADMIN_TOKEN = TOKEN;
    expect((await lanternsDelete(del(id))).status).toBe(403);
    expect((await lanternsDelete(del(id, 'Bearer salah'))).status).toBe(403);
    expect((await lanternsDelete(del('bad id!', `Bearer ${TOKEN}`))).status).toBe(400);
    expect((await lanternsDelete(del('tidakada1', `Bearer ${TOKEN}`))).status).toBe(404);
    expect((await lanternsDelete(del(id, `Bearer ${TOKEN}`))).status).toBe(200);
    const list = (await (await lanternsGet()).json()) as { lanterns: { id: string }[] };
    expect(list.lanterns.some((l) => l.id === id)).toBe(false);
  });
});

describe('counter', () => {
  it('menjumlah km (dijepit) dan penerjun', async () => {
    await countersPost(post('counters', { event: 'km', km: 12.5 }));
    await countersPost(post('counters', { event: 'flight' }));
    const d = (await (await countersPost(post('counters', { event: 'dive' }))).json()) as { divers: number };
    expect(d.divers).toBe(1);
    const tooMuch = await countersPost(post('counters', { event: 'km', km: 99999 }));
    expect(tooMuch.status).toBe(400);
    const tot = (await (await countersGet()).json()) as { km: number; flights: number; divers: number };
    expect(tot).toMatchObject({ km: 12.5, flights: 1, divers: 1 });
  });
});
