/** GET /api/health — status layanan (tanpa rahasia): penyedia AI mana yang aktif & jenis penyimpanan. */
import { json } from './_lib/http';
import { providersFromEnv } from './_lib/providers';

export async function GET(): Promise<Response> {
  const storage = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ? 'upstash' : 'memory';
  return json({ ok: true, ai: providersFromEnv().map((p) => p.name), storage, time: new Date().toISOString() });
}
