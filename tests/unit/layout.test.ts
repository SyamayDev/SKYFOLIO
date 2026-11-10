/**
 * Tata letak dunia: zona tidak boleh menimpa landasan atau jalur lepas landas (bug Fase 1: kantor pos
 * sempat berdiri di tengah landasan), dan penempatan pulau proyek harus deterministik.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AirportFrame } from '../../src/world/AirportLayout';
import { placeIslands, type IslandInput } from '../../src/world/Zones/islandPlacement';
import { latLonToVec3 } from '../../src/utils/geo';

interface ZoneDef {
  id: string;
  lat?: number;
  lon?: number;
}
const zones = (JSON.parse(readFileSync(resolve(import.meta.dirname, '../../content/world/zones.json'), 'utf8')) as { zones: ZoneDef[] }).zones;
const frame = new AirportFrame();

function local(z: ZoneDef): { along: number; side: number } {
  return frame.toLocal(latLonToVec3(z.lat!, z.lon!, 1), { along: 0, side: 0 });
}

/** Jarak (unit) dari koridor landasan + jalur naik awal (along −30…45, side 0). */
function corridorDistance(p: { along: number; side: number }): number {
  const a = Math.max(-30, Math.min(45, p.along));
  return Math.hypot(p.along - a, p.side);
}

describe('zona di sekitar bandara', () => {
  // Zona yang memang menempel ke bandara/landasan atau berada di udara/air.
  const NEAR_OK = new Set(['home-airport', 'sky-circuit', 'journey-stream', 'lantern-valley', 'control-tower']);

  it('tidak ada zona berbangunan di koridor landasan', () => {
    for (const z of zones) {
      // Orbit & Bulan tidak punya lat/lon (letaknya di angkasa).
      if (NEAR_OK.has(z.id) || z.lat == null || z.lon == null) continue;
      const d = corridorDistance(local(z));
      expect(d, `${z.id} terlalu dekat landasan (${d.toFixed(1)} unit)`).toBeGreaterThan(24);
    }
  });

  it('menara kontrol berada di samping landasan, bukan di atasnya', () => {
    const t = zones.find((z) => z.id === 'control-tower')!;
    expect(Math.abs(local(t).side)).toBeGreaterThan(frame.halfWidth + 6);
  });
});

describe('penempatan pulau proyek', () => {
  const items: IslandInput[] = [
    { id: 'a', featured: true, featuredRank: 1, size: 'large' },
    { id: 'b', featured: true, featuredRank: 2, size: 'large' },
    { id: 'c', featured: false, size: 'medium' },
    { id: 'd', featured: false, size: 'small' },
  ];
  const zone = { lat: -12, lon: 87, radiusDeg: 14 };

  it('deterministik untuk input yang sama', () => {
    expect(placeIslands(items, zone)).toEqual(placeIslands(items, zone));
  });

  it('menambah proyek tidak menggeser pulau yang sudah ada', () => {
    const before = placeIslands(items, zone);
    const after = placeIslands([...items, { id: 'z', featured: false, size: 'small' }], zone);
    for (const p of before) expect(after.find((q) => q.id === p.id)).toEqual(p);
  });
});
