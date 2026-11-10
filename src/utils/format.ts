/**
 * Konversi satuan mainan ke angka yang ramah dibaca di HUD.
 * Planet mainan: 1 unit/dtk ditampilkan sebagai 4 km/j, 1 unit ketinggian sebagai 20 m.
 */
export const KMH_PER_UNIT = 4;
export const METERS_PER_UNIT = 20;

export function toKmh(unitsPerSecond: number): number {
  return Math.round(Math.abs(unitsPerSecond) * KMH_PER_UNIT);
}

export function toMeters(units: number): number {
  return Math.max(0, Math.round((units * METERS_PER_UNIT) / 5) * 5);
}

export function formatNumber(n: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US').format(n);
  } catch {
    return String(n);
  }
}
