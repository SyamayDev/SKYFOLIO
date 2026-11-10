/**
 * Penerbangan di atas awan sampai Bulan (docs/03 bagian 8–10), satu sistem tanpa layar loading:
 * - Lapisan: darat/air → udara → stratosfer → angkasa → Bulan (dengan histeresis supaya tidak berkedip).
 * - Kit roket keluar saat mesin baling-baling kehabisan udara; Boost = roket, Rem = dorongan mundur.
 * - Bantuan orbit: tanpa dorongan, kecepatan perlahan dibawa ke orbit lingkaran (Bumi atau Bulan).
 * - Masuk atmosfer cepat → panas: hambatan ekstra, cahaya oranye, getaran (dibaca model & audio).
 * Semua lewat gaya pada rigid body Rapier (aturan "fisika dulu").
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { FLIGHT, SPACE } from '../config/flight';
import { bus, type FlightRegime } from '../core/EventBus';
import { smoothstep } from '../utils/math';

/** Lapisan dari ketinggian (di atas permukaan benda langit terdekat) dengan histeresis. */
export function regimeOf(prev: FlightRegime, alt: number, grounded: boolean, inWater: boolean, nearMoon: boolean): FlightRegime {
  if (nearMoon) return 'moon';
  if (grounded) return 'ground';
  if (inWater) return 'water';
  const h = SPACE.HYST;
  const wasHigh = prev === 'space' ? 1 : prev === 'stratosphere' ? 0 : -1;
  if (alt > SPACE.SPACE_ALT + (wasHigh === 1 ? -h : h)) return 'space';
  if (alt > SPACE.STRATO_ALT + (wasHigh >= 0 ? -h : h)) return 'stratosphere';
  return 'air';
}

/** Kecepatan orbit lingkaran di jarak `r` dari pusat (gravitasi g0·(R/r)²). */
export function circularSpeed(g0: number, surfaceRadius: number, r: number): number {
  return Math.sqrt((g0 * surfaceRadius * surfaceRadius) / Math.max(r, 1));
}

export interface SpaceInput {
  boost: boolean;
  brake: boolean;
  gas: number;
  pitch: number;
  roll: number;
}

const _p = new Vector3();
const _v = new Vector3();
const _up = new Vector3();
const _f = new Vector3();
const _t = new Vector3();
const _q = new Quaternion();

export class SpaceFlight {
  regime: FlightRegime = 'ground';
  rocket = false;
  /** Roket sedang menyala (0..1, dihaluskan) — untuk api & suara. */
  thrust = 0;
  /** 0..1 panas masuk atmosfer. */
  heat = 0;
  /** 0..1 kekuatan aerodinamika. */
  aero = 1;
  private reentry = false;
  private moonGroundedPrev = false;
  private lastVs = 0;

  get inSpace(): boolean {
    return this.regime === 'space' || this.regime === 'moon';
  }

  /** Dipanggil sebelum model terbang: menentukan lapisan & kekuatan udara. */
  preStep(body: RAPIER.RigidBody, center: Vector3, surfaceRadius: number, grounded: boolean, inWater: boolean, onMoon: boolean): void {
    const t = body.translation();
    _p.set(t.x, t.y, t.z).sub(center);
    const alt = _p.length() - surfaceRadius;
    const prev = this.regime;
    this.regime = regimeOf(prev, alt, grounded && !onMoon, inWater, onMoon);
    if (this.regime !== prev) {
      bus.emit('flight:regime', { regime: this.regime, prev });
      body.setLinearDamping(this.inSpace ? 0 : FLIGHT.LINEAR_DAMPING);
    }
    this.aero = onMoon ? 0 : 1 - smoothstep(SPACE.AERO_FADE_START, SPACE.AERO_FADE_END, alt);
    const wantRocket = onMoon || alt > SPACE.ROCKET_DEPLOY_ALT || (this.rocket && alt > SPACE.ROCKET_RETRACT_ALT);
    if (wantRocket !== this.rocket) {
      this.rocket = wantRocket;
      bus.emit('rocket', { deployed: wantRocket });
    }
  }

  /** Dipanggil sesudah model terbang: dorongan roket, bantuan orbit, panas. */
  step(body: RAPIER.RigidBody, input: SpaceInput, assist: boolean, center: Vector3, surfaceRadius: number, grounded: boolean, onMoon: boolean, dt: number): void {
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    _p.set(t.x, t.y, t.z).sub(center);
    const dist = _p.length();
    _up.copy(_p).divideScalar(dist);
    _q.set(r.x, r.y, r.z, r.w);
    _f.set(0, 0, -1).applyQuaternion(_q);
    _v.set(lv.x, lv.y, lv.z);
    const m = FLIGHT.MASS;

    // Roket: Boost (atau gas di angkasa) = maju, Rem = mundur.
    const firing = this.rocket && (input.boost || (this.inSpace && input.gas > 0.6));
    const retro = this.rocket && this.inSpace && input.brake;
    this.thrust += ((firing ? 1 : retro ? 0.5 : 0) - this.thrust) * Math.min(1, dt * 8);
    // Batas kecepatan roket supaya tetap bisa dikendalikan (dorongan memudar mendekati batas).
    const along = _v.dot(_f);
    const cap = 1 - smoothstep(SPACE.ROCKET_MAX_SPEED * 0.8, SPACE.ROCKET_MAX_SPEED, along);
    if (firing) body.applyImpulse(_t.copy(_f).multiplyScalar(SPACE.ROCKET_ACCEL * cap * m * dt), true);
    else if (retro) body.applyImpulse(_t.copy(_f).multiplyScalar(-SPACE.RETRO_ACCEL * m * dt), true);

    // Bantuan orbit (bukan di permukaan Bulan): kecepatan → orbit lingkaran tangen di ketinggian ini.
    const altSurface = dist - surfaceRadius;
    if (assist && this.inSpace && !firing && !retro && !grounded && altSurface > (onMoon ? 25 : 40)) {
      const g0 = onMoon ? FLIGHT.G0_MOON : FLIGHT.G0;
      const vc = circularSpeed(g0, surfaceRadius, dist);
      _t.copy(_v).addScaledVector(_up, -_v.dot(_up));
      if (_t.lengthSq() < 1) _t.copy(_f).addScaledVector(_up, -_f.dot(_up));
      if (_t.lengthSq() > 1e-6) {
        _t.normalize().multiplyScalar(vc);
        const k = Math.min(1, SPACE.ORBIT_ASSIST_RATE * dt);
        _t.sub(_v).multiplyScalar(k * m);
        body.applyImpulse(_t, true);
      }
    }

    // Masuk atmosfer (Bumi saja).
    const speed = _v.length();
    const descending = _v.dot(_up) < -2;
    const heatTarget = !onMoon && altSurface < SPACE.HEAT_ALT && altSurface > 70 && speed > SPACE.HEAT_SPEED && (descending || this.heat > 0.2) ? Math.min(1, (speed - SPACE.HEAT_SPEED) / 25) : 0;
    this.heat += (heatTarget - this.heat) * Math.min(1, dt * (heatTarget > this.heat ? 1.2 : 0.6));
    if (this.heat > 0.05) body.applyImpulse(_t.copy(_v).multiplyScalar(-SPACE.HEAT_DRAG * this.heat * m * dt), true);
    const re = this.heat > 0.25;
    if (re !== this.reentry) {
      this.reentry = re;
      bus.emit('reentry', { active: re });
    }

    // Mendarat di Bulan.
    const moonGrounded = onMoon && grounded;
    if (moonGrounded && !this.moonGroundedPrev) bus.emit('moon:landed', { smooth: Math.abs(this.lastVs) < SPACE.MOON_SOFT_VSPEED });
    if (!moonGrounded) this.lastVs = _v.dot(_up);
    this.moonGroundedPrev = moonGrounded;
  }

  reset(): void {
    this.heat = 0;
    this.thrust = 0;
    this.reentry = false;
  }
}
