/**
 * Scatter — props padat (pohon, semak, batu, rumput, bunga, kaktus, rumah desa) yang dibangkitkan
 * deterministik dari data segitiga planet, hanya di sekitar kamera (docs/02 bagian 2.4, docs/11).
 *
 * Cara kerja:
 * - Segitiga daratan dikelompokkan ke sel lintang/bujur 1° (indeks CSR).
 * - Isi tiap sel dibangkitkan sekali dengan seed tetap (dunia sama untuk semua pengunjung) lalu di-cache (LRU).
 * - Tiap jenis props = satu mesh instanced (InstancedBufferGeometry + atribut vec4 per instans:
 *   xyz = posisi di permukaan, w = skala + varian×4). Orientasi (atas lokal + yaw acak), goyangan angin,
 *   "tumbuh" di tepi radius, dan mengecil saat pesawat lewat dihitung di vertex shader TSL.
 * - Buffer instans disusun ulang saat kamera bergerak beberapa unit (cukup beberapa kali per detik).
 * - Pohon di dekat pesawat bisa diserempet (sensor) dan batangnya punya collider kapsul sungguhan (pool).
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Color, Frustum, Group, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Mesh, Quaternion, Sphere, Vector3, DynamicDrawUsage, type Camera } from 'three';
import { MeshToonNodeMaterial, type Node } from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  color,
  cos,
  cross,
  distance,
  dot,
  float,
  floor,
  fract,
  mix,
  normalize,
  positionGeometry,
  select,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
} from 'three/tsl';
import { AIRPORT, PLANET_RADIUS } from '../config/world';
import type { QualityTier } from '../config/quality';
import { GROUP, interactionGroups, type PhysicsWorld } from '../physics/PhysicsWorld';
import { mulberry32 } from '../utils/rng';
import { setFlatShading, toonGradient } from '../utils/modeling/materials';
import { AirportFrame } from './AirportLayout';
import { TriClass, auxFarm, auxForest, classOf, drynessOf } from './EarthFormat';
import type { Planet } from './Planet';
import { KINDS, PROP_KIND_COUNT, PropKind, kindGeometry } from './ScatterKinds';

const DEG = 180 / Math.PI;
const CELL_COUNT = 180 * 360;
const MAX_CACHE = 5000;
const REBUILD_MOVE = 3.5;
/** Rebuild juga saat arah kamera berubah lebih dari ini (kosinus ±8°). */
const REBUILD_TURN_COS = Math.cos(0.14);
/** Bayangan pohon hanya digambar dalam radius ini dari pesawat (unit). */
const SHADOW_RADIUS = 42;
const TRUNK_POOL = 18;

export const SCATTER_TIERS: Record<QualityTier, { radius: number; density: number; capacity: number }> = {
  low: { radius: 0.62, density: 0.62, capacity: 0.42 },
  medium: { radius: 0.8, density: 0.8, capacity: 0.65 },
  high: { radius: 1, density: 1, capacity: 1 },
  ultra: { radius: 1.25, density: 1.15, capacity: 1.5 },
};

interface CellData {
  /** Per jenis: Float32Array [x,y,z,w]× atau null. */
  kinds: (Float32Array | null)[];
  /** Pohon untuk deteksi serempet & batang: [x,y,z,skala,kind]×. */
  trees: Float32Array;
}

const floatUniform = (v: number) => uniform(v);
type FloatUniform = ReturnType<typeof floatUniform>;

interface KindMesh {
  mesh: Mesh;
  geo: InstancedBufferGeometry;
  attr: InstancedBufferAttribute;
  capacity: number;
  radius: FloatUniform;
}

interface Exclusion {
  dir: Vector3;
  cos: number;
}

export interface TreeHit {
  x: number;
  y: number;
  z: number;
  scale: number;
  kind: PropKind;
}

const _v = new Vector3();
const _c = new Vector3();
const _fwd = new Vector3();
const _frustum = new Frustum();
const _pm = new Matrix4();
const _sphere = new Sphere();
const _q = new Quaternion();
const _up = new Vector3(0, 1, 0);

function cellOf(lat: number, lon: number): number {
  const la = Math.min(179, Math.max(0, Math.floor(lat + 90)));
  const lo = ((Math.floor(lon + 180) % 360) + 360) % 360;
  return la * 360 + lo;
}

export class Scatter {
  readonly group = new Group();
  /** Posisi pesawat (untuk efek daun mengecil). */
  readonly planePos = uniform(new Vector3());
  readonly wind = uniform(1);
  private readonly cellStart = new Int32Array(CELL_COUNT + 1);
  private readonly cellTris: Int32Array;
  private readonly cellCenter = new Float32Array(CELL_COUNT * 3);
  private readonly cache = new Map<number, CellData>();
  private readonly kinds: KindMesh[] = [];
  private readonly exclusions: Exclusion[] = [];
  private readonly airport = new AirportFrame();
  private readonly airportDir = new Vector3();
  private tier: QualityTier = 'high';
  private readonly lastFocus = new Vector3(1e9, 0, 0);
  private readonly lastDir = new Vector3(0, 0, 1);
  private rebuildTimer = 0;
  private activeCells: number[] = [];
  private activeDist: number[] = [];
  private lastBrushKey = -1;
  private lastBrushTime = -10;
  private trunkBody: RAPIER.RigidBody | null = null;
  private readonly trunks: RAPIER.Collider[] = [];
  private trunkTimer = 0;
  /** Diaktifkan Experience setelah semua sistem siap. */
  enabled = true;

  constructor(
    private readonly planet: Planet,
    private readonly physics: PhysicsWorld | null,
    tier: QualityTier,
  ) {
    this.group.name = 'scatter';
    this.tier = tier;
    latLonDir(AIRPORT.lat, AIRPORT.lon, this.airportDir);

    // --- Indeks sel (CSR) dari pusat segitiga.
    const n = planet.triangleCount;
    const tp = planet.triPos;
    const cellIds = new Int32Array(n);
    const counts = new Int32Array(CELL_COUNT);
    for (let t = 0; t < n; t++) {
      const cls = classOf(planet.classes[t]!);
      if (cls === TriClass.Lake || cls === TriClass.Airport) {
        cellIds[t] = -1;
        continue;
      }
      const o = t * 9;
      const x = tp[o]! + tp[o + 3]! + tp[o + 6]!;
      const y = tp[o + 1]! + tp[o + 4]! + tp[o + 7]!;
      const z = tp[o + 2]! + tp[o + 5]! + tp[o + 8]!;
      const len = Math.hypot(x, y, z) || 1;
      const lat = Math.asin(y / len) * DEG;
      const lon = Math.atan2(x, z) * DEG;
      if (Math.abs(lat) > 84) {
        cellIds[t] = -1;
        continue;
      }
      const c = cellOf(lat, lon);
      cellIds[t] = c;
      counts[c]!++;
    }
    let acc = 0;
    for (let c = 0; c < CELL_COUNT; c++) {
      this.cellStart[c] = acc;
      acc += counts[c]!;
    }
    this.cellStart[CELL_COUNT] = acc;
    this.cellTris = new Int32Array(acc);
    const fill = this.cellStart.slice(0, CELL_COUNT);
    for (let t = 0; t < n; t++) {
      const c = cellIds[t]!;
      if (c >= 0) this.cellTris[fill[c]!++] = t;
    }
    for (let c = 0; c < CELL_COUNT; c++) {
      const lat = Math.floor(c / 360) - 90 + 0.5;
      const lon = (c % 360) - 180 + 0.5;
      latLonDir(lat, lon, _v).multiplyScalar(PLANET_RADIUS + 2);
      this.cellCenter[c * 3] = _v.x;
      this.cellCenter[c * 3 + 1] = _v.y;
      this.cellCenter[c * 3 + 2] = _v.z;
    }

    // --- Mesh per jenis.
    for (let k = 0; k < PROP_KIND_COUNT; k++) this.kinds.push(this.createKindMesh(k as PropKind));
    this.applyTier();

    // --- Pool collider batang pohon.
    if (physics) {
      const R = physics.R;
      this.trunkBody = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
      const groups = interactionGroups(GROUP.STATIC, 0xffff);
      for (let i = 0; i < TRUNK_POOL; i++) {
        const col = physics.world.createCollider(
          R.ColliderDesc.capsule(0.6, 0.2).setCollisionGroups(groups).setFriction(0.6).setRestitution(0.2),
          this.trunkBody,
        );
        physics.setInfo(col, { kind: 'static', material: 'wood' });
        col.setEnabled(false);
        this.trunks.push(col);
      }
    }
  }

  private createKindMesh(kind: PropKind): KindMesh {
    const cfg = KINDS[kind]!;
    const base = kindGeometry(kind);
    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('normal', base.getAttribute('normal'));
    geo.setAttribute('color', base.getAttribute('color'));
    const capacity = Math.ceil(cfg.capacity * SCATTER_TIERS.ultra.capacity);
    const attr = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    attr.setUsage(DynamicDrawUsage);
    geo.setAttribute('inst', attr);
    geo.instanceCount = 0;
    const radius = floatUniform(cfg.radius);

    const m = new MeshToonNodeMaterial({ gradientMap: toonGradient() });
    m.name = `scatter-${cfg.name}`;
    setFlatShading(m);
    const inst = attribute('inst', 'vec4');
    const ip = inst.xyz;
    const variant = floor(inst.w.div(4));
    const sc = inst.w.sub(variant.mul(4));
    const upv = normalize(ip);
    const east = normalize(cross(vec3(0, 1, 0), upv).add(vec3(0.0001, 0, 0)));
    const north = cross(upv, east);
    const rnd = fract(sin(dot(ip, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
    const rnd2 = fract(rnd.mul(91.7).add(0.31));
    const yaw = rnd.mul(Math.PI * 2);
    const cy = cos(yaw);
    const sy = sin(yaw);
    const tx = east.mul(cy).add(north.mul(sy));
    const tz = north.mul(cy).sub(east.mul(sy));
    let s = sc.mul(smoothstep(radius, radius.mul(0.84), distance(cameraPosition, ip)));
    if (cfg.shrinkNearPlane) s = s.mul(mix(float(0.42), float(1), smoothstep(2.2, 7.5, distance(this.planePos, ip))));
    const lp = positionGeometry;
    let local: Node = lp;
    if (cfg.sway > 0) {
      const hgt = lp.y.max(0);
      const amp = hgt.mul(hgt).mul(cfg.sway).mul(this.wind);
      const ph = rnd.mul(6.283);
      const sw = sin(time.mul(1.7).add(ph)).mul(amp);
      const sw2 = sin(time.mul(1.23).add(ph.mul(1.7))).mul(amp.mul(0.6));
      local = vec3(lp.x.add(sw), lp.y, lp.z.add(sw2));
    }
    const lv = local as unknown as typeof lp;
    m.positionNode = ip.add(tx.mul(lv.x).add(upv.mul(lv.y)).add(tz.mul(lv.z)).mul(s));
    if (cfg.castShadow) {
      // Pass bayangan: hanya props dekat pesawat yang benar-benar menghasilkan bayangan (sisanya diciutkan
      // ke titik sehingga tidak dirasterisasi) — area peta bayangan memang hanya sekitar pesawat.
      const near = smoothstep(SHADOW_RADIUS, SHADOW_RADIUS - 6, distance(this.planePos, ip));
      m.castShadowPositionNode = ip.add(tx.mul(lv.x).add(upv.mul(lv.y)).add(tz.mul(lv.z)).mul(s.mul(near)));
    }

    // Warna: warna titik × variasi kecerahan per instans; bagian penanda putih → warna varian.
    const vc = attribute('color', 'vec3');
    let col = vc.mul(rnd2.mul(0.22).add(0.89));
    if (cfg.variants?.length) {
      let pal: Node = color(new Color(cfg.variants[0]!));
      for (let i = 1; i < cfg.variants.length; i++) pal = select(variant.equal(i), color(new Color(cfg.variants[i]!)), pal as never);
      const palC = pal as unknown as ReturnType<typeof color>;
      const mark = smoothstep(0.93, 0.99, vc.x.mul(vc.y).mul(vc.z));
      col = mix(col, palC.mul(rnd2.mul(0.12).add(0.94)), mark);
    }
    m.colorNode = col;

    const mesh = new Mesh(geo, m);
    mesh.name = `scatter-${cfg.name}`;
    mesh.frustumCulled = false;
    mesh.castShadow = cfg.castShadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    base.dispose();
    return { mesh, geo, attr, capacity, radius };
  }

  setTier(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.applyTier();
    this.cache.clear();
    this.lastFocus.set(1e9, 0, 0);
  }

  private applyTier(): void {
    const t = SCATTER_TIERS[this.tier];
    const shadows = this.tier === 'high' || this.tier === 'ultra';
    this.kinds.forEach((km, k) => {
      const cfg = KINDS[k]!;
      km.radius.value = cfg.radius * t.radius;
      km.capacity = Math.min(km.attr.count, Math.ceil(cfg.capacity * t.capacity));
      km.mesh.castShadow = cfg.castShadow && shadows;
    });
  }

  /** Kosongkan area (zona, landmark): tidak ada props dalam radius (unit) dari arah `dir`. */
  addExclusion(dir: Vector3, radiusUnits: number): void {
    this.exclusions.push({ dir: dir.clone().normalize(), cos: Math.cos(radiusUnits / PLANET_RADIUS) });
    this.cache.clear();
    this.lastFocus.set(1e9, 0, 0);
  }

  private excluded(x: number, y: number, z: number, len: number): boolean {
    for (const e of this.exclusions) {
      if ((x * e.dir.x + y * e.dir.y + z * e.dir.z) / len > e.cos) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ pembangkitan sel

  private generate(cell: number): CellData {
    const out: number[][] = Array.from({ length: PROP_KIND_COUNT }, () => []);
    const trees: number[] = [];
    const dens = SCATTER_TIERS[this.tier].density;
    const tp = this.planet.triPos;
    const nearAirport = this.airportDir.dot(_c.set(this.cellCenter[cell * 3]!, this.cellCenter[cell * 3 + 1]!, this.cellCenter[cell * 3 + 2]!).normalize()) > Math.cos(0.12);
    const loc = { along: 0, side: 0 };
    for (let i = this.cellStart[cell]!; i < this.cellStart[cell + 1]!; i++) {
      const t = this.cellTris[i]!;
      const o = t * 9;
      const ax = tp[o]!;
      const ay = tp[o + 1]!;
      const az = tp[o + 2]!;
      const e1x = tp[o + 3]! - ax;
      const e1y = tp[o + 4]! - ay;
      const e1z = tp[o + 5]! - az;
      const e2x = tp[o + 6]! - ax;
      const e2y = tp[o + 7]! - ay;
      const e2z = tp[o + 8]! - az;
      const cxp = e1y * e2z - e1z * e2y;
      const cyp = e1z * e2x - e1x * e2z;
      const czp = e1x * e2y - e1y * e2x;
      const area = Math.hypot(cxp, cyp, czp) / 2;
      if (area < 1e-4) continue;
      const mx = ax + (e1x + e2x) / 3;
      const my = ay + (e1y + e2y) / 3;
      const mz = az + (e1z + e2z) / 3;
      const mlen = Math.hypot(mx, my, mz);
      const slope = (cxp * mx + cyp * my + czp * mz) / (2 * area * mlen);
      const cb = this.planet.classes[t]!;
      const cls = classOf(cb);
      const dry = drynessOf(cb);
      const a = this.planet.aux[t]!;
      const forest = auxForest(a);
      const farm = auxFarm(a);
      const lat = Math.asin(my / mlen) * DEG;
      const absLat = Math.abs(lat);
      const lon = Math.atan2(mx, mz) * DEG;
      const tropic = absLat < 23;
      const boreal = absLat >= 52;

      // Kepadatan per unit² per jenis.
      const d = new Float32Array(PROP_KIND_COUNT);
      if (cls === TriClass.Grass) {
        const treeD = Math.pow(forest, 1.3) * 0.36 + 0.01 * (1 - farm);
        if (dry > 0.35 && !boreal) {
          d[PropKind.Acacia] = treeD * 0.55 + dry * 0.025;
          d[PropKind.Shrub] = dry * 0.06;
          d[PropKind.Broadleaf] = treeD * 0.3;
        } else if (tropic) {
          d[PropKind.Broadleaf] = treeD * 0.74;
          d[PropKind.Palm] = treeD * 0.26;
        } else if (!boreal) {
          d[PropKind.Broadleaf] = treeD * 0.6;
          d[PropKind.Pine] = treeD * 0.4;
        } else if (absLat < 62) {
          d[PropKind.TallPine] = treeD * 0.7;
          d[PropKind.Pine] = treeD * 0.3;
        } else {
          d[PropKind.SnowPine] = treeD * 0.8;
          d[PropKind.TallPine] = treeD * 0.2;
        }
        d[PropKind.Bush] = (0.035 + forest * 0.1) * (1 - dry * 0.6);
        d[PropKind.Rock] = 0.008 + (slope < 0.9 ? 0.03 : 0);
        d[PropKind.Grass] = (1.1 - forest * 0.55 - farm * 0.6) * (1 - dry * 0.4);
        d[PropKind.Flower] = (0.16 * (1 - forest) * (1 - farm * 0.7)) * (boreal ? 0.4 : 1) * (1 - dry * 0.7);
        d[PropKind.House] = farm > 0.35 ? 0.007 * farm : 0;
      } else if (cls === TriClass.Sand) {
        if (tropic) d[PropKind.Palm] = 0.06;
        else if (!boreal) d[PropKind.Broadleaf] = 0.008;
        d[PropKind.Grass] = 0.35;
        d[PropKind.Rock] = 0.012;
        d[PropKind.Bush] = 0.015;
      } else if (cls === TriClass.Desert) {
        d[PropKind.Rock] = 0.022;
        if (lon < -30) d[PropKind.Cactus] = 0.012;
        else d[PropKind.Shrub] = 0.01;
      } else if (cls === TriClass.Rock) {
        d[PropKind.Rock] = 0.06;
        d[boreal ? PropKind.SnowPine : PropKind.Pine] = absLat < 62 ? 0.035 * (1 - dry) : 0;
        d[PropKind.Grass] = 0.18;
      } else if (cls === TriClass.Snow) {
        d[PropKind.Rock] = 0.008;
      }

      const rng = mulberry32((t * 2654435761) ^ 0x5eed);
      for (let k = 0; k < PROP_KIND_COUNT; k++) {
        const dk = d[k]!;
        if (dk <= 0) continue;
        const count = Math.floor(area * dk * dens + rng());
        for (let j = 0; j < count; j++) {
          let u = rng();
          let v = rng();
          if (u + v > 1) {
            u = 1 - u;
            v = 1 - v;
          }
          const px = ax + e1x * u + e2x * v;
          const py = ay + e1y * u + e2y * v;
          const pz = az + e1z * u + e2z * v;
          const len = Math.hypot(px, py, pz);
          const h = len - PLANET_RADIUS;
          const r = rng();
          // Di atas pita pantai (pohon) / sedikit di atas air (rumput pantai).
          const minH = k === PropKind.Palm ? 0.75 : k === PropKind.Grass || k === PropKind.Rock ? 0.5 : 0.85;
          if (h < minH) continue;
          if (this.exclusions.length && this.excluded(px, py, pz, len)) continue;
          if (nearAirport) {
            _v.set(px / len, py / len, pz / len);
            const fd = this.airport.flatDistance(_v);
            const keep = k === PropKind.Grass || k === PropKind.Flower ? 0.6 : AIRPORT.blendWidth + 3;
            if (fd < keep) continue;
            void loc;
          }
          let scale = 0.78 + r * 0.5;
          if (k === PropKind.Rock) scale = 0.45 + r * r * 1.4;
          else if (k === PropKind.House) scale = 0.85 + r * 0.35;
          else if (k === PropKind.Grass || k === PropKind.Flower) scale = 0.7 + r * 0.6;
          const variant = Math.floor(rng() * 8);
          out[k]!.push(px, py, pz, Math.min(3.99, scale) + variant * 4);
          if (KINDS[k]!.tree) trees.push(px, py, pz, scale, k);
        }
      }
    }
    return {
      kinds: out.map((a) => (a.length ? new Float32Array(a) : null)),
      trees: new Float32Array(trees),
    };
  }

  private cell(c: number): CellData {
    const hit = this.cache.get(c);
    if (hit) {
      this.cache.delete(c);
      this.cache.set(c, hit);
      return hit;
    }
    const data = this.generate(c);
    this.cache.set(c, data);
    if (this.cache.size > MAX_CACHE) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    return data;
  }

  // ------------------------------------------------------------------ pembaruan per frame

  update(dt: number, camera: Camera, planePos: Vector3, planeAltitude: number): void {
    this.planePos.value.copy(planePos);
    if (!this.enabled) return;
    this.rebuildTimer += dt;
    // Matriks kamera bisa masih dari frame sebelumnya (mis. setelah teleport/respawn) → perbarui dulu.
    camera.updateMatrixWorld();
    const cameraPos = camera.position;
    camera.getWorldDirection(_fwd);
    if (
      cameraPos.distanceToSquared(this.lastFocus) > REBUILD_MOVE * REBUILD_MOVE ||
      _fwd.dot(this.lastDir) < REBUILD_TURN_COS ||
      this.rebuildTimer > 1.5
    ) {
      this.lastDir.copy(_fwd);
      _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pm);
      this.rebuild(cameraPos);
    }
    this.trunkTimer += dt;
    if (this.trunkTimer > 0.2) {
      this.trunkTimer = 0;
      this.updateTrunks(planePos, planeAltitude);
    }
  }

  private rebuild(cameraPos: Vector3): void {
    this.lastFocus.copy(cameraPos);
    this.rebuildTimer = 0;
    const t = SCATTER_TIERS[this.tier];
    let maxR = 0;
    for (const k of KINDS) maxR = Math.max(maxR, k.radius * t.radius);
    const r = cameraPos.length() || 1;
    const lat = Math.asin(cameraPos.y / r) * DEG;
    const lon = Math.atan2(cameraPos.x, cameraPos.z) * DEG;
    const alt = Math.max(0, r - PLANET_RADIUS);
    // Tidak perlu props bila kamera sangat tinggi (props terlalu kecil untuk terlihat).
    if (alt > maxR) {
      for (const km of this.kinds) km.geo.instanceCount = 0;
      return;
    }
    const angDeg = ((maxR + 8) / PLANET_RADIUS) * DEG;
    const cells = this.activeCells;
    const dists = this.activeDist;
    cells.length = 0;
    dists.length = 0;
    const la0 = Math.max(-84, Math.floor(lat - angDeg));
    const la1 = Math.min(84, Math.floor(lat + angDeg));
    for (let la = la0; la <= la1; la++) {
      const cl = Math.max(0.05, Math.cos(((la + 0.5) * Math.PI) / 180));
      const span = Math.min(180, angDeg / cl + 1);
      for (let lo = Math.floor(lon - span); lo <= Math.floor(lon + span); lo++) {
        const c = cellOf(la + 0.5, lo + 0.5);
        if (this.cellStart[c + 1]! - this.cellStart[c]! === 0) continue;
        const dx = this.cellCenter[c * 3]! - cameraPos.x;
        const dy = this.cellCenter[c * 3 + 1]! - cameraPos.y;
        const dz = this.cellCenter[c * 3 + 2]! - cameraPos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < maxR + 8) {
          // Frustum (diperlebar) supaya sel di belakang kamera tidak dibangkitkan/digambar.
          _sphere.center.set(this.cellCenter[c * 3]!, this.cellCenter[c * 3 + 1]!, this.cellCenter[c * 3 + 2]!);
          _sphere.radius = 9 + dist * 0.12;
          if (dist > 14 && !_frustum.intersectsSphere(_sphere)) continue;
          cells.push(c);
          dists.push(dist);
        }
      }
    }
    // Sel terdekat dulu supaya kapasitas penuh dipakai untuk yang paling terlihat.
    const order = cells.map((_, i) => i).sort((a, b) => dists[a]! - dists[b]!);
    const fillCount = new Int32Array(PROP_KIND_COUNT);
    for (const idx of order) {
      const c = cells[idx]!;
      const dist = dists[idx]!;
      let data: CellData | null = null;
      for (let k = 0; k < PROP_KIND_COUNT; k++) {
        const km = this.kinds[k]!;
        if (dist > km.radius.value + 8) continue;
        data ??= this.cell(c);
        const arr = data.kinds[k];
        if (!arr) continue;
        const room = km.capacity - fillCount[k]!;
        if (room <= 0) continue;
        const n = Math.min(room, arr.length / 4);
        (km.attr.array as Float32Array).set(n * 4 === arr.length ? arr : arr.subarray(0, n * 4), fillCount[k]! * 4);
        fillCount[k] = fillCount[k]! + n;
      }
    }
    this.kinds.forEach((km, k) => {
      const n = fillCount[k]!;
      km.geo.instanceCount = n;
      km.mesh.visible = n > 0;
      if (n > 0) {
        km.attr.clearUpdateRanges();
        km.attr.addUpdateRange(0, n * 4);
        km.attr.needsUpdate = true;
      }
    });
  }

  /** Jumlah instans per jenis (debug). */
  get kindCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    this.kinds.forEach((k, i) => (out[KINDS[i]!.name] = k.geo.instanceCount));
    return out;
  }

  /** Jumlah instans yang sedang digambar (statistik debug). */
  get instanceCount(): number {
    return this.kinds.reduce((n, k) => n + k.geo.instanceCount, 0);
  }

  // ------------------------------------------------------------------ pohon: serempet & batang

  private forTreesNear(pos: Vector3, cb: (x: number, y: number, z: number, s: number, kind: number, key: number) => boolean): void {
    const r = pos.length() || 1;
    const lat = Math.asin(pos.y / r) * DEG;
    const lon = Math.atan2(pos.x, pos.z) * DEG;
    for (let dla = -1; dla <= 1; dla++)
      for (let dlo = -1; dlo <= 1; dlo++) {
        const c = cellOf(lat + dla, lon + dlo);
        if (this.cellStart[c + 1]! - this.cellStart[c]! === 0) continue;
        const tr = this.cell(c).trees;
        for (let i = 0; i < tr.length; i += 5) {
          if (cb(tr[i]!, tr[i + 1]!, tr[i + 2]!, tr[i + 3]!, tr[i + 4]!, c * 100000 + i)) return;
        }
      }
  }

  /** Pohon yang sedang diserempet di posisi ini (sensor), atau null. */
  checkBrush(pos: Vector3, time: number, out: TreeHit): TreeHit | null {
    let found: TreeHit | null = null;
    const len = pos.length();
    const ux = pos.x / len;
    const uy = pos.y / len;
    const uz = pos.z / len;
    this.forTreesNear(pos, (x, y, z, s, kind, key) => {
      const rx = pos.x - x;
      const ry = pos.y - y;
      const rz = pos.z - z;
      const h = rx * ux + ry * uy + rz * uz;
      const top = KINDS[kind]!.top * s;
      if (h < -0.5 || h > top + 0.6) return false;
      const horiz = Math.sqrt(Math.max(0, rx * rx + ry * ry + rz * rz - h * h));
      if (horiz < 0.95 * s + 1.5) {
        if (key === this.lastBrushKey && time - this.lastBrushTime < 1.5) return true;
        this.lastBrushKey = key;
        this.lastBrushTime = time;
        out.x = x;
        out.y = y;
        out.z = z;
        out.scale = s;
        out.kind = kind as PropKind;
        found = out;
        return true;
      }
      return false;
    });
    return found;
  }

  /** Pindahkan pool collider kapsul ke batang pohon terdekat dari pesawat (hanya saat terbang rendah). */
  private updateTrunks(planePos: Vector3, altitude: number): void {
    if (!this.trunks.length) return;
    const near: { d: number; x: number; y: number; z: number; s: number; kind: number }[] = [];
    if (altitude < 14) {
      this.forTreesNear(planePos, (x, y, z, s, kind) => {
        const d = (x - planePos.x) ** 2 + (y - planePos.y) ** 2 + (z - planePos.z) ** 2;
        if (d < 26 * 26) near.push({ d, x, y, z, s, kind });
        return false;
      });
      near.sort((a, b) => a.d - b.d);
    }
    for (let i = 0; i < this.trunks.length; i++) {
      const col = this.trunks[i]!;
      const t = near[i];
      if (!t) {
        if (col.isEnabled()) col.setEnabled(false);
        continue;
      }
      // Batang setinggi ±45% pohon, berdiri mengikuti atas lokal.
      const halfH = KINDS[t.kind]!.top * t.s * 0.22;
      _v.set(t.x, t.y, t.z);
      const up = _c.copy(_v).normalize();
      _q.setFromUnitVectors(_up, up);
      _v.addScaledVector(up, halfH + 0.15);
      col.setTranslationWrtParent({ x: _v.x, y: _v.y, z: _v.z });
      col.setRotationWrtParent({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
      col.setHalfHeight(halfH);
      col.setRadius(0.16 * t.s + 0.06);
      if (!col.isEnabled()) col.setEnabled(true);
    }
  }

  dispose(): void {
    for (const km of this.kinds) {
      km.geo.dispose();
      (km.mesh.material as MeshToonNodeMaterial).dispose();
    }
    if (this.physics && this.trunkBody) this.physics.world.removeRigidBody(this.trunkBody);
    this.trunks.length = 0;
    this.cache.clear();
  }
}

function latLonDir(lat: number, lon: number, out: Vector3): Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const c = Math.cos(la);
  return out.set(c * Math.sin(lo), Math.sin(la), c * Math.cos(lo));
}
