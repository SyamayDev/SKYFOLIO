/**
 * Planet low-poly dari public/earth/earth.bin (dibuat scripts/build-earth.ts, format v2).
 * - 80 chunk mesh (frustum culling + culling horizon) dengan material medan prosedural.
 * - Collider trimesh Rapier per chunk; chunk jauh dari pesawat dinonaktifkan.
 * - Data segitiga (posisi, kelas, aux) disimpan supaya sistem sebaran props (Scatter) bisa memakainya.
 * - Bola lantai laut sebagai jaring pengaman.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, SRGBColorSpace, Vector3, type Material } from 'three';
import { PLANET_RADIUS, SEA_FLOOR_RADIUS } from '../config/world';
import { GROUP, interactionGroups, type PhysicsWorld, type SurfaceMaterial } from '../physics/PhysicsWorld';
import { TriClass, classOf, type EarthMeta } from './EarthFormat';

interface Chunk {
  mesh: Mesh;
  center: Vector3;
  centerDir: Vector3;
  radius: number;
  angularRadius: number;
  collider: RAPIER.Collider | null;
  start: number;
  count: number;
}

const COLLIDER_RANGE = 160;
const _v = new Vector3();

/** LUT sRGB byte → linear float. */
const SRGB_TO_LINEAR = (() => {
  const lut = new Float32Array(256);
  const c = new Color();
  for (let i = 0; i < 256; i++) {
    c.setRGB(i / 255, 0, 0, SRGBColorSpace);
    lut[i] = c.r;
  }
  return lut;
})();

export function classMaterial(cls: number): SurfaceMaterial {
  switch (cls) {
    case TriClass.Sand:
    case TriClass.Desert:
      return 'sand';
    case TriClass.Snow:
      return 'snow';
    case TriClass.Rock:
      return 'rock';
    case TriClass.Lake:
      return 'water';
    default:
      return 'grass';
  }
}

export class Planet {
  readonly group = new Group();
  readonly chunks: Chunk[] = [];
  /** Posisi semua segitiga (9 float per segitiga, urutan chunk). */
  readonly triPos: Float32Array;
  readonly classes: Uint8Array;
  readonly aux: Uint8Array;
  readonly triangleCount: number;
  private seaFloor: RAPIER.Collider | null = null;
  private material: Material;

  constructor(
    data: ArrayBuffer,
    meta: EarthMeta,
    material: Material,
    private readonly physics: PhysicsWorld,
  ) {
    this.group.name = 'planet';
    this.material = material;
    const total = meta.triangleCount;
    this.triangleCount = total;
    const pos = new Int16Array(data, meta.sections.positions, total * 9);
    const col = new Uint8Array(data, meta.sections.colors, total * 3);
    this.classes = new Uint8Array(data, meta.sections.classes, total);
    this.aux = new Uint8Array(data, meta.sections.aux, total);
    const scale = meta.quantRadius / 32767;
    this.triPos = new Float32Array(total * 9);
    for (let i = 0; i < total * 9; i++) this.triPos[i] = pos[i]! * scale;
    const R = physics.R;
    const groups = interactionGroups(GROUP.TERRAIN, 0xffff);

    for (const [index, ch] of meta.chunks.entries()) {
      if (ch.count === 0) continue;
      const n = ch.count * 3;
      const positions = this.triPos.subarray(ch.start * 9, (ch.start + ch.count) * 9);
      const colors = new Float32Array(n * 3);
      const auxAttr = new Uint8Array(n * 4);
      for (let t = 0; t < ch.count; t++) {
        const tri = ch.start + t;
        const cr = SRGB_TO_LINEAR[col[tri * 3]!]!;
        const cg = SRGB_TO_LINEAR[col[tri * 3 + 1]!]!;
        const cb = SRGB_TO_LINEAR[col[tri * 3 + 2]!]!;
        const a = this.aux[tri]!;
        const forest = (a >> 4) * 17;
        const farm = (a & 15) * 17;
        const cls = (this.classes[tri]! & 7) * 32;
        for (let k = 0; k < 3; k++) {
          colors[t * 9 + k * 3] = cr;
          colors[t * 9 + k * 3 + 1] = cg;
          colors[t * 9 + k * 3 + 2] = cb;
          auxAttr[t * 12 + k * 4] = forest;
          auxAttr[t * 12 + k * 4 + 1] = farm;
          auxAttr[t * 12 + k * 4 + 2] = cls;
          auxAttr[t * 12 + k * 4 + 3] = 255;
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(positions, 3));
      geo.setAttribute('color', new BufferAttribute(colors, 3));
      geo.setAttribute('aux', new BufferAttribute(auxAttr, 4, true));
      geo.computeVertexNormals(); // non-indexed → normal per muka (faceted)
      geo.computeBoundingSphere();
      const mesh = new Mesh(geo, material);
      mesh.name = `chunk-${index}`;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);

      // Collider trimesh (titik duplikat digabung, tepi internal diperbaiki supaya tidak ada benjolan palsu).
      const indices = new Uint32Array(n);
      for (let i = 0; i < n; i++) indices[i] = i;
      let collider: RAPIER.Collider;
      const flags = R.TriMeshFlags.MERGE_DUPLICATE_VERTICES | R.TriMeshFlags.FIX_INTERNAL_EDGES;
      try {
        collider = physics.world.createCollider(
          R.ColliderDesc.trimesh(positions, indices, flags).setCollisionGroups(groups).setFriction(0.8).setRestitution(0.1),
        );
      } catch {
        collider = physics.world.createCollider(
          R.ColliderDesc.trimesh(positions, indices).setCollisionGroups(groups).setFriction(0.8).setRestitution(0.1),
        );
      }
      physics.setInfo(collider, { kind: 'terrain', material: 'grass', owner: { chunk: index, start: ch.start } });
      collider.setEnabled(false);

      const center = new Vector3(...ch.center);
      const centerDir = center.clone().normalize();
      this.chunks.push({
        mesh,
        center,
        centerDir,
        radius: ch.radius,
        angularRadius: Math.asin(Math.min(1, ch.radius / Math.max(center.length(), ch.radius))),
        collider,
        start: ch.start,
        count: ch.count,
      });
    }

    // Jaring pengaman: bola padat di bawah dasar laut.
    this.seaFloor = physics.world.createCollider(
      R.ColliderDesc.ball(SEA_FLOOR_RADIUS).setCollisionGroups(groups).setFriction(0.9).setRestitution(0.05),
    );
    physics.setInfo(this.seaFloor, { kind: 'terrain', material: 'water' });
  }

  /** Ganti material medan (mis. saat tier kualitas berubah). */
  setMaterial(material: Material): void {
    if (material === this.material) return;
    this.material = material;
    for (const c of this.chunks) c.mesh.material = material;
  }

  /** Material permukaan di titik raycast (dari kelas segitiga). */
  materialAt(collider: RAPIER.Collider, featureId: number | undefined): SurfaceMaterial {
    const info = this.physics.infoOf(collider);
    const owner = info?.owner as { start: number } | undefined;
    if (!owner || featureId === undefined || featureId < 0) return info?.material ?? 'grass';
    return classMaterial(classOf(this.classes[owner.start + featureId] ?? TriClass.Grass));
  }

  /** Aktifkan collider chunk di dekat titik-titik penting (pesawat, kamera). */
  updateColliders(focus: Vector3): void {
    for (const c of this.chunks) {
      if (!c.collider) continue;
      const near = _v.copy(c.center).distanceTo(focus) < c.radius + COLLIDER_RANGE;
      if (c.collider.isEnabled() !== near) c.collider.setEnabled(near);
    }
  }

  /** Aktifkan semua collider (untuk raycast penempatan saat memuat). */
  enableAllColliders(on: boolean): void {
    for (const c of this.chunks) c.collider?.setEnabled(on);
  }

  /**
   * Culling horizon: chunk di balik lengkung planet tidak digambar.
   * Chunk terlihat jika sudut antara arah kamera dan pusat chunk < sudut horizon + radius sudut chunk.
   */
  updateVisibility(cameraPos: Vector3): void {
    const r = cameraPos.length();
    const camDir = _v.copy(cameraPos).divideScalar(r || 1);
    const horizon = Math.acos(Math.min(1, (PLANET_RADIUS - 2) / Math.max(r, PLANET_RADIUS)));
    for (const c of this.chunks) {
      const ang = Math.acos(Math.max(-1, Math.min(1, camDir.dot(c.centerDir))));
      c.mesh.visible = ang < horizon + c.angularRadius + 0.08;
    }
  }

  // ------------------------------------------------------------------ kueri tinggi medan (CPU)

  private cellStart: Int32Array | null = null;
  private cellTris: Int32Array | null = null;

  private buildCellIndex(): void {
    const n = this.triangleCount;
    const tp = this.triPos;
    const ids = new Int32Array(n);
    const counts = new Int32Array(180 * 360);
    for (let t = 0; t < n; t++) {
      const o = t * 9;
      const x = tp[o]! + tp[o + 3]! + tp[o + 6]!;
      const y = tp[o + 1]! + tp[o + 4]! + tp[o + 7]!;
      const z = tp[o + 2]! + tp[o + 5]! + tp[o + 8]!;
      const len = Math.hypot(x, y, z) || 1;
      const c = cellIndex((Math.asin(y / len) * 180) / Math.PI, (Math.atan2(x, z) * 180) / Math.PI);
      ids[t] = c;
      counts[c]!++;
    }
    const start = new Int32Array(180 * 360 + 1);
    for (let c = 0; c < 180 * 360; c++) start[c + 1] = start[c]! + counts[c]!;
    const tris = new Int32Array(n);
    const fill = start.slice(0, 180 * 360);
    for (let t = 0; t < n; t++) tris[fill[ids[t]!]!++] = t;
    this.cellStart = start;
    this.cellTris = tris;
  }

  /**
   * Tinggi permukaan daratan (di atas laut) di bawah arah satuan `dir`, dihitung langsung dari segitiga
   * (tidak bergantung collider yang mungkin nonaktif). Laut / tidak ada daratan → `seaValue`.
   */
  heightAt(dir: Vector3, seaValue = 0): number {
    if (!this.cellStart) this.buildCellIndex();
    const start = this.cellStart!;
    const tris = this.cellTris!;
    const len = dir.length() || 1;
    const dx = dir.x / len;
    const dy = dir.y / len;
    const dz = dir.z / len;
    const lat = (Math.asin(Math.max(-1, Math.min(1, dy))) * 180) / Math.PI;
    const lon = (Math.atan2(dx, dz) * 180) / Math.PI;
    const tp = this.triPos;
    let best = -1;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const c = cellIndex(lat + a, lon + b);
        for (let i = start[c]!; i < start[c + 1]!; i++) {
          const o = tris[i]! * 9;
          const t = rayTriFromCenter(dx, dy, dz, tp, o);
          if (t > 0 && t > best) best = t;
        }
      }
    }
    return best > 0 ? best - PLANET_RADIUS : seaValue;
  }

  dispose(): void {
    for (const c of this.chunks) {
      c.mesh.geometry.dispose();
      if (c.collider) this.physics.removeCollider(c.collider);
    }
    if (this.seaFloor) this.physics.removeCollider(this.seaFloor);
    this.chunks.length = 0;
  }
}

function cellIndex(lat: number, lon: number): number {
  const la = Math.min(179, Math.max(0, Math.floor(lat + 90)));
  const lo = ((Math.floor(lon + 180) % 360) + 360) % 360;
  return la * 360 + lo;
}

/** Möller–Trumbore dari pusat planet sepanjang arah satuan d; mengembalikan jarak t (≤ 0 = tidak kena). */
function rayTriFromCenter(dx: number, dy: number, dz: number, p: Float32Array, o: number): number {
  const ax = p[o]!;
  const ay = p[o + 1]!;
  const az = p[o + 2]!;
  const e1x = p[o + 3]! - ax;
  const e1y = p[o + 4]! - ay;
  const e1z = p[o + 5]! - az;
  const e2x = p[o + 6]! - ax;
  const e2y = p[o + 7]! - ay;
  const e2z = p[o + 8]! - az;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const tx = -ax;
  const ty = -ay;
  const tz = -az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return -1;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return -1;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}
