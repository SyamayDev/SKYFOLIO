/**
 * Paket pengetahuan Piko untuk server (docs/06 bagian 3): `api/_generated/knowledge.ts` dari content/.
 * Field kosong / needsConfirmation tidak ikut (buildKnowledge memakai versi publik konten).
 * Dijalankan di `prebuild` dan boleh dijalankan manual: `npm run build:knowledge`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildKnowledge } from '../src/ai/knowledge';
import { ROOT, formatIssues, loadContent } from './lib/content';

const { content, issues } = loadContent();
const errors = issues.filter((i) => i.level === 'error');
if (errors.length) {
  console.error(formatIssues(errors));
  process.exit(1);
}
const k = buildKnowledge(content);
// Ringkas untuk prompt: buang bio panjang versi bahasa lain & kolom yang tidak perlu.
const compact = {
  ...k,
  profile: { ...k.profile, bio: { id: k.profile.bio.id.slice(0, 600), en: k.profile.bio.en.slice(0, 600) } },
  projects: k.projects.map((p) => ({ ...p, tech: p.tech.slice(0, 8) })),
};
const ids = {
  zones: k.zones.map((z) => z.id),
  projects: k.projects.map((p) => p.id),
  landmarks: k.landmarks.map((l) => l.id),
  links: k.contacts.map((c) => c.id),
};
const name = content.copilot.name || 'Piko';
const json = JSON.stringify(compact);
const out = `// DIBUAT OTOMATIS oleh scripts/build-knowledge.ts dari content/ — jangan diedit manual.
export const COPILOT_NAME = ${JSON.stringify(name)};
export const IDS: Record<'zones' | 'projects' | 'landmarks' | 'links', string[]> = ${JSON.stringify(ids)};
export const KNOWLEDGE: unknown = ${json};
`;
const dir = resolve(ROOT, 'api/_generated');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'knowledge.ts'), out);
console.log(`✅ Paket pengetahuan: ${Math.round(json.length / 4)} token (±), ${ids.projects.length} proyek, ${k.skills.length} skill`);
