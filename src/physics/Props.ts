/**
 * Props fisika generik: rigid body dinamis + mesh, dengan bunyi/efek tumbukan per material,
 * tidur saat jauh dari pesawat, dan reset ke posisi awal.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3, type Object3D } from 'three';
import { bus } from '../core/EventBus';
import { GROUP, interactionGroups, type PhysicsWorld, type SurfaceMaterial, type SyncedBody } from './PhysicsWorld';
import type { RadialGravity } from './RadialGravity';

export interface PropShape {
  /** Kuboid: setengah ukuran + posisi lokal. */
  half: [number, number, number];
  offset?: [number, number, number];
  rotation?: Quaternion;
}

export interface PropOptions {
  mass: number;
  material: SurfaceMaterial;
  shapes: PropShape[];
  friction?: number;
  restitution?: number;
  /** Batas kecepatan tumbukan minimum agar berbunyi. */
  soundThreshold?: number;
}

const SLEEP_DISTANCE = 120;
const _p = new Vector3();

export class Prop {
  readonly body: RAPIER.RigidBody;
  readonly synced: SyncedBody;
  readonly home = new Vector3();
  readonly homeRot = new Quaternion();
  private lastSound = 0;

  constructor(
    readonly physics: PhysicsWorld,
    gravity: RadialGravity,
    readonly object: Object3D,
    position: Vector3,
    rotation: Quaternion,
    readonly opts: PropOptions,
  ) {
    const R = physics.R;
    this.home.copy(position);
    this.homeRot.copy(rotation);
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
      .setLinearDamping(0.05)
      .setAngularDamping(0.3)
      .setCanSleep(true);
    this.body = physics.world.createRigidBody(desc);
    const vol = opts.shapes.reduce((a, s) => a + s.half[0] * s.half[1] * s.half[2] * 8, 0);
    const density = opts.mass / Math.max(vol, 1e-4);
    const groups = interactionGroups(GROUP.PROP, GROUP.TERRAIN | GROUP.STATIC | GROUP.PROP | GROUP.PLANE);
    for (const s of opts.shapes) {
      const cd = R.ColliderDesc.cuboid(s.half[0], s.half[1], s.half[2])
        .setDensity(density)
        .setFriction(opts.friction ?? 0.7)
        .setRestitution(opts.restitution ?? 0.3)
        .setCollisionGroups(groups)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      if (s.offset) cd.setTranslation(s.offset[0], s.offset[1], s.offset[2]);
      if (s.rotation) cd.setRotation({ x: s.rotation.x, y: s.rotation.y, z: s.rotation.z, w: s.rotation.w });
      const c = physics.world.createCollider(cd, this.body);
      physics.setInfo(c, {
        kind: 'prop',
        material: opts.material,
        owner: this,
        onContact: (e) => {
          const now = performance.now();
          if (e.impactSpeed < (opts.soundThreshold ?? 1.2) || now - this.lastSound < 120) return;
          this.lastSound = now;
          bus.emit('prop:hit', { material: opts.material, speed: e.impactSpeed, point: e.point });
        },
      });
    }
    gravity.add(this.body);
    this.synced = physics.addSynced(this.body, object);
    this.synced.apply(1);
  }

  /** Tidurkan bila jauh dari pesawat (hemat CPU). */
  manageSleep(focus: Vector3): void {
    const t = this.body.translation();
    _p.set(t.x, t.y, t.z);
    if (_p.distanceTo(focus) > SLEEP_DISTANCE && !this.body.isSleeping()) this.body.sleep();
  }

  get speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  resetHome(): void {
    this.body.setTranslation({ x: this.home.x, y: this.home.y, z: this.home.z }, true);
    this.body.setRotation({ x: this.homeRot.x, y: this.homeRot.y, z: this.homeRot.z, w: this.homeRot.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.synced.snap();
  }
}
