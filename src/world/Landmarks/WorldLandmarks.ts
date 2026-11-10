/**
 * Landmark dunia (docs/02 bagian 4) dari content/world/landmarks.json: versi low-poly "terinspirasi"
 * (bukan replika, tanpa logo/papan komersial), diperbesar supaya terbaca dari udara, collider kuboid
 * sederhana. Kunjungan pertama (lewat dalam radius kecil) memberi stempel paspor bonus. Landmark
 * `flyUnder` punya pemicu di bawah bentang untuk achievement "Kolong Jembatan".
 * Istana Maimun & Masjid Raya sudah ada di plaza Bandara Medan (HomeAirport) — di sini hanya pemicunya.
 */
import type { Mesh} from 'three';
import { Group, Vector3, type Material } from 'three';
import { PALETTE } from '../../config/palette';
import { AIRPORT, PLANET_RADIUS } from '../../config/world';
import { content } from '../../content';
import { detailCuller } from '../DetailCuller';
import { bus } from '../../core/EventBus';
import { addStamp } from '../../game/Progress';
import { AirportFrame } from '../AirportLayout';
import { Kit, box, cone, cyl, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { SurfaceFrame, addStatic, makeMesh, type StaticBox, type ZoneDeps } from '../Zones/ZoneKit';

interface Model {
  kit: Kit;
  boxes: StaticBox[];
  /** Titik di bawah bentang (lokal) untuk pemicu kolong jembatan. */
  under?: [number, number, number];
  /** Tinggi kira-kira (unit) untuk radius kunjungan. */
  height: number;
}

const GOLD = '#F2C14E';
const LANDMARK_SCALE = 0.62;
const STONE = '#D9C7A3';

function build(id: string): Model | null {
  const k = new Kit();
  const boxes: StaticBox[] = [];
  switch (id) {
    case 'monas': {
      k.add(box(8, 1.2, 8), STONE, { pos: [0, 0.6, 0] });
      k.add(box(5, 2.2, 5), '#F4E7CD', { pos: [0, 2.3, 0] });
      k.add(cyl(0.9, 1.4, 16, 4), '#F4F4F4', { pos: [0, 11, 0], rot: [0, Math.PI / 4, 0] });
      k.add(cyl(1.6, 1.0, 0.8, 8), '#E9E4DA', { pos: [0, 19.4, 0] });
      k.add(cone(0.9, 2.6, 6), GOLD, { pos: [0, 21.1, 0] });
      boxes.push({ half: [4, 1.7, 4], offset: [0, 1.7, 0] }, { half: [1.2, 8.5, 1.2], offset: [0, 11, 0] });
      return { kit: k, boxes, height: 22 };
    }
    case 'borobudur': {
      for (let i = 0; i < 6; i++) k.add(box(18 - i * 2.8, 1.4, 18 - i * 2.8), i % 2 ? '#8E8790' : '#9C8F86', { pos: [0, 0.7 + i * 1.4, 0], jitter: 0.03 });
      for (let r = 0; r < 3; r++) {
        const n = 8 + r * 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rad = 2.6 + r * 1.6;
          k.add(sphere(0.55, 8, 6), '#A89A8C', { pos: [Math.cos(a) * rad, 9.2 + (2 - r) * 0.9, Math.sin(a) * rad], scale: [1, 1.2, 1] });
        }
      }
      k.add(sphere(1.6, 10, 8), '#A89A8C', { pos: [0, 11.6, 0], scale: [1, 1.15, 1] });
      k.add(cone(0.4, 2, 6), '#A89A8C', { pos: [0, 13.6, 0] });
      boxes.push({ half: [9, 2.2, 9], offset: [0, 2.2, 0] }, { half: [5, 5, 5], offset: [0, 5, 0] });
      return { kit: k, boxes, height: 14 };
    }
    case 'ampera-bridge':
    case 'golden-bridge': {
      const red = id === 'ampera-bridge' ? '#D9363E' : '#E0562B';
      const span = id === 'ampera-bridge' ? 22 : 30;
      k.add(box(span, 0.8, 4), red, { pos: [0, 6, 0] });
      for (const s of [-1, 1]) {
        const x = (s * span) / 4;
        k.add(box(1.4, 18, 1.4), red, { pos: [x, 9, -1.6] });
        k.add(box(1.4, 18, 1.4), red, { pos: [x, 9, 1.6] });
        k.add(box(1.6, 1, 4.6), red, { pos: [x, 17.2, 0] });
        if (id === 'ampera-bridge') k.add(box(1.6, 1, 4.6), red, { pos: [x, 12, 0] });
        for (const side of [-1.8, 1.8]) {
          // Kabel utama melengkung (beberapa segmen).
          for (let i = 0; i < 8; i++) {
            const t0 = i / 8;
            const t1 = (i + 1) / 8;
            const xa = x - span / 4 + t0 * (span / 2);
            const xb = x - span / 4 + t1 * (span / 2);
            const ya = 17 - Math.sin(t0 * Math.PI) * 9;
            const yb = 17 - Math.sin(t1 * Math.PI) * 9;
            const len = Math.hypot(xb - xa, yb - ya);
            k.add(cyl(0.12, 0.12, len, 4), PALETTE.ink, { pos: [(xa + xb) / 2, (ya + yb) / 2, side], rot: [0, 0, Math.atan2(yb - ya, xb - xa) - Math.PI / 2] });
          }
        }
      }
      boxes.push({ half: [span / 2, 0.4, 2], offset: [0, 6, 0] });
      for (const s of [-1, 1]) boxes.push({ half: [0.7, 9, 2.4], offset: [(s * span) / 4, 9, 0] });
      return { kit: k, boxes, under: [0, 2.6, 0], height: 18 };
    }
    case 'eiffel-like': {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        k.add(cyl(0.35, 0.6, 12, 4), '#8B6B4A', { pos: [Math.cos(a) * 3, 5.5, Math.sin(a) * 3], rot: [Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28] });
      }
      k.add(box(7, 0.6, 7), '#8B6B4A', { pos: [0, 6, 0] });
      k.add(cyl(0.4, 1.6, 14, 4), '#8B6B4A', { pos: [0, 13, 0], rot: [0, Math.PI / 4, 0] });
      k.add(box(3.4, 0.5, 3.4), '#8B6B4A', { pos: [0, 12, 0] });
      k.add(cone(0.4, 4, 4), '#8B6B4A', { pos: [0, 22, 0] });
      boxes.push({ half: [3.5, 3, 3.5], offset: [0, 3, 0] }, { half: [1.2, 8, 1.2], offset: [0, 14, 0] });
      return { kit: k, boxes, under: [0, 2, 0], height: 24 };
    }
    case 'clock-tower-like': {
      k.add(box(3.4, 16, 3.4), '#C9A66B', { pos: [0, 8, 0], jitter: 0.02 });
      k.add(box(4, 4, 4), '#B8935A', { pos: [0, 17, 0] });
      for (let i = 0; i < 4; i++) k.add(cyl(1.4, 1.4, 0.2, 16), '#FFF6E6', { pos: [Math.sin((i * Math.PI) / 2) * 2.05, 17, Math.cos((i * Math.PI) / 2) * 2.05], rot: [Math.PI / 2, 0, (i * Math.PI) / 2] });
      k.add(cone(2.6, 6, 4), '#3B4A5A', { pos: [0, 22, 0], rot: [0, Math.PI / 4, 0] });
      boxes.push({ half: [2, 10, 2], offset: [0, 10, 0] });
      return { kit: k, boxes, height: 25 };
    }
    case 'colosseum-like': {
      const n = 28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const h = i < n * 0.7 ? 7 : 4;
        k.add(box(2.2, h, 1.2), i % 2 ? '#D9B48A' : '#CFA67A', { pos: [Math.cos(a) * 9, h / 2, Math.sin(a) * 6.5], rot: [0, -a + Math.PI / 2, 0] });
      }
      k.add(cyl(7, 7, 0.4, 20), '#C9B79C', { pos: [0, 0.2, 0], scale: [1.2, 1, 0.85] });
      boxes.push({ half: [9, 3.5, 6.5], offset: [0, 3.5, 0] });
      return { kit: k, boxes, height: 8 };
    }
    case 'pyramids': {
      for (const [x, z, s] of [
        [0, 0, 1],
        [12, 6, 0.8],
        [21, 11, 0.55],
      ] as [number, number, number][]) {
        k.add(cone(9 * s, 12 * s, 4), '#E3B86F', { pos: [x, 6 * s, z], rot: [0, Math.PI / 4, 0], jitter: 0.03 });
        boxes.push({ half: [5 * s, 4 * s, 5 * s], offset: [x, 4 * s, z] });
      }
      return { kit: k, boxes, height: 12 };
    }
    case 'tall-tower-dubai-like': {
      for (let i = 0; i < 7; i++) k.add(cyl(2.4 - i * 0.3, 2.6 - i * 0.3, 5, 6), '#C9D6E6', { pos: [0, 2.5 + i * 5, 0], jitter: 0.02 });
      k.add(cone(0.5, 10, 6), '#E9EDF2', { pos: [0, 40, 0] });
      boxes.push({ half: [2.2, 18, 2.2], offset: [0, 18, 0] });
      return { kit: k, boxes, height: 45 };
    }
    case 'taj-like': {
      k.add(box(16, 1, 16), '#F4F0E8', { pos: [0, 0.5, 0] });
      k.add(rbox(9, 7, 9, 0.4), '#FFFFFF', { pos: [0, 4.5, 0] });
      k.add(sphere(3.6, 14, 10), '#FFFFFF', { pos: [0, 9.4, 0], scale: [1, 1.2, 1] });
      k.add(cone(0.3, 2.4, 6), GOLD, { pos: [0, 14.2, 0] });
      for (const [x, z] of [
        [-7, -7],
        [7, -7],
        [7, 7],
        [-7, 7],
      ] as [number, number][]) {
        k.add(cyl(0.6, 0.7, 11, 8), '#FFFFFF', { pos: [x, 6, z] });
        k.add(sphere(0.9, 8, 6), '#FFFFFF', { pos: [x, 12, z] });
      }
      boxes.push({ half: [4.5, 4, 4.5], offset: [0, 4.5, 0] });
      return { kit: k, boxes, height: 14 };
    }
    case 'great-wall': {
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * 5;
        const y = Math.sin(i * 0.9) * 1.6 + 2;
        k.add(box(5.2, 2.4, 1.6), '#B9A07E', { pos: [x, y, Math.sin(i * 0.6) * 2], rot: [0, Math.cos(i * 0.6) * 0.3, 0] });
        if (i % 3 === 0) k.add(box(2.4, 4.4, 2.4), '#A88D6A', { pos: [x, y + 1, Math.sin(i * 0.6) * 2] });
      }
      boxes.push({ half: [22, 2, 2], offset: [0, 2.2, 0] });
      return { kit: k, boxes, height: 6 };
    }
    case 'fuji': {
      k.add(cone(20, 22, 12), '#7E8FA6', { pos: [0, 11, 0], jitter: 0.04 });
      k.add(cone(7.4, 8, 12), PALETTE.snow, { pos: [0, 18.4, 0], jitter: 0.02 });
      boxes.push({ half: [12, 9, 12], offset: [0, 9, 0] });
      return { kit: k, boxes, height: 22 };
    }
    case 'opera-shells': {
      k.add(box(16, 1.4, 8), '#D9C7A3', { pos: [0, 0.7, 0] });
      for (let i = 0; i < 5; i++) {
        k.add(sphere(3.4 - i * 0.3, 10, 6), '#FFFFFF', { pos: [-6 + i * 3, 3.2, 0], scale: [0.6, 1.6, 1], rot: [0, 0, -0.5] });
      }
      boxes.push({ half: [8, 2.4, 4], offset: [0, 2.4, 0] });
      return { kit: k, boxes, height: 8 };
    }
    case 'liberty-like': {
      k.add(box(6, 4, 6), '#C9B79C', { pos: [0, 2, 0] });
      k.add(cyl(1.4, 2, 7, 8), '#7CC5A8', { pos: [0, 7.5, 0] });
      k.add(sphere(1.1, 10, 8), '#7CC5A8', { pos: [0, 11.8, 0] });
      for (let i = 0; i < 7; i++) k.add(cone(0.25, 1.2, 4), '#7CC5A8', { pos: [Math.cos((i / 7) * Math.PI * 2) * 1, 12.8, Math.sin((i / 7) * Math.PI * 2) * 1] });
      k.add(cyl(0.3, 0.3, 4, 6), '#7CC5A8', { pos: [1.6, 12.4, 0], rot: [0, 0, -0.25] });
      k.add(cone(0.6, 1.2, 8), GOLD, { pos: [2.1, 14.9, 0] });
      boxes.push({ half: [3, 2, 3], offset: [0, 2, 0] }, { half: [1.6, 4.5, 1.6], offset: [0, 8, 0] });
      return { kit: k, boxes, height: 15 };
    }
    case 'machu-like': {
      for (let i = 0; i < 5; i++) k.add(box(18 - i * 3, 1.6, 10 - i * 1.2), i % 2 ? '#7CB06A' : '#6FA45E', { pos: [0, 0.8 + i * 1.6, 0] });
      for (let i = 0; i < 7; i++) {
        k.add(box(1.8, 1.4, 1.8), '#9C8F86', { pos: [-6 + i * 2, 9, (i % 2) * 2 - 1] });
        k.add(cone(1.5, 1.2, 4), '#8B6B4A', { pos: [-6 + i * 2, 10.3, (i % 2) * 2 - 1], rot: [0, Math.PI / 4, 0] });
      }
      k.add(cone(4, 12, 7), '#5F8F52', { pos: [12, 6, 4] });
      boxes.push({ half: [9, 4, 5], offset: [0, 4, 0] });
      return { kit: k, boxes, height: 12 };
    }
    default:
      return null;
  }
}

interface Placed {
  id: string;
  center: Vector3;
  radius: number;
  under: Vector3 | null;
  underCooldown: number;
}

export class WorldLandmarks {
  readonly group = new Group();
  private readonly placed: Placed[] = [];
  private builtIds = new Set<string>();
  private timer = 0;

  constructor(private readonly deps: ZoneDeps) {
    this.group.name = 'landmarks';
    const af = new AirportFrame();
    for (const lm of content.get().landmarks.landmarks) {
      if (lm.id === 'istana-maimun' || lm.id === 'masjid-raya-medan') {
        // Model ada di plaza bandara (HomeAirport).
        const p = af.toWorld(lm.id === 'istana-maimun' ? 11 : 16.5, lm.id === 'istana-maimun' ? 11.2 : 11.6, AIRPORT.elevation + 3);
        this.placed.push({ id: lm.id, center: p, radius: 14, under: null, underCooldown: 0 });
        continue;
      }
      const f = new SurfaceFrame(lm.lat, lm.lon, 0, deps.planet, 0);
      const r = 30 * lm.scale;
      this.placed.push({ id: lm.id, center: f.origin.clone(), radius: r, under: null, underCooldown: 0 });
      deps.scatter.addExclusion(f.dir, 18 * lm.scale);
    }
  }

  private buildOne(id: string): void {
    const lm = content.get().landmarks.landmarks.find((x) => x.id === id);
    if (!lm) return;
    const m = build(id);
    if (!m) return;
    const f = new SurfaceFrame(lm.lat, lm.lon, id === 'ampera-bridge' ? 0 : 90, this.deps.planet, 0);
    const holder = new Group();
    const mesh: Mesh = makeMesh(m.kit, this.deps.material as Material, `landmark-${id}`);
    holder.add(mesh);
    // Skala dunia mainan: cukup besar untuk terlihat dari udara, tidak menenggelamkan kota di sekitarnya.
    const sc = lm.scale * LANDMARK_SCALE;
    holder.scale.setScalar(sc);
    f.place(holder, 0, 0, -0.3, 0, Math.max(0.6, f.ground));
    this.group.add(holder);
    detailCuller.add(holder, 260, 4);
    addStatic(this.deps.physics, holder, m.boxes.map((b) => ({ half: b.half.map((v) => v * sc) as [number, number, number], offset: b.offset?.map((v) => v * sc) as [number, number, number] | undefined })), 'rock');
    const p = this.placed.find((x) => x.id === id);
    if (p && m.under) {
      holder.updateMatrixWorld();
      p.under = new Vector3(...m.under).applyMatrix4(holder.matrixWorld);
    }
  }

  update(dt: number, planePos: Vector3): void {
    this.timer += dt;
    for (const p of this.placed) {
      const d = planePos.distanceTo(p.center);
      if (!this.builtIds.has(p.id) && d < 360) {
        this.builtIds.add(p.id);
        this.buildOne(p.id);
      }
      if (d < p.radius && addStamp(`landmark:${p.id}`)) {
        bus.emit('landmark:visit', { id: p.id, first: true });
        bus.emit('stamp', { id: `landmark:${p.id}`, kind: 'landmark' });
      }
      if (p.under) {
        p.underCooldown -= dt;
        if (p.underCooldown <= 0 && planePos.distanceTo(p.under) < 4.5) {
          p.underCooldown = 5;
          bus.emit('interact', { zone: 'landmark', action: `under:${p.id}` });
        }
      }
    }
  }

  /** Posisi landmark (tujuan autopilot Piko). */
  position(id: string): Vector3 | null {
    const p = this.placed.find((x) => x.id === id);
    return p ? p.center.clone().setLength(p.center.length() + 14) : null;
  }
}

void torus;
void PLANET_RADIUS;
