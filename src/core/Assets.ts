/** Pemuat aset biner/JSON dengan penanganan galat yang ramah. */
import type { CityInfo, EarthMeta } from '../world/EarthFormat';

export async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url} (HTTP ${res.status})`);
  return res.arrayBuffer();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/** URL aset publik dengan memperhitungkan base Vite. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export interface EarthAssets {
  earth: ArrayBuffer;
  meta: EarthMeta;
  trees: ArrayBuffer;
  buildings: ArrayBuffer;
  cities: CityInfo[];
}

export async function loadEarthAssets(): Promise<EarthAssets> {
  const [earth, meta, trees, buildings, cities] = await Promise.all([
    fetchArrayBuffer(assetUrl('earth/earth.bin')),
    fetchJson<EarthAssets['meta']>(assetUrl('earth/earth-meta.json')),
    fetchArrayBuffer(assetUrl('earth/trees.bin')),
    fetchArrayBuffer(assetUrl('earth/buildings.bin')),
    fetchJson<EarthAssets['cities']>(assetUrl('earth/cities.json')),
  ]);
  return { earth, meta, trees, buildings, cities };
}
