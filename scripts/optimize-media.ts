/**
 * optimize-media — semua gambar di content/media/** → public/media/** dalam webp & avif (480/960/1600 px)
 * + placeholder blur kecil, hanya untuk file yang berubah (cache hash). Manifest ditulis ke
 * src/content/_generated/media.json dan dipakai loader konten (docs/08 bagian 4).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import type { MediaImage } from '../src/content/schema';
import { CONTENT_DIR, GENERATED_DIR, MEDIA_MANIFEST, ROOT, readMediaManifest } from './lib/content';

const SRC = join(CONTENT_DIR, 'media');
const OUT = resolve(ROOT, 'public/media');
const CACHE = resolve(ROOT, 'scripts/.cache/media-hash.json');
const WIDTHS = [480, 960, 1600];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function main(): Promise<void> {
  const files = walk(SRC).filter((f) => /\.(jpe?g|png|webp|avif|heic|heif|tiff?)$/i.test(f));
  const cache: Record<string, string> = existsSync(CACHE) ? (JSON.parse(readFileSync(CACHE, 'utf8')) as Record<string, string>) : {};
  const old = readMediaManifest();
  const manifest: Record<string, MediaImage> = {};
  let done = 0;
  for (const f of files) {
    const key = relative(CONTENT_DIR, f).replace(/\\/g, '/');
    const buf = readFileSync(f);
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
    const base = key.replace(/^media\//, '').replace(/\.[^.]+$/, '');
    const outBase = join(OUT, base);
    if (cache[key] === hash && old[key]) {
      manifest[key] = old[key];
      continue;
    }
    try {
      mkdirSync(dirname(outBase), { recursive: true });
      const img = sharp(buf, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      const w0 = meta.width ?? 1600;
      const h0 = meta.height ?? 900;
      const widths = WIDTHS.filter((w) => w <= Math.max(480, w0));
      const srcset: string[] = [];
      const avif: string[] = [];
      for (const w of widths) {
        const url = `/media/${base}-${w}.${hash}`;
        await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${outBase}-${w}.${hash}.webp`);
        await img.clone().resize({ width: w, withoutEnlargement: true }).avif({ quality: 55 }).toFile(`${outBase}-${w}.${hash}.avif`);
        srcset.push(`${url}.webp ${w}w`);
        avif.push(`${url}.avif ${w}w`);
      }
      const blur = await img.clone().resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
      const top = widths[widths.length - 1]!;
      manifest[key] = {
        src: `/media/${base}-${top}.${hash}.webp`,
        srcset: srcset.join(', '),
        avifSrcset: avif.join(', '),
        width: Math.min(top, w0),
        height: Math.round((Math.min(top, w0) / w0) * h0),
        blur: `data:image/webp;base64,${blur.toString('base64')}`,
      };
      cache[key] = hash;
      done++;
    } catch (e) {
      console.warn(`⚠️  ${key}: gagal diproses (${(e as Error).message})`);
    }
  }
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(MEDIA_MANIFEST, JSON.stringify(manifest, null, 2));
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  console.log(`🖼️  optimize-media: ${files.length} gambar (${done} diproses ulang) → public/media/`);
}

main().catch((e: unknown) => {
  console.error('❌ optimize-media gagal:', e);
  process.exit(1);
});
