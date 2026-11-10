/**
 * Planet low-poly dari public/earth/earth.bin (dibuat scripts/build-earth.ts).
 * - 80 chunk mesh (frustum culling + culling horizon) dengan satu material warna-titik.
 * - Collider trimesh Rapier per chunk; chunk jauh dari pesawat dinonaktifkan.
 * - Bola lantai laut sebagai jaring pengaman.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, SRGBColorSpace, Vector3, type Material } from 'three';
import { PLANET_RADIUS, SEA_FLOOR_RADIUS } from '../config/world';
import { GROUP, interactionGroups, type PhysicsWorld, type SurfaceMaterial } from '../physics/PhysicsWorld';
import { TriClass, type EarthMeta } from './EarthFormat';

interface Chunk {
  mesh: Mesh;
  center: Vector3;
  centerDir: Vector3;
  radius: number;
  angularRadius: number;
  collider: RAPIER.Collider | null;
  start: number;
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
    case TriClass.Airport:
      return 'grass';
    default:
      return 'grass';
  }
}

export class Planet {
  readonly group = new Group();
  readonly chunks: Chunk[] = [];
  readonly classes: Uint8Array;
  private seaFloor: RAPIER.Collider | null = null;

  constructor(
    data: ArrayBuffer,
    meta: EarthMeta,
    material: Material,
    private readonly physics: PhysicsWorld,
  ) {
    this.group.name = 'planet';
    const total = meta.triangleCount;
    const pos = new Int16Array(data, meta.sections.positions, total * 9);
    const col = new Uint8Array(data, meta.sections.colors, total * 3);
    this.classes = new Uint8Array(data, meta.sections.classes, total);
    const scale = meta.quantRadius / 32767;
    const R = physics.R;
    const groups = interactionGroups(GROUP.TERRAIN, 0xffff);

    for (const [index, ch] of meta.chunks.entries()) {
      if (ch.count === 0) continue;
      const n = ch.count * 3;
      const positions = new Float32Array(n * 3);
      const colors = new Float32Array(n * 3);
      for (let t = 0; t < ch.count; t++) {
        const tri = ch.start + t;
        const cr = SRGB_TO_LINEAR[col[tri * 3]!]!;
        const cg = SRGB_TO_LINEAR[col[tri * 3 + 1]!]!;
        const cb = SRGB_TO_LINEAR[col[tri * 3 + 2]!]!;
        for (let k = 0; k < 9; k++) positions[t * 9 + k] = pos[tri * 9 + k]! * scale;
        for (let k = 0; k < 3; k++) {
          colors[t * 9 + k * 3] = cr;
          colors[t * 9 + k * 3 + 1] = cg;
          colors[t * 9 + k * 3 + 2] = cb;
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
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
      });
    }

    // Jaring pengaman: bola padat di bawah dasar laut.
    this.seaFloor = physics.world.createCollider(
      R.ColliderDesc.ball(SEA_FLOOR_RADIUS).setCollisionGroups(groups).setFriction(0.9).setRestitution(0.05),
    );
    physics.setInfo(this.seaFloor, { kind: 'terrain', material: 'water' });
  }

  /** Material permukaan di titik raycast (dari kelas segitiga). */
  materialAt(collider: RAPIER.Collider, featureId: number | undefined): SurfaceMaterial {
    const info = this.physics.infoOf(collider);
    const owner = info?.owner as { start: number } | undefined;
    if (!owner || featureId === undefined || featureId < 0) return info?.material ?? 'grass';
    return classMaterial(this.classes[owner.start + featureId] ?? TriClass.Grass);
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
