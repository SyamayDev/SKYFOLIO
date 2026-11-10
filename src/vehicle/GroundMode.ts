/**
 * Mode darat (docs/03 bagian 5): suspensi raycast per roda, gesekan samping kuat, hambatan gulir, rem.
 * Roda bukan collider — tiga raycast dari titik pasang ke arah −atas badan.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { FLIGHT, GROUND } from '../config/flight';
import { WORLD_ONLY_FILTER, type PhysicsWorld, type SurfaceMaterial } from '../physics/PhysicsWorld';
import { clamp } from '../utils/math';
import { PLANE_DIMENSIONS } from './PlaneBody';

export interface Wheel {
  mount: Vector3;
  rest: number;
  radius: number;
  isTail: boolean;
  compression: number;
  prevCompression: number;
  contact: boolean;
  load: number;
  /** Putaran visual (rad). */
  spin: number;
  forwardSpeed: number;
  slip: number;
  material: SurfaceMaterial;
  readonly hitPoint: Vector3;
  readonly hitNormal: Vector3;
}

function makeWheel(x: number, y: number, z: number, rest: number, radius: number, isTail: boolean): Wheel {
  return {
    mount: new Vector3(x, y, z),
    rest,
    radius,
    isTail,
    compression: 0,
    prevCompression: 0,
    contact: false,
    load: 0,
    spin: 0,
    forwardSpeed: 0,
    slip: 0,
    material: 'grass',
    hitPoint: new Vector3(),
    hitNormal: new Vector3(),
  };
}

const _pos = new Vector3();
const _q = new Quaternion();
const _down = new Vector3();
const _mount = new Vector3();
const _f = new Vector3();
const _vel = new Vector3();
const _tan = new Vector3();
const _fwd = new Vector3();
const _lat = new Vector3();
const _imp = new Vector3();
const _rv = { x: 0, y: 0, z: 0 };
const _app = new Vector3();

export class GroundMode {
  readonly wheels: Wheel[];
  grounded = false;
  /** Jumlah roda yang menyentuh tanah. */
  contacts = 0;
  /** Jarak tanah di bawah pusat pesawat (untuk ground effect). */
  heightAboveGround = Infinity;
  private groundTimer = 0;
  materialAt: ((collider: RAPIER.Collider, featureId: number | undefined) => SurfaceMaterial) | null = null;

  constructor(private readonly physics: PhysicsWorld) {
    const D = PLANE_DIMENSIONS;
    this.wheels = [
      makeWheel(-D.mainGear.x, D.mainGear.y, D.mainGear.z, GROUND.REST_LENGTH_MAIN, GROUND.WHEEL_RADIUS_MAIN, false),
      makeWheel(D.mainGear.x, D.mainGear.y, D.mainGear.z, GROUND.REST_LENGTH_MAIN, GROUND.WHEEL_RADIUS_MAIN, false),
      makeWheel(D.tailGear.x, D.tailGear.y, D.tailGear.z, GROUND.REST_LENGTH_TAIL, GROUND.WHEEL_RADIUS_TAIL, true),
    ];
  }

  reset(): void {
    for (const w of this.wheels) {
      w.compression = w.prevCompression = 0;
      w.contact = false;
    }
    this.grounded = false;
    this.groundTimer = 0;
  }

  /** Pusat benda langit tempat roda berpijak (Bumi atau Bulan) dan skala gravitasinya. */
  readonly center = new Vector3();
  gScale = 1;

  step(body: RAPIER.RigidBody, brake: boolean, dt: number, parkingBrake = false): void {
    const t = body.translation();
    const r = body.rotation();
    _pos.set(t.x, t.y, t.z);
    _q.set(r.x, r.y, r.z, r.w);
    _down.set(0, -1, 0).applyQuaternion(_q);
    _f.set(0, 0, -1).applyQuaternion(_q);
    const mass = FLIGHT.MASS;
    const g = FLIGHT.G0 * this.gScale;
    let contacts = 0;

    for (const w of this.wheels) {
      _mount.copy(w.mount).applyQuaternion(_q).add(_pos);
      const maxLen = w.rest + w.radius;
      // Hanya medan & bangunan: props kecil (huruf, koper) didorong oleh collider roda, bukan raycast,
      // supaya kompresi tidak melonjak saat roda menyentuh benda tinggi.
      const hit = this.physics.castRay(_mount, _down, maxLen, WORLD_ONLY_FILTER, body);
      w.prevCompression = w.compression;
      if (!hit) {
        w.contact = false;
        w.compression = 0;
        w.load = 0;
        w.forwardSpeed *= 0.98;
        continue;
      }
      contacts++;
      w.contact = true;
      w.compression = clamp(maxLen - hit.distance, 0, w.rest);
      w.hitPoint.copy(hit.point);
      w.hitNormal.copy(hit.normal);
      w.material = this.materialAt ? this.materialAt(hit.collider, hit.featureId) : (hit.info?.material ?? 'grass');
      const compVel = (w.compression - w.prevCompression) / dt;
      let force = GROUND.K_SPRING * w.compression + GROUND.C_DAMP * compVel;
      force = clamp(force, 0, GROUND.MAX_SUSPENSION_FORCE);
      // Gaya suspensi sepanjang normal tanah (bukan sumbu badan yang miring ±9° saat posisi tiga roda —
      // itu akan mendorong pesawat mundur), di titik pasang roda.
      _imp.copy(w.hitNormal).multiplyScalar(force * Math.max(0, w.hitNormal.dot(_down) * -1) * dt);
      body.applyImpulseAtPoint(_imp, _mount, true);
      w.load = force / (mass * g);

      // Gesekan di titik kontak: hapus selip samping, hambatan gulir, rem.
      const v = body.velocityAtPoint(w.hitPoint, _rv);
      _vel.set(v.x, v.y, v.z);
      const n = w.hitNormal;
      _tan.copy(_vel).addScaledVector(n, -_vel.dot(n));
      _fwd.copy(_f).addScaledVector(n, -_f.dot(n));
      if (_fwd.lengthSq() < 1e-6) continue;
      _fwd.normalize();
      _lat.crossVectors(n, _fwd);
      const vf = _tan.dot(_fwd);
      const vl = _tan.dot(_lat);
      w.forwardSpeed = vf;
      w.slip = Math.abs(vl);
      const share = clamp(w.load, 0, 1.5) * mass * (w.isTail ? 0.35 : 0.5);
      // Samping (kuat, dibatasi supaya tidak berbalik arah).
      const latImp = -vl * share * Math.min(1, GROUND.SIDE_GRIP * dt);
      // Gulir + rem (rem hanya roda utama).
      const decel = GROUND.ROLL_RESIST + ((brake || parkingBrake) && !w.isTail ? GROUND.BRAKE : 0);
      const maxF = Math.abs(vf) * share;
      const fwdImp = -Math.sign(vf) * Math.min(maxF, decel * share * dt);
      _imp.copy(_lat).multiplyScalar(latImp).addScaledVector(_fwd, fwdImp);
      // Gesekan/rem diterapkan dekat ketinggian pusat massa (bukan di titik kontak), supaya rem keras
      // tidak membuat pesawat terjungkal ke depan (nose-over). Sisa momen kecil memberi rasa "menunduk".
      _app.copy(w.hitPoint).addScaledVector(n, _mount.copy(_pos).sub(w.hitPoint).dot(n) * GROUND.FRICTION_LIFT);
      body.applyImpulseAtPoint(_imp, _app, true);
    }
    this.contacts = contacts;
    // Debounce supaya tidak berkedip antara udara/darat.
    if (contacts > 0) this.groundTimer = Math.min(this.groundTimer + dt, 1);
    else this.groundTimer = Math.max(this.groundTimer - dt * 2, 0);
    this.grounded = contacts > 0 && this.groundTimer >= GROUND.AIRBORNE_DEBOUNCE * 0.5 ? true : contacts >= 2;

    // Tinggi di atas tanah (ground effect + HUD).
    const hit = this.physics.castRay(_pos, _down.copy(_pos).sub(this.center).normalize().negate(), 12, WORLD_ONLY_FILTER, body);
    this.heightAboveGround = hit ? hit.distance : Infinity;
  }

  /** Putar roda secara visual sesuai jarak tempuh. */
  animate(dt: number): void {
    for (const w of this.wheels) w.spin += (w.forwardSpeed / w.radius) * dt;
  }
}
