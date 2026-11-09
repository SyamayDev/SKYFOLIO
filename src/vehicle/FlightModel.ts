/**
 * Model terbang (docs/03 bagian 4). Dijalankan setiap langkah fisika sebelum world.step().
 * Tidak bergantung DOM, jadi bisa diuji di Node (tests/unit/flight.test.ts).
 *
 * Konvensi badan: depan = −Z, atas = +Y, kanan = +X.
 * Semua "atas" memakai atas lokal planet (normalize(posisi)), jadi aman melewati kutub.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { AIR, FLIGHT, GROUND, type AssistLevel } from '../config/flight';
import { PLANET_RADIUS } from '../config/world';
import { clamp, clamp01, damp, lerp, smoothstep, DEG2RAD, TAU } from '../utils/math';
import { bankAngle, pitchAngle, rotateTowards } from '../utils/quat';

export interface FlightInput {
  /** +1 = hidung naik. */
  pitch: number;
  /** +1 = miring kanan. */
  roll: number;
  /** +1 = belok kanan (rudder). */
  yaw: number;
  /** Gas di darat/air (0..1), dari dorongan maju. */
  gas: number;
  boost: boolean;
  brake: boolean;
}

export interface FlightEnv {
  grounded: boolean;
  inWater: boolean;
  /** Jarak ke tanah di bawah pesawat (Infinity bila tidak ada). */
  heightAboveGround: number;
  assist: AssistLevel;
  wind: Vector3;
  /** Prediksi tabrakan tanah dalam `FLIGHT.GROUND_AVOID_LOOKAHEAD` detik (opsional, untuk bantuan Penuh). */
  groundAhead?: () => boolean;
}

export class FlightState {
  speed = 0;
  airspeed = 0;
  altitude = 0;
  verticalSpeed = 0;
  alphaDeg = 0;
  rho = 1;
  throttle = 0;
  thrust = 0;
  lift = 0;
  drag = 0;
  stalled = false;
  boosting = false;
  bankDeg = 0;
  pitchDeg = 0;
  /** 0..1 intensitas getaran buffet stall. */
  buffet = 0;
}

const FORWARD = new Vector3(0, 0, -1);
const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);

export class FlightModel {
  readonly state = new FlightState();
  /** Barrel roll yang sedang berjalan. */
  readonly roll = { active: false, t: 0, dir: 1, cooldown: 0 };

  private stallLatch = false;
  /** Integrator auto-throttle. */
  private throttleTrim = 0;
  /** Sudut angguk yang ditahan saat stik dilepas (mode Normal). */
  private pitchHold: number | null = null;
  // Objek sementara (dipakai ulang tiap langkah — tanpa alokasi di loop panas).
  private readonly pos = new Vector3();
  private readonly vel = new Vector3();
  private readonly vRel = new Vector3();
  private readonly angVel = new Vector3();
  private readonly q = new Quaternion();
  private readonly qInv = new Quaternion();
  private readonly up = new Vector3();
  private readonly f = new Vector3();
  private readonly ub = new Vector3();
  private readonly rb = new Vector3();
  private readonly force = new Vector3();
  private readonly tmp = new Vector3();
  private readonly omegaT = new Vector3();
  private readonly err = new Vector3();

  /** Tekanan dinamis jelajah (ketinggian jelajah, kecepatan jelajah). */
  private get qRef(): number {
    const rho = Math.exp(-(430 - PLANET_RADIUS) / AIR.DENSITY_SCALE);
    return 0.5 * rho * this.cfg.CRUISE_SPEED * this.cfg.CRUISE_SPEED;
  }

  constructor(private readonly cfg = FLIGHT) {}

  /** Mulai barrel roll bila tidak cooldown. Mengembalikan true bila dimulai. */
  startBarrelRoll(dir: number): boolean {
    if (this.roll.active || this.roll.cooldown > 0) return false;
    this.roll.active = true;
    this.roll.t = 0;
    this.roll.dir = dir >= 0 ? 1 : -1;
    this.roll.cooldown = this.cfg.BARREL_ROLL_DURATION + this.cfg.BARREL_ROLL_COOLDOWN;
    return true;
  }

  reset(): void {
    this.stallLatch = false;
    this.throttleTrim = 0;
    this.pitchHold = null;
    this.roll.active = false;
    this.roll.cooldown = 0;
    this.state.throttle = 0;
  }

  step(body: RAPIER.RigidBody, input: FlightInput, env: FlightEnv, dt: number): void {
    const c = this.cfg;
    const s = this.state;
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    const av = body.angvel();
    this.pos.set(t.x, t.y, t.z);
    this.q.set(r.x, r.y, r.z, r.w);
    this.vel.set(lv.x, lv.y, lv.z);
    this.angVel.set(av.x, av.y, av.z);

    const radius = this.pos.length();
    this.up.copy(this.pos).divideScalar(radius);
    const alt = radius - PLANET_RADIUS;
    this.f.copy(FORWARD).applyQuaternion(this.q);
    this.ub.copy(UP).applyQuaternion(this.q);
    this.rb.copy(RIGHT).applyQuaternion(this.q);

    const rho = Math.exp(-Math.max(alt, 0) / AIR.DENSITY_SCALE);
    const airborne = !env.grounded && !env.inWater;

    // --- 1. Penjajaran kecepatan (bantuan arcade): v ← slerp(v, f·|v|, ALIGN·dt·ρ)
    this.vRel.copy(this.vel).sub(env.wind);
    let airspeed = this.vRel.length();
    const align = env.assist === 'full' ? c.ALIGN_FULL : env.assist === 'normal' ? c.ALIGN_NORMAL : 0;
    if (airborne && align > 0 && !this.stallLatch && airspeed > c.STALL_SPEED * 0.8 && this.vRel.dot(this.f) > 0) {
      const frac = clamp01(align * dt * rho * (this.roll.active ? 0.25 : 1));
      rotateTowards(this.vRel, this.f, frac, this.vRel);
      this.vel.copy(this.vRel).add(env.wind);
      body.setLinvel(this.vel, true);
    }

    airspeed = this.vRel.length();
    const alpha = Math.atan2(-this.vRel.dot(this.ub), this.vRel.dot(this.f));
    const alphaDeg = alpha / DEG2RAD;

    // --- 2. Throttle
    let target: number;
    if (!airborne) {
      target = input.boost ? 1 : input.brake ? 0 : Math.max(c.IDLE_THROTTLE * 0.5, input.gas);
    } else if (input.brake) {
      target = c.IDLE_THROTTLE;
    } else if (input.boost) {
      target = 1;
    } else {
      // Auto-throttle: menjaga kecepatan jelajah (pengendali PI).
      const e = (c.CRUISE_SPEED - airspeed) / c.CRUISE_SPEED;
      this.throttleTrim = clamp(this.throttleTrim + e * c.AUTO_THROTTLE_INTEGRAL * dt, -0.4, 0.45);
      target = clamp(c.CRUISE_THROTTLE + this.throttleTrim + c.AUTO_THROTTLE_GAIN * e, c.IDLE_THROTTLE, 1);
    }
    if (!airborne || input.boost || input.brake) this.throttleTrim *= 1 - Math.min(1, dt * 0.5);
    s.throttle = damp(s.throttle, target, c.THROTTLE_SPOOL_RATE, dt);
    s.boosting = input.boost && s.throttle > 0.5;

    // --- 3. Stall (dengan histeresis supaya tidak berkedip)
    if (airborne) {
      if (!this.stallLatch && (airspeed < c.STALL_SPEED || alphaDeg > c.ALPHA_STALL_DEG)) this.stallLatch = true;
      else if (this.stallLatch && airspeed > c.STALL_SPEED + c.STALL_EXIT_MARGIN && alphaDeg < c.ALPHA_STALL_DEG - 4)
        this.stallLatch = false;
    } else {
      this.stallLatch = false;
    }
    s.stalled = this.stallLatch;
    s.buffet = this.stallLatch ? clamp01(0.4 + (c.STALL_SPEED - airspeed) / c.STALL_SPEED) : 0;

    // --- 4. Gaya
    this.force.set(0, 0, 0);
    const propFactor = 1 + c.PROP_STATIC_BONUS * Math.max(0, 1 - airspeed / c.PROP_FADE_SPEED);
    const thrust =
      s.throttle * c.T_MAX * rho * (s.boosting ? c.BOOST_MULT : 1) * propFactor * (env.inWater ? 0.4 : 1);
    this.force.addScaledVector(this.f, thrust);

    let lift = 0;
    let drag = 0;
    if (airspeed > 0.5) {
      let cl = clamp(c.C_L0 + c.C_LA * alpha, -c.C_L_MAX, c.C_L_MAX);
      // Di sudut serang sangat besar (terbang menyamping/mundur) angkat memudar.
      cl *= 1 - smoothstep(0.6, 1.4, Math.abs(alpha));
      if (this.stallLatch) cl *= c.STALL_LIFT_MULT;
      const h = env.heightAboveGround;
      if (h < c.GROUND_EFFECT_HEIGHT) cl *= 1 + c.GROUND_EFFECT_GAIN * (1 - Math.max(0, h) / c.GROUND_EFFECT_HEIGHT);
      const qd = 0.5 * rho * airspeed * airspeed;
      // Auto-trim (mode bantuan): gaya angkat "camber" (C_L0) jenuh di tekanan dinamis jelajah,
      // supaya boost tidak membuat pesawat meroket naik. Bagian dari α tetap memakai q penuh.
      const qCamber = env.assist === 'off' ? qd : Math.min(qd, this.qRef);
      const cl0 = this.stallLatch ? c.C_L0 * c.STALL_LIFT_MULT : c.C_L0;
      lift = (qCamber * cl0 + qd * (cl - cl0)) * c.S;
      // Arah angkat = normalize(kanan × v_rel) (tegak lurus aliran dan sayap).
      this.tmp.crossVectors(this.rb, this.vRel);
      const ll = this.tmp.length();
      if (ll > 1e-4) this.force.addScaledVector(this.tmp, lift / ll);
      const cd = c.C_D0 + c.K_I * cl * cl + (input.brake ? c.AIRBRAKE_CD : 0) + c.GEAR_CD;
      drag = qd * cd * c.S;
      this.force.addScaledVector(this.vRel, -drag / airspeed);
    }
    body.applyImpulse(this.tmp.copy(this.force).multiplyScalar(dt), true);

    // --- 5. Kontrol rotasi: laju sudut target
    const auth = clamp(airspeed / c.CRUISE_SPEED, c.AUTHORITY_MIN, c.AUTHORITY_MAX);
    let pitchRate = input.pitch * c.PITCH_RATE_MAX_DEG * DEG2RAD * auth;
    let rollRate = input.roll * c.ROLL_RATE_MAX_DEG * DEG2RAD * auth;
    let yawRate = input.yaw * c.YAW_RATE_MAX_DEG * DEG2RAD * auth;
    let turnRate = 0;

    const bank = bankAngle(this.rb, this.ub, this.up);
    const pitch = pitchAngle(this.f, this.up);
    const upright = this.ub.dot(this.up) > 0;
    s.bankDeg = bank / DEG2RAD;
    s.pitchDeg = pitch / DEG2RAD;

    if (airborne) {
      if (env.assist !== 'off') {
        // Batas angguk aman: cegah pemula langsung stall saat menahan "naik".
        if (airspeed < c.ENVELOPE_FREE_SPEED && upright) {
          const k = clamp01((airspeed - c.STALL_SPEED - 2) / (c.ENVELOPE_FREE_SPEED - c.STALL_SPEED - 2));
          const maxPitch = lerp(c.ENVELOPE_MIN_DEG, c.ENVELOPE_MAX_DEG, k) * DEG2RAD;
          if (pitch > maxPitch) {
            const over = pitch - maxPitch;
            if (pitchRate > 0) pitchRate *= Math.max(0, 1 - over / 0.17);
            pitchRate -= over * 2.5;
          }
        }
        // Auto-level: sayap kembali datar tanpa input roll.
        if (Math.abs(input.roll) < 0.1 && !this.roll.active) {
          rollRate += -bank * (env.assist === 'full' ? c.AUTO_LEVEL_FULL : c.AUTO_LEVEL_NORMAL);
        }
        // Penuh: hidung perlahan kembali ke horizon. Normal: sudut angguk saat stik dilepas ditahan (trim),
        // supaya gangguan kecil tidak membuat pesawat pelan-pelan naik/turun.
        const released = Math.abs(input.pitch) < 0.1 && upright && !this.stallLatch;
        if (released && env.assist === 'full') {
          pitchRate += -pitch * c.AUTO_LEVEL_PITCH_FULL;
        } else if (released) {
          if (this.pitchHold === null) this.pitchHold = pitch;
          pitchRate += (this.pitchHold - pitch) * c.PITCH_HOLD_GAIN;
        }
        if (!released) this.pitchHold = null;
        // Belokan terkoordinasi: kemiringan menghasilkan yaw di sekitar atas lokal.
        const fade = 1 - smoothstep(1.35, 1.7, Math.abs(bank));
        const effBank = clamp(bank, -1.3, 1.3);
        const maxTurn = c.TURN_RATE_MAX_DEG * DEG2RAD;
        turnRate = clamp((c.TURN_G * Math.tan(effBank)) / Math.max(airspeed, 8), -maxTurn, maxTurn) * fade;
        // Penghindar tanah (Penuh saja).
        if (env.assist === 'full' && env.groundAhead?.()) pitchRate += c.GROUND_AVOID_RATE;
      }
      if (this.stallLatch) pitchRate -= c.STALL_NOSE_DOWN_RATE;
      rollRate = clamp(rollRate, -c.ROLL_RATE_MAX_DEG * DEG2RAD * 1.2, c.ROLL_RATE_MAX_DEG * DEG2RAD * 1.2);
    } else {
      this.pitchHold = null;
      // Kemudi roda ekor / rudder air: belok di sekitar atas lokal, melemah saat cepat.
      const groundSpeed = this.vel.length();
      const steer = clamp(input.roll + input.yaw, -1, 1);
      const fadeHigh = 1 - 0.65 * smoothstep(4, GROUND.STEER_FADE_SPEED, groundSpeed);
      const fadeLow = Math.max(0.3, clamp01(groundSpeed / 2.5));
      turnRate = steer * GROUND.STEER_RATE_DEG * DEG2RAD * fadeHigh * fadeLow;
      yawRate = 0;
    }

    if (this.roll.active) {
      rollRate = (this.roll.dir * TAU) / c.BARREL_ROLL_DURATION;
      this.roll.t += dt;
      if (this.roll.t >= c.BARREL_ROLL_DURATION) this.roll.active = false;
    }
    if (this.roll.cooldown > 0) this.roll.cooldown = Math.max(0, this.roll.cooldown - dt);

    // ω target dunia = input badan + belokan + rotasi rangka lokal (mengikuti lengkung planet)
    this.omegaT
      .copy(this.rb)
      .multiplyScalar(pitchRate)
      .addScaledVector(this.f, rollRate)
      .addScaledVector(this.ub, -yawRate)
      .addScaledVector(this.up, -turnRate);
    // Rotasi rangka tangen saat bergerak: ω_frame = (up × v) / r
    this.tmp.crossVectors(this.up, this.vel).divideScalar(radius);
    this.omegaT.add(this.tmp);
    // Weathervane: hidung cenderung mengikuti arah aliran udara. Di mode bantuan hanya saat stall
    // (supaya hidung jatuh mengikuti arah jatuh); kalau selalu aktif, ia memperkuat lonjakan naik saat cepat.
    if (airborne && airspeed > 3 && (env.assist === 'off' || this.stallLatch)) {
      const qCruise = 0.5 * 0.72 * c.CRUISE_SPEED * c.CRUISE_SPEED;
      const k = c.WEATHERVANE * clamp((0.5 * rho * airspeed * airspeed) / qCruise, 0, 1.5);
      this.tmp.crossVectors(this.f, this.vRel).multiplyScalar(k / airspeed);
      this.omegaT.add(this.tmp);
    }

    // Torsi = I × (ω_target − ω) × K_RATE, dihitung di rangka badan.
    // Ditambah feed-forward yang menutup kehilangan akibat angular damping Rapier,
    // supaya laju target (termasuk rotasi rangka planet) tercapai tanpa galat tetap.
    // Rapier memutar benda dengan ω sesudah impuls (sebelum redaman), lalu meredam ω ×1/(1+x).
    // Agar ω terintegrasi = ω_target di kondisi tunak: tambahan = (1−k)·x/(1+x).
    const kRate = Math.min(1, c.K_RATE * dt);
    const x = dt * c.ANGULAR_DAMPING;
    const ff = ((1 - kRate) * x) / (1 + x) / kRate;
    this.err.copy(this.omegaT).sub(this.angVel).addScaledVector(this.omegaT, ff);
    this.qInv.copy(this.q).invert();
    this.err.applyQuaternion(this.qInv); // ke rangka badan (x = pitch, y = yaw, z = roll)
    if (!airborne) {
      // Di darat/air: roll dan pitch diurus suspensi/apung, kontrol hanya lemah.
      this.err.x *= env.inWater ? 0.2 : 0.12;
      this.err.z = 0;
    }
    this.err.x *= c.INERTIA_PITCH;
    this.err.y *= c.INERTIA_YAW;
    this.err.z *= c.INERTIA_ROLL;
    this.err.applyQuaternion(this.q).multiplyScalar(kRate);
    body.applyTorqueImpulse(this.err, true);

    // --- 6. Keadaan untuk HUD/audio
    s.speed = this.vel.length();
    s.airspeed = airspeed;
    s.altitude = alt;
    s.verticalSpeed = this.vel.dot(this.up);
    s.alphaDeg = alphaDeg;
    s.rho = rho;
    s.thrust = thrust;
    s.lift = lift;
    s.drag = drag;
  }
}
