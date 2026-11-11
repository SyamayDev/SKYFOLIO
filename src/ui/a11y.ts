/**
 * Aksesibilitas tampilan (docs/07 bagian 11): kontras tinggi & teks besar lewat atribut di <html>
 * (dipakai theme.css), dan warna penanda ramah buta warna (palet Okabe–Ito) untuk radar & peta.
 */
import { settings } from '../core/Settings';

/** Palet Okabe–Ito: tetap bisa dibedakan oleh semua jenis buta warna umum. */
export const OKABE_ITO = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'] as const;

export function wireA11y(): () => void {
  return settings.subscribe((s) => {
    const d = document.documentElement.dataset;
    d.contrast = s.accessibility.highContrastUi ? 'high' : 'normal';
    d.textSize = s.accessibility.largeText ? 'large' : 'normal';
  });
}

/** Warna penanda zona; mode buta warna → warna Okabe–Ito yang stabil per id (ikon tetap pembeda utama). */
export function markerColor(base: string, id: string, colorblind: boolean): string {
  if (!colorblind) return base;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return OKABE_ITO[h % OKABE_ITO.length]!;
}
