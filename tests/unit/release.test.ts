/** Kesiapan rilis (Fase 5): CSP vercel.json = CSP sumber, file SEO/PWA ada, tidak ada rahasia di klien. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSP, siteUrl } from '../../scripts/seo';

const ROOT = resolve(import.meta.dirname, '../..');

describe('rilis', () => {
  it('CSP di vercel.json sama dengan scripts/seo.ts', () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const all = cfg.headers.find((h) => h.source === '/(.*)')!;
    expect(all.headers.find((h) => h.key === 'Content-Security-Policy')?.value).toBe(CSP);
  });
  it('file publik penting ada', () => {
    for (const f of ['og.png', '404.html', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'cv/Syahril-Maimubdy-CV-ID.pdf', 'cv/Syahril-Maimubdy-CV-EN.pdf', 'earth/earth.bin.gz']) {
      expect(existsSync(join(ROOT, 'public', f)), f).toBe(true);
    }
  });
  it('halaman HTML tanpa script/handler inline (CSP tanpa unsafe-inline)', () => {
    for (const f of ['index.html', 'ringkas/index.html', 'cv/index.html', 'public/404.html']) {
      const html = readFileSync(join(ROOT, f), 'utf8');
      const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, attrs, body]) => !/\bsrc=/.test(attrs!) && !/application\/ld\+json/.test(attrs!) && body!.trim() !== '');
      expect(inline.length, `${f}: script inline`).toBe(0);
      expect(/\son[a-z]+\s*=\s*["']/i.test(html), `${f}: handler inline (onclick=…)`).toBe(false);
    }
  });
  it('URL situs dari variabel Vercel', () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'skyfolio.vercel.app' })).toBe('https://skyfolio.vercel.app');
    expect(siteUrl({ VITE_SITE_URL: 'https://contoh.dev/' })).toBe('https://contoh.dev');
    expect(siteUrl({})).toBe('');
  });
  it('tidak ada API key di kode klien (src/)', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
    for (const f of walk(join(ROOT, 'src')).filter((x) => /\.(ts|svelte)$/.test(x))) {
      const s = readFileSync(f, 'utf8');
      expect(/(GROQ_API_KEY|GEMINI_API_KEY|CF_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|LEADERBOARD_SECRET|gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,})/.test(s), f).toBe(false);
    }
  });
});
