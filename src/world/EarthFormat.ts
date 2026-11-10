/**
 * Format data planet (public/earth/*) — dipakai bersama oleh build-earth dan klien.
 */

export const EARTH_FORMAT_VERSION = 2;

export const TriClass = {
  Grass: 0,
  Sand: 1,
  Lake: 2,
  Snow: 3,
  Rock: 4,
  Desert: 5,
  Airport: 6,
} as const;
export type TriClass = (typeof TriClass)[keyof typeof TriClass];

export interface EarthChunkMeta {
  start: number;
  count: number;
  center: [number, number, number];
  radius: number;
}

export interface EarthMeta {
  version: number;
  quantRadius: number;
  triangleCount: number;
  sections: { positions: number; colors: number; classes: number; aux: number };
  rivers: { vertexCount: number; strips: number[] };
  chunks: EarthChunkMeta[];
}

export interface CityInfo {
  name: string;
  lat: number;
  lon: number;
  pop: number;
}

/** Ukuran record biner. */
export const BUILDING_RECORD_BYTES = 10;
/** Satu titik pita sungai: int16 x,y,z + uint16 (u×4 << 1 | sisi). */
export const RIVER_VERTEX_BYTES = 8;

/** Byte kelas: bit 0–2 = TriClass, bit 3–5 = kekeringan 0..7. */
export function classOf(b: number): TriClass {
  return (b & 7) as TriClass;
}
export function drynessOf(b: number): number {
  return ((b >> 3) & 7) / 7;
}

/** aux per segitiga: kepadatan hutan (nibble atas) dan ladang (nibble bawah), masing-masing 0..15. */
export function auxForest(aux: number): number {
  return (aux >> 4) / 15;
}
export function auxFarm(aux: number): number {
  return (aux & 15) / 15;
}
