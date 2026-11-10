/**
 * Partikel ber-pool (debu, asap, percikan, daun, cipratan, konfeti) — satu InstancedMesh, satu draw call.
 * Tanpa alokasi saat emisi: slot partikel dipakai ulang secara melingkar.
 */
import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, Quaternion, Vector3, type Scene } from 'three';
import { Kit, ico } from '../utils/modeling/Kit';
import { createToonMaterial } from '../utils/modeling/materials';
import type { Vec3Like } from '../core/EventBus';

interface P {
  alive: boolean;
  pos: Vector3;
  vel: Vector3;
  life: number;
  max: number;
  size0: number;
  size1: number;
  drag: number;
  gravity: number;
  spin: number;
  rot: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _up = new Vector3();
const _axis = new Vector3(0.3, 1, 0.2).normalize();
const _c = new Color();
const _r = new Vector3();

export class Particles {
  readonly mesh: InstancedMesh;
  private readonly pool: P[] = [];
  private cursor = 0;
  private capacity: number;

  constructor(
    scene: Scene,
    private readonly maxCapacity = 480,
    capacity = 320,
  ) {
    const geo = new Kit().add(ico(0.5, 0), '#FFFFFF').build();
    const mat = createToonMaterial({ rim: false });
    this.mesh = new InstancedMesh(geo, mat, maxCapacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'particles';
    for (let i = 0; i < maxCapacity; i++) {
      this.pool.push({
        alive: false,
        pos: new Vector3(),
        vel: new Vector3(),
        life: 0,
        max: 1,
        size0: 0.3,
        size1: 0,
        drag: 1,
        gravity: 0,
        spin: 0,
        rot: 0,
      });
      this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, _c.set('#ffffff'));
    }
    this.capacity = Math.min(capacity, maxCapacity);
    this.mesh.count = this.capacity;
    scene.add(this.mesh);
  }

  setCapacity(n: number): void {
    this.capacity = Math.min(n, this.maxCapacity);
    this.mesh.count = this.capacity;
    this.cursor = this.cursor % this.capacity;
  }

  /** Satu partikel. `spread` = kecepatan acak tambahan. */
  emit(
    pos: Vec3Like,
    vel: Vec3Like,
    color: string,
    opts: { life?: number; size?: number; sizeEnd?: number; drag?: number; gravity?: number; spread?: number } = {},
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const p = this.pool[i]!;
    const spread = opts.spread ?? 0;
    p.alive = true;
    p.pos.set(pos.x, pos.y, pos.z);
    _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(spread * 2);
    p.vel.set(vel.x, vel.y, vel.z).add(_r);
    p.life = 0;
    p.max = (opts.life ?? 0.8) * (0.8 + Math.random() * 0.4);
    p.size0 = (opts.size ?? 0.3) * (0.8 + Math.random() * 0.4);
    p.size1 = opts.sizeEnd ?? 0;
    p.drag = opts.drag ?? 1.5;
    p.gravity = opts.gravity ?? 0;
    p.spin = (Math.random() - 0.5) * 8;
    p.rot = Math.random() * 6;
    this.mesh.setColorAt(i, _c.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Semburan beberapa partikel dari satu titik. */
  burst(
    pos: Vec3Like,
    count: number,
    colors: readonly string[],
    opts: { speed?: number; up?: Vec3Like; upSpeed?: number; life?: number; size?: number; drag?: number; gravity?: number } = {},
  ): void {
    const speed = opts.speed ?? 3;
    for (let k = 0; k < count; k++) {
      _up.set(0, 0, 0);
      if (opts.up) _up.set(opts.up.x, opts.up.y, opts.up.z).multiplyScalar(opts.upSpeed ?? 0);
      this.emit(pos, _up, colors[k % colors.length]!, {
        life: opts.life ?? 0.9,
        size: opts.size ?? 0.3,
        sizeEnd: 0,
        drag: opts.drag ?? 2,
        gravity: opts.gravity ?? 0,
        spread: speed,
      });
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i]!;
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        continue;
      }
      // Gravitasi radial (ke pusat planet) dan hambatan.
      if (p.gravity !== 0) {
        _up.copy(p.pos).normalize();
        p.vel.addScaledVector(_up, -p.gravity * dt);
      }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.spin * dt;
      const t = p.life / p.max;
      // Muncul cepat (pegas kecil) lalu mengecil.
      const grow = Math.min(1, t * 6);
      const size = (p.size0 + (p.size1 - p.size0) * t) * grow;
      _q.setFromAxisAngle(_axis, p.rot);
      _s.setScalar(Math.max(0, size));
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
