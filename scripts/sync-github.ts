/**
 * sync-github — menarik repo publik GitHub Aril menjadi draf proyek (docs/08 bagian 6).
 *
 *   npm run sync:github
 *
 * - Tanpa GITHUB_TOKEN: 1 panggilan API (daftar repo) + README lewat raw.githubusercontent.com
 *   (tidak memakan kuota API anonim 60/jam). Bahasa = bahasa utama repo.
 * - Dengan GITHUB_TOKEN: rincian bahasa per repo + data kontribusi (Kota Kontribusi).
 * - Draf ditulis ke content/projects/_drafts/<repo>.md (tidak tampil di situs sampai dipindahkan).
 *   Draf yang sudah ada TIDAK ditimpa bagian ceritanya (hanya data frontmatter diperbarui).
 * - Skill: bahasa yang belum ada di skills.json ditambah dengan source "github-sync", level 3.
 *   Level yang sudah diisi Aril tidak pernah diubah.
 * Saat build (prebuild) script ini diam-diam dilewati bila jaringan tidak tersedia.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringifyYaml, splitFrontmatter, type YamlValue } from '../src/content/yaml';
import { CONTENT_DIR, GENERATED_DIR } from './lib/content';

const DRAFTS = join(CONTENT_DIR, 'projects/_drafts');
const TOKEN = process.env.GITHUB_TOKEN?.trim() || '';
const IS_PREBUILD = process.env.npm_lifecycle_event === 'prebuild';

interface Repo {
  name: string;
  fork: boolean;
  description: string | null;
  language: string | null;
  topics?: string[];
  homepage: string | null;
  stargazers_count: number;
  created_at: string;
  pushed_at: string;
  html_url: string;
  default_branch: string;
  languages_url: string;
  archived: boolean;
}

const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'skyfolio-sync' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

async function readme(user: string, r: Repo): Promise<string> {
  for (const name of ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'README', 'README.markdown']) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${user}/${r.name}/${r.default_branch}/${name}`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return (await res.text()).slice(0, 12000);
    } catch {
      // coba nama lain
    }
  }
  return '';
}

/** "react-sistemrekomendasijurusan" → "React Sistemrekomendasijurusan"; "SI_PANDRI_OP" → "SI PANDRI OP". */
export function prettyTitle(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Paragraf pertama README yang berupa kalimat (bukan judul, gambar, badge). */
export function firstParagraph(md: string): string {
  const blocks = md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n\s*\n/);
  for (const b of blocks) {
    const t = b.trim();
    if (!t || t.startsWith('#') || t.startsWith('![') || t.startsWith('[![') || t.startsWith('```') || t.startsWith('|') || t.startsWith('-')) continue;
    const plain = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ');
    if (plain.length > 25) return plain.slice(0, 300);
  }
  return '';
}

async function main(): Promise<void> {
  const socials = JSON.parse(readFileSync(join(CONTENT_DIR, 'socials.json'), 'utf8')) as { githubUsername?: string };
  const user = socials.githubUsername ?? 'SyamayDev';
  console.log(`🐙 sync-github: ${user}${TOKEN ? ' (dengan token)' : ' (tanpa token)'}`);
  let repos: Repo[];
  try {
    repos = await getJson<Repo[]>(`https://api.github.com/users/${user}/repos?per_page=100&type=owner&sort=updated`);
  } catch (e) {
    const msg = `sync-github dilewati: ${(e as Error).message}`;
    if (IS_PREBUILD) {
      console.log(`ℹ️  ${msg}`);
      return;
    }
    throw new Error(msg, { cause: e });
  }
  const own = repos.filter((r) => !r.fork && r.name.toLowerCase() !== user.toLowerCase());
  mkdirSync(DRAFTS, { recursive: true });
  const langTotals = new Map<string, number>();
  const summary: { name: string; lang: string | null; homepage: string | null; desc: string }[] = [];

  for (const r of own) {
    let langs: Record<string, number> = r.language ? { [r.language]: 1 } : {};
    if (TOKEN) langs = await getJson<Record<string, number>>(r.languages_url).catch(() => langs);
    const totalBytes = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
    for (const [l, b] of Object.entries(langs)) langTotals.set(l, (langTotals.get(l) ?? 0) + b / totalBytes);

    const text = IS_PREBUILD ? '' : await readme(user, r);
    const desc = r.description?.trim() || firstParagraph(text);
    const id = slug(r.name);
    const file = join(DRAFTS, `${id}.md`);
    const front: Record<string, YamlValue> = {
      id,
      title: prettyTitle(r.name),
      summary: { id: desc || null, en: null },
      year: Number(r.created_at.slice(0, 4)),
      role: { id: null, en: null },
      tech: [...Object.keys(langs), ...(r.topics ?? [])],
      links: { demo: r.homepage?.trim() || null, repo: r.html_url },
      media: { cover: null, gallery: [] },
      featured: false,
      featuredRank: null,
      island: { diorama: 'generic', lat: null, lon: null, size: 'small' },
      github: { stars: r.stargazers_count, pushedAt: r.pushed_at.slice(0, 10), archived: r.archived },
      needsConfirmation: ['summary', 'role'],
    };
    let body = '## Cerita (ID)\n\n\n## Story (EN)\n\n';
    if (existsSync(file)) {
      // Pertahankan cerita yang sudah ditulis.
      try {
        body = splitFrontmatter(readFileSync(file, 'utf8')).body.replace(/\n## README \(sumber\)[\s\S]*$/, '');
      } catch {
        // tulis ulang
      }
    }
    const src = text ? `\n## README (sumber)\n\n<!-- Salinan README dari GitHub untuk bahan menulis cerita. Bagian ini diabaikan situs. -->\n\n${text.replace(/<!--|-->/g, '')}\n` : '';
    writeFileSync(file, `---\n${stringifyYaml(front)}---\n\n${body.trim()}\n${src}`);
    summary.push({ name: r.name, lang: r.language, homepage: r.homepage, desc });
  }

  // Skill dari bahasa repo (tanpa mengubah level yang sudah diisi Aril).
  const skillsPath = join(CONTENT_DIR, 'skills.json');
  const skills = JSON.parse(readFileSync(skillsPath, 'utf8')) as {
    groups: { id: string; skills: { id: string; name: unknown; level: number; source?: string }[] }[];
  };
  const known = new Set(skills.groups.flatMap((g) => g.skills.map((s) => s.id)));
  const langGroup = skills.groups.find((g) => g.id === 'languages');
  const added: string[] = [];
  const NOT_LANG = new Set(['Hack']); // label GitHub yang keliru untuk file .php/.html kecil
  for (const [lang, weight] of [...langTotals.entries()].sort((a, b) => b[1] - a[1])) {
    const id = slug(lang);
    if (known.has(id) || NOT_LANG.has(lang) || weight < 1.5) continue; // minimal ±2 repo
    langGroup?.skills.push({ id, name: lang, level: 3, source: 'github-sync' });
    known.add(id);
    added.push(lang);
  }
  if (added.length) writeFileSync(skillsPath, `${JSON.stringify(skills, null, 2)}\n`);

  // Kontribusi (butuh token).
  if (TOKEN) {
    try {
      const q = `query { user(login: "${user}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;
      const res = await fetch('https://api.github.com/graphql', { method: 'POST', headers, body: JSON.stringify({ query: q }) });
      const json = (await res.json()) as unknown;
      mkdirSync(GENERATED_DIR, { recursive: true });
      writeFileSync(resolve(GENERATED_DIR, 'contributions.json'), JSON.stringify(json));
      console.log('  kontribusi tersimpan → src/content/_generated/contributions.json');
    } catch (e) {
      console.log(`  kontribusi dilewati: ${(e as Error).message}`);
    }
  } else console.log('  kontribusi dilewati (butuh GITHUB_TOKEN) → Kota Kontribusi tampil sebagai lokasi konstruksi');

  console.log(`✅ ${own.length} draf di content/projects/_drafts/. Skill baru: ${added.length ? added.join(', ') : '—'}`);
  for (const s of summary) console.log(`  • ${s.name} [${s.lang ?? '-'}] ${s.homepage ?? ''} ${s.desc ? `— ${s.desc.slice(0, 70)}` : ''}`);
}

main().catch((e: unknown) => {
  console.error('❌', (e as Error).message);
  process.exit(IS_PREBUILD ? 0 : 1);
});
