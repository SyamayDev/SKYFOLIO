/**
 * Gravitasi radial (docs/03 bagian 2):
 *   g(r) = G0 × (PLANET_RADIUS / r)², arah ke pusat planet.
 * Di dalam sphere of influence Bulan, gravitasi menuju pusat Bulan (G0_MOON) dan Bumi diabaikan.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { FLIGHT } from '../config/flight';
import { MOON_RADIUS, PLANET_RADIUS } from '../config/world';

const _g = new Vector3();
const _imp = { x: 0, y: 0, z: 0 };

export class RadialGravity {
  /** Posisi pusat Bulan (diisi Fase 2). Null = Bulan belum ada. */
  moonCenter: Vector3 | null = null;
  readonly bodies = new Set<RAPIER.RigidBody>();

  /** Percepatan gravitasi di posisi `pos` (ditulis ke `out`). */
  accelerationAt(pos: Vector3, out = new Vector3()): Vector3 {
    if (this.moonCenter) {
      const dx = pos.x - this.moonCenter.x;
      const dy = pos.y - this.moonCenter.y;
      const dz = pos.z - this.moonCenter.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < FLIGHT.MOON_SOI && d > 1e-3) {
        const g = FLIGHT.G0_MOON * (MOON_RADIUS / Math.max(d, MOON_RADIUS)) ** 2;
        return out.set(dx, dy, dz).multiplyScalar(-g / d);
      }
    }
    const r = pos.length();
    if (r < 1e-3) return out.set(0, 0, 0);
    const g = FLIGHT.G0 * (PLANET_RADIUS / Math.max(r, 1)) ** 2;
    return out.copy(pos).multiplyScalar(-g / r);
  }

  add(body: RAPIER.RigidBody): void {
    this.bodies.add(body);
  }

  remove(body: RAPIER.RigidBody): void {
    this.bodies.delete(body);
  }

  /** Dipanggil sekali per langkah fisika sebelum world.step(). */
  apply(dt: number): void {
    for (const body of this.bodies) {
      // Benda yang tidur tidak diberi gaya supaya tetap tidur (hemat CPU).
      // Body nonaktif (misalnya pesawat dibekukan di layar muat) tidak boleh menimbun kecepatan.
      if (body.isSleeping() || !body.isDynamic() || !body.isEnabled()) continue;
      const t = body.translation();
      _g.set(t.x, t.y, t.z);
      this.accelerationAt(_g, _g);
      const m = body.mass() * dt;
      _imp.x = _g.x * m;
      _imp.y = _g.y * m;
      _imp.z = _g.z * m;
      body.applyImpulse(_imp, false);
    }
  }
}
