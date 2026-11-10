/**
 * Sel cuaca prosedural harian (docs/04 bagian 7.2): deterministik per tanggal UTC, jadi semua pengunjung
 * melihat badai yang sama hari ini. Sel bergeser pelan sepanjang hari (angin pasat di tropis ke barat,
 * angin barat di lintang tengah ke timur).
 */
import { mulberry32 } from '../utils/rng';
import type { WeatherKind } from './weatherCodes';

export interface WeatherCell {
  lat: number;
  lon: number;
  /** Radius pengaruh (derajat busur). */
  radiusDeg: number;
  kind: Extract<WeatherKind, 'rain' | 'storm' | 'snow' | 'fog'>;
  strength: number;
}

const COUNT = 18;

/** Sel untuk tanggal `date` (posisi sudah digeser sesuai jam). `season` = seasonOf(date), 1 = musim panas utara. */
export function cellsFor(date: Date, season: number): WeatherCell[] {
  const day = Math.floor(date.getTime() / 86400000);
  const hours = (date.getTime() / 3600000) % 24;
  const rng = mulberry32(0x5eed ^ (day * 2654435761));
  const out: WeatherCell[] = [];
  for (let i = 0; i < COUNT; i++) {
    // Sebaran lintang: 45% tropis (ITCZ), sisanya lintang tengah/tinggi.
    const tropical = rng() < 0.45;
    const lat = tropical ? (rng() - 0.5) * 30 + season * 6 : (rng() < 0.5 ? -1 : 1) * (35 + rng() * 32);
    const lon0 = rng() * 360 - 180;
    const drift = (tropical ? -6 : 9) * (0.6 + rng() * 0.6);
    const lon = ((lon0 + (drift * hours) / 24 + 540) % 360) - 180;
    // Belahan bumi yang sedang musim dingin → hujan di lintang tinggi menjadi salju.
    const winter = lat * season < 0;
    const cold = Math.abs(lat) > 62 || (Math.abs(lat) > 45 && winter);
    const r = rng();
    const kind: WeatherCell['kind'] = cold ? 'snow' : r < 0.22 ? 'storm' : r < 0.32 ? 'fog' : 'rain';
    out.push({ lat, lon, radiusDeg: 5 + rng() * 9, kind, strength: 0.55 + rng() * 0.45 });
  }
  return out;
}
