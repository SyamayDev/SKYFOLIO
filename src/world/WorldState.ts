/**
 * Keadaan dunia yang dibaca banyak shader sekaligus (docs/04 bagian 6–7): seberapa malam di sekitar kamera,
 * seberapa basah permukaan, kilat petir, dan musim. Satu uniform dipakai bersama → tidak ada pembaruan per material.
 */
import { uniform } from 'three/tsl';

/** 0 = siang, 1 = malam pekat (di posisi kamera). */
export const uNight = uniform(0);
/** 0..1 permukaan basah setelah hujan (tanah lebih gelap & mengilap, genangan). */
export const uWet = uniform(0);
/** 0..1 kilatan petir sesaat (langit & lingkungan menjadi terang). */
export const uFlash = uniform(0);
/** −1..1: musim di belahan utara (1 = puncak musim panas utara, −1 = musim dingin utara). */
export const uSeason = uniform(0);

/** Musim dari tanggal: puncak panas utara ±21 Juni. */
export function seasonOf(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = (date.getTime() - start) / 86400000;
  return Math.cos(((doy - 172) / 365.25) * Math.PI * 2);
}
