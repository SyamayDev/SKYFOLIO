/**
 * Plugin Vite konten SKYFOLIO (docs/08 bagian 3):
 * - `virtual:content` → konten publik (field needsConfirmation sudah disembunyikan), bertipe SiteContent.
 * - Hot reload: perubahan di content/ dikirim ke browser tanpa memuat ulang halaman (event 'skyfolio:content').
 * - Mode Ringkas & CV: HTML statis dirender dari konten saat dev maupun build (transformIndexHtml).
 * - Hangar (hanya dev): API lokal untuk membaca/menulis konten (lihat scripts/hangar-api.ts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { toPublicContent } from '../src/content/public.ts';
import { CONTENT_DIR, GENERATED_DIR, formatIssues, loadContent } from './lib/content.ts';
import { renderCv } from './lib/render-cv.ts';
import { renderRingkas } from './lib/render-ringkas.ts';
import { hangarMiddleware } from './hangar-api.ts';

const VIRTUAL = 'virtual:content';
const RESOLVED = '\0virtual:content';

function build(strict: boolean): ReturnType<typeof toPublicContent>['content'] {
  const { content, issues } = loadContent();
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) {
    const msg = `Konten tidak valid:\n${formatIssues(errors)}`;
    if (strict) throw new Error(msg);
    console.warn(msg);
  }
  const pub = toPublicContent(content).content;
  // Hasil juga ditulis ke src/content/_generated untuk Mode Ringkas, CV, dan paket pengetahuan AI.
  try {
    mkdirSync(GENERATED_DIR, { recursive: true });
    writeFileSync(resolve(GENERATED_DIR, 'content.json'), JSON.stringify(pub));
  } catch {
    // tidak fatal
  }
  return pub;
}

export function contentPlugin(): Plugin {
  let server: ViteDevServer | null = null;
  let isBuild = false;
  return {
    name: 'skyfolio-content',
    configResolved(cfg) {
      isBuild = cfg.command === 'build';
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
      return null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      const pub = build(isBuild);
      return `export default ${JSON.stringify(pub)};`;
    },
    configureServer(s) {
      server = s;
      s.watcher.add(CONTENT_DIR);
      const onChange = (file: string): void => {
        const f = file.replace(/\\/g, '/');
        if (!f.includes('/content/') || f.includes('/content/projects/_drafts/')) return;
        const mod = s.moduleGraph.getModuleById(RESOLVED);
        if (mod) s.moduleGraph.invalidateModule(mod);
        try {
          const pub = build(false);
          s.ws.send({ type: 'custom', event: 'skyfolio:content', data: pub });
        } catch (e) {
          console.warn('skyfolio-content:', e);
        }
      };
      s.watcher.on('change', onChange);
      s.watcher.on('add', onChange);
      s.watcher.on('unlink', onChange);
      s.middlewares.use('/__hangar', hangarMiddleware(() => server));
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const path = ctx.path.replace(/\\/g, '/');
        if (!html.includes('<!--SKYFOLIO:')) return html;
        const pub = build(isBuild);
        if (path.includes('/ringkas/')) return html.replace('<!--SKYFOLIO:RINGKAS-->', renderRingkas(pub));
        if (path.includes('/cv/')) return html.replace('<!--SKYFOLIO:CV-->', renderCv(pub));
        return html;
      },
    },
  };
}
