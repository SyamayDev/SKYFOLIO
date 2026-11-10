/**
 * Penempatan pulau proyek otomatis (docs/08 bagian 5) — fungsi murni dan deterministik (diuji unit test).
 * 1. Proyek dengan island.lat/lon diletakkan di koordinat itu.
 * 2. Sisanya diambil dari kandidat Poisson ber-seed tetap di dalam area zona, diurutkan dari yang paling dekat
 *    ke Medan; tiap pulau mengambil kandidat bebas pertama (jarak minimum = jumlah radius + 6 unit).
 * 3. Urutan: unggulan (featuredRank kecil dulu), lalu sisanya menurut id → menambah proyek baru tidak
 *    menggeser pulau unggulan, dan pulau lain hanya bergeser bila tempatnya kebetulan terpakai.
 */
import { HOME, PLANET_RADIUS } from '../../config/world';
import { angularDistanceDeg, destination } from '../../utils/geo';
import { mulberry32 } from '../../utils/rng';

/** Radius pulau (unit). Sedikit lebih besar dari docs/02 (10/7/5) supaya landasan pulau cukup untuk mendarat. */
export const ISLAND_RADIUS = { large: 14, medium: 11, small: 9 } as const;
export type IslandSize = keyof typeof ISLAND_RADIUS;

export interface IslandInput {
  id: string;
  featured: boolean;
  featuredRank?: number | null;
  lat?: number | null;
  lon?: number | null;
  size: IslandSize;
}

export interface PlacedIsland {
  id: string;
  lat: number;
  lon: number;
  radius: number;
  auto: boolean;
}

const UNIT_DEG = 180 / (Math.PI * PLANET_RADIUS);

export function placeIslands(
  items: IslandInput[],
  zone: { lat: number; lon: number; radiusDeg: number },
  isFree: (lat: number, lon: number, radius: number) => boolean = () => true,
  /** Jarak minimum dari Medan (derajat) supaya pulau tidak menumpuk di pesisir Sumatra. */
  minHomeDeg = 9,
): PlacedIsland[] {
  const placed: PlacedIsland[] = [];
  const fits = (lat: number, lon: number, r: number): boolean =>
    placed.every((p) => angularDistanceDeg({ lat, lon }, p) / UNIT_DEG >= p.radius + r + 6);
  for (const it of items) {
    if (it.lat != null && it.lon != null) placed.push({ id: it.id, lat: it.lat, lon: it.lon, radius: ISLAND_RADIUS[it.size], auto: false });
  }
  // Kandidat tetap (tidak bergantung daftar proyek).
  const rng = mulberry32(777);
  const cand: { lat: number; lon: number; d: number }[] = [];
  for (let i = 0; i < 900; i++) {
    const bearing = rng() * 360;
    const dist = Math.sqrt(rng()) * zone.radiusDeg;
    const p = destination({ lat: zone.lat, lon: zone.lon }, bearing, dist);
    cand.push({ ...p, d: angularDistanceDeg(p, HOME) });
  }
  cand.sort((a, b) => a.d - b.d);
  const far = cand.filter((c) => c.d >= minHomeDeg);
  const auto = items
    .filter((it) => it.lat == null || it.lon == null)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.featured && b.featured) return (a.featuredRank ?? 99) - (b.featuredRank ?? 99);
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  for (const it of auto) {
    const r = ISLAND_RADIUS[it.size];
    const c = far.find((x) => fits(x.lat, x.lon, r) && isFree(x.lat, x.lon, r));
    if (c) placed.push({ id: it.id, lat: +c.lat.toFixed(4), lon: +c.lon.toFixed(4), radius: r, auto: true });
  }
  return placed;
}
