/**
 * validate-content — memeriksa semua file di content/ dengan skema zod (docs/08 bagian 2).
 * Gagal (exit 1) jika ada error, supaya build produksi tidak pernah layar putih karena salah ketik.
 */
import { formatIssues, loadContent } from './lib/content';

const { content, issues } = loadContent();
const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn');
if (warns.length) console.log(`⚠️  ${warns.length} peringatan (bukan error):\n${formatIssues(warns)}\n`);
if (errors.length) {
  console.error(`❌ ${errors.length} error konten:\n${formatIssues(errors)}`);
  process.exit(1);
}
console.log(`✅ Konten valid: ${content.projects.length} proyek, ${content.skills.groups.reduce((n, g) => n + g.skills.length, 0)} skill, ${content.timeline.items.length} item perjalanan.`);
