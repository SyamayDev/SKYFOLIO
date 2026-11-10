/**
 * Rigid body pesawat PK-ARL (docs/03 bagian 3). Dipisah dari Plane.ts supaya unit test memakai badan yang sama.
 * Ukuran collider cocok dengan model visual di PlaneModel.ts (pesawat mainan bersayap rendah sesuai
 * gambar referensi Aril, lihat docs/decisions.md). Massa & inersia diatur eksplisit di config/flight.ts,
 * jadi bentuk collider hanya memengaruhi tabrakan, bukan rasa terbang.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Quaternion, Vector3 } from 'three';
import { FLIGHT } from '../config/flight';
import { GROUP, interactionGroups, type PhysicsWorld } from '../physics/PhysicsWorld';

/** Dimensi badan pesawat (unit) — dipakai juga oleh model visual. */
export const PLANE_DIMENSIONS = {
  fuselageHalfLength: 1.55,
  fuselageRadius: 0.58,
  fuselageCenterZ: 0.2,
  /** Sayap utama (rendah). */
  wing: { halfSpan: 2.6, halfChord: 0.55, y: -0.24, z: -0.38, halfThick: 0.1 },
  tailPlane: { halfSpan: 1.0, halfChord: 0.32, y: 0.24, z: 2.0, halfThick: 0.05 },
  fin: { halfHeight: 0.5, halfChord: 0.34, y: 0.75, z: 2.05, halfThick: 0.05 },
  /** Titik pasang suspensi roda (rangka badan). Sama dengan versi sebelumnya supaya rasa di darat tetap. */
  mainGear: { x: 0.68, y: -0.5, z: -0.72 },
  tailGear: { x: 0, y: -0.42, z: 2.15 },
} as const;

export function createPlaneBody(physics: PhysicsWorld, position: Vector3, rotation: Quaternion): RAPIER.RigidBody {
  const R = physics.R;
  const D = PLANE_DIMENSIONS;
  const desc = R.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
    .setLinearDamping(FLIGHT.LINEAR_DAMPING)
    .setAngularDamping(FLIGHT.ANGULAR_DAMPING)
    .setCcdEnabled(true)
    .setCanSleep(false)
    .setAdditionalMassProperties(
      FLIGHT.MASS,
      { x: 0, y: 0, z: FLIGHT.CENTER_OF_MASS_Z },
      { x: FLIGHT.INERTIA_PITCH, y: FLIGHT.INERTIA_YAW, z: FLIGHT.INERTIA_ROLL },
      { x: 0, y: 0, z: 0, w: 1 },
    );
  const body = physics.world.createRigidBody(desc);
  const groups = interactionGroups(GROUP.PLANE, GROUP.TERRAIN | GROUP.STATIC | GROUP.PROP);
  const events = R.ActiveEvents.COLLISION_EVENTS;

  const add = (c: RAPIER.ColliderDesc): RAPIER.Collider => {
    c.setDensity(0)
      .setFriction(FLIGHT.FRICTION)
      .setRestitution(FLIGHT.RESTITUTION)
      .setCollisionGroups(groups)
      .setActiveEvents(events);
    return physics.world.createCollider(c, body);
  };
  // Kapsul badan (sumbu Y Rapier diputar ke sumbu Z badan).
  const s = Math.SQRT1_2;
  add(
    R.ColliderDesc.capsule(D.fuselageHalfLength - D.fuselageRadius, D.fuselageRadius)
      .setTranslation(0, 0.05, D.fuselageCenterZ)
      .setRotation({ x: s, y: 0, z: 0, w: s }),
  );
  add(R.ColliderDesc.cuboid(D.wing.halfSpan, D.wing.halfThick, D.wing.halfChord).setTranslation(0, D.wing.y, D.wing.z));
  add(
    R.ColliderDesc.cuboid(D.tailPlane.halfSpan, D.tailPlane.halfThick, D.tailPlane.halfChord).setTranslation(
      0,
      D.tailPlane.y,
      D.tailPlane.z,
    ),
  );
  add(R.ColliderDesc.cuboid(D.fin.halfThick, D.fin.halfHeight, D.fin.halfChord).setTranslation(0, D.fin.y, D.fin.z));
  return body;
}
