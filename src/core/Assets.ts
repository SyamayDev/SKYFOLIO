/** Pemuat aset biner/JSON dengan penanganan galat yang ramah. */
import type { CityInfo, EarthMeta } from '../world/EarthFormat';

export async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url} (HTTP ${res.status})`);
  return res.arrayBuffer();
}

/**
 * Muat `<url>.gz` lalu buka dengan DecompressionStream (hemat ±60% unduhan walau hosting tidak
 * mengompres file biner). Jika browser tidak mendukung atau gagal, pakai file mentah.
 */
export async function fetchCompressed(url: string): Promise<ArrayBuffer> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (DS) {
    try {
      const res = await fetch(`${url}.gz`);
      if (res.ok && res.body) {
        // Server yang sudah mengirim Content-Encoding: gzip membuat browser membukanya otomatis.
        const enc = res.headers.get('content-encoding');
        if (enc && enc.includes('gzip')) return await res.arrayBuffer();
        const stream = res.body.pipeThrough(new DS('gzip'));
        return await new Response(stream).arrayBuffer();
      }
    } catch {
      // Jatuh ke file mentah di bawah.
    }
  }
  return fetchArrayBuffer(url);
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
  rivers: ArrayBuffer;
  buildings: ArrayBuffer;
  cities: CityInfo[];
}

export async function loadEarthAssets(): Promise<EarthAssets> {
  const [earth, meta, rivers, buildings, cities] = await Promise.all([
    fetchCompressed(assetUrl('earth/earth.bin')),
    fetchJson<EarthAssets['meta']>(assetUrl('earth/earth-meta.json')),
    fetchCompressed(assetUrl('earth/rivers.bin')),
    fetchArrayBuffer(assetUrl('earth/buildings.bin')),
    fetchJson<EarthAssets['cities']>(assetUrl('earth/cities.json')),
  ]);
  return { earth, meta, rivers, buildings, cities };
}
