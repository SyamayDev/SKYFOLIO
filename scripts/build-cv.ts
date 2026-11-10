/**
 * build-cv — mencetak /cv/ ke PDF A4 (ID & EN) dengan Playwright (docs/07 bagian 10).
 * Jalankan di komputer Aril: npm run build:cv → public/cv/Syahril-Maimubdy-CV-{ID,EN}.pdf (di-commit).
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT } from './lib/content';

async function main(): Promise<void> {
  const server = await createServer({ root: ROOT, configFile: resolve(ROOT, 'vite.config.ts'), server: { port: 4199, strictPort: false }, logLevel: 'warn' });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? 'http://localhost:4199/';
  const outDir = resolve(ROOT, 'public/cv');
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const lang of ['id', 'en'] as const) {
      await page.goto(`${url}cv/?lang=${lang}`, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });
      const file = resolve(outDir, `Syahril-Maimubdy-CV-${lang.toUpperCase()}.pdf`);
      await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
      console.log(`📄 ${file}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e: unknown) => {
  console.error('❌ build-cv gagal:', e);
  process.exit(1);
});
