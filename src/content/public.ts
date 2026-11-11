/**
 * Aturan `needsConfirmation` (CLAUDE.md aturan 1, docs/08 bagian 2): field yang belum dikonfirmasi Aril
 * disembunyikan di situs, CV, Mode Ringkas, dan paket pengetahuan AI. Fungsi di sini murni (tanpa fs)
 * supaya bisa dipakai di build maupun tes.
 */
import type { SiteContent } from './schema.ts';

export interface HiddenField {
  where: string;
  field: string;
}

function hideFields<T extends Record<string, unknown>>(obj: T, fields: string[] | undefined, where: string, hidden: HiddenField[]): T {
  if (!fields?.length) return obj;
  const copy: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    hidden.push({ where, field: f });
    if (!(f in copy)) continue;
    const v = copy[f];
    copy[f] = Array.isArray(v) ? [] : v && typeof v === 'object' ? { id: null, en: null } : null;
  }
  delete copy.needsConfirmation;
  return copy as T;
}

/** Salinan konten yang aman ditampilkan + daftar field yang disembunyikan (untuk laporan & Hangar). */
export function toPublicContent(c: SiteContent): { content: SiteContent; hidden: HiddenField[] } {
  const hidden: HiddenField[] = [];
  const out: SiteContent = structuredClone(c);
  out.profile = hideFields(out.profile, out.profile.needsConfirmation, 'profile.json', hidden);
  out.skills.groups = out.skills.groups.map((g) => ({
    ...g,
    skills: g.skills.filter((s) => {
      if (s.needsConfirmation) hidden.push({ where: `skills.json › ${typeof s.name === 'string' ? s.name : (s.name.id ?? s.id)}`, field: 'skill' });
      return !s.needsConfirmation;
    }),
  }));
  out.timeline.items = out.timeline.items.map((it) => hideFields(it, it.needsConfirmation, `timeline.json › ${it.id}`, hidden));
  out.certificates.items = out.certificates.items
    .map((it) => hideFields(it, it.needsConfirmation, `certificates.json › ${it.id}`, hidden))
    // Sertifikat tanpa judul terkonfirmasi tidak ditampilkan sama sekali.
    .filter((it) => it.title && (typeof it.title === 'string' || it.title.id || it.title.en));
  out.secretMessage = hideFields(out.secretMessage, out.secretMessage.needsConfirmation, 'secret-message.json', hidden);
  out.projects = out.projects.map((p) => {
    const q = hideFields(p as unknown as Record<string, unknown>, p.needsConfirmation, `projects/${p.file}`, hidden) as unknown as typeof p;
    if (p.needsConfirmation?.includes('tech')) q.tech = [];
    if (p.needsConfirmation?.includes('summary')) {
      q.summary = { id: null, en: null };
    }
    return q;
  });
  return { content: out, hidden };
}

/** Teks dalam bahasa aktif, jatuh ke bahasa lain bila kosong. */
export function pickText(t: { id?: string | null; en?: string | null } | string | null | undefined, locale: 'id' | 'en'): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const a = locale === 'id' ? t.id : t.en;
  const b = locale === 'id' ? t.en : t.id;
  return (a && a.trim()) || (b && b.trim()) || '';
}
