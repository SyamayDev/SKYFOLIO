/**
 * Dunia fisika Rapier (docs/03 bagian 1).
 * - Gravitasi dunia = 0; gravitasi radial diberikan manual (RadialGravity).
 * - Langkah tetap 1/60 detik (akumulator ada di core/Loop).
 * - Tabrakan diteruskan ke handler per collider lewat EventQueue.
 * - Benda yang disinkronkan ke mesh disimpan dua state (sebelum/sesudah langkah) untuk interpolasi visual.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3, type Object3D } from 'three';

export type Rapier = typeof RAPIER;

/** Grup tabrakan (bit). */
export const GROUP = {
  TERRAIN: 1 << 0,
  PLANE: 1 << 1,
  PROP: 1 << 2,
  STATIC: 1 << 3,
  SENSOR: 1 << 4,
} as const;

export function interactionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

/** Filter raycast standar: semua yang padat kecuali pesawat. */
export const SOLID_FILTER = interactionGroups(0xffff, GROUP.TERRAIN | GROUP.STATIC | GROUP.PROP);
export const WORLD_ONLY_FILTER = interactionGroups(0xffff, GROUP.TERRAIN | GROUP.STATIC);

export type SurfaceMaterial = 'grass' | 'sand' | 'snow' | 'rock' | 'wood' | 'metal' | 'fabric' | 'rubber' | 'water' | 'asphalt';

export interface ColliderInfo {
  kind: 'terrain' | 'prop' | 'static' | 'plane';
  material: SurfaceMaterial;
  /** Dipanggil saat benda ini mulai bersentuhan dengan benda lain. */
  onContact?: (e: ContactInfo) => void;
  owner?: unknown;
}

export interface ContactInfo {
  self: RAPIER.Collider;
  other: RAPIER.Collider;
  otherInfo: ColliderInfo | undefined;
  /** Kecepatan relatif sepanjang normal kontak (unit/dtk, selalu ≥ 0). */
  impactSpeed: number;
  point: Vector3;
  normal: Vector3;
}

export interface RayHit {
  distance: number;
  /** Indeks segitiga (trimesh) yang terkena, bila ada. */
  featureId: number | undefined;
  point: Vector3;
  normal: Vector3;
  collider: RAPIER.Collider;
  info: ColliderInfo | undefined;
}

/** Rigid body yang posisinya disalin ke Object3D dengan interpolasi. */
export class SyncedBody {
  readonly prevPos = new Vector3();
  readonly currPos = new Vector3();
  readonly prevRot = new Quaternion();
  readonly currRot = new Quaternion();
  /** Kecepatan sebelum langkah terakhir (dipakai menghitung kecepatan tumbukan). */
  readonly preStepVel = new Vector3();

  constructor(
    readonly body: RAPIER.RigidBody,
    readonly object: Object3D | null,
  ) {
    this.capture();
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
  }

  capture(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);
  }

  /** Lompat langsung tanpa interpolasi (respawn, teleport). */
  snap(): void {
    this.capture();
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
  }

  apply(alpha: number): void {
    if (!this.object) return;
    this.object.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.object.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);
  }
}

export class PhysicsWorld {
  readonly dt = 1 / 60;
  readonly world: RAPIER.World;
  readonly events: RAPIER.EventQueue;
  readonly synced: SyncedBody[] = [];
  /** Waktu langkah fisika terakhir (ms) untuk panel performa. */
  lastStepMs = 0;

  private readonly info = new Map<number, ColliderInfo>();
  private readonly ray: RAPIER.Ray;
  private readonly hit: RayHit = {
    distance: 0,
    featureId: undefined,
    point: new Vector3(),
    normal: new Vector3(),
    collider: null as unknown as RAPIER.Collider,
    info: undefined,
  };
  private readonly bodyBySynced = new Map<number, SyncedBody>();
  private readonly _n = new Vector3();
  private readonly _p = new Vector3();
  private readonly _v = new Vector3();
  private readonly _contact: ContactInfo = {
    self: null as unknown as RAPIER.Collider,
    other: null as unknown as RAPIER.Collider,
    otherInfo: undefined,
    impactSpeed: 0,
    point: new Vector3(),
    normal: new Vector3(),
  };

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    return new PhysicsWorld();
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = this.dt;
    this.events = new RAPIER.EventQueue(true);
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  get R(): Rapier {
    return RAPIER;
  }

  setInfo(collider: RAPIER.Collider, info: ColliderInfo): void {
    this.info.set(collider.handle, info);
  }

  infoOf(collider: RAPIER.Collider): ColliderInfo | undefined {
    return this.info.get(collider.handle);
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.info.delete(collider.handle);
    this.world.removeCollider(collider, true);
  }

  addSynced(body: RAPIER.RigidBody, object: Object3D | null): SyncedBody {
    const s = new SyncedBody(body, object);
    this.synced.push(s);
    this.bodyBySynced.set(body.handle, s);
    return s;
  }

  removeSynced(s: SyncedBody): void {
    const i = this.synced.indexOf(s);
    if (i >= 0) this.synced.splice(i, 1);
    this.bodyBySynced.delete(s.body.handle);
  }

  /**
   * Raycast ke dunia. Hasil memakai objek yang dipakai ulang — salin bila perlu disimpan.
   */
  castRay(
    origin: Vector3,
    dir: Vector3,
    maxDist: number,
    filterGroups = SOLID_FILTER,
    excludeBody?: RAPIER.RigidBody,
  ): RayHit | null {
    const o = this.ray.origin;
    o.x = origin.x;
    o.y = origin.y;
    o.z = origin.z;
    const d = this.ray.dir;
    d.x = dir.x;
    d.y = dir.y;
    d.z = dir.z;
    const h = this.world.castRayAndGetNormal(
      this.ray,
      maxDist,
      true,
      this.R.QueryFilterFlags.EXCLUDE_SENSORS,
      filterGroups,
      undefined,
      excludeBody,
    );
    if (!h) return null;
    this.hit.distance = h.timeOfImpact;
    this.hit.featureId = h.featureId;
    this.hit.point.copy(origin).addScaledVector(dir, h.timeOfImpact);
    this.hit.normal.set(h.normal.x, h.normal.y, h.normal.z);
    this.hit.collider = h.collider;
    this.hit.info = this.info.get(h.collider.handle);
    return this.hit;
  }

  /** Simpan kecepatan sebelum langkah untuk menghitung tumbukan. */
  private recordPreStep(): void {
    for (const s of this.synced) {
      const v = s.body.linvel();
      s.preStepVel.set(v.x, v.y, v.z);
    }
  }

  step(): void {
    const t0 = performance.now();
    for (const s of this.synced) {
      s.prevPos.copy(s.currPos);
      s.prevRot.copy(s.currRot);
    }
    this.recordPreStep();
    this.world.step(this.events);
    for (const s of this.synced) s.capture();
    this.dispatchEvents();
    this.lastStepMs = performance.now() - t0;
  }

  private velocityBefore(collider: RAPIER.Collider, out: Vector3): Vector3 {
    const body = collider.parent();
    if (!body) return out.set(0, 0, 0);
    const s = this.bodyBySynced.get(body.handle);
    if (s) return out.copy(s.preStepVel);
    const v = body.linvel();
    return out.set(v.x, v.y, v.z);
  }

  private dispatchEvents(): void {
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const c1 = this.world.getCollider(h1);
      const c2 = this.world.getCollider(h2);
      if (!c1 || !c2) return;
      const i1 = this.info.get(h1);
      const i2 = this.info.get(h2);
      if (!i1?.onContact && !i2?.onContact) return;
      let hasManifold = false;
      this.world.contactPair(c1, c2, (manifold) => {
        if (hasManifold || manifold.numContacts() === 0) return;
        hasManifold = true;
        const n = manifold.normal();
        this._n.set(n.x, n.y, n.z);
        const sp = manifold.numSolverContacts() > 0 ? manifold.solverContactPoint(0) : null;
        if (sp) this._p.set(sp.x, sp.y, sp.z);
        else {
          const t = c1.translation();
          this._p.set(t.x, t.y, t.z);
        }
      });
      if (!hasManifold) {
        // Tidak ada manifold (misalnya sensor) — pakai arah antar pusat.
        const a = c1.translation();
        const b = c2.translation();
        this._n.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        this._p.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      }
      const v1 = this.velocityBefore(c1, this._v);
      const vx = v1.x;
      const vy = v1.y;
      const vz = v1.z;
      const v2 = this.velocityBefore(c2, this._v);
      const rel = Math.abs((vx - v2.x) * this._n.x + (vy - v2.y) * this._n.y + (vz - v2.z) * this._n.z);
      const c = this._contact;
      c.impactSpeed = rel;
      c.point.copy(this._p);
      if (i1?.onContact) {
        c.self = c1;
        c.other = c2;
        c.otherInfo = i2;
        c.normal.copy(this._n).negate();
        i1.onContact(c);
      }
      if (i2?.onContact) {
        c.self = c2;
        c.other = c1;
        c.otherInfo = i1;
        c.normal.copy(this._n);
        i2.onContact(c);
      }
    });
    // Event gaya kontak tidak dipakai di Fase 0; kuras supaya antrean tidak menumpuk.
    this.events.drainContactForceEvents(() => undefined);
  }

  interpolate(alpha: number): void {
    for (const s of this.synced) s.apply(alpha);
  }

  dispose(): void {
    this.synced.length = 0;
    this.info.clear();
    this.events.free();
    this.world.free();
  }
}
