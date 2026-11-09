/**
 * Format data planet (public/earth/*) — dipakai bersama oleh build-earth dan klien.
 */

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

export const TreeType = {
  Round: 0,
  Palm: 1,
  Pine: 2,
  TallPine: 3,
  Cactus: 4,
  Bush: 5,
} as const;
export type TreeType = (typeof TreeType)[keyof typeof TreeType];
export const TREE_TYPE_COUNT = 6;

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
  sections: { positions: number; colors: number; classes: number };
  chunks: EarthChunkMeta[];
}

export interface CityInfo {
  name: string;
  lat: number;
  lon: number;
  pop: number;
}

/** Ukuran record biner. */
export const TREE_RECORD_BYTES = 8;
export const BUILDING_RECORD_BYTES = 10;
/** Skala pohon tersimpan sebagai byte 0..255 → 0,5..1,5. */
export function decodeTreeScale(b: number): number {
  return 0.5 + b / 255;
}
