/**
 * Sirkuit Langit (docs/02 bagian 3.11, docs/09 bagian 4): 24 cincin di sepanjang lingkaran besar yang miring
 * 35° dan melewati atas bandara, ketinggian 22–60. Gerbang start dekat bandara. Cincin berikutnya menyala;
 * melewatkan cincin = lap tidak sah. Waktu lap lokal + lap terbaik tersimpan (leaderboard & hantu: Fase 4).
 */
import { Group, Mesh, Quaternion, Vector3 } from 'three';
import { PALETTE } from '../../config/palette';
import { AIRPORT, PLANET_RADIUS } from '../../config/world';
import { store } from '../../core/Store';
import { bus } from '../../core/EventBus';
import { patchProgress, progress } from '../../game/Progress';
import { tr } from '../../i18n';
import { DEG2RAD } from '../../utils/math';
import { bearingDirection, latLonToVec3 } from '../../utils/geo';
import { Kit, box, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial } from '../../utils/modeling/materials';
import { quatFromUpForward } from '../../utils/quat';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import type { ZoneDeps } from './ZoneKit';

export const CIRCUIT_RINGS = 24;
export const CIRCUIT_INCLINATION = 35;
const RING_R = 5;
/** Waktu fisik minimum yang masuk akal (detik) — dipakai juga oleh anti-curang server. */
export const MIN_LAP_SECONDS = 25;

export interface CircuitState {
  racing: boolean;
  next: number;
  total: number;
  time: number;
  best: number | null;
  invalid: boolean;
  last: number | null;
  /** Cap waktu tiap cincin (detik) untuk dikirim ke server. */
  splits: number[];
  countdown: number;
}

export const circuit = store<CircuitState>({ racing: false, next: 0, total: CIRCUIT_RINGS, time: 0, best: null, invalid: false, last: null, splits: [], countdown: 0 });

interface CRing {
  center: Vector3;
  normal: Vector3;
  quat: Quaternion;
  prevSide: number;
}

const _v = new Vector3();
const _q = new Quaternion();

/** Titik ke-k pada lingkaran besar sirkuit (dipakai juga untuk autopilot tes). */
export function circuitPoint(theta: number, out = new Vector3()): Vector3 {
  const p0 = latLonToVec3(AIRPORT.lat, AIRPORT.lon, 1);
  const heading = Math.asin(Math.min(1, Math.cos(CIRCUIT_INCLINATION * DEG2RAD) / Math.cos(AIRPORT.lat * DEG2RAD))) / DEG2RAD;
  const d0 = bearingDirection(p0, heading);
  const alt = 41 + Math.sin(theta * 3 + 0.4) * 19;
  return out
    .copy(p0)
    .multiplyScalar(Math.cos(theta))
    .addScaledVector(d0, Math.sin(theta))
    .normalize()
    .multiplyScalar(PLANET_RADIUS + Math.max(22, Math.min(60, alt)));
}

export class SkyCircuit extends Zone {
  private readonly rings: CRing[] = [];
  private startT = 0;
  private lastPassTime = 0;
  private board: Billboard | null = null;
  private glow: Mesh | null = null;

  constructor() {
    super('sky-circuit');
    this.icon = '🏁';
    this.color = '#FFC93C';
    this.triggerRadius = 28;
    // Rute keliling planet: dibangun sejak awal (24 cincin ringan) dan selalu di-update.
    this.buildRadius = Infinity;
    this.updateRadius = Infinity;
    this.renderRadius = Infinity;
    this.cullDetail = false;
  }

  locate(_deps: ZoneDeps): void {
    circuitPoint(0.035, this.center);
    this.poi.copy(this.center).setLength(this.center.length() + 10);
    circuit.update((c) => ({ ...c, best: progress.get().bestLap }));
  }

  /** Cincin: aktif selalu (rute keliling planet), jarak pemicu ke gerbang start. */
  protected build(): void {
    const mat = this.deps.material;
    const all = new Kit();
    const holder = new Group();
    for (let i = 0; i < CIRCUIT_RINGS; i++) {
      const theta = 0.035 + (i / CIRCUIT_RINGS) * Math.PI * 2;
      const c = circuitPoint(theta);
      const ahead = circuitPoint(theta + 0.01);
      const normal = ahead.clone().sub(c).normalize();
      const g = new Group();
      const k = new Kit();
      k.add(torus(RING_R, 0.35, 8, 32), i === 0 ? '#FFFFFF' : i % 2 ? PALETTE.sun : '#E5484D', {});
      if (i === 0) for (let s = 0; s < 12; s++) k.add(box(0.7, 0.7, 0.72), s % 2 ? PALETTE.ink : '#FFFFFF', { pos: [Math.cos((s / 12) * Math.PI * 2) * RING_R, Math.sin((s / 12) * Math.PI * 2) * RING_R, 0] });
      // Semua cincin digabung jadi satu mesh (1 draw call); satu "glow" dipindah ke cincin berikutnya.
      const up = c.clone().normalize();
      holder.position.copy(c);
      holder.quaternion.copy(quatFromUpForward(up, normal, _q));
      holder.updateMatrix();
      all.addPainted(k.build(), holder.matrix);
      this.rings.push({ center: c, normal, quat: holder.quaternion.clone(), prevSide: 0 });
      void g;
    }
    this.group.add(new Mesh(all.build(), mat));
    this.glow = new Mesh(torus(RING_R, 0.8, 6, 28), createUnlitMaterial('#FFF1A8', { transparent: true, opacity: 0.55 }));
    this.group.add(this.glow);
    this.board = new Billboard(() => tr('zones.circuit.board', { best: fmt(progress.get().bestLap) }), { width: 9, height: 1.8, bg: 'rgba(43,45,66,0.9)', color: '#FFC93C', fontSize: 70 });
    this.boards.push(this.board);
    this.board.object.position.copy(this.center).addScaledVector(_v.copy(this.center).normalize(), RING_R + 3);
    this.group.add(this.board.object);
  }

  /** Sirkuit keliling planet: selalu di-update supaya cincin bisa dilewati di mana saja. */
  override distanceTo(p: Vector3): number {
    return p.distanceTo(this.center);
  }

  override update(t: ZoneTick): void {
    const st = circuit.get();
    if (st.countdown > 0) {
      const before = Math.ceil(st.countdown);
      const cd = Math.max(0, st.countdown - t.dt);
      if (Math.ceil(cd) !== before && cd > 0) bus.emit('toast', { text: `${Math.ceil(cd)}…`, kind: 'info', icon: '🏁' });
      circuit.set({ ...st, countdown: cd });
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i]!;
      _v.copy(t.planePos).sub(r.center);
      const side = Math.sign(_v.dot(r.normal));
      const lateral = _v.addScaledVector(r.normal, -_v.dot(r.normal)).length();
      if (r.prevSide < 0 && side > 0 && lateral < RING_R + 0.6) this.pass(i, t.time);
      r.prevSide = side;
    }
    if (this.glow) {
      const r = this.rings[st.racing ? st.next % CIRCUIT_RINGS : 0]!;
      this.glow.position.copy(r.center);
      this.glow.quaternion.copy(r.quat);
      this.glow.scale.setScalar(1 + Math.sin(t.time * 6) * 0.06);
    }
    if (st.racing) circuit.set({ ...circuit.get(), time: t.time - this.startT });
  }

  private pass(i: number, time: number): void {
    const st = circuit.get();
    if (i === 0) {
      if (st.racing && st.next >= CIRCUIT_RINGS && !st.invalid) {
        const lap = time - this.startT;
        const best = st.best == null || lap < st.best ? lap : st.best;
        if (best === lap && lap > MIN_LAP_SECONDS) patchProgress((p) => (p.bestLap = lap));
        circuit.set({ ...st, racing: false, last: lap, best, time: lap });
        bus.emit('toast', { text: tr(best === lap ? 'zones.circuit.newBest' : 'zones.circuit.lap', { time: fmt(lap) }), kind: 'success', icon: '🏆' });
        bus.emit('interact', { zone: this.id, action: `lap:${lap.toFixed(2)}` });
        this.board?.redraw();
        return;
      }
      // Mulai lap baru.
      this.startT = time;
      this.lastPassTime = time;
      circuit.set({ ...st, racing: true, next: 1, time: 0, invalid: false, splits: [0], countdown: 0 });
      bus.emit('toast', { text: tr('zones.circuit.go'), kind: 'info', icon: '🏁' });
      bus.emit('ring:passed', { index: 0, total: CIRCUIT_RINGS, label: 'start' });
      return;
    }
    if (!st.racing) return;
    if (i !== st.next) {
      if (i > st.next && !st.invalid) {
        circuit.set({ ...st, invalid: true });
        bus.emit('toast', { text: tr('zones.circuit.missed'), kind: 'warn', icon: '⚠️' });
      }
      return;
    }
    const split = time - this.startT;
    circuit.set({ ...st, next: i + 1, splits: [...st.splits, split] });
    this.lastPassTime = time;
    bus.emit('ring:passed', { index: i, total: CIRCUIT_RINGS, label: 'circuit' });
  }

  override action(): ZoneAction {
    return { label: 'actions.viewCircuit', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}

export function fmt(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
}
