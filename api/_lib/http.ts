/** Utilitas HTTP bersama untuk Vercel Functions (handler Web standar: Request → Response). */

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

/** Baca body JSON dengan batas ukuran (default 8 KB) — input pengunjung tidak dipercaya. */
export async function readJson(req: Request, maxBytes = 8192): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** IP pengunjung (Vercel mengisi x-forwarded-for; IP pertama = klien). */
export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') ?? '';
  return xf.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '0.0.0.0';
}

/** Hash IP + garam (IP mentah tidak pernah disimpan). */
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT || 'skyfolio-dev-salt';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hanya izinkan dari situs sendiri (Origin cocok dengan Host) — mencegah situs lain memakai kuota AI kita. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // permintaan langsung (curl/server) tetap kena batas pemakaian
  try {
    const o = new URL(origin);
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
    return o.host === host || o.hostname === 'localhost' || o.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
