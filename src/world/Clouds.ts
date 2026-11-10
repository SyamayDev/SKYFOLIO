/**
 * Awan (docs/04 bagian 7.3, versi dasar): gugus "puff" low-poly di lapisan awan, tersebar di seluruh
 * planet secara deterministik dengan kepadatan mengikuti iklim (ITCZ & jalur badai lebih berawan,
 * gurun subtropis lebih cerah). Seluruh lapisan berputar pelan ke timur seperti dibawa angin.
 *
 * - Awan dibagi ke 12 wilayah (InstancedMesh per wilayah) → wilayah di balik planet tidak digambar.
 * - Dalam tiap wilayah awan diurutkan menurut "peringkat" global → tutupan awan diatur lewat `count`.
 * - `densityAt(pos)` memberi 0..1 seberapa dalam suatu titik berada di dalam awan (untuk kabut & kanopi).
 */
import type { BufferGeometry} from 'three';
import { Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { color, mix, positionGeometry, smoothstep, uniform } from 'three/tsl';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLANET_RADIUS } from '../config/world';
import type { QualityTier } from '../config/quality';
import { mulberry32 } from '../utils/rng';
import { SimplexNoise } from '../utils/noise';
import { setFlatShading, toonGradient } from '../utils/modeling/materials';

const CANDIDATES = 1400;
const TIER_CLOUDS: Record<QualityTier, number> = { low: 300, medium: 520, high: 800, ultra: 1050 };
/** Putaran lapisan awan (rad/dtk) — satu putaran ±70 menit. */
const DRIFT = 0.0015;
const CLOUD_MIN_ALT = 40;
const CLOUD_MAX_ALT = 66;

interface Cloud {
  center: Vector3;
  radius: number;
  rank: number;
  puffs: { c: Vector3; r: number; sy: number }[];
}

interface Region {
  mesh: InstancedMesh;
  dir: Vector3;
  /** Radius sudut wilayah (rad). */
  ang: number;
  /** Per awan (urut peringkat): indeks puff akhir (eksklusif) dan peringkat global. */
  ends: number[];
  ranks: number[];
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _local = new Vector3();
const _axis = new Vector3(0, 1, 0);

function puffGeometry(detail: number): BufferGeometry {
  const base = new IcosahedronGeometry(1, detail);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const geo = mergeVertices(base);
  geo.computeVertexNormals();
  base.dispose();
  return geo;
}

export class Clouds {
  readonly group = new Group();
  private readonly material: MeshToonNodeMaterial;
  private readonly clouds: Cloud[] = [];
  private readonly regions: Region[] = [];
  private geometry: BufferGeometry;
  private detail = 1;
  private tierMax = 800;
  /** 0..1 tutupan awan (cuaca). */
  private coverage = 0.6;
  private angle = 0;
  private activeCount = 0;
  readonly brightness = uniform(1);

  constructor(tier: QualityTier) {
    this.group.name = 'clouds';
    const rng = mulberry32(4711);
    const noise = new SimplexNoise(8080);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const cand: { dir: Vector3; score: number }[] = [];
    for (let i = 0; i < CANDIDATES; i++) {
      const y = 1 - (2 * (i + 0.5)) / CANDIDATES;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const dir = new Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      dir.x += (rng() - 0.5) * 0.06;
      dir.y += (rng() - 0.5) * 0.06;
      dir.z += (rng() - 0.5) * 0.06;
      dir.normalize();
      const lat = Math.abs(Math.asin(dir.y) * (180 / Math.PI));
      let climate = 0.55;
      if (lat < 12) climate += 0.25;
      else if (lat > 15 && lat < 32) climate -= 0.22;
      else if (lat > 40 && lat < 65) climate += 0.18;
      if (lat > 75) climate -= 0.25;
      climate += noise.fbm3(dir.x * 2.2, dir.y * 2.2, dir.z * 2.2, 3) * 0.45;
      cand.push({ dir, score: rng() / Math.max(0.05, climate) });
    }
    cand.sort((a, b) => a.score - b.score);

    const east = new Vector3();
    const north = new Vector3();
    cand.forEach((c, rank) => {
      const alt = CLOUD_MIN_ALT + rng() * (CLOUD_MAX_ALT - CLOUD_MIN_ALT);
      const size = 4.5 + rng() * rng() * 10;
      const center = c.dir.clone().multiplyScalar(PLANET_RADIUS + alt);
      east.crossVectors(_axis, c.dir);
      if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
      east.normalize();
      north.crossVectors(c.dir, east);
      const n = 4 + Math.floor(rng() * 4);
      const puffs: Cloud['puffs'] = [];
      for (let k = 0; k < n; k++) {
        const main = k === 0;
        const pr = size * (main ? 0.5 : 0.24 + rng() * 0.16);
        const a = rng() * Math.PI * 2;
        const d = main ? 0 : size * (0.32 + rng() * 0.32);
        const pc = center
          .clone()
          .addScaledVector(east, Math.cos(a) * d)
          .addScaledVector(north, Math.sin(a) * d * 0.7)
          .addScaledVector(c.dir, pr * 0.42);
        puffs.push({ c: pc, r: pr, sy: 0.7 + rng() * 0.12 });
      }
      this.clouds.push({ center, radius: size * 1.1, rank, puffs });
    });

    const m = new MeshToonNodeMaterial({ gradientMap: toonGradient() });
    setFlatShading(m);
    m.name = 'clouds';
    const k = smoothstep(-0.55, 0.65, positionGeometry.y);
    m.colorNode = mix(color(new Color('#C9D6EC')), color(new Color('#FFFFFF')), k).mul(this.brightness);
    m.emissiveNode = color(new Color('#30405E')).mul(0.18).mul(this.brightness);
    this.material = m;
    this.detail = tier === 'low' || tier === 'medium' ? 0 : 1;
    this.geometry = puffGeometry(this.detail);

    // 12 wilayah = 12 titik ikosahedron.
    const ico = new IcosahedronGeometry(1, 0);
    const pos = ico.getAttribute('position');
    const dirs: Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new Vector3().fromBufferAttribute(pos, i).normalize();
      if (!dirs.some((d) => d.distanceTo(v) < 1e-3)) dirs.push(v);
    }
    ico.dispose();
    const buckets: Cloud[][] = dirs.map(() => []);
    for (const c of this.clouds) {
      const cd = _local.copy(c.center).normalize();
      let best = 0;
      let bd = -2;
      dirs.forEach((d, i) => {
        const dd = d.dot(cd);
        if (dd > bd) {
          bd = dd;
          best = i;
        }
      });
      buckets[best]!.push(c);
    }
    dirs.forEach((dir, i) => {
      const list = buckets[i]!.sort((a, b) => a.rank - b.rank);
      const total = list.reduce((n, c) => n + c.puffs.length, 0);
      const mesh = new InstancedMesh(this.geometry, m, Math.max(1, total));
      mesh.name = `clouds-${i}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const ends: number[] = [];
      const ranks: number[] = [];
      let idx = 0;
      let ang = 0;
      const up = new Vector3();
      for (const c of list) {
        for (const p of c.puffs) {
          up.copy(p.c).normalize();
          _q.setFromUnitVectors(_axis, up);
          _s.set(p.r, p.r * p.sy, p.r);
          _m.compose(p.c, _q, _s);
          mesh.setMatrixAt(idx++, _m);
        }
        ends.push(idx);
        ranks.push(c.rank);
        ang = Math.max(ang, Math.acos(Math.min(1, dir.dot(_local.copy(c.center).normalize()))) + c.radius / PLANET_RADIUS);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.regions.push({ mesh, dir, ang, ends, ranks });
    });
    this.setTier(tier);
  }

  setTier(tier: QualityTier): void {
    this.tierMax = TIER_CLOUDS[tier];
    const detail = tier === 'low' || tier === 'medium' ? 0 : 1;
    if (detail !== this.detail) {
      this.detail = detail;
      const old = this.geometry;
      this.geometry = puffGeometry(detail);
      for (const r of this.regions) r.mesh.geometry = this.geometry;
      old.dispose();
    }
    this.applyCount();
  }

  /** Tutupan awan 0..1 (dari cuaca). */
  setCoverage(c: number): void {
    this.coverage = Math.max(0, Math.min(1, c));
    this.applyCount();
  }

  private applyCount(): void {
    const n = Math.min(this.clouds.length, Math.round(this.tierMax * (0.25 + this.coverage * 0.95)));
    this.activeCount = n;
    for (const r of this.regions) {
      let end = 0;
      for (let i = 0; i < r.ranks.length && r.ranks[i]! < n; i++) end = r.ends[i]!;
      r.mesh.count = end;
    }
  }

  get visibleClouds(): number {
    return this.activeCount;
  }

  update(dt: number, cameraPos: Vector3): void {
    this.angle = (this.angle + dt * DRIFT) % (Math.PI * 2);
    this.group.rotation.y = this.angle;
    // Culling horizon per wilayah (dalam ruang lapisan awan yang berputar).
    _local.copy(cameraPos).applyAxisAngle(_axis, -this.angle);
    const r = _local.length() || 1;
    const camDir = _local.divideScalar(r);
    const horizon = Math.acos(Math.min(1, PLANET_RADIUS / Math.max(r, PLANET_RADIUS))) + Math.acos(PLANET_RADIUS / (PLANET_RADIUS + CLOUD_MAX_ALT));
    for (const reg of this.regions) {
      const a = Math.acos(Math.max(-1, Math.min(1, camDir.dot(reg.dir))));
      reg.mesh.visible = reg.mesh.count > 0 && a < horizon + reg.ang;
    }
  }

  /** 0..1: seberapa dalam titik dunia `pos` berada di dalam awan (dipakai kabut, kanopi, audio). */
  densityAt(pos: Vector3): number {
    _local.copy(pos).applyAxisAngle(_axis, -this.angle);
    const r = _local.length();
    if (r < PLANET_RADIUS + CLOUD_MIN_ALT - 12 || r > PLANET_RADIUS + CLOUD_MAX_ALT + 25) return 0;
    let best = 0;
    for (const c of this.clouds) {
      if (c.rank >= this.activeCount) continue;
      if (c.center.distanceToSquared(_local) > (c.radius + 2) ** 2) continue;
      for (const p of c.puffs) {
        const d = p.c.distanceTo(_local) / p.r;
        if (d < 1.1) best = Math.max(best, Math.min(1, (1.1 - d) * 2.2));
      }
    }
    return best;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    for (const r of this.regions) r.mesh.dispose();
  }
}
