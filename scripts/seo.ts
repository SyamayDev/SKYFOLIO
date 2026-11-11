/**
 * SEO & keamanan saat build (docs/11 checklist kompetisi):
 * - URL situs absolut untuk OG/canonical/sitemap: VITE_SITE_URL, atau domain produksi Vercel
 *   (VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL yang diisi otomatis saat build di Vercel).
 * - Content-Security-Policy satu sumber: dipakai `vercel.json` (dicek tes) dan `vite preview`.
 */
import type { Plugin } from 'vite';

export const CSP = [
  "default-src 'self'",
  // Rapier memuat wasm dari data base64 → butuh 'wasm-unsafe-eval' (bukan 'unsafe-eval').
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://api.open-meteo.com https://api.web3forms.com",
  "form-action 'self' https://api.web3forms.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.VITE_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const host = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  return host ? `https://${host.replace(/\/+$/, '')}` : '';
}

const PAGES = ['/', '/ringkas/', '/cv/'];

/** Tag per halaman. Disisipkan di fase 'post' supaya Vite tidak menganggap href halaman sebagai aset. */
function pageTags(path: string, base: string): string[] {
  if (!base) return [];
  if (path === '/ringkas/') {
    return [
      `<link rel="canonical" href="${base}/ringkas/" />`,
      `<link rel="alternate" hreflang="id" href="${base}/ringkas/" />`,
      `<link rel="alternate" hreflang="en" href="${base}/ringkas/?lang=en" />`,
      `<link rel="alternate" hreflang="x-default" href="${base}/ringkas/" />`,
      `<meta property="og:url" content="${base}/ringkas/" />`,
    ];
  }
  if (path === '/cv/') return [`<link rel="canonical" href="${base}/cv/" />`];
  return [];
}

export function seoPlugin(): Plugin {
  const base = siteUrl();
  return {
    name: 'skyfolio-seo',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const path = ctx.path.replace(/index\.html$/, '');
        let out = html;
        // OG image & URL absolut bila domain diketahui.
        if (base) out = out.replace(/content="\/og\.png"/g, `content="${base}/og.png"`);
        const extra = pageTags(path, base);
        if (extra.length) out = out.replace('</head>', `  ${extra.join('\n    ')}\n  </head>`);
        if (path === '/' && !out.includes('og:title')) {
          const img = base ? `${base}/og.png` : '/og.png';
          const tags = [
            ...(base ? [`<link rel="canonical" href="${base}/" />`, `<meta property="og:url" content="${base}/" />`] : []),
            '<meta property="og:type" content="website" />',
            '<meta property="og:site_name" content="SKYFOLIO" />',
            '<meta property="og:title" content="SKYFOLIO — Portofolio 3D Syahril Maimubdy" />',
            '<meta property="og:description" content="Terbangkan pesawat mainan berfisika nyata keliling Bumi low-poly bersama co-pilot Piko. Setiap zona menyimpan satu bagian cerita Aril." />',
            `<meta property="og:image" content="${img}" />`,
            '<meta property="og:image:width" content="1200" />',
            '<meta property="og:image:height" content="630" />',
            '<meta name="twitter:card" content="summary_large_image" />',
            '<meta name="twitter:title" content="SKYFOLIO — Portofolio 3D Syahril Maimubdy" />',
            `<meta name="twitter:image" content="${img}" />`,
            '<link rel="manifest" href="/manifest.webmanifest" />',
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
          ].join('\n    ');
          out = out.replace('</head>', `    ${tags}\n  </head>`);
        }
        return out;
      },
    },
    generateBundle() {
      const now = new Date().toISOString().slice(0, 10);
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /hangar/\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}` });
      if (base) {
        const urls = PAGES.map((p) => `  <url><loc>${base}${p}</loc><lastmod>${now}</lastmod></url>`).join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      }
    },
  };
}
