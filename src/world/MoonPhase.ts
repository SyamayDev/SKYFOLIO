/** Fase & arah Bulan nyata (docs/04 bagian 6) — modul murni supaya mudah diuji. */
import { Vector3 } from 'three';

const SYNODIC = 29.53059;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

/** Fase Bulan 0..1 (0 = bulan baru, 0,5 = purnama). */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  return (((days / SYNODIC) % 1) + 1) % 1;
}

/** Arah Bulan dari pusat Bumi: arah matahari diputar mundur sejauh sudut fase di sekitar sumbu kutub. */
export function moonDirection(sunDir: Vector3, phase: number, out = new Vector3()): Vector3 {
  const a = -phase * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  out.set(sunDir.x * c + sunDir.z * s, sunDir.y * 0.4, -sunDir.x * s + sunDir.z * c);
  return out.normalize();
}
