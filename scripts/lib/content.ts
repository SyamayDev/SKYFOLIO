/**
 * Loader konten (Node): membaca content/, memvalidasi dengan skema zod, mem-parse proyek markdown,
 * menghubungkan media yang sudah dioptimalkan, dan mengumpulkan peringatan (docs/08 bagian 2–3).
 * Dipakai plugin Vite (virtual:content), validate:content, build:cv, build-knowledge, dan Hangar.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { ZodError } from 'zod';
import { markdownToHtml, markdownToText, splitStory } from '../../src/content/markdown';
import {
  CONTENT_FILES,
  ProjectSchema,
  type ContentIssue,
  type MediaImage,
  type Project,
  type SiteContent,
} from '../../src/content/schema';
import { YamlError, splitFrontmatter } from '../../src/content/yaml';

export const ROOT = resolve(import.meta.dirname, '../..');
export const CONTENT_DIR = resolve(ROOT, 'content');
export const GENERATED_DIR = resolve(ROOT, 'src/content/_generated');
export const MEDIA_MANIFEST = resolve(GENERATED_DIR, 'media.json');

export type MediaManifest = Record<string, MediaImage>;

function zodIssues(file: string, err: ZodError): ContentIssue[] {
  return err.issues.map((i) => ({
    file,
    path: i.path.join('.') || '(akar)',
    message: i.message,
    level: 'error' as const,
  }));
}

export function readMediaManifest(): MediaManifest {
  try {
    if (existsSync(MEDIA_MANIFEST)) return JSON.parse(readFileSync(MEDIA_MANIFEST, 'utf8')) as MediaManifest;
  } catch {
    // manifest rusak → anggap kosong
  }
  return {};
}

function resolveMedia(path: string | null | undefined, manifest: MediaManifest, where: string, issues: ContentIssue[]): MediaImage | null {
  if (!path) return null;
  const key = path.replace(/^\/+/, '').replace(/^content\//, '');
  const hit = manifest[key];
  if (hit) return hit;
  const exists = existsSync(join(CONTENT_DIR, key));
  issues.push({
    file: where,
    path: key,
    message: exists ? 'gambar belum dioptimalkan (jalankan npm run optimize:media)' : 'gambar belum ada — taruh filenya di content/' + key,
    level: 'warn',
  });
  return null;
}

export interface LoadResult {
  content: SiteContent;
  issues: ContentIssue[];
  /** File yang dibaca (untuk watcher). */
  files: string[];
}

export function loadContent(): LoadResult {
  const issues: ContentIssue[] = [];
  const files: string[] = [];
  const data: Record<string, unknown> = {};
  for (const [key, [file, schema]] of Object.entries(CONTENT_FILES)) {
    const full = join(CONTENT_DIR, file);
    files.push(full);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(full, 'utf8'));
    } catch (e) {
      issues.push({ file: `content/${file}`, path: '(file)', message: `JSON tidak valid: ${(e as Error).message}`, level: 'error' });
      continue;
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      issues.push(...zodIssues(`content/${file}`, parsed.error));
      data[key] = json;
    } else data[key] = parsed.data;
  }

  const manifest = readMediaManifest();
  const projects: Project[] = [];
  const pdir = join(CONTENT_DIR, 'projects');
  const seen = new Set<string>();
  for (const name of existsSync(pdir) ? readdirSync(pdir).sort() : []) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const full = join(pdir, name);
    files.push(full);
    const rel = `content/projects/${name}`;
    let fm: ReturnType<typeof splitFrontmatter>;
    try {
      fm = splitFrontmatter(readFileSync(full, 'utf8'));
    } catch (e) {
      issues.push({ file: rel, path: '(frontmatter)', message: e instanceof YamlError ? e.message : String(e), level: 'error' });
      continue;
    }
    const parsed = ProjectSchema.safeParse(fm.data);
    if (!parsed.success) {
      issues.push(...zodIssues(rel, parsed.error));
      continue;
    }
    const p = parsed.data;
    if (seen.has(p.id)) issues.push({ file: rel, path: 'id', message: `id "${p.id}" dipakai lebih dari satu proyek`, level: 'error' });
    seen.add(p.id);
    if (`${p.id}.md` !== name) issues.push({ file: rel, path: 'id', message: `sebaiknya nama file sama dengan id (${p.id}.md)`, level: 'warn' });
    const story = splitStory(fm.body);
    if (!story.id && !story.en) issues.push({ file: rel, path: 'cerita', message: 'cerita proyek masih kosong', level: 'warn' });
    else if (!story.id || !story.en) issues.push({ file: rel, path: 'cerita', message: `cerita belum ada versi ${story.id ? 'EN' : 'ID'}`, level: 'warn' });
    for (const f of p.needsConfirmation ?? []) issues.push({ file: rel, path: f, message: 'menunggu konfirmasi Aril (disembunyikan)', level: 'warn' });
    projects.push({
      ...p,
      story: { id: markdownToHtml(story.id), en: markdownToHtml(story.en) },
      storyText: { id: markdownToText(story.id), en: markdownToText(story.en) },
      cover: resolveMedia(p.media.cover, manifest, rel, issues),
      galleryImages: p.media.gallery.map((g) => resolveMedia(g, manifest, rel, issues)).filter((x): x is MediaImage => !!x),
      file: name,
    });
  }

  const c = data as unknown as SiteContent;
  // Peringatan needsConfirmation dari file JSON.
  for (const it of c.timeline?.items ?? []) {
    for (const f of it.needsConfirmation ?? []) issues.push({ file: 'content/timeline.json', path: `${it.id}.${f}`, message: 'menunggu konfirmasi Aril (disembunyikan)', level: 'warn' });
  }
  for (const g of c.skills?.groups ?? []) {
    for (const s of g.skills) {
      if (s.needsConfirmation) issues.push({ file: 'content/skills.json', path: s.id, message: 'skill menunggu konfirmasi Aril (disembunyikan)', level: 'warn' });
    }
  }
  for (const f of c.secretMessage?.needsConfirmation ?? []) {
    issues.push({ file: 'content/secret-message.json', path: f, message: 'pesan rahasia belum ditulis Aril (pakai ucapan netral)', level: 'warn' });
  }
  for (const it of c.certificates?.items ?? []) {
    for (const f of it.needsConfirmation ?? []) issues.push({ file: 'content/certificates.json', path: `${it.id}.${f}`, message: 'menunggu konfirmasi Aril', level: 'warn' });
  }

  // Galeri & foto profil.
  const galleryDir = join(CONTENT_DIR, 'media/gallery');
  const gallery: MediaImage[] = [];
  if (existsSync(galleryDir)) {
    for (const n of readdirSync(galleryDir).sort()) {
      if (!/\.(jpe?g|png|webp|avif|heic)$/i.test(n)) continue;
      const img = manifest[`media/gallery/${n}`];
      if (img) gallery.push(img);
    }
  }
  const profilePhoto = c.profile?.avatar?.photo ? resolveMedia(c.profile.avatar.photo, manifest, 'content/profile.json', issues) : null;

  const content: SiteContent = {
    ...c,
    projects: projects.sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99) || (b.year ?? 0) - (a.year ?? 0)),
    profilePhoto,
    gallery,
    generatedAt: new Date().toISOString(),
  };
  return { content, issues, files: files.map((f) => relative(ROOT, f)) };
}

export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((i) => `${i.level === 'error' ? '❌' : '⚠️ '} ${i.file}: ${i.path} — ${i.message}`).join('\n');
}
