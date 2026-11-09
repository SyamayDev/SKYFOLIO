/**
 * build-earth — membuat Bumi low-poly SKYFOLIO dari data Natural Earth (public domain).
 * Jalankan: npm run build:earth
 *
 * Output (public/earth/):
 *   earth.bin           posisi int16 terkuantisasi (non-indexed, per segitiga) + warna uint8 + kelas uint8
 *   earth-meta.json     daftar 80 chunk (start, count, bounding sphere), statistik, offset section
 *   trees.bin           posisi pohon (int16×3) + tipe + skala, urut prioritas (tier rendah ambil prefiks)
 *   buildings.bin       gedung kota (int16×3 + ukuran + gaya)
 *   cities.json         daftar kota yang dipakai
 *   coast-distance.png  1024×512 equirectangular: R = jarak dari pantai di laut, G = jarak ke pantai di darat
 *   biome-mask.png      512×256 kelas biome (untuk sebaran props berikutnya)
 * Debug: scripts/.cache/debug-sumatra.png (peta Sumatra Utara: daratan, bandara, Toba)
 *
 * Lihat docs/02-world-zones.md bagian 2.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Vector3 } from 'three';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import {
  AIRPORT,
  DETAIL_REGION,
  EARTH_QUANT_RADIUS,
  PLANET_RADIUS,
  TERRAIN_MAX_HEIGHT,
  TOBA,
  HOME,
} from '../src/config/world';
import { EXTRA, PALETTE, hexToRgb01 } from '../src/config/palette';
import { SimplexNoise } from '../src/utils/noise';
import { hash01, mulberry32 } from '../src/utils/rng';
import { angularDistanceDeg, bearingDirection, latLonToVec3 } from '../src/utils/geo';
import { clamp, lerp, smoothstep, DEG2RAD, RAD2DEG } from '../src/utils/math';
import { AirportFrame } from '../src/world/AirportLayout';
import { TreeType, TriClass } from '../src/world/EarthFormat';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, 'scripts/.cache');
const OUT = resolve(ROOT, 'public/earth');
const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

const SUBDIV_LEVEL = 6;
const SEA_DEPTH = 2.5;
const MASK_W = 4096;
const MASK_H = 2048;
const DT_W = 1024;
const DT_H = 512;
const VERSION = 1;


// ---------------------------------------------------------------------------------------------
// 1. Data

async function loadGeo(name: string): Promise<FeatureCollection> {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, `${name}.geojson`);
  if (!existsSync(file)) {
    console.log(`  ↓ mengunduh ${name}…`);
    const res = await fetch(`${NE_BASE}${name}.geojson`);
    if (!res.ok) throw new Error(`Gagal mengunduh ${name}: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, 'utf8')) as FeatureCollection;
}

function ringsOf(g: Geometry | null): Position[][] {
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  return [];
}

/** Rasterisasi poligon (aturan genap-ganjil) ke bitmap equirectangular. */
function rasterize(rings: Position[][], w: number, h: number): Uint8Array {
  const rows: number[][] = Array.from({ length: h }, () => []);
  for (const ring of rings) {
    for (let k = 0; k < ring.length - 1; k++) {
      const a = ring[k]!;
      const b = ring[k + 1]!;
      const x0 = ((a[0]! + 180) / 360) * w;
      const y0 = ((90 - a[1]!) / 180) * h;
      const x1 = ((b[0]! + 180) / 360) * w;
      const y1 = ((90 - b[1]!) / 180) * h;
      if (y0 === y1) continue;
      const ymin = Math.min(y0, y1);
      const ymax = Math.max(y0, y1);
      const j0 = Math.max(0, Math.ceil(ymin - 0.5));
      const j1 = Math.min(h - 1, Math.ceil(ymax - 0.5) - 1);
      for (let j = j0; j <= j1; j++) {
        const yc = j + 0.5;
        const t = (yc - y0) / (y1 - y0);
        rows[j]!.push(x0 + t * (x1 - x0));
      }
    }
  }
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const r = rows[j]!.sort((p, q) => p - q);
    for (let k = 0; k + 1 < r.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(r[k]! - 0.5));
      const i1 = Math.min(w - 1, Math.ceil(r[k + 1]! - 0.5) - 1);
      for (let i = i0; i <= i1; i++) mask[j * w + i] = 1;
    }
  }
  return mask;
}

function downsample(mask: Uint8Array, w: number, h: number, f: number): Uint8Array {
  const ow = w / f;
  const oh = h / f;
  const out = new Uint8Array(ow * oh);
  const half = (f * f) / 2;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let n = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) n += mask[(y * f + dy) * w + x * f + dx]!;
      out[y * ow + x] = n >= half ? 1 : 0;
    }
  }
  return out;
}

/**
 * Transformasi jarak chamfer pada grid equirectangular (derajat busur, memperhitungkan cos(lat)).
 * Mengembalikan jarak tiap sel ke sel terdekat yang `isSource`.
 */
function distanceTransform(isSource: (i: number) => boolean, w: number, h: number): Float32Array {
  const cell = 180 / h;
  const d = new Float32Array(w * h).fill(1e9);
  for (let i = 0; i < w * h; i++) if (isSource(i)) d[i] = 0;
  const hx = new Float32Array(h);
  for (let y = 0; y < h; y++) hx[y] = Math.max(0.02, Math.cos((90 - (y + 0.5) * cell) * DEG2RAD)) * cell;
  const relax = (i: number, j: number, c: number): void => {
    const v = d[j]! + c;
    if (v < d[i]!) d[i] = v;
  };
  for (let iter = 0; iter < 2; iter++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const xl = (x - 1 + w) % w;
        const xr = (x + 1) % w;
        relax(i, y * w + xl, hx[y]!);
        if (y > 0) {
          const diag = Math.hypot(hx[y]!, cell);
          relax(i, (y - 1) * w + x, cell);
          relax(i, (y - 1) * w + xl, diag);
          relax(i, (y - 1) * w + xr, diag);
        }
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        const xl = (x - 1 + w) % w;
        const xr = (x + 1) % w;
        relax(i, y * w + xr, hx[y]!);
        if (y < h - 1) {
          const diag = Math.hypot(hx[y]!, cell);
          relax(i, (y + 1) * w + x, cell);
          relax(i, (y + 1) * w + xl, diag);
          relax(i, (y + 1) * w + xr, diag);
        }
      }
    }
  }
  return d;
}

function sampleBilinear(grid: Float32Array, w: number, h: number, lat: number, lon: number): number {
  const x = ((lon + 180) / 360) * w - 0.5;
  const y = ((90 - lat) / 180) * h - 0.5;
  const x0 = Math.floor(x);
  const y0 = clamp(Math.floor(y), 0, h - 1);
  const y1 = clamp(y0 + 1, 0, h - 1);
  const fx = x - x0;
  const fy = clamp(y - y0, 0, 1);
  const xa = ((x0 % w) + w) % w;
  const xb = (xa + 1) % w;
  const a = grid[y0 * w + xa]!;
  const b = grid[y0 * w + xb]!;
  const c = grid[y1 * w + xa]!;
  const e = grid[y1 * w + xb]!;
  return lerp(lerp(a, b, fx), lerp(c, e, fx), fy);
}

// ---------------------------------------------------------------------------------------------
// 2. Punggungan pegunungan bernama (polyline lat/lon, tinggi, lebar dalam derajat)

interface Ridge {
  name: string;
  pts: [number, number][];
  height: number;
  width: number;
}

const RIDGES: Ridge[] = [
  { name: 'Himalaya', height: 18, width: 3.2, pts: [[35.5, 74], [34, 77], [31, 79], [29, 82], [28, 86], [27.8, 89], [27.5, 92], [28.5, 96]] },
  { name: 'Tibet', height: 9, width: 5.5, pts: [[34, 80], [33, 86], [32.5, 91], [31.5, 96]] },
  { name: 'Tian Shan–Pamir', height: 10, width: 2.4, pts: [[38.5, 70], [41, 75], [42.5, 80], [43.5, 86]] },
  { name: 'Andes', height: 15, width: 2.3, pts: [[10, -73], [5, -75.5], [0, -78], [-6, -78.5], [-12, -76], [-16, -71], [-22, -68], [-28, -69.5], [-33, -70], [-40, -71.5], [-46, -73], [-52, -73.5]] },
  { name: 'Rocky', height: 10, width: 3.6, pts: [[62, -136], [57, -127], [52, -119], [47, -114], [43, -110], [39, -106.5], [35, -106]] },
  { name: 'Alpen', height: 9, width: 1.7, pts: [[44, 6.5], [45.8, 7.5], [46.4, 10], [47, 12.5], [47.4, 15]] },
  { name: 'Bukit Barisan', height: 8.5, width: 1.25, pts: [[5.2, 95.7], [4.3, 96.6], [3.4, 97.4], [2.3, 98.4], [1.3, 99.4], [0.2, 100.2], [-1.2, 100.9], [-2.6, 101.9], [-4.0, 103.1], [-5.2, 104.4]] },
  { name: 'Ural', height: 6, width: 2, pts: [[68, 66], [62, 59.5], [56, 59], [52, 58.5]] },
  { name: 'Atlas', height: 7, width: 1.8, pts: [[30.5, -9.5], [32, -6], [33.5, -3], [35, 1], [36, 5], [36.8, 9]] },
  { name: 'Great Dividing Range', height: 6, width: 1.8, pts: [[-12, 143], [-18, 146], [-25, 150.5], [-30, 151.5], [-35, 149], [-37.5, 146]] },
  { name: 'Papua', height: 10, width: 1.5, pts: [[-3, 134.5], [-4, 137], [-4.4, 140], [-5.5, 143], [-6.5, 146], [-8, 148]] },
  { name: 'Skandinavia', height: 6, width: 2, pts: [[70, 23], [66, 15], [62, 9], [59.5, 7]] },
  { name: 'Appalachia', height: 4, width: 2, pts: [[47, -69], [42, -74], [37, -80], [34, -84]] },
  { name: 'Ethiopia', height: 7, width: 2.4, pts: [[14, 38], [10, 39], [7, 38]] },
  { name: 'Zagros', height: 6, width: 1.8, pts: [[37, 45], [33, 48], [29, 52], [27, 57]] },
  { name: 'Kaukasus', height: 8, width: 1.4, pts: [[43.5, 40], [42.5, 45], [41, 48.5]] },
  { name: 'Jepang', height: 6, width: 1.2, pts: [[43.5, 143], [40, 140.8], [36.5, 138.5], [34.5, 134]] },
  { name: 'Sierra Madre', height: 6, width: 2, pts: [[30, -108], [25, -105], [20, -103], [17, -98]] },
];

function ridgeHeight(lat: number, lon: number, noise: SimplexNoise, dir: Vector3): number {
  let best = 0;
  const cl = Math.cos(lat * DEG2RAD);
  for (const r of RIDGES) {
    let dmin = Infinity;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [la1, lo1] = r.pts[k]!;
      const [la2, lo2] = r.pts[k + 1]!;
      // Pra-saring kotak pembatas.
      if (lat < Math.min(la1, la2) - r.width || lat > Math.max(la1, la2) + r.width) continue;
      if (lon < Math.min(lo1, lo2) - r.width * 2 || lon > Math.max(lo1, lo2) + r.width * 2) continue;
      const ax = lo1 * cl;
      const ay = la1;
      const bx = lo2 * cl;
      const by = la2;
      const px = lon * cl;
      const py = lat;
      const vx = bx - ax;
      const vy = by - ay;
      const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      const d = Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
      if (d < dmin) dmin = d;
    }
    if (dmin < r.width) {
      const x = dmin / r.width;
      const bump = (1 - x * x) * (1 - x * x);
      const rough = 0.72 + 0.28 * Math.abs(noise.noise3(dir.x * 14, dir.y * 14, dir.z * 14));
      best = Math.max(best, r.height * bump * rough);
    }
  }
  return best;
}

// Gurun (poligon tangan)
const DESERTS: { name: string; red: boolean; pts: [number, number][] }[] = [
  { name: 'Sahara', red: false, pts: [[30, -10], [31, 10], [30, 30], [22, 34], [16, 30], [14, 15], [16, 0], [18, -12], [25, -15]] },
  { name: 'Arab', red: false, pts: [[30, 38], [28, 48], [24, 56], [17, 52], [14, 45], [20, 40]] },
  { name: 'Iran', red: false, pts: [[34, 52], [34, 60], [29, 60], [29, 52]] },
  { name: 'Thar', red: false, pts: [[29, 69], [29, 74], [25, 74], [24, 69]] },
  { name: 'Taklamakan', red: false, pts: [[41, 77], [41, 89], [37, 89], [37, 77]] },
  { name: 'Gobi', red: false, pts: [[45, 95], [45, 112], [40, 112], [40, 95]] },
  { name: 'Australia', red: true, pts: [[-19, 118], [-19, 138], [-24, 142], [-31, 138], [-31, 122], [-25, 115]] },
  { name: 'Kalahari', red: false, pts: [[-19, 18], [-19, 26], [-27, 26], [-28, 18]] },
  { name: 'Atacama', red: true, pts: [[-17, -71], [-17, -69], [-28, -69.5], [-28, -71.5]] },
  { name: 'Mojave', red: true, pts: [[37, -118], [37, -112], [31, -108], [31, -116]] },
];

function pointInPoly(lat: number, lon: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i]!;
    const [yj, xj] = pts[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function desertAt(lat: number, lon: number): { red: boolean } | null {
  for (const d of DESERTS) if (pointInPoly(lat, lon, d.pts)) return d;
  return null;
}

// ---------------------------------------------------------------------------------------------
// 3. Fungsi medan

interface Sample {
  h: number; // tinggi di atas laut (unit), negatif = di bawah laut
  kind: 'sea' | 'land' | 'lake' | 'airport';
}

class Terrain {
  readonly noise = new SimplexNoise(20260101);
  readonly airport = new AirportFrame();
  private readonly tobaCenter = latLonToVec3(TOBA.lat, TOBA.lon, 1);
  private readonly tobaAxis = bearingDirection(this.tobaCenter, TOBA.axisDeg);
  private readonly tobaSide = new Vector3().crossVectors(this.tobaAxis, this.tobaCenter).normalize();
  private readonly samosirCenter = latLonToVec3(TOBA.samosir.lat, TOBA.samosir.lon, 1);

  constructor(
    private readonly land: Uint8Array,
    private readonly lakes: Uint8Array,
    readonly inland: Float32Array,
    readonly offshore: Float32Array,
  ) {}

  isLandMask(lat: number, lon: number): boolean {
    const x = Math.min(MASK_W - 1, Math.floor(((lon + 180) / 360) * MASK_W));
    const y = Math.min(MASK_H - 1, Math.floor(((90 - lat) / 180) * MASK_H));
    return this.land[y * MASK_W + x] === 1;
  }

  isLakeMask(lat: number, lon: number): boolean {
    const x = Math.min(MASK_W - 1, Math.floor(((lon + 180) / 360) * MASK_W));
    const y = Math.min(MASK_H - 1, Math.floor(((90 - lat) / 180) * MASK_H));
    return this.lakes[y * MASK_W + x] === 1;
  }

  /** Jarak elips Toba yang dinormalkan (1 = tepi danau). */
  tobaEllipse(dir: Vector3): number {
    const c = dir.dot(this.tobaCenter);
    const a = Math.atan2(dir.dot(this.tobaAxis), c) * RAD2DEG;
    const s = Math.atan2(dir.dot(this.tobaSide), c) * RAD2DEG;
    return Math.hypot(a / TOBA.semiMajorDeg, s / TOBA.semiMinorDeg);
  }

  samosirEllipse(dir: Vector3): number {
    const c = dir.dot(this.samosirCenter);
    const a = Math.atan2(dir.dot(this.tobaAxis), c) * RAD2DEG;
    const s = Math.atan2(dir.dot(this.tobaSide), c) * RAD2DEG;
    return Math.hypot(a / TOBA.samosir.semiMajorDeg, s / TOBA.samosir.semiMinorDeg);
  }

  natural(dir: Vector3, lat: number, lon: number): Sample {
    const toba = this.tobaEllipse(dir);
    if (toba < 1) {
      if (this.samosirEllipse(dir) < 1) return { h: TOBA.samosir.height, kind: 'land' };
      return { h: TOBA.surfaceHeight, kind: 'lake' };
    }
    const land = this.isLandMask(lat, lon) || toba < 1.25;
    if (!land) return { h: -SEA_DEPTH, kind: 'sea' };
    const inl = sampleBilinear(this.inland, DT_W, DT_H, lat, lon);
    const n = this.noise;
    const base = 0.55 + 3.4 * (1 - Math.exp(-inl / 4));
    const coastFade = smoothstep(0, 1.2, inl);
    const hills = n.fbm3(dir.x * 3.1, dir.y * 3.1, dir.z * 3.1, 4) * 1.9 * coastFade;
    const fine = n.noise3(dir.x * 11, dir.y * 11, dir.z * 11) * 0.45 * coastFade;
    let h = base + hills + fine + ridgeHeight(lat, lon, n, dir) * smoothstep(0, 0.7, inl);
    // Lapisan es Antartika dan Greenland.
    const greenland = lat > 60 && lon > -73 && lon < -12;
    if (lat < -62 || greenland) h += 3.5 * smoothstep(0, 3, inl);
    // Bibir kaldera Toba: dinding naik di sekeliling danau.
    if (toba < 1.6) h = Math.max(h, TOBA.surfaceHeight + 1.2 + (toba - 1) * 2.5);
    if (this.isLakeMask(lat, lon)) return { h: clamp(h - 1.2, 0.4, TERRAIN_MAX_HEIGHT), kind: 'lake' };
    return { h: clamp(h, 0.35, TERRAIN_MAX_HEIGHT), kind: 'land' };
  }

  sample(dir: Vector3): Sample {
    const lat = Math.asin(clamp(dir.y, -1, 1)) * RAD2DEG;
    const lon = Math.atan2(dir.x, dir.z) * RAD2DEG;
    const nat = this.natural(dir, lat, lon);
    const d = this.airport.flatDistance(dir);
    if (d <= 0) return { h: AIRPORT.elevation, kind: 'airport' };
    if (d < AIRPORT.blendWidth) {
      const t = smoothstep(0, AIRPORT.blendWidth, d);
      if (nat.kind === 'sea') {
        // Pesisir buatan landai di tepi bandara.
        const shore = lerp(AIRPORT.elevation, -SEA_DEPTH, t);
        return { h: shore, kind: shore > 0 ? 'land' : 'sea' };
      }
      return { h: lerp(AIRPORT.elevation, nat.h, t), kind: nat.kind === 'lake' ? 'lake' : 'land' };
    }
    return nat;
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Icosphere dengan pelacakan chunk

interface Mesh {
  verts: Vector3[];
  faces: number[]; // triplet indeks
  chunk: number[]; // id chunk per muka
}

function icosphere(level: number): Mesh {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => new Vector3(x, y, z).normalize());
  let faces = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];
  // Pastikan semua muka menghadap keluar (CCW dilihat dari luar).
  for (let f = 0; f < faces.length; f += 3) {
    const a = verts[faces[f]!]!;
    const b = verts[faces[f + 1]!]!;
    const c = verts[faces[f + 2]!]!;
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (n.dot(a) < 0) [faces[f + 1], faces[f + 2]] = [faces[f + 2]!, faces[f + 1]!];
  }
  let chunk = Array.from({ length: 20 }, (_, i) => i);
  const cache = new Map<number, number>();
  const mid = (i: number, j: number): number => {
    const key = i < j ? i * 1_000_000 + j : j * 1_000_000 + i;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const v = new Vector3().addVectors(verts[i]!, verts[j]!).normalize();
    verts.push(v);
    cache.set(key, verts.length - 1);
    return verts.length - 1;
  };
  for (let l = 0; l < level; l++) {
    const nf: number[] = [];
    const nc: number[] = [];
    for (let f = 0; f < faces.length / 3; f++) {
      const a = faces[f * 3]!;
      const b = faces[f * 3 + 1]!;
      const c = faces[f * 3 + 2]!;
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      nf.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
      // Level pertama menentukan id chunk (20 × 4 = 80 chunk).
      const id = l === 0 ? f * 4 : chunk[f]!;
      if (l === 0) nc.push(id, id + 1, id + 2, id + 3);
      else nc.push(id, id, id, id);
    }
    faces = nf;
    chunk = nc;
  }
  return { verts, faces, chunk };
}

// ---------------------------------------------------------------------------------------------
// 5. Pewarnaan

const RGB = {
  grassTropic: hexToRgb01(PALETTE.grassTropic),
  grassTemperate: hexToRgb01(PALETTE.grassTemperate),
  grassBoreal: hexToRgb01(PALETTE.grassBoreal),
  sand: hexToRgb01(PALETTE.sand),
  desert: hexToRgb01(PALETTE.desert),
  redRock: hexToRgb01(PALETTE.redRock),
  rock: hexToRgb01(PALETTE.rock),
  snow: hexToRgb01(PALETTE.snow),
  ice: hexToRgb01(PALETTE.ice),
  lake: hexToRgb01(EXTRA.lake),
};

function mix3(a: number[], b: number[], t: number): [number, number, number] {
  return [lerp(a[0]!, b[0]!, t), lerp(a[1]!, b[1]!, t), lerp(a[2]!, b[2]!, t)];
}

function classify(
  centroid: Vector3,
  hs: [number, number, number],
  kinds: [Sample['kind'], Sample['kind'], Sample['kind']],
  normal: Vector3,
  faceId: number,
): { rgb: [number, number, number]; cls: TriClass } {
  const lat = Math.asin(clamp(centroid.y / centroid.length(), -1, 1)) * RAD2DEG;
  const lon = Math.atan2(centroid.x, centroid.z) * RAD2DEG;
  const hAvg = (hs[0] + hs[1] + hs[2]) / 3;
  const hMin = Math.min(...hs);
  const lakeCount = kinds.filter((k) => k === 'lake').length;
  const airportCount = kinds.filter((k) => k === 'airport').length;
  const up = centroid.clone().normalize();
  const slope = normal.dot(up);
  let rgb: [number, number, number];
  let cls: TriClass;
  const v = (hash01(faceId) - 0.5) * 0.08; // variasi kecerahan ±4%
  const absLat = Math.abs(lat);
  if (lakeCount >= 2) {
    rgb = [...RGB.lake] as [number, number, number];
    cls = TriClass.Lake;
  } else if (airportCount >= 2) {
    rgb = mix3(RGB.grassTropic, RGB.grassTemperate, 0.35);
    cls = TriClass.Airport;
  } else if (hMin < 0.3 || kinds.includes('sea')) {
    rgb = [...RGB.sand] as [number, number, number];
    cls = TriClass.Sand;
  } else if (absLat > 72 || (lat < -62 && hAvg > 1) || (lat > 60 && lon > -73 && lon < -12 && hAvg > 2)) {
    rgb = hash01(faceId * 7) > 0.35 ? ([...RGB.snow] as [number, number, number]) : ([...RGB.ice] as [number, number, number]);
    cls = TriClass.Snow;
  } else if (hAvg > TERRAIN_MAX_HEIGHT * 0.62) {
    rgb = [...RGB.snow] as [number, number, number];
    cls = TriClass.Snow;
  } else if (hAvg > TERRAIN_MAX_HEIGHT * 0.4 || (slope < 0.8 && hAvg > 3)) {
    rgb = [...RGB.rock] as [number, number, number];
    cls = TriClass.Rock;
  } else {
    const desert = desertAt(lat, lon);
    if (desert) {
      rgb = desert.red && hash01(faceId * 3) > 0.45 ? ([...RGB.redRock] as [number, number, number]) : ([...RGB.desert] as [number, number, number]);
      cls = TriClass.Desert;
    } else if (absLat < 23) {
      rgb = [...RGB.grassTropic] as [number, number, number];
      cls = TriClass.Grass;
    } else if (absLat < 50) {
      rgb = mix3(RGB.grassTropic, RGB.grassTemperate, smoothstep(23, 30, absLat));
      cls = TriClass.Grass;
    } else if (absLat < 64) {
      rgb = mix3(RGB.grassTemperate, RGB.grassBoreal, smoothstep(50, 56, absLat));
      cls = TriClass.Grass;
    } else {
      rgb = mix3(RGB.grassBoreal, RGB.snow, 0.5);
      cls = TriClass.Grass;
    }
  }
  return { rgb: [clamp(rgb[0] * (1 + v), 0, 1), clamp(rgb[1] * (1 + v), 0, 1), clamp(rgb[2] * (1 + v), 0, 1)], cls };
}

// ---------------------------------------------------------------------------------------------
// 6. Bangun segitiga

interface Tri {
  a: Vector3;
  b: Vector3;
  c: Vector3;
  rgb: [number, number, number];
  cls: TriClass;
  chunk: number;
  kinds: [Sample['kind'], Sample['kind'], Sample['kind']];
  hs: [number, number, number];
}

function buildTriangles(mesh: Mesh, terrain: Terrain): Tri[] {
  const { verts, faces, chunk } = mesh;
  const samples: Sample[] = verts.map((v) => terrain.sample(v));
  const finalPos = verts.map((v, i) => v.clone().multiplyScalar(PLANET_RADIUS + samples[i]!.h));
  const faceCount = faces.length / 3;

  // Muka di wilayah detail.
  const detailCenter = { lat: DETAIL_REGION.lat, lon: DETAIL_REGION.lon };
  const isDetail = new Uint8Array(faceCount);
  const centroid = new Vector3();
  for (let f = 0; f < faceCount; f++) {
    centroid
      .copy(verts[faces[f * 3]!]!)
      .add(verts[faces[f * 3 + 1]!]!)
      .add(verts[faces[f * 3 + 2]!]!)
      .normalize();
    const lat = Math.asin(centroid.y) * RAD2DEG;
    const lon = Math.atan2(centroid.x, centroid.z) * RAD2DEG;
    if (angularDistanceDeg({ lat, lon }, detailCenter) < DETAIL_REGION.radiusDeg) isDetail[f] = 1;
  }
  // Ketetanggaan sisi → apakah sisi berbatasan dengan muka non-detail.
  const edgeFaces = new Map<number, number[]>();
  const ek = (i: number, j: number): number => (i < j ? i * 1_000_000 + j : j * 1_000_000 + i);
  for (let f = 0; f < faceCount; f++) {
    for (let e = 0; e < 3; e++) {
      const k = ek(faces[f * 3 + e]!, faces[f * 3 + ((e + 1) % 3)]!);
      const list = edgeFaces.get(k);
      if (list) list.push(f);
      else edgeFaces.set(k, [f]);
    }
  }
  const edgeIsBoundary = (i: number, j: number): boolean => {
    const list = edgeFaces.get(ek(i, j)) ?? [];
    return list.some((f) => isDetail[f] === 0);
  };

  const tris: Tri[] = [];
  const pushTri = (
    pa: Vector3,
    pb: Vector3,
    pc: Vector3,
    sa: Sample,
    sb: Sample,
    sc: Sample,
    ch: number,
    id: number,
  ): void => {
    const hs: [number, number, number] = [sa.h, sb.h, sc.h];
    if (Math.max(...hs) <= 0.02) return; // seluruhnya di bawah laut → tidak perlu
    const kinds: [Sample['kind'], Sample['kind'], Sample['kind']] = [sa.kind, sb.kind, sc.kind];
    const n = new Vector3().subVectors(pb, pa).cross(new Vector3().subVectors(pc, pa)).normalize();
    const cen = new Vector3().add(pa).add(pb).add(pc).divideScalar(3);
    const { rgb, cls } = classify(cen, hs, kinds, n, id);
    tris.push({ a: pa, b: pb, c: pc, rgb, cls, chunk: ch, kinds, hs });
  };

  const N = DETAIL_REGION.subdivisions;
  let subId = faceCount;
  for (let f = 0; f < faceCount; f++) {
    const ia = faces[f * 3]!;
    const ib = faces[f * 3 + 1]!;
    const ic = faces[f * 3 + 2]!;
    if (!isDetail[f]) {
      pushTri(finalPos[ia]!, finalPos[ib]!, finalPos[ic]!, samples[ia]!, samples[ib]!, samples[ic]!, chunk[f]!, f);
      continue;
    }
    // Subdivisi barisentrik N×N. Titik di sisi batas diinterpolasi lurus supaya tidak ada retakan.
    const idx = [ia, ib, ic];
    const grid = new Map<number, { p: Vector3; s: Sample }>();
    const edgePoint = (u: number, v: number, k: number): { p: Vector3; s: Sample } => {
      // Urutan kanonik: indeks kecil dulu, supaya muka tetangga menghasilkan titik identik.
      if (u > v) return edgePoint(v, u, N - k);
      if (k === 0) return { p: finalPos[u]!, s: samples[u]! };
      if (k === N) return { p: finalPos[v]!, s: samples[v]! };
      if (edgeIsBoundary(u, v)) {
        const p = new Vector3().lerpVectors(finalPos[u]!, finalPos[v]!, k / N);
        const h = p.length() - PLANET_RADIUS;
        const su = samples[u]!;
        const sv = samples[v]!;
        const kind = h <= 0 ? 'sea' : k / N < 0.5 ? su.kind : sv.kind;
        return { p, s: { h, kind: kind === 'sea' && h > 0 ? 'land' : kind } };
      }
      const dir = new Vector3()
        .copy(verts[u]!)
        .multiplyScalar(N - k)
        .addScaledVector(verts[v]!, k)
        .normalize();
      const s = terrain.sample(dir);
      return { p: dir.multiplyScalar(PLANET_RADIUS + s.h), s };
    };
    const point = (i: number, j: number): { p: Vector3; s: Sample } => {
      const key = i * 64 + j;
      const hit = grid.get(key);
      if (hit) return hit;
      let res: { p: Vector3; s: Sample };
      if (j === 0) res = edgePoint(idx[0]!, idx[1]!, i);
      else if (i === 0) res = edgePoint(idx[0]!, idx[2]!, j);
      else if (i + j === N) res = edgePoint(idx[1]!, idx[2]!, j);
      else {
        const dir = new Vector3()
          .copy(verts[ia]!)
          .multiplyScalar(N - i - j)
          .addScaledVector(verts[ib]!, i)
          .addScaledVector(verts[ic]!, j)
          .normalize();
        const s = terrain.sample(dir);
        res = { p: dir.multiplyScalar(PLANET_RADIUS + s.h), s };
      }
      grid.set(key, res);
      return res;
    };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N - j; i++) {
        const p0 = point(i, j);
        const p1 = point(i + 1, j);
        const p2 = point(i, j + 1);
        pushTri(p0.p, p1.p, p2.p, p0.s, p1.s, p2.s, chunk[f]!, subId++);
        if (i + j < N - 1) {
          const p3 = point(i + 1, j + 1);
          pushTri(p1.p, p3.p, p2.p, p1.s, p3.s, p2.s, chunk[f]!, subId++);
        }
      }
    }
  }
  return tris;
}

// ---------------------------------------------------------------------------------------------
// 7. Pencari permukaan (titik → segitiga) untuk menaruh pohon dan gedung tepat di atas medan

class SurfaceIndex {
  private readonly buckets = new Map<number, number[]>();
  constructor(private readonly tris: Tri[]) {
    tris.forEach((t, i) => {
      const lats = [t.a, t.b, t.c].map((p) => Math.asin(clamp(p.y / p.length(), -1, 1)) * RAD2DEG);
      const lons = [t.a, t.b, t.c].map((p) => Math.atan2(p.x, p.z) * RAD2DEG);
      const la0 = Math.floor(Math.min(...lats));
      const la1 = Math.floor(Math.max(...lats));
      let lo0 = Math.floor(Math.min(...lons));
      let lo1 = Math.floor(Math.max(...lons));
      if (lo1 - lo0 > 180 || Math.abs(Math.max(...lats)) > 80) {
        lo0 = -180;
        lo1 = 179;
      }
      for (let la = la0; la <= la1; la++) for (let lo = lo0; lo <= lo1; lo++) this.add(la, lo, i);
    });
  }
  private key(la: number, lo: number): number {
    return (la + 90) * 360 + (((lo + 180) % 360) + 360) % 360;
  }
  private add(la: number, lo: number, i: number): void {
    const k = this.key(la, lo);
    const b = this.buckets.get(k);
    if (b) b.push(i);
    else this.buckets.set(k, [i]);
  }
  /** Titik permukaan tepat di bawah arah `dir`, atau null jika bukan daratan. */
  find(dir: Vector3): { p: Vector3; tri: Tri } | null {
    const lat = Math.asin(clamp(dir.y, -1, 1)) * RAD2DEG;
    const lon = Math.atan2(dir.x, dir.z) * RAD2DEG;
    const list = this.buckets.get(this.key(Math.floor(lat), Math.floor(lon)));
    if (!list) return null;
    for (const i of list) {
      const t = this.tris[i]!;
      const hit = rayTri(dir, t.a, t.b, t.c);
      if (hit) return { p: hit, tri: t };
    }
    return null;
  }
}

const _e1 = new Vector3();
const _e2 = new Vector3();
const _pv = new Vector3();
const _tv = new Vector3();
const _qv = new Vector3();
/** Möller–Trumbore dari pusat planet ke arah `dir`. */
function rayTri(dir: Vector3, a: Vector3, b: Vector3, c: Vector3): Vector3 | null {
  _e1.subVectors(b, a);
  _e2.subVectors(c, a);
  _pv.crossVectors(dir, _e2);
  const det = _e1.dot(_pv);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  _tv.copy(a).negate();
  const u = _tv.dot(_pv) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  _qv.crossVectors(_tv, _e1);
  const v = dir.dot(_qv) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  const t = _e2.dot(_qv) * inv;
  if (t <= 0) return null;
  return dir.clone().multiplyScalar(t);
}

// ---------------------------------------------------------------------------------------------
// 8. Pohon

interface TreeOut {
  p: Vector3;
  type: TreeType;
  scale: number;
  priority: number;
}

function placeTrees(tris: Tri[], terrain: Terrain): TreeOut[] {
  const rng = mulberry32(777);
  const noise = new SimplexNoise(4242);
  const minDist = 1.5;
  const grid = new Map<string, Vector3[]>();
  const cellKey = (p: Vector3): string =>
    `${Math.floor(p.x / minDist)},${Math.floor(p.y / minDist)},${Math.floor(p.z / minDist)}`;
  const tooClose = (p: Vector3): boolean => {
    const cx = Math.floor(p.x / minDist);
    const cy = Math.floor(p.y / minDist);
    const cz = Math.floor(p.z / minDist);
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let z = cz - 1; z <= cz + 1; z++) {
          for (const q of grid.get(`${x},${y},${z}`) ?? []) if (q.distanceToSquared(p) < minDist * minDist) return true;
        }
    return false;
  };
  const detailCenter = { lat: DETAIL_REGION.lat, lon: DETAIL_REGION.lon };
  const out: TreeOut[] = [];
  const e1 = new Vector3();
  const e2 = new Vector3();
  for (const t of tris) {
    if (t.cls !== TriClass.Grass && t.cls !== TriClass.Desert && t.cls !== TriClass.Rock) continue;
    const area = e1.subVectors(t.b, t.a).cross(e2.subVectors(t.c, t.a)).length() / 2;
    const cen = new Vector3().add(t.a).add(t.b).add(t.c).divideScalar(3);
    const dir = cen.clone().normalize();
    const lat = Math.asin(clamp(dir.y, -1, 1)) * RAD2DEG;
    const lon = Math.atan2(dir.x, dir.z) * RAD2DEG;
    const inDetail = angularDistanceDeg({ lat, lon }, detailCenter) < DETAIL_REGION.radiusDeg;
    // Hutan berkelompok: kepadatan dari noise.
    const forest = clamp(noise.fbm3(dir.x * 6, dir.y * 6, dir.z * 6, 3) * 1.6 + 0.35, 0, 1);
    let density = 0.06 * forest;
    if (t.cls === TriClass.Desert) density = 0.006;
    if (t.cls === TriClass.Rock) density = 0.012;
    if (Math.abs(lat) > 64) density *= 0.25;
    if (inDetail) density *= 2.6;
    const count = Math.floor(area * density + rng());
    for (let k = 0; k < count; k++) {
      let u = rng();
      let v = rng();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const p = new Vector3().copy(t.a).addScaledVector(e1.subVectors(t.b, t.a), u).addScaledVector(e2.subVectors(t.c, t.a), v);
      const pdir = p.clone().normalize();
      // Jauhi bandara dan danau Toba.
      if (terrain.airport.flatDistance(pdir) < AIRPORT.blendWidth + 2) continue;
      if (terrain.tobaEllipse(pdir) < 1.15) continue;
      if (tooClose(p)) continue;
      const absLat = Math.abs(lat);
      let type: TreeType;
      const r = rng();
      if (t.cls === TriClass.Desert) type = TreeType.Cactus;
      else if (t.cls === TriClass.Rock) type = TreeType.Pine;
      else if (absLat < 23) type = r < 0.38 ? TreeType.Palm : r < 0.85 ? TreeType.Round : TreeType.Bush;
      else if (absLat < 50) type = r < 0.62 ? TreeType.Round : r < 0.9 ? TreeType.Pine : TreeType.Bush;
      else type = r < 0.75 ? TreeType.TallPine : TreeType.Pine;
      const key = cellKey(p);
      const list = grid.get(key);
      if (list) list.push(p);
      else grid.set(key, [p]);
      out.push({ p, type, scale: 0.75 + rng() * 0.5, priority: (inDetail ? 0 : 1) + rng() });
    }
  }
  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, 9000);
}

// ---------------------------------------------------------------------------------------------
// 9. Kota

interface City {
  name: string;
  lat: number;
  lon: number;
  pop: number;
}

interface BuildingOut {
  p: Vector3;
  w: number;
  d: number;
  h: number;
  color: number;
  rot: number;
}

const EXTRA_CITIES: City[] = [
  { name: 'Denpasar', lat: -8.65, lon: 115.22, pop: 900000 },
  { name: 'Pekanbaru', lat: 0.51, lon: 101.45, pop: 1100000 },
];
const INDONESIA_KEEP = ['Medan', 'Jakarta', 'Surabaya', 'Bandung', 'Makassar', 'Palembang', 'Banda Aceh', 'Padang', 'Semarang'];

function pickCities(places: FeatureCollection): City[] {
  const all: City[] = places.features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return {
      name: String(p.name ?? ''),
      lat: Number(p.latitude),
      lon: Number(p.longitude),
      pop: Number(p.pop_max ?? 0),
      country: String(p.adm0name ?? ''),
    };
  });
  const top = [...all].sort((a, b) => b.pop - a.pop).slice(0, 150);
  const indo = all.filter((c) => INDONESIA_KEEP.includes(c.name));
  const map = new Map<string, City>();
  for (const c of [...top, ...indo, ...EXTRA_CITIES]) map.set(`${c.name}|${c.lat.toFixed(2)}`, { name: c.name, lat: c.lat, lon: c.lon, pop: c.pop });
  return [...map.values()];
}

function placeBuildings(cities: City[], surface: SurfaceIndex, terrain: Terrain): { buildings: BuildingOut[]; used: City[] } {
  const rng = mulberry32(31337);
  const buildings: BuildingOut[] = [];
  const used: City[] = [];
  for (const city of cities) {
    const center = latLonToVec3(city.lat, city.lon, 1);
    const count = Math.round(clamp(5 + Math.log10(Math.max(city.pop, 1e4) / 1e4) * 11, 5, 40));
    const radius = 1.6 + count * 0.12;
    const east = new Vector3().crossVectors(new Vector3(0, 1, 0), center);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = new Vector3().crossVectors(center, east).normalize();
    let placed = 0;
    const local: { p: Vector3; r: number }[] = [];
    for (let k = 0; k < count * 4 && placed < count; k++) {
      const ang = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * radius;
      const dir = center
        .clone()
        .addScaledVector(east, (Math.cos(ang) * dist) / PLANET_RADIUS)
        .addScaledVector(north, (Math.sin(ang) * dist) / PLANET_RADIUS)
        .normalize();
      if (terrain.airport.flatDistance(dir) < AIRPORT.blendWidth + 1) continue;
      if (terrain.tobaEllipse(dir) < 1.1) continue;
      const hit = surface.find(dir);
      if (!hit || hit.tri.cls === TriClass.Lake || hit.tri.cls === TriClass.Sand || hit.tri.cls === TriClass.Snow) continue;
      const centerness = 1 - dist / radius;
      const w = 0.7 + rng() * 0.8;
      const d = 0.7 + rng() * 0.8;
      if (local.some((o) => o.p.distanceTo(hit.p) < (o.r + Math.max(w, d)) * 0.75)) continue;
      const big = clamp(Math.log10(Math.max(city.pop, 1e4) / 1e5), 0, 2.2);
      const h = 0.9 + rng() * 1.2 + centerness * centerness * big * (1.4 + rng() * 1.6);
      local.push({ p: hit.p, r: Math.max(w, d) });
      buildings.push({ p: hit.p, w, d, h, color: Math.floor(rng() * 5), rot: Math.floor(rng() * 8) });
      placed++;
    }
    if (placed > 0) used.push(city);
  }
  return { buildings, used };
}

// ---------------------------------------------------------------------------------------------
// 10. Tulis file

function quant(v: number): number {
  return clamp(Math.round((v / EARTH_QUANT_RADIUS) * 32767), -32767, 32767);
}

function writeEarth(tris: Tri[]): { meta: object; bytes: number } {
  // Urutkan per chunk.
  const byChunk: Tri[][] = Array.from({ length: 80 }, () => []);
  for (const t of tris) byChunk[t.chunk]!.push(t);
  const total = tris.length;
  const posBytes = total * 9 * 2;
  const colBytes = total * 3;
  const clsBytes = total;
  const buf = Buffer.alloc(posBytes + colBytes + clsBytes);
  const pos = new Int16Array(buf.buffer, buf.byteOffset, total * 9);
  let i = 0;
  const chunks: { start: number; count: number; center: number[]; radius: number }[] = [];
  for (let c = 0; c < 80; c++) {
    const list = byChunk[c]!;
    const start = i;
    const center = new Vector3();
    for (const t of list) center.add(t.a).add(t.b).add(t.c);
    if (list.length) center.divideScalar(list.length * 3);
    let radius = 0;
    for (const t of list) {
      for (const p of [t.a, t.b, t.c]) {
        radius = Math.max(radius, p.distanceTo(center));
      }
      const ps = [t.a, t.b, t.c];
      for (let k = 0; k < 3; k++) {
        pos[i * 9 + k * 3] = quant(ps[k]!.x);
        pos[i * 9 + k * 3 + 1] = quant(ps[k]!.y);
        pos[i * 9 + k * 3 + 2] = quant(ps[k]!.z);
      }
      buf[posBytes + i * 3] = Math.round(t.rgb[0] * 255);
      buf[posBytes + i * 3 + 1] = Math.round(t.rgb[1] * 255);
      buf[posBytes + i * 3 + 2] = Math.round(t.rgb[2] * 255);
      buf[posBytes + colBytes + i] = t.cls;
      i++;
    }
    chunks.push({
      start,
      count: list.length,
      center: [+center.x.toFixed(3), +center.y.toFixed(3), +center.z.toFixed(3)],
      radius: +(radius + 0.5).toFixed(3),
    });
  }
  writeFileSync(resolve(OUT, 'earth.bin'), buf);
  const meta = {
    version: VERSION,
    generatedBy: 'scripts/build-earth.ts',
    source: 'Natural Earth 1:50m (public domain)',
    quantRadius: EARTH_QUANT_RADIUS,
    triangleCount: total,
    sections: { positions: 0, colors: posBytes, classes: posBytes + colBytes },
    chunks,
  };
  writeFileSync(resolve(OUT, 'earth-meta.json'), JSON.stringify(meta));
  return { meta, bytes: buf.length };
}

function writeTrees(trees: TreeOut[]): number {
  const buf = Buffer.alloc(trees.length * 8);
  trees.forEach((t, i) => {
    buf.writeInt16LE(quant(t.p.x), i * 8);
    buf.writeInt16LE(quant(t.p.y), i * 8 + 2);
    buf.writeInt16LE(quant(t.p.z), i * 8 + 4);
    buf.writeUInt8(t.type, i * 8 + 6);
    buf.writeUInt8(Math.round(clamp((t.scale - 0.5) / 1.0, 0, 1) * 255), i * 8 + 7);
  });
  writeFileSync(resolve(OUT, 'trees.bin'), buf);
  return buf.length;
}

function writeBuildings(list: BuildingOut[]): number {
  const buf = Buffer.alloc(list.length * 10);
  list.forEach((b, i) => {
    const o = i * 10;
    buf.writeInt16LE(quant(b.p.x), o);
    buf.writeInt16LE(quant(b.p.y), o + 2);
    buf.writeInt16LE(quant(b.p.z), o + 4);
    buf.writeUInt8(Math.round(clamp(b.w / 2.5, 0, 1) * 255), o + 6);
    buf.writeUInt8(Math.round(clamp(b.d / 2.5, 0, 1) * 255), o + 7);
    buf.writeUInt8(Math.round(clamp(b.h / 8, 0, 1) * 255), o + 8);
    buf.writeUInt8((b.color & 7) | ((b.rot & 7) << 3), o + 9);
  });
  writeFileSync(resolve(OUT, 'buildings.bin'), buf);
  return buf.length;
}

async function writeImages(terrain: Terrain, landDT: Uint8Array): Promise<void> {
  // coast-distance.png: R = jarak dari pantai di laut (0..6°), G = jarak ke pantai di darat (0..10°).
  const rgb = Buffer.alloc(DT_W * DT_H * 3);
  for (let i = 0; i < DT_W * DT_H; i++) {
    rgb[i * 3] = landDT[i] ? 0 : Math.round(clamp(terrain.offshore[i]! / 6, 0, 1) * 255);
    rgb[i * 3 + 1] = landDT[i] ? Math.round(clamp(terrain.inland[i]! / 10, 0, 1) * 255) : 0;
    rgb[i * 3 + 2] = landDT[i] ? 255 : 0;
  }
  await sharp(rgb, { raw: { width: DT_W, height: DT_H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, 'coast-distance.png'));

  // biome-mask.png 512×256: warna kelas (debug + sebaran props berikutnya).
  const BW = 512;
  const BH = 256;
  const bio = Buffer.alloc(BW * BH * 3);
  const dir = new Vector3();
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      const lat = 90 - ((y + 0.5) / BH) * 180;
      const lon = ((x + 0.5) / BW) * 360 - 180;
      latLonToVec3(lat, lon, 1, dir);
      const s = terrain.sample(dir);
      const o = (y * BW + x) * 3;
      let c: number[] = [0, 0, 0];
      if (s.kind === 'land' || s.kind === 'airport') {
        const desert = desertAt(lat, lon);
        c = desert ? [200, 150, 60] : Math.abs(lat) > 64 ? [220, 230, 240] : s.h > 9 ? [140, 130, 120] : [70, 180, 80];
      } else if (s.kind === 'lake') c = [60, 170, 230];
      bio[o] = c[0]!;
      bio[o + 1] = c[1]!;
      bio[o + 2] = c[2]!;
    }
  }
  await sharp(bio, { raw: { width: BW, height: BH, channels: 3 } }).png().toFile(resolve(OUT, 'biome-mask.png'));
}

async function writeDebugSumatra(terrain: Terrain, natural: boolean, file: string): Promise<void> {
  // Peta Sumatra Utara untuk memeriksa letak bandara dan Toba.
  const lat0 = 7;
  const lat1 = 0;
  const lon0 = 95;
  const lon1 = 103;
  const ppd = 60;
  const W = (lon1 - lon0) * ppd;
  const H = (lat0 - lat1) * ppd;
  const img = Buffer.alloc(W * H * 3);
  const dir = new Vector3();
  const loc = { along: 0, side: 0 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = lat0 - (y + 0.5) / ppd;
      const lon = lon0 + (x + 0.5) / ppd;
      latLonToVec3(lat, lon, 1, dir);
      const s = natural ? terrain.natural(dir, lat, lon) : terrain.sample(dir);
      const o = (y * W + x) * 3;
      let c: number[];
      if (s.kind === 'sea') c = [40, 110, 210];
      else if (s.kind === 'lake') c = [80, 200, 240];
      else if (s.kind === 'airport') c = [255, 210, 60];
      else {
        const t = clamp(s.h / 12, 0, 1);
        c = [lerp(90, 150, t), lerp(200, 130, t), lerp(90, 110, t)];
      }
      terrain.airport.toLocal(dir, loc);
      const inRunway = Math.abs(loc.along) < terrain.airport.halfLength && Math.abs(loc.side) < terrain.airport.halfWidth;
      if (inRunway) c = natural ? [c[0]! * 0.5, c[1]! * 0.5, c[2]! * 0.5] : [60, 60, 70];
      else if (natural && Math.abs(terrain.airport.flatDistance(dir)) < 0.25) c = [255, 210, 60];
      // Titik Medan asli
      if (angularDistanceDeg({ lat, lon }, HOME) < 0.05) c = [255, 0, 0];
      // Grid 1°
      if (Math.abs(lat - Math.round(lat)) <= 0.51 / ppd || Math.abs(lon - Math.round(lon)) <= 0.51 / ppd) c = [c[0]! * 0.7, c[1]! * 0.7, c[2]! * 0.7];
      img[o] = c[0]!;
      img[o + 1] = c[1]!;
      img[o + 2] = c[2]!;
    }
  }
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(resolve(CACHE, file));
}

// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const t0 = performance.now();
  console.log('🌍 build-earth: memuat data Natural Earth…');
  const [landGeo, lakeGeo, placesGeo] = await Promise.all([
    loadGeo('ne_50m_land'),
    loadGeo('ne_50m_lakes'),
    loadGeo('ne_50m_populated_places_simple'),
  ]);
  const landRings = landGeo.features.flatMap((f) => ringsOf(f.geometry));
  const lakeRings = lakeGeo.features.flatMap((f) => ringsOf(f.geometry));
  console.log(`  ${landRings.length} ring daratan, ${lakeRings.length} ring danau`);

  const land = rasterize(landRings, MASK_W, MASK_H);
  const lakes = rasterize(lakeRings, MASK_W, MASK_H);
  const landSmall = downsample(land, MASK_W, MASK_H, MASK_W / DT_W);
  const inland = distanceTransform((i) => landSmall[i] === 0, DT_W, DT_H);
  const offshore = distanceTransform((i) => landSmall[i] === 1, DT_W, DT_H);
  console.log(`  raster + jarak pantai selesai (${((performance.now() - t0) / 1000).toFixed(1)} dtk)`);

  const terrain = new Terrain(land, lakes, inland, offshore);

  // Laporan geometri bandara vs Toba.
  const airportC = { lat: AIRPORT.lat, lon: AIRPORT.lon };
  const tobaDist = angularDistanceDeg(airportC, { lat: TOBA.lat, lon: TOBA.lon });
  console.log(
    `  bandara: tengah ${AIRPORT.lat},${AIRPORT.lon} heading ${AIRPORT.headingDeg}°, jarak ke Toba ${tobaDist.toFixed(2)}° (${((tobaDist * DEG2RAD) * PLANET_RADIUS).toFixed(1)} unit)`,
  );

  mkdirSync(OUT, { recursive: true });
  const mesh = icosphere(SUBDIV_LEVEL);
  console.log(`  icosphere level ${SUBDIV_LEVEL}: ${mesh.verts.length} titik, ${mesh.faces.length / 3} muka`);
  const tris = buildTriangles(mesh, terrain);
  const earth = writeEarth(tris);
  console.log(`  daratan: ${tris.length} segitiga → earth.bin ${(earth.bytes / 1024).toFixed(0)} KB`);

  const surface = new SurfaceIndex(tris);
  const trees = placeTrees(tris, terrain);
  const treeBytes = writeTrees(trees);
  console.log(`  pohon: ${trees.length} → trees.bin ${(treeBytes / 1024).toFixed(0)} KB`);

  const cities = pickCities(placesGeo);
  const { buildings, used } = placeBuildings(cities, surface, terrain);
  const bBytes = writeBuildings(buildings);
  writeFileSync(
    resolve(OUT, 'cities.json'),
    JSON.stringify(used.map((c) => ({ name: c.name, lat: +c.lat.toFixed(3), lon: +c.lon.toFixed(3), pop: c.pop }))),
  );
  console.log(`  kota: ${used.length}, gedung: ${buildings.length} → buildings.bin ${(bBytes / 1024).toFixed(0)} KB`);

  await writeImages(terrain, landSmall);
  await writeDebugSumatra(terrain, true, 'debug-sumatra-natural.png');
  await writeDebugSumatra(terrain, false, 'debug-sumatra.png');
  console.log(`✅ selesai dalam ${((performance.now() - t0) / 1000).toFixed(1)} detik`);
}

main().catch((err: unknown) => {
  console.error('❌ build-earth gagal:', err);
  process.exit(1);
});
