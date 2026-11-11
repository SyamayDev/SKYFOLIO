/**
 * Batas pemakaian (docs/06 bagian 2.3, docs/10). Upstash Redis lewat REST (tanpa SDK). Tanpa Upstash
 * (lokal/belum dipasang) → penghitung di memori per instans fungsi (tetap membatasi, walau tidak global).
 */
export interface Store {
  /** Naikkan penghitung `key` (kedaluwarsa `ttl` detik sejak pertama), kembalikan nilai baru. */
  incr(key: string, ttl: number): Promise<number>;
  /** Tambah bilangan (boleh pecahan) tanpa kedaluwarsa, kembalikan total. */
  incrBy(key: string, n: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  /** Tambah ke depan daftar & potong ke `max` item. */
  lpushTrim(key: string, value: string, max: number): Promise<void>;
  lrange(key: string, n: number): Promise<string[]>;
  /** Hapus semua item daftar yang sama persis dengan `value`. */
  lrem(key: string, value: string): Promise<void>;
  /** Sorted set (leaderboard). */
  zadd(key: string, score: number, member: string): Promise<void>;
  zrange(key: string, n: number): Promise<{ member: string; score: number }[]>;
}

class MemoryStore implements Store {
  private readonly m = new Map<string, { v: string; exp: number }>();
  private readonly lists = new Map<string, string[]>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private live(key: string): { v: string; exp: number } | undefined {
    const e = this.m.get(key);
    if (e && e.exp && e.exp < Date.now()) {
      this.m.delete(key);
      return undefined;
    }
    return e;
  }
  async incr(key: string, ttl: number): Promise<number> {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + 1;
    this.m.set(key, { v: String(n), exp: e?.exp || Date.now() + ttl * 1000 });
    return n;
  }
  async incrBy(key: string, n: number): Promise<number> {
    const e = this.live(key);
    const v = (e ? Number(e.v) : 0) + n;
    this.m.set(key, { v: String(v), exp: 0 });
    return v;
  }
  async get(key: string): Promise<string | null> {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.m.set(key, { v: value, exp: ttl ? Date.now() + ttl * 1000 : 0 });
  }
  async lpushTrim(key: string, value: string, max: number): Promise<void> {
    const l = this.lists.get(key) ?? [];
    l.unshift(value);
    this.lists.set(key, l.slice(0, max));
  }
  async lrange(key: string, n: number): Promise<string[]> {
    return (this.lists.get(key) ?? []).slice(0, n);
  }
  async lrem(key: string, value: string): Promise<void> {
    this.lists.set(key, (this.lists.get(key) ?? []).filter((v) => v !== value));
  }
  async zadd(key: string, score: number, member: string): Promise<void> {
    const z = this.zsets.get(key) ?? new Map<string, number>();
    const prev = z.get(member);
    if (prev === undefined || score < prev) z.set(member, score);
    this.zsets.set(key, z);
  }
  async zrange(key: string, n: number): Promise<{ member: string; score: number }[]> {
    return [...(this.zsets.get(key) ?? new Map<string, number>()).entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score)
      .slice(0, n);
  }
}

class UpstashStore implements Store {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}
  private async pipe(cmds: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r) => r.result);
  }
  async incr(key: string, ttl: number): Promise<number> {
    const [n] = await this.pipe([
      ['INCR', key],
      ['EXPIRE', key, ttl, 'NX'],
    ]);
    return Number(n);
  }
  async incrBy(key: string, n: number): Promise<number> {
    const [v] = await this.pipe([['INCRBYFLOAT', key, n]]);
    return Number(v);
  }
  async get(key: string): Promise<string | null> {
    const [v] = await this.pipe([['GET', key]]);
    return v == null ? null : String(v);
  }
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.pipe([ttl ? ['SET', key, value, 'EX', ttl] : ['SET', key, value]]);
  }
  async lpushTrim(key: string, value: string, max: number): Promise<void> {
    await this.pipe([
      ['LPUSH', key, value],
      ['LTRIM', key, 0, max - 1],
    ]);
  }
  async lrange(key: string, n: number): Promise<string[]> {
    const [v] = await this.pipe([['LRANGE', key, 0, n - 1]]);
    return Array.isArray(v) ? v.map(String) : [];
  }
  async lrem(key: string, value: string): Promise<void> {
    await this.pipe([['LREM', key, 0, value]]);
  }
  async zadd(key: string, score: number, member: string): Promise<void> {
    // LT: hanya perbarui bila waktu baru lebih cepat (skor lebih kecil = lebih baik).
    await this.pipe([['ZADD', key, 'LT', score, member]]);
  }
  async zrange(key: string, n: number): Promise<{ member: string; score: number }[]> {
    const [v] = await this.pipe([['ZRANGE', key, 0, n - 1, 'WITHSCORES']]);
    const arr = Array.isArray(v) ? v.map(String) : [];
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i + 1 < arr.length; i += 2) out.push({ member: arr[i]!, score: Number(arr[i + 1]) });
    return out;
  }
}

let cached: Store | null = null;
let cachedFor = '';

/** Penyimpanan aktif. Upstash bila variabel lingkungan terisi (otomatis dari Vercel Marketplace). */
export function getStore(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  const key = url && token ? `${url}|${token.length}` : 'memory';
  if (!cached || cachedFor !== key) {
    cached = url && token ? new UpstashStore(url, token) : new MemoryStore();
    cachedFor = key;
  }
  return cached;
}

/** Ganti penyimpanan (tes). */
export function setStore(s: Store | null): void {
  cached = s;
  cachedFor = s ? 'custom' : '';
}

export const LIMITS = {
  /** Pesan AI per pengunjung per jam. */
  perIpHour: 15,
  /** Panggilan AI global per hari (di bawah batas harian penyedia pertama). */
  globalDay: 800,
};

/** true = masih boleh. Gagal menghubungi penyimpanan → izinkan (lebih baik melayani daripada mati). */
export async function allow(ipHash: string, scope = 'ai'): Promise<boolean> {
  const s = getStore();
  const hour = Math.floor(Date.now() / 3_600_000);
  const day = Math.floor(Date.now() / 86_400_000);
  try {
    const [mine, all] = await Promise.all([s.incr(`rl:${scope}:ip:${ipHash}:${hour}`, 3600), s.incr(`rl:${scope}:global:${day}`, 86_400)]);
    return mine <= LIMITS.perIpHour && all <= LIMITS.globalDay;
  } catch {
    return true;
  }
}
