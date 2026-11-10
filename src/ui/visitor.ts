/**
 * Data pengunjung untuk boarding pass (docs/01 bagian 4.2): nama (boleh kosong → "Kapten Misterius"),
 * nomor penerbangan acak SKY-1234, negara asal dari locale browser (tanpa meminta lokasi), tanggal.
 * Disimpan di localStorage `skyfolio:v1:visitor` (try/catch).
 */
import { store } from '../core/Store';

export const VISITOR_KEY = 'skyfolio:v1:visitor';

export interface Visitor {
  name: string;
  flight: string;
  country: string;
}

function guessCountry(): string {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const m = /-([A-Za-z]{2})$/.exec(l);
      if (m) return m[1]!.toUpperCase();
    }
    if ((navigator.language ?? '').toLowerCase().startsWith('id')) return 'ID';
  } catch {
    // abaikan
  }
  return 'ID';
}

function load(): Visitor {
  const fresh: Visitor = { name: '', flight: `SKY-${1000 + Math.floor(Math.random() * 9000)}`, country: typeof navigator === 'undefined' ? 'ID' : guessCountry() };
  try {
    const raw = localStorage.getItem(VISITOR_KEY);
    if (raw) return { ...fresh, ...(JSON.parse(raw) as Partial<Visitor>) };
  } catch {
    // mode privat
  }
  return fresh;
}

export const visitor = store<Visitor>(load());

visitor.subscribe((v) => {
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify(v));
  } catch {
    // abaikan
  }
});

/** Nama bersih: maks. 16 karakter, tanpa tanda aneh (dipakai juga leaderboard). */
export function cleanName(s: string): string {
  return s
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 16);
}
