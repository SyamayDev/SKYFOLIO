/**
 * Tiga cincin latihan sesudah landasan: naik, belok kiri, boost (docs/02 bagian 3.1).
 * Lolos cincin = bunyi "ding" bernada naik, cincin berkedip hijau, konfeti, toast.
 */
import { Color, Group, Mesh, Quaternion, Vector3, type Material } from 'three';
import { PALETTE } from '../../config/palette';
import { bus } from '../../core/EventBus';
import { Kit, torus } from '../../utils/modeling/Kit';
import { quatFromUpForward } from '../../utils/quat';
import type { AirportFrame } from '../AirportLayout';
import { Billboard } from '../Billboard';
import type { I18nKey } from '../../i18n';

interface RingDef {
  along: number;
  side: number;
  height: number;
  label: I18nKey;
}

export const RING_DEFS: RingDef[] = [
  { along: 34, side: 0, height: 9, label: 'rings.climb' },
  { along: 58, side: -12, height: 15, label: 'rings.turn' },
  { along: 70, side: -40, height: 17, label: 'rings.boost' },
];

const RADIUS = 3.4;

interface Ring {
  group: Group;
  mesh: Mesh;
  center: Vector3;
  normal: Vector3;
  passed: boolean;
  flash: number;
  prevSide: number;
  label: Billboard;
}

const _d = new Vector3();
const _hit = new Vector3();

export class TrainingRings {
  readonly group = new Group();
  readonly rings: Ring[] = [];
  private passedCount = 0;
  private readonly baseColor = new Color(PALETTE.sun);
  private readonly doneColor = new Color(PALETTE.leaf);

  constructor(material: Material, frame: AirportFrame) {
    this.group.name = 'training-rings';
    let prev = frame.onSurface(20, 0, 3);
    RING_DEFS.forEach((def, i) => {
      const center = frame.onSurface(def.along, def.side, def.height);
      const up = center.clone().normalize();
      const normal = center.clone().sub(prev);
      normal.addScaledVector(up, -normal.dot(up) * 0.7).normalize();
      // Cincin: torus kuning dengan garis biru (setiap ring punya material sendiri untuk efek kedip).
      const k = new Kit();
      k.add(torus(RADIUS, 0.32, 8, 28), PALETTE.sun, { jitter: 0.03 });
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        k.add(torus(0.36, 0.06, 4, 10), PALETTE.sky, {
          pos: [Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0],
          rot: [0, Math.PI / 2, a],
        });
      }
      const mesh = new Mesh(k.build(), material);
      mesh.name = `ring-${i}`;
      mesh.castShadow = true;
      const g = new Group();
      g.position.copy(center);
      // Torus di bidang XY → sumbu Z = normal cincin.
      const q = quatFromUpForward(up, normal, new Quaternion());
      g.quaternion.copy(q);
      g.add(mesh);
      const label = new Billboard(def.label, { width: 4.2, height: 1.2, fontSize: 92, color: PALETTE.ink, bg: 'rgba(255,246,230,0.92)' });
      label.object.position.set(0, RADIUS + 1.4, 0);
      g.add(label.object);
      this.group.add(g);
      this.rings.push({ group: g, mesh, center, normal, passed: false, flash: 0, prevSide: NaN, label });
      prev = center;
    });
  }

  /** Cek lintasan pesawat melewati bidang cincin di dalam radius. */
  update(dt: number, planePos: Vector3, time: number): void {
    for (const [i, r] of this.rings.entries()) {
      _d.copy(planePos).sub(r.center);
      const side = _d.dot(r.normal);
      if (!Number.isNaN(r.prevSide) && Math.sign(side) !== Math.sign(r.prevSide) && Math.abs(side) < 8) {
        // Titik potong ≈ posisi sekarang diproyeksikan ke bidang cincin.
        _hit.copy(_d).addScaledVector(r.normal, -side);
        if (_hit.length() < RADIUS + 0.3 && r.prevSide < 0) this.pass(i, r);
      }
      r.prevSide = side;
      // Animasi: berputar pelan, berdenyut saat dilewati.
      r.mesh.rotation.z += dt * 0.25;
      r.flash = Math.max(0, r.flash - dt * 1.8);
      const pop = 1 + Math.sin(r.flash * Math.PI) * 0.18;
      r.group.scale.setScalar(pop);
      r.label.object.position.y = RADIUS + 1.4 + Math.sin(time * 2 + i) * 0.15;
    }
  }

  private pass(i: number, r: Ring): void {
    r.flash = 1;
    if (!r.passed) {
      r.passed = true;
      this.passedCount++;
      this.recolor(r, this.doneColor);
    }
    bus.emit('ring:passed', { index: i, total: this.rings.length, label: RING_DEFS[i]!.label });
  }

  private recolor(r: Ring, c: Color): void {
    const col = r.mesh.geometry.attributes.color;
    if (!col) return;
    // Hanya warna utama (kuning) yang diganti; garis biru tetap.
    const arr = col.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      if (Math.abs(arr[i]! - this.baseColor.r) < 0.12 && Math.abs(arr[i + 1]! - this.baseColor.g) < 0.12) {
        arr[i] = c.r;
        arr[i + 1] = c.g;
        arr[i + 2] = c.b;
      }
    }
    col.needsUpdate = true;
  }

  get allPassed(): boolean {
    return this.passedCount >= this.rings.length;
  }

  refreshLabels(): void {
    for (const r of this.rings) r.label.redraw();
  }

  dispose(): void {
    for (const r of this.rings) {
      r.mesh.geometry.dispose();
      r.label.dispose();
    }
  }
}
