/**
 * Autopilot (docs/03 bagian 12) — dipakai Piko, Mode Rekruter, tombol "Antar ke sini" di peta, dan tes.
 * Memakai INPUT YANG SAMA dengan pemain (pitch/roll/gas/boost), bukan memindahkan posisi, jadi fisikanya jujur.
 * 1. Arah = lingkaran besar ke target, diproyeksikan ke bidang tangen → kesalahan arah → perintah roll.
 * 2. Ketinggian target = max(tinggi tujuan, medan di 20/40/60 unit ke depan + jarak aman) → perintah pitch.
 * 3. Tiba: mengitari POI (radius 18) lalu memanggil `onArrive`.
 * Input pemain di atas deadzone → batal ("Kemudi diambil alih!").
 */
import { Vector3 } from 'three';
import { AUTOPILOT } from '../config/flight';
import { PLANET_RADIUS } from '../config/world';
import { clamp } from '../utils/math';

export interface AutopilotCommand {
  pitch: number;
  roll: number;
  gas: number;
  boost: boolean;
}

export interface AutopilotTarget {
  id: string;
  label: string;
  position: Vector3;
  /** Ketinggian pendekatan di atas permukaan (default 20). */
  approachAgl?: number;
  /** Radius mengitari saat tiba. */
  orbitRadius?: number;
  onArrive?: () => void;
  /** Tetap mengitari setelah tiba (Mode Rekruter / panel terbuka di HP). */
  hold?: boolean;
  boost?: boolean;
}

const _up = new Vector3();
const _to = new Vector3();
const _fwd = new Vector3();
const _right = new Vector3();
const _probe = new Vector3();
const _pRight = new Vector3();

export class Autopilot {
  target: AutopilotTarget | null = null;
  arrived = false;
  private readonly cmd: AutopilotCommand = { pitch: 0, roll: 0, gas: 0, boost: false };
  private altI = 0;

  constructor(private readonly terrainHeight: (dir: Vector3) => number) {}

  get active(): boolean {
    return this.target !== null;
  }

  engage(t: AutopilotTarget): void {
    this.target = t;
    this.arrived = false;
    this.altI = 0;
  }

  cancel(): void {
    this.target = null;
    this.arrived = false;
  }

  /** Jarak permukaan (unit busur) ke target. */
  distanceTo(pos: Vector3): number {
    if (!this.target) return 0;
    return _up.copy(pos).normalize().angleTo(_to.copy(this.target.position).normalize()) * PLANET_RADIUS;
  }

  /** `forward`/`planeUp` = sumbu depan & atas badan pesawat di ruang dunia. */
  update(pos: Vector3, forward: Vector3, planeUp: Vector3, vel: Vector3, grounded: boolean): AutopilotCommand | null {
    const t = this.target;
    if (!t) return null;
    const c = this.cmd;
    const r = pos.length();
    _up.copy(pos).divideScalar(r);
    _fwd.copy(forward).addScaledVector(_up, -forward.dot(_up)).normalize();
    _right.crossVectors(_fwd, _up);
    const dist = this.distanceTo(pos);
    const orbitR = t.orbitRadius ?? AUTOPILOT.ORBIT_RADIUS;
    // Arah yang diinginkan.
    _to.copy(t.position).normalize();
    _to.addScaledVector(_up, -_to.dot(_up));
    if (dist < orbitR * 1.15) {
      if (!this.arrived) {
        this.arrived = true;
        t.onArrive?.();
        if (!t.hold) {
          this.target = null;
          return null;
        }
      }
      // Mengitari: arah tangen lingkaran di sekitar POI (searah jarum jam dilihat dari atas).
      _to.normalize();
      _to.cross(_up).negate().addScaledVector(_to, (dist - orbitR) / orbitR);
    }
    if (_to.lengthSq() < 1e-10) _to.copy(_fwd);
    _to.normalize();
    const err = Math.atan2(_to.dot(_right), _to.dot(_fwd));
    // Input roll = laju putar, bukan sudut. Maka kendalikan SUDUT MIRING (dibatasi) supaya tidak terus berguling
    // sampai terbalik — penting di FPS rendah saat perintah hanya diperbarui beberapa kali per detik.
    _pRight.crossVectors(forward, planeUp);
    const bank = Math.atan2(-_pRight.dot(_up), planeUp.dot(_up));
    const wantBank = clamp(err * AUTOPILOT.BANK_GAIN, -AUTOPILOT.MAX_BANK, AUTOPILOT.MAX_BANK);
    c.roll = clamp((wantBank - bank) * AUTOPILOT.ROLL_GAIN, -1, 1);
    // Ketinggian target dengan penghindaran medan.
    // Jauh dari tujuan: terbang jelajah lebih tinggi; mendekat: turun ke ketinggian pendekatan.
    const agl = Math.max(t.approachAgl ?? AUTOPILOT.APPROACH_AGL, dist > AUTOPILOT.CRUISE_DIST ? AUTOPILOT.CRUISE_AGL : 0);
    let ground = Math.max(0, this.terrainHeight(_up));
    for (const ahead of [20, 40, 60]) {
      _probe.copy(_up).addScaledVector(_fwd, ahead / PLANET_RADIUS).normalize();
      ground = Math.max(ground, this.terrainHeight(_probe) - ahead * 0.08);
    }
    const tgtR = PLANET_RADIUS + Math.max(ground + AUTOPILOT.CLEARANCE, Math.max(0, this.terrainHeight(_to.copy(t.position).normalize())) + agl);
    const vs = vel.dot(_up);
    const altErr = tgtR - r;
    this.altI = clamp(this.altI + altErr * 0.002, -0.3, 0.3);
    // Saat miring, sebagian gaya angkat hilang → tambah tarikan sebanding sudut miring.
    c.pitch = clamp(altErr * AUTOPILOT.ALT_GAIN - vs * AUTOPILOT.VS_DAMP + this.altI + Math.abs(bank) * AUTOPILOT.TURN_PITCH, -0.8, 0.9);
    c.gas = 1;
    c.boost = !!t.boost && dist > 120 && Math.abs(err) < 0.3;
    // Dekat tanah (baru lepas landas): sayap datar dan terus menanjak lurus dulu, baru berbelok. Tanpa ini
    // autopilot langsung membelok di ujung landasan dan bisa menabrak menara kontrol.
    const agl0 = r - PLANET_RADIUS - Math.max(0, this.terrainHeight(_up));
    const rollLimit = clamp((agl0 - AUTOPILOT.TURN_MIN_AGL) / AUTOPILOT.TURN_BLEND_AGL, 0, 1);
    c.roll *= rollLimit;
    if (rollLimit < 1) c.pitch = Math.max(c.pitch, 0.45 * (1 - rollLimit));
    if (grounded) {
      c.pitch = 0.6;
      c.roll = 0;
      c.boost = false;
    }
    return c;
  }
}
