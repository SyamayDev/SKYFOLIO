/**
 * build-earth (v2) — membuat Bumi low-poly SKYFOLIO dari data Natural Earth (public domain).
 * Jalankan: npm run build:earth
 *
 * Output (public/earth/):
 *   earth.bin(.gz)      posisi int16 (non-indexed, per segitiga) + warna uint8 + kelas uint8 + aux uint8
 *                       aux = (hutan 0..15) << 4 | (ladang 0..15) → dipakai shader medan & sebaran props
 *   earth-meta.json     80 chunk (start, count, bounding sphere), offset section, info sungai
 *   rivers.bin(.gz)     pita sungai: segitiga, per titik int16 x,y,z + int16 (jarak sepanjang ×4 << 1 | sisi)
 *   buildings.bin       gedung kota (int16×3 + ukuran + gaya)
 *   cities.json         daftar kota yang dipakai
 *   coast-distance.png  1024×512 equirectangular: R = jarak dari pantai di laut, G = jarak ke pantai di darat
 *   biome-mask.png      512×256 kelas biome kasar
 * Debug (scripts/.cache/): debug-world.png, debug-sumatra*.png
 *
 * Lihat docs/02-world-zones.md bagian 2 dan docs/decisions.md (Bumi v2).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
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
import { EARTH_FORMAT_VERSION, TriClass } from '../src/world/EarthFormat';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, 'scripts/.cache');
const OUT = resolve(ROOT, 'public/earth');
const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

const SUBDIV_LEVEL = 7;
const SEA_DEPTH = 2.5;
const MASK_W = 4096;
const MASK_H = 2048;
const DT_W = 1024;
const DT_H = 512;

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

function linesOf(g: Geometry | null): Position[][] {
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
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
// 2. Punggungan pegunungan bernama (polyline lat/lon, tinggi, lebar dalam derajat) dan gurun

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
  { name: 'Jawa', height: 6, width: 0.8, pts: [[-6.9, 106.5], [-7.2, 108.5], [-7.4, 110.4], [-7.7, 112.5], [-8.0, 114.0]] },
  { name: 'Sulawesi', height: 5, width: 0.9, pts: [[0.8, 120.5], [-1.5, 120.2], [-3.5, 120.0], [-5.0, 120.0]] },
  { name: 'Kalimantan', height: 4, width: 1.4, pts: [[4.5, 115.2], [2.5, 114.2], [0.8, 113.8], [-0.8, 114.3]] },
];

function ridgeHeight(lat: number, lon: number, noise: SimplexNoise, dir: Vector3): number {
  let best = 0;
  const cl = Math.cos(lat * DEG2RAD);
  for (const r of RIDGES) {
    let dmin = Infinity;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [la1, lo1] = r.pts[k]!;
      const [la2, lo2] = r.pts[k + 1]!;
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
      // Puncak bergerigi: noise bergelombang + noise "ridged" (1 − |n|)² untuk punggung tajam.
      const n14 = Math.abs(noise.noise3(dir.x * 14, dir.y * 14, dir.z * 14));
      const rid = 1 - Math.abs(noise.noise3(dir.x * 26 + 7, dir.y * 26, dir.z * 26 - 3));
      const rough = 0.6 + 0.22 * n14 + 0.3 * rid * rid;
      best = Math.max(best, r.height * bump * rough);
    }
  }
  return best;
}

const DESERTS: { name: string; red: boolean; pts: [number, number][] }[] = [
  { name: 'Sahara', red: false, pts: [[30, -10], [31, 10], [30, 30], [22, 34], [16, 30], [14, 15], [16, 0], [18, -12], [25, -15]] },
  { name: 'Arab', red: false, pts: [[30, 38], [28, 48], [24, 56], [17, 52], [14, 45], [20, 40]] },
  { name: 'Iran', red: false, pts: [[34.5, 53], [35, 57], [33.5, 60.5], [30, 60], [28.5, 57], [29.5, 53.5], [32, 52]] },
  { name: 'Thar', red: false, pts: [[29.5, 70], [29, 73.5], [27, 74.5], [24.8, 73], [24.5, 70], [26.5, 68.8]] },
  { name: 'Taklamakan', red: false, pts: [[40.8, 78], [41.2, 84], [40.5, 88.5], [38, 89], [37, 85], [37.2, 79], [38.8, 76.8]] },
  { name: 'Gobi', red: false, pts: [[44.8, 96], [45.5, 103], [44.5, 110.5], [42, 112], [40.2, 108], [40.5, 100], [42.2, 95]] },
  { name: 'Australia', red: true, pts: [[-19, 118], [-19, 138], [-24, 142], [-31, 138], [-31, 122], [-25, 115]] },
  { name: 'Kalahari', red: false, pts: [[-19.5, 19], [-19, 24], [-21.5, 26.5], [-25.5, 26], [-27.8, 22.5], [-27, 18.5], [-23, 17.5]] },
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

const desertWarp = new SimplexNoise(777);
/** Uji gurun dengan tepi yang dibengkokkan noise supaya tidak tampak seperti poligon kotak. */
function desertAt(lat: number, lon: number): { red: boolean } | null {
  const wl = lat + desertWarp.fbm3(lat * 0.09, lon * 0.09, 1.3, 3) * 3.2;
  const wo = lon + desertWarp.fbm3(lat * 0.09 + 11, lon * 0.09, 4.7, 3) * 3.6;
  for (const d of DESERTS) if (pointInPoly(wl, wo, d.pts)) return d;
  return null;
}

/** 0..1: seberapa kering (dekat gurun atau sabana tropis kering). */
function drynessAt(lat: number, lon: number): number {
  if (desertAt(lat, lon)) return 1;
  let near = 0;
  for (const [dl, dn] of [
    [2.5, 0],
    [-2.5, 0],
    [0, 3],
    [0, -3],
    [4.5, 0],
    [-4.5, 0],
  ] as [number, number][]) {
    if (desertAt(lat + dl, lon + dn)) near += Math.abs(dl) > 3 ? 0.12 : 0.22;
  }
  // Sabana Afrika dan Australia utara.
  const sav =
    (lon > -18 && lon < 50 && Math.abs(lat) > 6 && Math.abs(lat) < 17 ? 0.45 : 0) +
    (lon > 112 && lon < 154 && lat < -13 && lat > -36 ? 0.35 : 0);
  return clamp(near + sav, 0, 0.9);
}

// ---------------------------------------------------------------------------------------------
// 3. Sungai (Natural Earth rivers_lake_centerlines + beberapa sungai Indonesia yang ditambah manual)

interface RiverLine {
  name: string;
  rank: number;
  /** [lon, lat] */
  pts: [number, number][];
}

/** Sungai penting yang tidak ada di data 1:50m (perkiraan jalur, cukup untuk dunia mainan). */
const EXTRA_RIVERS: RiverLine[] = [
  // Musi melintasi Palembang (Jembatan Ampera).
  { name: 'Musi', rank: 5, pts: [[102.1, -3.25], [102.9, -3.1], [103.6, -2.95], [104.2, -3.05], [104.76, -2.99], [104.85, -2.6], [104.92, -2.35]] },
  // Asahan: dari Danau Toba ke Selat Malaka.
  { name: 'Asahan', rank: 5, pts: [[99.2, 2.62], [99.5, 2.76], [99.75, 2.9], [99.86, 2.98]] },
  // Batang Hari (Jambi).
  { name: 'Batang Hari', rank: 5, pts: [[101.2, -1.3], [102.0, -1.5], [102.8, -1.55], [103.6, -1.6], [104.3, -1.05]] },
  // Bengawan Solo.
  { name: 'Bengawan Solo', rank: 5, pts: [[110.8, -7.6], [111.4, -7.3], [111.9, -7.15], [112.4, -6.95], [112.6, -6.9]] },
  // Mahakam.
  { name: 'Mahakam', rank: 5, pts: [[114.5, 0.4], [115.5, -0.1], [116.4, -0.35], [117.1, -0.5], [117.4, -0.6]] },
];

interface RiverSeg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Setengah lebar lembah (derajat). */
  w: number;
}

function valleyHalfWidth(rank: number): number {
  return rank <= 2 ? 0.55 : rank <= 4 ? 0.45 : 0.36;
}

class RiverIndex {
  private readonly grid = new Map<number, RiverSeg[]>();
  constructor(lines: RiverLine[]) {
    for (const l of lines) {
      const w = valleyHalfWidth(l.rank);
      for (let k = 0; k < l.pts.length - 1; k++) {
        const [ax, ay] = l.pts[k]!;
        const [bx, by] = l.pts[k + 1]!;
        if (Math.abs(ax - bx) > 180) continue; // melintasi garis tanggal → abaikan
        const seg: RiverSeg = { ax, ay, bx, by, w };
        const la0 = Math.floor(Math.min(ay, by) - w);
        const la1 = Math.floor(Math.max(ay, by) + w);
        const lo0 = Math.floor(Math.min(ax, bx) - w * 2);
        const lo1 = Math.floor(Math.max(ax, bx) + w * 2);
        for (let la = la0; la <= la1; la++)
          for (let lo = lo0; lo <= lo1; lo++) {
            const key = this.key(la, lo);
            const list = this.grid.get(key);
            if (list) list.push(seg);
            else this.grid.set(key, [seg]);
          }
      }
    }
  }
  private key(la: number, lo: number): number {
    return (la + 90) * 400 + (((lo + 180) % 360) + 360) % 360;
  }
  /** Jarak ternormalisasi ke sungai terdekat (0 = di sungai, ≥1 = di luar lembah). */
  valley(lat: number, lon: number): number {
    const list = this.grid.get(this.key(Math.floor(lat), Math.floor(lon)));
    if (!list) return 9;
    const cl = Math.cos(lat * DEG2RAD);
    let best = 9;
    for (const s of list) {
      const ax = s.ax * cl;
      const bx = s.bx * cl;
      const px = lon * cl;
      const vx = bx - ax;
      const vy = s.by - s.ay;
      const t = clamp(((px - ax) * vx + (lat - s.ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      const d = Math.hypot(px - (ax + vx * t), lat - (s.ay + vy * t)) / s.w;
      if (d < best) best = d;
    }
    return best;
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Fungsi medan

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
    readonly rivers: RiverIndex,
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
      if (this.samosirEllipse(dir) < 1) {
        const bump = this.noise.noise3(dir.x * 60, dir.y * 60, dir.z * 60) * 0.35;
        return { h: TOBA.samosir.height + bump, kind: 'land' };
      }
      return { h: TOBA.surfaceHeight, kind: 'lake' };
    }
    const land = this.isLandMask(lat, lon) || toba < 1.25;
    if (!land) return { h: -SEA_DEPTH, kind: 'sea' };
    const inl = sampleBilinear(this.inland, DT_W, DT_H, lat, lon);
    const n = this.noise;
    // Minimum 0,95 supaya pulau kecil punya puncak hijau di atas pita pantai (0,42–0,8).
    const base = 0.95 + 3.2 * (1 - Math.exp(-inl / 4));
    const coastFade = smoothstep(0, 1.2, inl);
    const hills = n.fbm3(dir.x * 3.1, dir.y * 3.1, dir.z * 3.1, 4) * 1.9 * coastFade;
    // Bukit kecil yang kini terlihat karena jaring 4× lebih rapat.
    const fine = n.fbm3(dir.x * 19, dir.y * 19, dir.z * 19, 2) * 0.62 * coastFade;
    let h = base + hills + fine + ridgeHeight(lat, lon, n, dir) * smoothstep(0, 0.7, inl);
    // Lapisan es Antartika dan Greenland.
    const greenland = lat > 60 && lon > -73 && lon < -12;
    if (lat < -62 || greenland) h += 3.5 * smoothstep(0, 3, inl);
    // Lembah sungai: tarik tinggi ke dasar lembah yang landai.
    const v = this.rivers.valley(lat, lon);
    if (v < 1 && !(lat < -62 || greenland)) {
      const k = 1 - smoothstep(0, 1, v);
      const floor = 0.95 + (h - 0.95) * 0.38;
      h = lerp(h, floor, k * 0.9);
    }
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
        const shore = lerp(AIRPORT.elevation, -SEA_DEPTH, t);
        return { h: shore, kind: shore > 0 ? 'land' : 'sea' };
      }
      return { h: lerp(AIRPORT.elevation, nat.h, t), kind: nat.kind === 'lake' ? 'lake' : 'land' };
    }
    return nat;
  }
}

// ---------------------------------------------------------------------------------------------
// 5. Icosphere dengan pelacakan chunk

interface Mesh {
  verts: Vector3[];
  faces: number[];
  chunk: number[];
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
// 6. Kota (dipakai untuk ladang di sekitar kota dan gedung)

interface City {
  name: string;
  lat: number;
  lon: number;
  pop: number;
}

const EXTRA_CITIES: City[] = [
  { name: 'Denpasar', lat: -8.65, lon: 115.22, pop: 900000 },
  { name: 'Pekanbaru', lat: 0.51, lon: 101.45, pop: 1100000 },
];
const INDONESIA_KEEP = ['Medan', 'Jakarta', 'Surabaya', 'Bandung', 'Makassar', 'Palembang', 'Banda Aceh', 'Padang', 'Semarang'];

function pickCities(places: FeatureCollection): City[] {
  const all = places.features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return { name: String(p.name ?? ''), lat: Number(p.latitude), lon: Number(p.longitude), pop: Number(p.pop_max ?? 0) };
  });
  const top = [...all].sort((a, b) => b.pop - a.pop).slice(0, 170);
  const indo = all.filter((c) => INDONESIA_KEEP.includes(c.name));
  const map = new Map<string, City>();
  for (const c of [...top, ...indo, ...EXTRA_CITIES]) map.set(`${c.name}|${c.lat.toFixed(2)}`, c);
  return [...map.values()];
}

function cityBuildingCount(pop: number): number {
  return Math.round(clamp(6 + Math.log10(Math.max(pop, 1e4) / 1e4) * 13, 6, 52));
}

class CityField {
  private readonly items: { dir: Vector3; r: number }[];
  constructor(cities: City[]) {
    this.items = cities.map((c) => ({
      dir: latLonToVec3(c.lat, c.lon, 1),
      // Radius pengaruh (rad): kota besar dikelilingi ladang lebih luas.
      r: ((1.6 + cityBuildingCount(c.pop) * 0.12) / PLANET_RADIUS) * 4.2,
    }));
  }
  /** 0..1 kedekatan dengan kota (untuk ladang dan desa). */
  influence(dir: Vector3): number {
    let best = 0;
    for (const c of this.items) {
      const d = Math.acos(clamp(dir.dot(c.dir), -1, 1));
      if (d < c.r) best = Math.max(best, 1 - smoothstep(c.r * 0.35, c.r, d));
    }
    return best;
  }
}

// ---------------------------------------------------------------------------------------------
// 7. Pewarnaan + kepadatan hutan/ladang

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
  forestTropic: hexToRgb01('#2E9B4C'),
  forestTemperate: hexToRgb01('#3C9446'),
  forestBoreal: hexToRgb01('#2C7650'),
  savanna: hexToRgb01('#B8C95C'),
  meadowWarm: hexToRgb01('#A5D65A'),
  meadowCool: hexToRgb01('#47B86E'),
  farm: hexToRgb01('#B4D96A'),
  highland: hexToRgb01('#8FB46A'),
  tundra: hexToRgb01('#9DB89A'),
  oasis: hexToRgb01('#7DBE4F'),
};

type RGB3 = [number, number, number];

function mix3(a: readonly number[], b: readonly number[], t: number): RGB3 {
  return [lerp(a[0]!, b[0]!, t), lerp(a[1]!, b[1]!, t), lerp(a[2]!, b[2]!, t)];
}

const redNoise = new SimplexNoise(9090);
const forestNoise = new SimplexNoise(4242);
const farmNoise = new SimplexNoise(5151);
const meadowNoise = new SimplexNoise(6262);

/** Warna dasar daratan berumput (iklim + bercak padang rumput + kering + dataran tinggi). */
function landGreen(lat: number, lon: number, dir: Vector3, absLat: number, hAvg: number, desert: { red: boolean } | null): RGB3 {
  const dry = desert ? 0.35 : drynessAt(lat, lon);
  let rgb: RGB3;
  if (absLat < 23) rgb = [...RGB.grassTropic] as RGB3;
  else if (absLat < 50) rgb = mix3(RGB.grassTropic, RGB.grassTemperate, smoothstep(23, 30, absLat));
  else if (absLat < 64) rgb = mix3(RGB.grassTemperate, RGB.grassBoreal, smoothstep(50, 56, absLat));
  else rgb = mix3(RGB.grassBoreal, RGB.tundra, smoothstep(64, 70, absLat));
  // Padang rumput: noise lebar → bercak hangat (kekuningan) dan sejuk (kebiruan).
  const mv = meadowNoise.fbm3(dir.x * 9, dir.y * 9, dir.z * 9, 3);
  rgb = mv > 0 ? mix3(rgb, RGB.meadowWarm, mv * 0.45) : mix3(rgb, RGB.meadowCool, -mv * 0.35);
  if (dry > 0) rgb = mix3(rgb, RGB.savanna, dry * 0.85);
  if (desert) rgb = mix3(rgb, RGB.oasis, 0.6);
  // Dataran tinggi sedikit lebih kusam.
  return mix3(rgb, RGB.highland, smoothstep(5, 11, hAvg) * 0.35);
}

interface Classified {
  rgb: RGB3;
  cls: TriClass;
  forest: number;
  farm: number;
  /** 0..1 kering (sabana/semi-gurun) → disimpan di bit 3–5 byte kelas untuk sebaran props. */
  dry: number;
}

function classify(
  centroid: Vector3,
  hs: [number, number, number],
  kinds: [Sample['kind'], Sample['kind'], Sample['kind']],
  normal: Vector3,
  faceId: number,
  terrain: Terrain,
  cities: CityField,
): Classified {
  const dir = centroid.clone().normalize();
  const lat = Math.asin(clamp(dir.y, -1, 1)) * RAD2DEG;
  const lon = Math.atan2(dir.x, dir.z) * RAD2DEG;
  const hAvg = (hs[0] + hs[1] + hs[2]) / 3;
  const hMin = Math.min(...hs);
  const lakeCount = kinds.filter((k) => k === 'lake').length;
  const airportCount = kinds.filter((k) => k === 'airport').length;
  const slope = normal.dot(dir);
  const v = (hash01(faceId) - 0.5) * 0.08; // variasi kecerahan ±4%
  const absLat = Math.abs(lat);
  let rgb: RGB3;
  let cls: TriClass;
  let forest = 0;
  let farm = 0;
  let dryness = 0;
  const greenland = lat > 60 && lon > -73 && lon < -12;

  if (lakeCount >= 2) {
    rgb = [...RGB.lake] as RGB3;
    cls = TriClass.Lake;
  } else if (airportCount >= 2) {
    rgb = mix3(RGB.grassTropic, RGB.grassTemperate, 0.35);
    cls = TriClass.Airport;
  } else if (absLat <= 72 && (hMin < 0.3 || kinds.includes('sea')) && !(lat < -62 || greenland)) {
    // Segitiga pantai: diwarnai seperti daratan di sebelahnya; pita pasir digambar shader
    // berdasarkan tinggi per piksel (tepat di garis air), jadi pantai tidak menebal di pulau kecil.
    const desert = desertAt(lat, lon);
    rgb = desert ? ([...RGB.desert] as RGB3) : landGreen(lat, lon, dir, absLat, hAvg, desert);
    cls = TriClass.Sand;
    dryness = desert ? 1 : drynessAt(lat, lon);
  } else if (absLat > 72 || (lat < -62 && hAvg > 1) || (greenland && hAvg > 2)) {
    rgb = hash01(faceId * 7) > 0.35 ? ([...RGB.snow] as RGB3) : ([...RGB.ice] as RGB3);
    cls = TriClass.Snow;
  } else if (hAvg > TERRAIN_MAX_HEIGHT * (absLat < 25 ? 0.86 : absLat < 40 ? 0.7 : 0.58)) {
    rgb = [...RGB.snow] as RGB3;
    cls = TriClass.Snow;
  } else if (hAvg > TERRAIN_MAX_HEIGHT * (absLat < 25 ? 0.5 : 0.4) || (slope < 0.78 && hAvg > 3)) {
    // Batu dengan sedikit variasi hangat/dingin.
    const t = redNoise.noise3(dir.x * 30, dir.y * 30, dir.z * 30);
    rgb = mix3(RGB.rock, t > 0 ? hexToRgb01('#A89A8C') : hexToRgb01('#8E8790'), Math.abs(t) * 0.6);
    cls = TriClass.Rock;
    forest = absLat < 60 ? 0.12 : 0; // pinus jarang di lereng
  } else {
    const riverV = terrain.rivers.valley(lat, lon);
    const desert = desertAt(lat, lon);
    if (desert && riverV > 0.55) {
      const n = redNoise.noise3(dir.x * 24, dir.y * 24, dir.z * 24);
      rgb = desert.red && n > 0.05 ? mix3(RGB.desert, RGB.redRock, smoothstep(0.05, 0.35, n)) : ([...RGB.desert] as RGB3);
      // Bukit pasir sedikit lebih terang di puncak.
      rgb = mix3(rgb, hexToRgb01('#F8CB86'), clamp((hAvg - 2) / 6, 0, 0.35));
      cls = TriClass.Desert;
      dryness = 1;
    } else {
      cls = TriClass.Grass;
      const dry = desert ? 0.35 : drynessAt(lat, lon);
      dryness = dry;
      rgb = landGreen(lat, lon, dir, absLat, hAvg, desert);

      // Kepadatan hutan: berkelompok (noise), tergantung iklim.
      const fn = forestNoise.fbm3(dir.x * 5.5, dir.y * 5.5, dir.z * 5.5, 4);
      let f = clamp(fn * 1.7 + 0.42, 0, 1);
      const climate = absLat < 23 ? 1.05 : absLat < 50 ? 0.78 : absLat < 64 ? 0.95 : 0.22;
      f *= climate * (1 - dry * 0.9);
      if (slope < 0.86) f *= 0.7;
      // Ladang: sabuk pertanian dataran rendah + sekitar kota.
      const fm = farmNoise.fbm3(dir.x * 7, dir.y * 7, dir.z * 7, 3);
      const belt = absLat > 8 && absLat < 58 ? 1 : absLat > 4 && absLat < 62 ? 0.5 : 0;
      const lowland = hAvg < 4.5 ? 1 : smoothstep(7, 4.5, hAvg);
      let fa = smoothstep(0.05, 0.38, fm) * belt * lowland * (1 - dry * 0.7);
      fa = Math.max(fa, cities.influence(dir) * lowland * (1 - dry * 0.5));
      if (slope < 0.9) fa *= 0.5;
      if (fa > 0.3) f *= 1 - smoothstep(0.3, 0.7, fa) * 0.85;
      forest = clamp(f, 0, 1);
      farm = clamp(fa, 0, 1);
      // Lantai hutan lebih gelap → hutan terbaca dari ketinggian walau props tidak digambar.
      const fc = absLat < 23 ? RGB.forestTropic : absLat < 50 ? RGB.forestTemperate : RGB.forestBoreal;
      rgb = mix3(rgb, fc, smoothstep(0.15, 0.85, forest) * 0.8);
      rgb = mix3(rgb, RGB.farm, smoothstep(0.25, 0.7, farm) * 0.55);
    }
  }
  return {
    rgb: [clamp(rgb[0] * (1 + v), 0, 1), clamp(rgb[1] * (1 + v), 0, 1), clamp(rgb[2] * (1 + v), 0, 1)],
    cls,
    forest,
    farm,
    dry: dryness,
  };
}

// ---------------------------------------------------------------------------------------------
// 8. Bangun segitiga

interface Tri {
  a: Vector3;
  b: Vector3;
  c: Vector3;
  rgb: RGB3;
  cls: TriClass;
  forest: number;
  farm: number;
  dry: number;
  chunk: number;
}

function buildTriangles(mesh: Mesh, terrain: Terrain, cities: CityField): Tri[] {
  const { verts, faces, chunk } = mesh;
  const samples: Sample[] = verts.map((v) => terrain.sample(v));
  const finalPos = verts.map((v, i) => v.clone().multiplyScalar(PLANET_RADIUS + samples[i]!.h));
  const faceCount = faces.length / 3;

  const isDetail = new Uint8Array(faceCount);
  const R = DETAIL_REGION;
  const centroid = new Vector3();
  for (let f = 0; f < faceCount; f++) {
    centroid
      .copy(verts[faces[f * 3]!]!)
      .add(verts[faces[f * 3 + 1]!]!)
      .add(verts[faces[f * 3 + 2]!]!)
      .normalize();
    const lat = Math.asin(centroid.y) * RAD2DEG;
    const lon = Math.atan2(centroid.x, centroid.z) * RAD2DEG;
    if (lat > R.latMin && lat < R.latMax && lon > R.lonMin && lon < R.lonMax) isDetail[f] = 1;
  }
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
  const pushTri = (pa: Vector3, pb: Vector3, pc: Vector3, sa: Sample, sb: Sample, sc: Sample, ch: number, id: number): void => {
    const hs: [number, number, number] = [sa.h, sb.h, sc.h];
    if (Math.max(...hs) <= 0.02) return;
    const kinds: [Sample['kind'], Sample['kind'], Sample['kind']] = [sa.kind, sb.kind, sc.kind];
    const n = new Vector3().subVectors(pb, pa).cross(new Vector3().subVectors(pc, pa)).normalize();
    const cen = new Vector3().add(pa).add(pb).add(pc).divideScalar(3);
    const c = classify(cen, hs, kinds, n, id, terrain, cities);
    tris.push({ a: pa, b: pb, c: pc, rgb: c.rgb, cls: c.cls, forest: c.forest, farm: c.farm, dry: c.dry, chunk: ch });
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
    const idx = [ia, ib, ic];
    const grid = new Map<number, { p: Vector3; s: Sample }>();
    const edgePoint = (u: number, v: number, k: number): { p: Vector3; s: Sample } => {
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
// 9. Pencari permukaan (titik → segitiga)

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
// 10. Pita sungai (mengikuti permukaan medan)

interface RiverSample {
  l: Vector3;
  r: Vector3;
  /** Jarak sepanjang sungai (unit). */
  u: number;
}
type RiverStrip = RiverSample[];

function riverHalfWidth(rank: number): number {
  return rank <= 2 ? 0.78 : rank <= 4 ? 0.6 : 0.46;
}

function buildRiverRibbons(lines: RiverLine[], surface: SurfaceIndex): RiverStrip[] {
  const out: RiverStrip[] = [];
  const STEP = 0.18; // derajat (~1,3 unit)
  const up = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();
  const tmp = new Vector3();
  for (const l of lines) {
    // Resample polyline (lon, lat) per STEP derajat.
    const pts: [number, number][] = [];
    for (let k = 0; k < l.pts.length - 1; k++) {
      const [ax, ay] = l.pts[k]!;
      const [bx, by] = l.pts[k + 1]!;
      if (Math.abs(ax - bx) > 180) continue;
      const cl = Math.cos(((ay + by) / 2) * DEG2RAD);
      const len = Math.hypot((bx - ax) * cl, by - ay);
      const n = Math.max(1, Math.ceil(len / STEP));
      for (let i = 0; i < n; i++) pts.push([lerp(ax, bx, i / n), lerp(ay, by, i / n)]);
    }
    if (l.pts.length) pts.push(l.pts[l.pts.length - 1]!);
    const hw = riverHalfWidth(l.rank);
    let strip: { c: Vector3; l: Vector3; r: Vector3; u: number }[] = [];
    let dist = 0;
    const flush = (): void => {
      if (strip.length >= 3) out.push(strip.map((s) => ({ l: s.l, r: s.r, u: s.u })));
      strip = [];
    };
    const centers: (Vector3 | null)[] = pts.map(([lo, la]) => {
      const dir = latLonToVec3(la, lo, 1);
      const hit = surface.find(dir);
      if (!hit || hit.tri.cls === TriClass.Lake || hit.tri.cls === TriClass.Sand || hit.tri.cls === TriClass.Airport) return null;
      return hit.p;
    });
    for (let i = 0; i < pts.length; i++) {
      const c = centers[i];
      if (!c) {
        flush();
        continue;
      }
      const prev = centers[i - 1] ?? c;
      const next = centers[i + 1] ?? c;
      up.copy(c).normalize();
      tan.subVectors(next, prev);
      tan.addScaledVector(up, -tan.dot(up));
      if (tan.lengthSq() < 1e-8) continue;
      tan.normalize();
      side.crossVectors(tan, up).normalize();
      // Ujung hulu menyempit.
      const taper = clamp((i + 1) / 6, 0.35, 1);
      const w = hw * taper;
      const drape = (sgn: number): Vector3 => {
        tmp.copy(c).addScaledVector(side, sgn * w).normalize();
        const hit = surface.find(tmp);
        const base = hit ? hit.p : c.clone().addScaledVector(side, sgn * w);
        return base.clone().addScaledVector(base.clone().normalize(), 0.07);
      };
      if (strip.length) dist += strip[strip.length - 1]!.c.distanceTo(c);
      strip.push({ c, l: drape(-1), r: drape(1), u: dist });
    }
    flush();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 11. Gedung kota

interface BuildingOut {
  p: Vector3;
  w: number;
  d: number;
  h: number;
  color: number;
  rot: number;
}

function placeBuildings(cities: City[], surface: SurfaceIndex, terrain: Terrain): { buildings: BuildingOut[]; used: City[] } {
  const rng = mulberry32(31337);
  const buildings: BuildingOut[] = [];
  const used: City[] = [];
  for (const city of cities) {
    const center = latLonToVec3(city.lat, city.lon, 1);
    const count = cityBuildingCount(city.pop);
    const radius = 1.6 + count * 0.12;
    const east = new Vector3().crossVectors(new Vector3(0, 1, 0), center);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = new Vector3().crossVectors(center, east).normalize();
    let placed = 0;
    const local: { p: Vector3; r: number }[] = [];
    for (let k = 0; k < count * 5 && placed < count; k++) {
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
// 12. Tulis file

function quant(v: number): number {
  return clamp(Math.round((v / EARTH_QUANT_RADIUS) * 32767), -32767, 32767);
}

function writeBin(name: string, buf: Buffer): void {
  writeFileSync(resolve(OUT, name), buf);
  // Versi gzip untuk dibuka dengan DecompressionStream di browser (hemat ±65% unduhan
  // walau hosting tidak mengompres file biner).
  writeFileSync(resolve(OUT, `${name}.gz`), gzipSync(buf, { level: 9 }));
}

function writeEarth(tris: Tri[], rivers: RiverStrip[]): { bytes: number; gz: number } {
  const byChunk: Tri[][] = Array.from({ length: 80 }, () => []);
  for (const t of tris) byChunk[t.chunk]!.push(t);
  const total = tris.length;
  const posBytes = total * 9 * 2;
  const colBytes = total * 3;
  const clsBytes = total;
  const auxBytes = total;
  const buf = Buffer.alloc(posBytes + colBytes + clsBytes + auxBytes);
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
      const ps = [t.a, t.b, t.c];
      for (let k = 0; k < 3; k++) {
        radius = Math.max(radius, ps[k]!.distanceTo(center));
        pos[i * 9 + k * 3] = quant(ps[k]!.x);
        pos[i * 9 + k * 3 + 1] = quant(ps[k]!.y);
        pos[i * 9 + k * 3 + 2] = quant(ps[k]!.z);
      }
      buf[posBytes + i * 3] = Math.round(t.rgb[0] * 255);
      buf[posBytes + i * 3 + 1] = Math.round(t.rgb[1] * 255);
      buf[posBytes + i * 3 + 2] = Math.round(t.rgb[2] * 255);
      buf[posBytes + colBytes + i] = t.cls | (Math.round(clamp(t.dry, 0, 1) * 7) << 3);
      buf[posBytes + colBytes + clsBytes + i] = (Math.round(t.forest * 15) << 4) | Math.round(t.farm * 15);
      i++;
    }
    chunks.push({
      start,
      count: list.length,
      center: [+center.x.toFixed(3), +center.y.toFixed(3), +center.z.toFixed(3)],
      radius: +(radius + 0.5).toFixed(3),
    });
  }
  writeBin('earth.bin', buf);

  // Sungai: strip; per sampel dua titik (kiri, kanan), per titik int16 x,y,z + uint16 (u×4 << 1 | sisi).
  // Panjang tiap strip disimpan di meta → klien membangun indeks sendiri (hemat ±3× dibanding segitiga lepas).
  const vcount = rivers.reduce((n, st) => n + st.length * 2, 0);
  const rv = Buffer.alloc(vcount * 8);
  let k = 0;
  for (const st of rivers) {
    for (const smp of st) {
      const u = Math.round((smp.u % 4096) * 4) & 0x3fff;
      for (const [p, side] of [
        [smp.l, 0],
        [smp.r, 1],
      ] as [Vector3, number][]) {
        rv.writeInt16LE(quant(p.x), k * 8);
        rv.writeInt16LE(quant(p.y), k * 8 + 2);
        rv.writeInt16LE(quant(p.z), k * 8 + 4);
        rv.writeUInt16LE((u << 1) | side, k * 8 + 6);
        k++;
      }
    }
  }
  writeBin('rivers.bin', rv);

  const meta = {
    version: EARTH_FORMAT_VERSION,
    generatedBy: 'scripts/build-earth.ts',
    source: 'Natural Earth 1:50m (public domain)',
    quantRadius: EARTH_QUANT_RADIUS,
    triangleCount: total,
    sections: { positions: 0, colors: posBytes, classes: posBytes + colBytes, aux: posBytes + colBytes + clsBytes },
    rivers: { vertexCount: vcount, strips: rivers.map((st) => st.length) },
    chunks,
  };
  writeFileSync(resolve(OUT, 'earth-meta.json'), JSON.stringify(meta));
  return { bytes: buf.length + rv.length, gz: gzipSync(buf, { level: 9 }).length + gzipSync(rv, { level: 9 }).length };
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
  const rgb = Buffer.alloc(DT_W * DT_H * 3);
  for (let i = 0; i < DT_W * DT_H; i++) {
    rgb[i * 3] = landDT[i] ? 0 : Math.round(clamp(terrain.offshore[i]! / 6, 0, 1) * 255);
    rgb[i * 3 + 1] = landDT[i] ? Math.round(clamp(terrain.inland[i]! / 10, 0, 1) * 255) : 0;
    rgb[i * 3 + 2] = landDT[i] ? 255 : 0;
  }
  await sharp(rgb, { raw: { width: DT_W, height: DT_H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, 'coast-distance.png'));

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

/** Peta dunia debug dari segitiga sungguhan (warna muka + sungai) untuk diperiksa dengan mata. */
async function writeDebugWorld(surface: SurfaceIndex, rivers: RiverStrip[], file: string, box?: [number, number, number, number]): Promise<void> {
  const [lat0, lat1, lon0, lon1] = box ?? [85, -85, -180, 180];
  const W = box ? 1200 : 1800;
  const H = Math.round((W * (lat0 - lat1)) / (lon1 - lon0));
  const img = Buffer.alloc(W * H * 3);
  const dir = new Vector3();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = lat0 - ((y + 0.5) / H) * (lat0 - lat1);
      const lon = lon0 + ((x + 0.5) / W) * (lon1 - lon0);
      latLonToVec3(lat, lon, 1, dir);
      const hit = surface.find(dir);
      const o = (y * W + x) * 3;
      if (hit) {
        img[o] = Math.round(hit.tri.rgb[0] * 255);
        img[o + 1] = Math.round(hit.tri.rgb[1] * 255);
        img[o + 2] = Math.round(hit.tri.rgb[2] * 255);
      } else {
        img[o] = 30;
        img[o + 1] = 111;
        img[o + 2] = 217;
      }
    }
  }
  for (const v of rivers.flat().map((s) => ({ p: s.l }))) {
    const lat = Math.asin(clamp(v.p.y / v.p.length(), -1, 1)) * RAD2DEG;
    const lon = Math.atan2(v.p.x, v.p.z) * RAD2DEG;
    const x = Math.floor(((lon - lon0) / (lon1 - lon0)) * W);
    const y = Math.floor(((lat0 - lat) / (lat0 - lat1)) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const o = (y * W + x) * 3;
    img[o] = 70;
    img[o + 1] = 160;
    img[o + 2] = 255;
  }
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(resolve(CACHE, file));
}

async function writeDebugSumatra(terrain: Terrain, natural: boolean, file: string): Promise<void> {
  const lat0 = 8;
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
      if (angularDistanceDeg({ lat, lon }, HOME) < 0.05) c = [255, 0, 0];
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
  const lap = (msg: string): void => console.log(`  ${msg} (${((performance.now() - t0) / 1000).toFixed(1)} dtk)`);
  console.log('🌍 build-earth v2: memuat data Natural Earth…');
  const [landGeo, lakeGeo, placesGeo, riverGeo] = await Promise.all([
    loadGeo('ne_50m_land'),
    loadGeo('ne_50m_lakes'),
    loadGeo('ne_50m_populated_places_simple'),
    loadGeo('ne_50m_rivers_lake_centerlines'),
  ]);
  const landRings = landGeo.features.flatMap((f) => ringsOf(f.geometry));
  const lakeRings = lakeGeo.features.flatMap((f) => ringsOf(f.geometry));
  const riverLines: RiverLine[] = [
    ...riverGeo.features.flatMap((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const rank = Number(p.scalerank ?? 6);
      return linesOf(f.geometry).map((pts) => ({ name: String(p.name ?? ''), rank, pts: pts.map((q) => [q[0]!, q[1]!] as [number, number]) }));
    }),
    ...EXTRA_RIVERS,
  ];
  console.log(`  ${landRings.length} ring daratan, ${lakeRings.length} ring danau, ${riverLines.length} garis sungai`);

  const land = rasterize(landRings, MASK_W, MASK_H);
  const lakes = rasterize(lakeRings, MASK_W, MASK_H);
  const landSmall = downsample(land, MASK_W, MASK_H, MASK_W / DT_W);
  const inland = distanceTransform((i) => landSmall[i] === 0, DT_W, DT_H);
  const offshore = distanceTransform((i) => landSmall[i] === 1, DT_W, DT_H);
  lap('raster + jarak pantai');

  // Sungai rank 6 hanya di Asia Tenggara (tanah air), di tempat lain cukup sungai besar (rank ≤ 5).
  const inSea = (l: RiverLine): boolean => l.pts.some(([lo, la]) => lo > 92 && lo < 150 && la > -12 && la < 10);
  const majorRivers = riverLines.filter((l) => l.rank <= 5 || inSea(l));
  const riverIndex = new RiverIndex(majorRivers);
  const terrain = new Terrain(land, lakes, inland, offshore, riverIndex);
  const cities = pickCities(placesGeo);
  const cityField = new CityField(cities);

  mkdirSync(OUT, { recursive: true });
  const mesh = icosphere(SUBDIV_LEVEL);
  lap(`icosphere level ${SUBDIV_LEVEL}: ${mesh.verts.length} titik, ${mesh.faces.length / 3} muka`);
  const tris = buildTriangles(mesh, terrain, cityField);
  lap(`daratan: ${tris.length} segitiga`);

  const surface = new SurfaceIndex(tris);
  const rivers = buildRiverRibbons(majorRivers, surface);
  const earth = writeEarth(tris, rivers);
  lap(
    `earth.bin + rivers.bin: ${(earth.bytes / 1024).toFixed(0)} KB mentah, ${(earth.gz / 1024).toFixed(0)} KB gzip (sungai ${rivers.length} strip, ${rivers.reduce((n, st) => n + (st.length - 1) * 2, 0)} segitiga)`,
  );

  const { buildings, used } = placeBuildings(cities, surface, terrain);
  const bBytes = writeBuildings(buildings);
  writeFileSync(
    resolve(OUT, 'cities.json'),
    JSON.stringify(used.map((c) => ({ name: c.name, lat: +c.lat.toFixed(3), lon: +c.lon.toFixed(3), pop: c.pop }))),
  );
  lap(`kota: ${used.length}, gedung: ${buildings.length} → buildings.bin ${(bBytes / 1024).toFixed(0)} KB`);

  await writeImages(terrain, landSmall);
  await writeDebugSumatra(terrain, false, 'debug-sumatra.png');
  await writeDebugWorld(surface, rivers, 'debug-world.png');
  await writeDebugWorld(surface, rivers, 'debug-indonesia.png', [8, -11, 94, 142]);
  lap('gambar');
  console.log(`✅ selesai dalam ${((performance.now() - t0) / 1000).toFixed(1)} detik`);
}

main().catch((err: unknown) => {
  console.error('❌ build-earth gagal:', err);
  process.exit(1);
});
