/**
 * Helper quaternion untuk terbang di planet bulat.
 * Konvensi badan pesawat (sama dengan kamera three.js): depan = −Z, atas = +Y, kanan = +X.
 * Semua perhitungan memakai atas lokal planet, jadi tidak ada glitch di kutub.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';

const _m = new Matrix4();
const _r = new Vector3();
const _u = new Vector3();
const _b = new Vector3();
const _f = new Vector3();
const _axis = new Vector3();

export const AXIS_FORWARD = new Vector3(0, 0, -1);
export const AXIS_UP = new Vector3(0, 1, 0);
export const AXIS_RIGHT = new Vector3(1, 0, 0);

/**
 * Quaternion dari arah atas dan arah depan yang diinginkan.
 * Depan diproyeksikan ke bidang tegak lurus `up` (Gram-Schmidt), jadi `up` selalu dihormati.
 * Jika depan sejajar `up`, dipakai sumbu cadangan supaya hasilnya tetap valid.
 */
export function quatFromUpForward(up: Vector3, forward: Vector3, out = new Quaternion()): Quaternion {
  _u.copy(up).normalize();
  _f.copy(forward).addScaledVector(_u, -forward.dot(_u));
  if (_f.lengthSq() < 1e-10) {
    // Cari sumbu apa pun yang tegak lurus up.
    _f.set(1, 0, 0).addScaledVector(_u, -_u.x);
    if (_f.lengthSq() < 1e-6) _f.set(0, 0, 1).addScaledVector(_u, -_u.z);
  }
  _f.normalize();
  _b.copy(_f).negate(); // sumbu +Z badan = belakang
  _r.crossVectors(_u, _b).normalize(); // +X = up × back
  _m.makeBasis(_r, _u, _b);
  return out.setFromRotationMatrix(_m);
}

/** Sumbu badan dari quaternion. */
export function bodyForward(q: Quaternion, out = new Vector3()): Vector3 {
  return out.copy(AXIS_FORWARD).applyQuaternion(q);
}
export function bodyUp(q: Quaternion, out = new Vector3()): Vector3 {
  return out.copy(AXIS_UP).applyQuaternion(q);
}
export function bodyRight(q: Quaternion, out = new Vector3()): Vector3 {
  return out.copy(AXIS_RIGHT).applyQuaternion(q);
}

/**
 * Sudut miring (bank) relatif horizon lokal, radian. Positif = sayap kanan turun.
 * Rentang (−π, π], jadi terbalik penuh = ±π.
 */
export function bankAngle(right: Vector3, up: Vector3, localUp: Vector3): number {
  return Math.atan2(-right.dot(localUp), up.dot(localUp));
}

/** Sudut angguk (pitch) relatif horizon lokal, radian. Positif = hidung naik. */
export function pitchAngle(forward: Vector3, localUp: Vector3): number {
  const d = forward.dot(localUp);
  return Math.asin(d < -1 ? -1 : d > 1 ? 1 : d);
}

/**
 * Memutar vektor `v` menuju arah `target` sebesar fraksi `t` (slerp arah, panjang dipertahankan).
 * Ditulis ke `out`. Aman bila keduanya sejajar.
 */
export function rotateTowards(v: Vector3, targetDir: Vector3, t: number, out: Vector3): Vector3 {
  const len = v.length();
  if (len < 1e-6) return out.copy(v);
  _f.copy(v).divideScalar(len);
  _b.copy(targetDir).normalize();
  const dot = Math.min(1, Math.max(-1, _f.dot(_b)));
  const angle = Math.acos(dot);
  if (angle < 1e-6) return out.copy(v);
  _axis.crossVectors(_f, _b);
  if (_axis.lengthSq() < 1e-12) return out.copy(v); // berlawanan arah: biarkan (tidak terdefinisi)
  _axis.normalize();
  return out.copy(_f).applyAxisAngle(_axis, angle * Math.min(1, Math.max(0, t))).multiplyScalar(len);
}

/** Vektor rotasi (sumbu × sudut) yang memutar arah `from` ke arah `to`. */
export function rotationVectorBetween(from: Vector3, to: Vector3, out = new Vector3()): Vector3 {
  _f.copy(from).normalize();
  _b.copy(to).normalize();
  out.crossVectors(_f, _b);
  const s = out.length();
  const c = _f.dot(_b);
  if (s < 1e-9) return out.set(0, 0, 0);
  return out.multiplyScalar(Math.atan2(s, c) / s);
}
