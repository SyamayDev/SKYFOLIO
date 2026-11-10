/**
 * Arus Perjalanan (docs/02 bagian 3.7): pita angin di atas khatulistiwa (34 unit di atas laut) yang mengalir
 * ke timur mulai dari meridian Medan. Gerbang melayang per item timeline, urut dari yang terlama; tahun hanya
 * tampil bila sudah terkonfirmasi. Di dalam arus pesawat mendapat angin buritan + bantuan tetap di jalur
 * (gaya fisika sungguhan, bisa dilawan).
 */
import { Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { PALETTE } from '../../config/palette';
import { HOME, PLANET_RADIUS } from '../../config/world';
import { L, content } from '../../content';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { DEG2RAD, RAD2DEG } from '../../utils/math';
import { latLonToVec3 } from '../../utils/geo';
import { Kit, box, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial } from '../../utils/modeling/materials';
import { quatFromUpForward } from '../../utils/quat';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import type { ZoneDeps } from './ZoneKit';

export const STREAM_ALT = 34;
const STREAM_R = PLANET_RADIUS + STREAM_ALT;
const TUBE = 6;
const GATE_SPACING = 9;
const STREAKS = 220;
const ICONS: Record<string, string> = {
  'graduation-cap': '🎓',
  trophy: '🏆',
  briefcase: '💼',
  users: '👥',
  school: '🏫',
};

interface Gate {
  id: string;
  lon: number;
  center: Vector3;
  normal: Vector3;
  passed: boolean;
  prevSide: number;
  mesh: Mesh;
  flash: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _e = new Vector3();
const _s = new Vector3(1, 1, 1);

export class JourneyStream extends Zone {
  private startLon = HOME.lon;
  private endLon = HOME.lon + 40;
  private readonly gates: Gate[] = [];
  private streaks: InstancedMesh | null = null;
  private readonly streakT: number[] = [];
  private readonly streakOff: [number, number][] = [];

  constructor() {
    super('journey-stream');
    this.icon = '🌬️';
    this.color = '#9FD8F5';
    this.triggerRadius = TUBE + 4;
    this.buildRadius = 360;
    this.updateRadius = 260;
    this.renderRadius = 600;
  }

  locate(_deps: ZoneDeps): void {
    const items = this.items();
    this.endLon = this.startLon + GATE_SPACING * (items.length + 1);
    latLonToVec3(0, this.startLon + GATE_SPACING * 0.5, STREAM_R, this.center);
    this.poi.copy(this.center).setLength(STREAM_R + 10);
  }

  /** Item timeline urut kronologis (yang terlama dulu). Item tanpa tahun menjaga urutan relatifnya. */
  private items(): ReturnType<typeof content.get>['timeline']['items'] {
    return [...content.get().timeline.items].reverse();
  }

  /** Jarak ke tabung arus (bukan ke satu titik). */
  override distanceTo(p: Vector3): number {
    const r = p.length();
    const lat = Math.asin(p.y / r) * RAD2DEG;
    let lon = Math.atan2(p.x, p.z) * RAD2DEG;
    if (lon < this.startLon - 180) lon += 360;
    const lonC = Math.max(this.startLon - 3, Math.min(this.endLon, lon));
    const along = (lon - lonC) * DEG2RAD * STREAM_R;
    const lateral = Math.sin(lat * DEG2RAD) * STREAM_R;
    return Math.hypot(r - STREAM_R, lateral, along);
  }

  protected build(): void {
    const items = this.items();
    const mat = this.deps.material;
    items.forEach((it, i) => {
      const lon = this.startLon + GATE_SPACING * (i + 1);
      const center = latLonToVec3(0, lon, STREAM_R);
      const up = center.clone().normalize();
      const east = new Vector3(0, 1, 0).cross(up).normalize();
      const g = new Group();
      const k = new Kit();
      k.add(torus(TUBE - 0.5, 0.45, 8, 32), i % 2 ? PALETTE.sun : '#3AA0FF', {});
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        k.add(box(0.5, 0.5, 0.5), '#FFFFFF', { pos: [Math.cos(a) * (TUBE - 0.5), Math.sin(a) * (TUBE - 0.5), 0], rot: [0, 0, a] });
      }
      const ring = new Mesh(k.build(), mat);
      ring.castShadow = false;
      g.add(ring);
      const year = [it.start, it.end].filter(Boolean).join(' – ');
      const label = new Billboard(() => `${ICONS[it.checkpointIcon ?? ''] ?? '⭐'} ${year ? `${year} · ` : ''}${L(it.title)}`, {
        width: 10,
        height: 1.5,
        bg: 'rgba(255,246,230,0.95)',
        fontSize: 60,
      });
      this.boards.push(label);
      label.object.position.set(0, TUBE + 2, 0);
      g.add(label.object);
      g.position.copy(center);
      g.quaternion.copy(quatFromUpForward(up, east, _q));
      this.group.add(g);
      this.gates.push({ id: it.id, lon, center, normal: east, passed: false, prevSide: 0, mesh: ring, flash: 0 });
    });
    // Coretan angin yang mengalir sepanjang tabung.
    const sk = new Kit().add(box(0.12, 0.12, 2.6), '#FFFFFF', {});
    const sm = new MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    this.streaks = new InstancedMesh(sk.build(), sm, STREAKS);
    this.streaks.frustumCulled = false;
    for (let i = 0; i < STREAKS; i++) {
      this.streakT.push(Math.random());
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (TUBE - 0.8);
      this.streakOff.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    this.group.add(this.streaks);
    // Pintu masuk: busur tipis bercahaya.
    const entry = new Mesh(torus(TUBE + 0.6, 0.15, 6, 40), createUnlitMaterial('#BDE8FF', { transparent: true, opacity: 0.6 }));
    const c0 = latLonToVec3(0, this.startLon, STREAM_R);
    entry.position.copy(c0);
    const up0 = c0.clone().normalize();
    entry.quaternion.copy(quatFromUpForward(up0, new Vector3(0, 1, 0).cross(up0), _q));
    this.group.add(entry);
  }

  override update(t: ZoneTick): void {
    if (this.streaks) {
      const span = this.endLon - this.startLon + 3;
      for (let i = 0; i < STREAKS; i++) {
        this.streakT[i] = (this.streakT[i]! + t.dt * (0.012 + (i % 5) * 0.002)) % 1;
        const lon = this.startLon - 3 + this.streakT[i]! * span;
        const [ox, oy] = this.streakOff[i]!;
        latLonToVec3(0, lon, 1, _v);
        _e.set(0, 1, 0).cross(_v).normalize();
        const p = _v.clone().multiplyScalar(STREAM_R + oy);
        p.y += ox;
        _q.copy(quatFromUpForward(_v, _e, _q));
        _m.compose(p, _q, _s);
        this.streaks.setMatrixAt(i, _m);
      }
      this.streaks.instanceMatrix.needsUpdate = true;
    }
    for (const g of this.gates) {
      _v.copy(t.planePos).sub(g.center);
      const side = Math.sign(_v.dot(g.normal));
      const lateral = _v.addScaledVector(g.normal, -_v.dot(g.normal)).length();
      if (g.prevSide !== 0 && side !== g.prevSide && lateral < TUBE) {
        g.flash = 1;
        this.passGate(g);
      }
      g.prevSide = side;
      if (g.flash > 0) g.flash = Math.max(0, g.flash - t.dt);
      g.mesh.scale.setScalar(1 + g.flash * 0.2);
      g.mesh.rotation.z += t.dt * 0.3;
    }
  }

  private passGate(g: Gate): void {
    const it = content.get().timeline.items.find((x) => x.id === g.id);
    if (!it) return;
    const year = [it.start, it.end].filter(Boolean).join(' – ');
    bus.emit('toast', { text: `${year ? `${year} · ` : ''}${L(it.title)}${it.org ? ` — ${it.org}` : ''}`, kind: 'info', icon: ICONS[it.checkpointIcon ?? ''] ?? '⭐' });
    const sum = L(it.summary);
    if (sum) bus.emit('piko:say', { text: sum, mood: 'happy', priority: 2 });
    if (!g.passed) {
      g.passed = true;
      bus.emit('interact', { zone: this.id, action: `gate:${g.id}` });
      if (this.gates.every((x) => x.passed)) {
        bus.emit('interact', { zone: this.id, action: 'journey-complete' });
        bus.emit('toast', { text: tr('zones.journey.complete'), kind: 'success', icon: '🧭' });
      }
    }
  }

  /**
   * Angin buritan + koreksi lembut ke sumbu tabung. Mengembalikan impuls (massa × Δv) untuk satu frame,
   * atau null bila di luar arus.
   */
  assist(pos: Vector3, vel: Vector3, dt: number, mass: number, out: Vector3): Vector3 | null {
    if (this.distanceTo(pos) > TUBE) return null;
    const r = pos.length();
    _v.copy(pos).divideScalar(r);
    _e.set(0, 1, 0).cross(_v).normalize();
    const along = vel.dot(_e);
    out.copy(_e).multiplyScalar(Math.max(0, 52 - along) * 0.6);
    out.addScaledVector(_v, (STREAM_R - r) * 0.8);
    out.y += -pos.y * 0.8;
    return out.multiplyScalar(mass * dt);
  }

  override action(): ZoneAction {
    return { label: 'actions.viewJourney', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }

  override dispose(): void {
    this.streaks?.geometry.dispose();
    super.dispose();
  }
}
