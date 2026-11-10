/**
 * Router intent lokal Piko dengan golden set (docs/06 bagian 10): target ≥ 70% ditangani lokal dengan benar.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../scripts/lib/content';
import { IntentRouter, type FaqEntry, type Lang } from '../../src/ai/IntentRouter';
import { buildKnowledge } from '../../src/ai/knowledge';
import { damerau, normalize, phraseScore } from '../../src/ai/text';

interface Golden {
  q: string;
  lang: Lang;
  local: boolean;
  tool?: string;
  arg?: string;
  must?: string[];
}
const golden = (JSON.parse(readFileSync(resolve(import.meta.dirname, '../ai/golden.json'), 'utf8')) as { items: Golden[] }).items;
const { content } = loadContent();
const router = new IntentRouter(buildKnowledge(content), content.faq.entries as FaqEntry[]);

function correct(g: Golden): { ok: boolean; why: string } {
  const r = router.route(g.q, g.lang);
  if (!g.local) return { ok: r === null, why: r ? `seharusnya ke AI, malah ${r.intent}` : '' };
  if (!r) return { ok: false, why: 'tidak tertangani' };
  if (g.tool) {
    const a = r.actions.find((x) => x.tool === g.tool);
    if (!a) return { ok: false, why: `aksi ${g.tool} tidak ada (${r.intent}: ${r.actions.map((x) => x.tool).join(',')})` };
    if (g.arg && !Object.values(a.args).map(String).includes(g.arg)) return { ok: false, why: `argumen ${JSON.stringify(a.args)} ≠ ${g.arg}` };
  }
  for (const m of g.must ?? []) if (!r.say.includes(m)) return { ok: false, why: `"${m}" tidak ada di "${r.say}"` };
  return { ok: true, why: '' };
}

describe('teks', () => {
  it('normalisasi & jarak salah ketik', () => {
    expect(normalize('  Halo, Piko!! ')).toBe('halo piko');
    expect(damerau('react', 'raect')).toBe(1);
    expect(phraseScore('bisa raect gak', 'react')).toBeGreaterThan(0.7);
  });
});

describe('IntentRouter golden set', () => {
  const results = golden.map((g) => ({ g, ...correct(g) }));
  it('≥ 70% ditangani dengan benar (lokal atau diteruskan ke AI)', () => {
    const ok = results.filter((r) => r.ok).length;
    const fails = results.filter((r) => !r.ok).map((r) => `${r.g.lang} "${r.g.q}": ${r.why}`);
    expect(ok / results.length, fails.join('\n')).toBeGreaterThanOrEqual(0.7);
  });
  it('perintah wajib dari prompt fase benar-benar menerbangkan pesawat', () => {
    expect(router.route('Bawa aku ke proyek terbaikmu', 'id')?.actions[0]).toEqual({ tool: 'fly_to_project', args: { projectId: 'featured:1' } });
    expect(router.route('Take me to the moon', 'en')?.actions[0]?.tool).toBe('go_to_moon');
  });
  it('pertanyaan di luar konten tidak dikarang', () => {
    expect(router.route('berapa umur kak aril?', 'id')).toBeNull();
    expect(router.route('what is his gpa', 'en')).toBeNull();
  });
});
