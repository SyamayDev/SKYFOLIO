/**
 * Konversi koordinat bumi ↔ posisi 3D.
 * Konvensi (docs/02 bagian 1): sumbu +Y = kutub utara, lon 0 menghadap +Z, lon +90° (timur) menghadap +X.
 * "Atas" lokal = normalize(posisi). Jangan pernah memakai (0,1,0) sebagai atas di logika dunia.
 */
import { Vector3 } from 'three';
import { DEG2RAD, RAD2DEG, clamp } from './math';

export interface LatLon {
  lat: number;
  lon: number;
}

const POLE = new Vector3(0, 1, 0);
const _a = new Vector3();
const _n = new Vector3();
const _u = new Vector3();

export function latLonToVec3(latDeg: number, lonDeg: number, radius = 1, out = new Vector3()): Vector3 {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  const c = Math.cos(lat);
  return out.set(radius * c * Math.sin(lon), radius * Math.sin(lat), radius * c * Math.cos(lon));
}

export function vec3ToLatLon(v: { x: number; y: number; z: number }, out: LatLon = { lat: 0, lon: 0 }): LatLon {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  out.lat = Math.asin(clamp(v.y / len, -1, 1)) * RAD2DEG;
  out.lon = Math.atan2(v.x, v.z) * RAD2DEG;
  return out;
}

export function localUp(pos: Vector3, out = new Vector3()): Vector3 {
  return out.copy(pos).normalize();
}

/**
 * Arah timur di titik `pos`. Di kutub (arah timur tidak terdefinisi) dipakai sumbu cadangan
 * supaya tidak menghasilkan NaN.
 */
export function eastAt(pos: Vector3, out = new Vector3()): Vector3 {
  out.crossVectors(POLE, pos);
  if (out.lengthSq() < 1e-10) out.set(1, 0, 0);
  return out.normalize();
}

/** Arah utara di titik `pos` (tegak lurus atas lokal): north = up × east. */
export function northAt(pos: Vector3, out = new Vector3()): Vector3 {
  eastAt(pos, _a);
  localUp(pos, _u);
  return out.crossVectors(_u, _a).normalize();
}

/** Arah tangen menurut bearing (derajat dari utara, searah jarum jam). */
export function bearingDirection(pos: Vector3, bearingDeg: number, out = new Vector3()): Vector3 {
  const b = bearingDeg * DEG2RAD;
  northAt(pos, _n);
  eastAt(pos, _a);
  return out
    .copy(_n)
    .multiplyScalar(Math.cos(b))
    .addScaledVector(_a, Math.sin(b))
    .normalize();
}

/** Bearing (derajat 0–360) dari sebuah arah tangen di titik `pos`. */
export function headingOf(pos: Vector3, dir: Vector3): number {
  northAt(pos, _n);
  eastAt(pos, _a);
  const b = Math.atan2(dir.dot(_a), dir.dot(_n)) * RAD2DEG;
  return (b + 360) % 360;
}

/** Jarak sudut lingkaran besar antara dua titik (derajat). */
export function angularDistanceDeg(a: LatLon, b: LatLon): number {
  const la1 = a.lat * DEG2RAD;
  const la2 = b.lat * DEG2RAD;
  const dLat = la2 - la1;
  const dLon = (b.lon - a.lon) * DEG2RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) * RAD2DEG;
}

/** Titik tujuan dari `start` dengan bearing dan jarak sudut tertentu (rumus lingkaran besar). */
export function destination(start: LatLon, bearingDeg: number, distanceDeg: number): LatLon {
  const la1 = start.lat * DEG2RAD;
  const lo1 = start.lon * DEG2RAD;
  const b = bearingDeg * DEG2RAD;
  const d = distanceDeg * DEG2RAD;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  let lon = lo2 * RAD2DEG;
  lon = ((lon + 540) % 360) - 180;
  return { lat: la2 * RAD2DEG, lon };
}

/** Konversi jarak permukaan (unit) ke derajat busur pada radius tertentu. */
export function unitsToDeg(units: number, radius: number): number {
  return (units / radius) * RAD2DEG;
}

export function degToUnits(deg: number, radius: number): number {
  return deg * DEG2RAD * radius;
}

/**
 * Rangka tangen lokal (east, north, up) di titik `pos`.
 * Ditulis ke vektor yang diberikan supaya bisa dipakai di loop panas.
 */
export function tangentFrame(pos: Vector3, east: Vector3, north: Vector3, up: Vector3): void {
  localUp(pos, up);
  eastAt(pos, east);
  north.crossVectors(up, east).normalize();
}
