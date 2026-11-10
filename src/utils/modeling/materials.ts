/**
 * Material bersama (docs/04 bagian 4): toon ramp halus + rim light tipis dari arah langit.
 * Satu material dipakai banyak mesh berwarna titik → sedikit program shader.
 */
import { Color, DataTexture, LinearFilter, RGBAFormat, type Side, type Texture } from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import { color, dot, float, normalView, oneMinus, positionViewDirection, pow, uniform } from 'three/tsl';

let gradient: Texture | null = null;

/** Ramp toon 4 tingkat dengan filter linear → transisi lembut, bukan garis keras. */
export function toonGradient(): Texture {
  if (gradient) return gradient;
  const steps = [0.46, 0.66, 0.86, 1.0];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255);
    data[i * 4 + 3] = 255;
  });
  const tex = new DataTexture(data, steps.length, 1, RGBAFormat);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  gradient = tex;
  return tex;
}

/** Warna rim (biru langit) — diubah oleh siklus siang-malam. */
export const rimColor = uniform(new Color('#BDE8FF'));
export const rimStrength = uniform(0.22);

export interface ToonOptions {
  rim?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: Side;
}

export function createToonMaterial(opts: ToonOptions = {}): MeshToonNodeMaterial {
  const m = new MeshToonNodeMaterial({ vertexColors: true, gradientMap: toonGradient() });
  if (opts.rim !== false) {
    const fresnel = pow(oneMinus(dot(normalView, positionViewDirection).abs()), float(3));
    m.emissiveNode = color(rimColor).mul(fresnel).mul(rimStrength);
  }
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 0.5;
    m.depthWrite = false;
  }
  if (opts.side !== undefined) m.side = opts.side;
  return m;
}

/**
 * Aktifkan flat shading (normal dari turunan posisi di fragment shader). Tipe MeshToonMaterial tidak
 * punya properti ini, tetapi NodeBuilder three memeriksanya di semua material node.
 */
export function setFlatShading<T extends object>(m: T): T {
  (m as unknown as { flatShading: boolean }).flatShading = true;
  return m;
}

/** Material tanpa cahaya (lampu, panel bercahaya). */
export function createUnlitMaterial(hex: string, opts: { transparent?: boolean; opacity?: number } = {}): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial({ color: new Color(hex) });
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 0.6;
    m.depthWrite = false;
  }
  m.fog = true;
  return m;
}

/** Material warna-titik tanpa cahaya (efek, partikel). */
export function createUnlitVertexColorMaterial(): MeshBasicNodeMaterial {
  return new MeshBasicNodeMaterial({ vertexColors: true });
}
