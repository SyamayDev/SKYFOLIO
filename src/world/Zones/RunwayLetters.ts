/**
 * Huruf "S Y A H R I L" di landasan (docs/02 bagian 3.1).
 * Setiap huruf = rigid body dengan collider gabungan kuboid (lebih akurat dari convex hull untuk huruf
 * cekung seperti L dan H). Setelah 20 detik diam di luar posisi, huruf melayang kembali dengan pegas
 * dan bunyi "plop".
 */
import { Group, Mesh, Quaternion, Vector3, type Material } from 'three';
import { PALETTE } from '../../config/palette';
import { bus } from '../../core/EventBus';
import { Prop, type PropShape } from '../../physics/Props';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import type { RadialGravity } from '../../physics/RadialGravity';
import { Kit, rbox } from '../../utils/modeling/Kit';
import { quatFromUpForward } from '../../utils/quat';
import type { AirportFrame } from '../AirportLayout';

/** Huruf balok di grid 3×5 sel: [x0, y0, x1, y1] (sel inklusif, y dari bawah). */
const FONT: Record<string, [number, number, number, number][]> = {
  S: [
    [0, 4, 2, 4],
    [0, 2, 0, 3],
    [1, 2, 2, 2],
    [2, 0, 2, 1],
    [0, 0, 1, 0],
  ],
  Y: [
    [0, 3, 0, 4],
    [2, 3, 2, 4],
    [0, 2, 2, 2],
    [1, 0, 1, 1],
  ],
  A: [
    [0, 4, 2, 4],
    [0, 0, 0, 3],
    [2, 0, 2, 3],
    [1, 2, 1, 2],
  ],
  H: [
    [0, 0, 0, 4],
    [2, 0, 2, 4],
    [1, 2, 1, 2],
  ],
  R: [
    [0, 0, 0, 4],
    [1, 4, 2, 4],
    [2, 3, 2, 3],
    [1, 2, 2, 2],
    [1, 1, 1, 1],
    [2, 0, 2, 0],
  ],
  I: [
    [0, 4, 2, 4],
    [1, 1, 1, 3],
    [0, 0, 2, 0],
  ],
  L: [
    [0, 1, 0, 4],
    [0, 0, 2, 0],
  ],
};

const LETTERS = ['S', 'Y', 'A', 'H', 'R', 'I', 'L'] as const;
const COLORS = [PALETTE.berry, PALETTE.sun, PALETTE.sky, PALETTE.leaf, PALETTE.lantern, '#B58CFF', PALETTE.sky];
const CELL = 0.4;
const DEPTH = 0.62;
const RETURN_DELAY = 20;
const RETURN_TIME = 1.3;
const MASS = 0.1;

interface Letter {
  char: string;
  prop: Prop;
  restTime: number;
  returning: boolean;
  t: number;
  fromPos: Vector3;
  fromRot: Quaternion;
}

const _v = new Vector3();
const _q = new Quaternion();
const _up = new Vector3();

export class RunwayLetters {
  readonly group = new Group();
  readonly letters: Letter[] = [];

  constructor(
    private readonly physics: PhysicsWorld,
    gravity: RadialGravity,
    material: Material,
    frame: AirportFrame,
    along: number,
  ) {
    this.group.name = 'runway-letters';
    const spacing = 1.32;
    const widthCells = 3;
    LETTERS.forEach((ch, i) => {
      const rects = FONT[ch]!;
      const k = new Kit();
      const shapes: PropShape[] = [];
      for (const [x0, y0, x1, y1] of rects) {
        const w = (x1 - x0 + 1) * CELL;
        const h = (y1 - y0 + 1) * CELL;
        const cx = (x0 + x1 + 1) * 0.5 * CELL - (widthCells * CELL) / 2;
        const cy = (y0 + y1 + 1) * 0.5 * CELL;
        k.add(rbox(w + 0.02, h + 0.02, DEPTH, 0.09), COLORS[i]!, { pos: [cx, cy, 0], jitter: 0.03 });
        shapes.push({ half: [w / 2, h / 2, DEPTH / 2], offset: [cx, cy, 0] });
      }
      const mesh = new Mesh(k.build(), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `letter-${ch}`;
      this.group.add(mesh);
      // Baris huruf melintang landasan; dibaca kiri→kanan dari pesawat yang menghadap arah lepas landas.
      const side = (i - (LETTERS.length - 1) / 2) * spacing;
      const pos = frame.onSurface(along, side, 0.03);
      _up.copy(pos).normalize();
      // Huruf menghadap pesawat (sumbu −Z huruf mengarah ke pesawat datang).
      const fwd = frame.forwardAt(along, side, _v).negate();
      const rot = quatFromUpForward(_up, fwd, new Quaternion());
      // Model huruf: depan (+Z) ke arah pesawat → putar 180° supaya terbaca.
      rot.multiply(_q.setFromAxisAngle(_v.set(0, 1, 0), Math.PI));
      const prop = new Prop(physics, gravity, mesh, pos, rot, {
        mass: MASS,
        material: 'wood',
        shapes,
        friction: 0.35,
        restitution: 0.3,
        soundThreshold: 1,
      });
      // Tidur sampai disentuh, supaya tetap rapi di tempat.
      prop.body.sleep();
      this.letters.push({ char: ch, prop, restTime: 0, returning: false, t: 0, fromPos: new Vector3(), fromRot: new Quaternion() });
    });
  }

  private displaced(l: Letter): boolean {
    const t = l.prop.body.translation();
    _v.set(t.x, t.y, t.z);
    if (_v.distanceTo(l.prop.home) > 0.35) return true;
    const r = l.prop.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return _q.angleTo(l.prop.homeRot) > 0.2;
  }

  update(dt: number): void {
    for (const l of this.letters) {
      const body = l.prop.body;
      if (l.returning) {
        // Melayang kembali: naik, berayun, lalu turun pas di tempat (easing pegas).
        l.t = Math.min(1, l.t + dt / RETURN_TIME);
        const t = l.t;
        const e = 1 - Math.pow(1 - t, 3);
        const overshoot = Math.sin(t * Math.PI) * 1.6;
        _up.copy(l.prop.home).normalize();
        _v.lerpVectors(l.fromPos, l.prop.home, e).addScaledVector(_up, overshoot);
        _q.slerpQuaternions(l.fromRot, l.prop.homeRot, Math.min(1, e * 1.15));
        body.setNextKinematicTranslation(_v);
        body.setNextKinematicRotation(_q);
        if (t >= 1) {
          l.returning = false;
          body.setBodyType(this.physics.R.RigidBodyType.Dynamic, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          body.sleep();
          bus.emit('letters:restored', { letter: l.char });
        }
        continue;
      }
      const displaced = this.displaced(l);
      const resting = l.prop.speed < 0.25 || body.isSleeping();
      const far = l.prop.home.distanceTo(_v) > 60;
      if (displaced && (resting || far)) l.restTime += dt;
      else l.restTime = 0;
      if (l.restTime > (far ? 5 : RETURN_DELAY)) this.startReturn(l);
    }
  }

  private startReturn(l: Letter): void {
    const t = l.prop.body.translation();
    const r = l.prop.body.rotation();
    l.fromPos.set(t.x, t.y, t.z);
    l.fromRot.set(r.x, r.y, r.z, r.w);
    l.returning = true;
    l.t = 0;
    l.restTime = 0;
    l.prop.body.setBodyType(this.physics.R.RigidBodyType.KinematicPositionBased, true);
  }

  /** Kembalikan semua huruf sekarang (misalnya untuk tes). */
  returnAll(): void {
    for (const l of this.letters) if (!l.returning && this.displaced(l)) this.startReturn(l);
  }

  /** Jumlah huruf yang sedang tidak di tempat. */
  get scatteredCount(): number {
    return this.letters.filter((l) => l.returning || this.displaced(l)).length;
  }
}
