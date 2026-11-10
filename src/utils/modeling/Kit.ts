/**
 * Pustaka "kitbash" kecil untuk membuat model low-poly lewat kode (docs/04 bagian 3).
 * Semua bagian diubah ke geometri non-indexed dengan normal per muka (flat) dan warna per titik,
 * lalu digabung (mergeByMaterial) supaya draw call sedikit.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type ExtrudeGeometryOptions,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash01 } from '../rng';

export type ColorLike = string | number | Color;
export type Vec3Tuple = [number, number, number];

export interface PartOptions {
  pos?: Vec3Tuple;
  /** Rotasi Euler (radian, urutan XYZ). */
  rot?: Vec3Tuple;
  scale?: number | Vec3Tuple;
  /** Variasi kecerahan per muka (0..1), misalnya 0.04 = ±4%. */
  jitter?: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

/** Ubah geometri jadi flat-shaded + satu warna titik. Atribut selain position/normal/color dibuang. */
export function paint(geo: BufferGeometry, color: ColorLike, jitter = 0, seed = 1): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.computeVertexNormals();
  _c.set(color);
  const n = g.attributes.position!.count;
  const arr = new Float32Array(n * 3);
  for (let f = 0; f < n / 3; f++) {
    const v = jitter > 0 ? 1 + (hash01(f * 7919 + seed) - 0.5) * 2 * jitter : 1;
    for (let k = 0; k < 3; k++) {
      const i = (f * 3 + k) * 3;
      arr[i] = _c.r * v;
      arr[i + 1] = _c.g * v;
      arr[i + 2] = _c.b * v;
    }
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3));
  if (g !== geo) geo.dispose();
  return g;
}

export function partMatrix(opts: PartOptions = {}, out = new Matrix4()): Matrix4 {
  const [px, py, pz] = opts.pos ?? [0, 0, 0];
  const [rx, ry, rz] = opts.rot ?? [0, 0, 0];
  const sc = opts.scale ?? 1;
  _p.set(px, py, pz);
  _q.setFromEuler(_e.set(rx, ry, rz));
  if (typeof sc === 'number') _s.set(sc, sc, sc);
  else _s.set(sc[0], sc[1], sc[2]);
  return out.compose(_p, _q, _s);
}

/** Pengumpul bagian-bagian model yang akan digabung menjadi satu geometri. */
export class Kit {
  private readonly parts: BufferGeometry[] = [];
  private seed = 1;

  add(geo: BufferGeometry, color: ColorLike, opts: PartOptions = {}): this {
    const g = paint(geo, color, opts.jitter ?? 0, this.seed++);
    g.applyMatrix4(partMatrix(opts, _m));
    // Skala negatif membalik urutan muka → normal perlu dihitung ulang.
    if (Array.isArray(opts.scale) && opts.scale[0] * opts.scale[1] * opts.scale[2] < 0) flipWinding(g);
    this.parts.push(g);
    return this;
  }

  addMatrix(geo: BufferGeometry, color: ColorLike, matrix: Matrix4, jitter = 0): this {
    const g = paint(geo, color, jitter, this.seed++);
    g.applyMatrix4(matrix);
    this.parts.push(g);
    return this;
  }

  /** Tambah geometri yang sudah diwarnai (punya atribut color). */
  addPainted(geo: BufferGeometry, matrix?: Matrix4): this {
    if (matrix) geo.applyMatrix4(matrix);
    this.parts.push(geo);
    return this;
  }

  get count(): number {
    return this.parts.length;
  }

  build(): BufferGeometry {
    if (this.parts.length === 0) return new BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (!merged) throw new Error('Kit.build: gagal menggabungkan geometri');
    merged.computeBoundingSphere();
    return merged;
  }
}

function flipWinding(g: BufferGeometry): void {
  const pos = g.attributes.position!;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = arr[i + 3 + k]!;
      arr[i + 3 + k] = arr[i + 6 + k]!;
      arr[i + 6 + k] = t;
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

// --- Primitif ---------------------------------------------------------------------------------

export const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);
export const rbox = (w: number, h: number, d: number, r = 0.1, seg = 2): BufferGeometry =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
export const cyl = (rTop: number, rBottom: number, h: number, seg = 8, open = false): BufferGeometry =>
  new CylinderGeometry(rTop, rBottom, h, seg, 1, open);
export const cone = (r: number, h: number, seg = 8): BufferGeometry => new ConeGeometry(r, h, seg);
export const sphere = (r: number, w = 8, h = 6): BufferGeometry => new SphereGeometry(r, w, h);
export const ico = (r: number, detail = 0): BufferGeometry => new IcosahedronGeometry(r, detail);
export const torus = (r: number, tube: number, radial = 6, tubular = 14, arc = Math.PI * 2): BufferGeometry =>
  new TorusGeometry(r, tube, radial, tubular, arc);

/** Lathe dari titik [radius, y] (badan, cowling). */
export function lathe(points: [number, number][], segments = 12): BufferGeometry {
  return new LatheGeometry(
    points.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
}

/** Silinder di antara dua titik (strut, kabel, tiang). */
export function strut(a: Vector3, b: Vector3, radius: number, seg = 6): BufferGeometry {
  const len = a.distanceTo(b);
  const g = new CylinderGeometry(radius, radius, len, seg, 1);
  const dir = new Vector3().subVectors(b, a).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5);
  g.applyMatrix4(new Matrix4().compose(mid, q, new Vector3(1, 1, 1)));
  return g;
}

/** Ekstrusi bentuk 2D (huruf, panel). Bentuk di bidang XY, tebal sepanjang Z (terpusat). */
export function extrude(shape: Shape, depth: number, opts: Partial<ExtrudeGeometryOptions> = {}): BufferGeometry {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4, ...opts });
  const bevel = opts.bevelEnabled ? (opts.bevelThickness ?? 0) : 0;
  g.translate(0, 0, -depth / 2 - bevel / 2);
  return g;
}

/**
 * Sayap dengan profil airfoil sederhana. Rentang sepanjang X (terpusat), tali busur sepanjang Z
 * (tepi depan di −Z), ketebalan sepanjang Y.
 */
export function airfoilWing(span: number, chord: number, thickness: number, tipRound = 0.25): BufferGeometry {
  const s = new Shape();
  // Profil di bidang (z, y): tepi depan bulat, tepi belakang tipis.
  const pts: [number, number][] = [
    [-0.5, 0],
    [-0.46, 0.45],
    [-0.3, 0.75],
    [-0.05, 0.62],
    [0.25, 0.38],
    [0.5, 0.06],
    [0.5, -0.06],
    [0.2, -0.25],
    [-0.2, -0.3],
    [-0.42, -0.22],
  ];
  pts.forEach(([z, y], i) => {
    const px = z * chord;
    const py = y * thickness;
    if (i === 0) s.moveTo(px, py);
    else s.lineTo(px, py);
  });
  s.closePath();
  const g = new ExtrudeGeometry(s, {
    depth: span - tipRound * 2,
    bevelEnabled: tipRound > 0,
    bevelThickness: tipRound,
    bevelSize: Math.min(thickness * 0.3, tipRound * 0.5),
    bevelSegments: 2,
    curveSegments: 1,
  });
  // Ekstrusi sepanjang +Z → putar supaya rentang di X, tali busur di Z.
  g.translate(0, 0, -(span - tipRound * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** Huruf/teks: helper untuk Shape persegi panjang dengan sudut bulat. */
export function roundedRectShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
