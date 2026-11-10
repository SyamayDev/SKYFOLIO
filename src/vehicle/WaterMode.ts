/**
 * Air (docs/03 bagian 7): daya apung sebanding kedalaman, hambatan air besar, cenderung tegak.
 * Laut adalah bola radius PLANET_RADIUS (bukan collider padat).
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { FLIGHT, WATER } from '../config/flight';
import { PLANET_RADIUS } from '../config/world';
import { clamp } from '../utils/math';

const _p = new Vector3();
const _up = new Vector3();
const _ub = new Vector3();
const _q = new Quaternion();
const _v = new Vector3();
const _axis = new Vector3();

export class WaterMode {
  inWater = false;
  depth = 0;
  /** Kecepatan masuk air pada langkah ini (untuk cipratan), 0 bila tidak baru masuk. */
  entrySpeed = 0;

  step(body: RAPIER.RigidBody, dt: number): void {
    const t = body.translation();
    _p.set(t.x, t.y, t.z);
    const r = _p.length();
    _up.copy(_p).divideScalar(r);
    // Titik tengah badan sedikit di bawah origin → mengapung dengan badan setengah tercelup.
    const depth = PLANET_RADIUS - r + 0.15;
    this.depth = depth;
    const was = this.inWater;
    this.inWater = depth > -0.05;
    this.entrySpeed = 0;
    if (!this.inWater) return;
    const lv = body.linvel();
    _v.set(lv.x, lv.y, lv.z);
    if (!was) this.entrySpeed = Math.max(0, -_v.dot(_up));

    const m = FLIGHT.MASS;
    const k = clamp(depth / WATER.BUOYANCY_DEPTH, 0, 1.6);
    // Apung melawan gravitasi.
    _v.multiplyScalar(-WATER.LINEAR_DRAG * Math.min(1, k + 0.2) * m * dt);
    _v.addScaledVector(_up, FLIGHT.G0 * WATER.BUOYANCY * k * m * dt);
    body.applyImpulse(_v, true);

    // Redam putaran + dorong supaya tegak.
    const av = body.angvel();
    const r2 = body.rotation();
    _q.set(r2.x, r2.y, r2.z, r2.w);
    _ub.set(0, 1, 0).applyQuaternion(_q);
    _axis.crossVectors(_ub, _up).multiplyScalar(WATER.UPRIGHT * 0.5 * dt);
    _axis.x -= av.x * WATER.ANGULAR_DRAG * 0.5 * dt;
    _axis.y -= av.y * WATER.ANGULAR_DRAG * 0.5 * dt;
    _axis.z -= av.z * WATER.ANGULAR_DRAG * 0.5 * dt;
    body.applyTorqueImpulse(_axis, true);
  }
}
