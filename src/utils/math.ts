/** Fungsi matematika skalar kecil yang dipakai di mana-mana. Bebas alokasi. */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

export function remap(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return lerp(outMin, outMax, clamp01(inverseLerp(inMin, inMax, v)));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Peluruhan eksponensial yang tidak bergantung frame rate.
 * `rate` = berapa cepat mendekati target (1/detik).
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Faktor lerp untuk damp() — berguna untuk vektor/quaternion. */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** Bungkus sudut ke rentang (−π, π]. */
export function wrapAngle(a: number): number {
  const w = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI; // [−π, π)
  return w <= -Math.PI ? w + TAU : w;
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

/** Zona mati + kurva respons (dipakai gamepad dan joystick sentuh). */
export function applyDeadzone(v: number, deadzone: number, exponent = 2): number {
  const a = Math.abs(v);
  if (a <= deadzone) return 0;
  const n = (a - deadzone) / (1 - deadzone);
  return Math.sign(v) * Math.pow(clamp01(n), exponent);
}

/**
 * Pegas teredam kritis (smoothDamp ala Unity) untuk satu sumbu.
 * Mengembalikan nilai baru; kecepatan disimpan di state[0].
 */
export function smoothDamp(
  current: number,
  target: number,
  state: Float32Array | number[],
  index: number,
  smoothTime: number,
  dt: number,
): number {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const vel = state[index] ?? 0;
  const temp = (vel + omega * change) * dt;
  state[index] = (vel - omega * temp) * exp;
  return target + (change + temp) * exp;
}
