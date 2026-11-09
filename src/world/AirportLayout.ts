/**
 * Rangka koordinat lokal bandara Medan.
 * Dipakai bersama oleh scripts/build-earth.ts (meratakan medan) dan klien (menaruh landasan, huruf, cincin),
 * jadi keduanya selalu cocok. Tidak boleh mengimpor DOM.
 *
 * Koordinat lokal:
 *   along = jarak sepanjang landasan (unit), positif ke arah lepas landas, 0 = tengah landasan
 *   side  = jarak menyamping (unit), positif ke kanan saat menghadap arah lepas landas
 */
import { Vector3 } from 'three';
import { AIRPORT, PLANET_RADIUS } from '../config/world';
import { bearingDirection, latLonToVec3 } from '../utils/geo';

export class AirportFrame {
  readonly center = new Vector3();
  readonly along = new Vector3();
  readonly side = new Vector3();
  readonly halfLength = AIRPORT.length / 2;
  readonly halfWidth = AIRPORT.width / 2;
  readonly surfaceRadius = PLANET_RADIUS + AIRPORT.elevation;

  constructor() {
    latLonToVec3(AIRPORT.lat, AIRPORT.lon, 1, this.center);
    bearingDirection(this.center, AIRPORT.headingDeg, this.along);
    // kanan = depan × atas
    this.side.crossVectors(this.along, this.center).normalize();
  }

  /** Arah satuan → koordinat lokal (unit busur). */
  toLocal(dir: Vector3, out: { along: number; side: number }): { along: number; side: number } {
    const c = dir.dot(this.center);
    out.along = Math.atan2(dir.dot(this.along), c) * PLANET_RADIUS;
    out.side = Math.atan2(dir.dot(this.side), c) * PLANET_RADIUS;
    return out;
  }

  /** Koordinat lokal → posisi dunia pada `height` di atas permukaan laut. */
  toWorld(along: number, side: number, height: number, out = new Vector3()): Vector3 {
    out
      .copy(this.center)
      .addScaledVector(this.along, Math.tan(along / PLANET_RADIUS))
      .addScaledVector(this.side, Math.tan(side / PLANET_RADIUS))
      .normalize();
    return out.multiplyScalar(PLANET_RADIUS + height);
  }

  /** Posisi pada permukaan bandara (datar, sedikit di atas medan). */
  onSurface(along: number, side: number, lift = 0, out = new Vector3()): Vector3 {
    return this.toWorld(along, side, AIRPORT.elevation + lift, out);
  }

  /** Arah depan landasan (tangen) di titik lokal tertentu. */
  forwardAt(along: number, side: number, out = new Vector3()): Vector3 {
    const p = this.toWorld(along, side, 0, out);
    const up = p.clone().normalize();
    const ahead = this.toWorld(along + 1, side, 0);
    return out.copy(ahead).sub(p).addScaledVector(up, -ahead.clone().sub(p).dot(up)).normalize();
  }

  /**
   * Jarak bertanda dari area datar bandara (landasan + margin). ≤ 0 berarti di dalam.
   */
  flatDistance(dir: Vector3): number {
    const l = this.toLocal(dir, _local);
    let best = Infinity;
    for (const [a0, a1, s0, s1] of AIRPORT.flatRects) {
      const ca = (a0 + a1) / 2;
      const cs = (s0 + s1) / 2;
      const dx = Math.abs(l.along - ca) - (a1 - a0) / 2;
      const dy = Math.abs(l.side - cs) - (s1 - s0) / 2;
      const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
      const inside = Math.min(Math.max(dx, dy), 0);
      best = Math.min(best, outside + inside);
    }
    return best;
  }
}

const _local = { along: 0, side: 0 };
