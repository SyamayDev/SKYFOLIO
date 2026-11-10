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

  dispose(): void {
    for (const c of this.chunks) {
      c.mesh.geometry.dispose();
      if (c.collider) this.physics.removeCollider(c.collider);
    }
    if (this.seaFloor) this.physics.removeCollider(this.seaFloor);
    this.chunks.length = 0;
  }
}
