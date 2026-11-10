/**
 * Konten di sisi klien: data dari `virtual:content` (sudah bersih dari field needsConfirmation)
 * dalam store yang ikut diperbarui saat file di content/ berubah (hot reload, docs/08 bagian 3).
 */
import data from 'virtual:content';
import { store } from '../core/Store';
import { locale, type Locale } from '../i18n';
import { pickText } from './public';
import type { LText, Project, SiteContent } from './schema';

export const content = store<SiteContent>(data);

if (import.meta.hot) {
  import.meta.hot.on('skyfolio:content', (d: SiteContent) => content.set(d));
}

/** Teks konten dalam bahasa aktif (jatuh ke bahasa lain bila kosong). */
export function L(t: LText | string | null | undefined, loc: Locale = locale.get()): string {
  return pickText(t, loc);
}

export function projectById(id: string): Project | undefined {
  return content.get().projects.find((p) => p.id === id);
}

/** Proyek unggulan ke-N (1-based) menurut featuredRank. */
export function featuredProject(n: number): Project | undefined {
  const list = content
    .get()
    .projects.filter((p) => p.featured)
    .sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99));
  return list[n - 1];
}

export function skillName(name: string | LText, loc: Locale = locale.get()): string {
  return typeof name === 'string' ? name : pickText(name, loc);
}

export function zoneById(id: string): SiteContent['zones']['zones'][number] | undefined {
  return content.get().zones.zones.find((z) => z.id === id);
}

/** Pesan Bulan: dari Aril bila sudah dikonfirmasi, jika tidak ucapan netral SKYFOLIO. */
export function secretMessage(loc: Locale = locale.get()): { text: string; fromAril: boolean } {
  const msg = pickText(content.get().secretMessage.message, loc);
  return msg ? { text: msg, fromAril: true } : { text: '', fromAril: false };
}
