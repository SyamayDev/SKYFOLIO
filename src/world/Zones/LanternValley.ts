/**
 * Lembah Lampion Danau Toba (docs/02 bagian 3.4): dermaga, perahu kecil yang terapung, lampion melayang di
 * atas danau (contoh lokal sampai API Fase 4 aktif), dan kunang-kunang saat malam.
 * Lampion pengunjung dari /api/lanterns diisi lewat `setLanterns()`.
 */
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { PALETTE } from '../../config/palette';
import { PLANET_RADIUS, TOBA } from '../../config/world';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { mulberry32 } from '../../utils/rng';
import { Kit, box, cone, cyl, rbox } from '../../utils/modeling/Kit';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addStatic, makeMesh, type ZoneDeps } from './ZoneKit';

export interface LanternData {
  id: string;
  text: string;
  country: string;
  seed: number;
  sample?: boolean;
}

const MAX_LANTERNS = 32;
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3();

export class LanternValley extends Zone {
  private frame!: SurfaceFrame;
  private lanterns: InstancedMesh | null = null;
  private fireflies: InstancedMesh | null = null;
  private data: LanternData[] = [];
  private readonly boats: Group[] = [];
  private readonly flyPos: Vector3[] = [];
  private released: { t: number; pos: Vector3 } | null = null;
  private readonly releasedObj = new Group();
  private nearestTag: Billboard | null = null;
  private nearestId = '';

  constructor() {
    super('lantern-valley');
    this.icon = '🏮';
    this.color = '#FFB347';
    this.triggerRadius = 26;
  }

  locate(deps: ZoneDeps): void {
    this.frame = new SurfaceFrame(TOBA.lat, TOBA.lon, TOBA.axisDeg, deps.planet, TOBA.surfaceHeight);
    this.center.copy(this.frame.dir).multiplyScalar(PLANET_RADIUS + TOBA.surfaceHeight);
    this.poi.copy(this.frame.point(0, 26, 0));
    this.data = sampleLanterns();
  }

  protected build(): void {
    const mat = this.deps.material;
    const f = this.frame;
    const lake = PLANET_RADIUS + TOBA.surfaceHeight;
    // Dermaga di tepi timur laut danau.
    const pier = new Group();
    const k = new Kit();
    k.add(box(1.1, 0.2, 3.4), '#C98B55', { pos: [0, 0.35, 0], jitter: 0.04 });
    for (let z = -1.5; z <= 1.5; z += 1) for (const x of [-0.5, 0.5]) k.add(cyl(0.08, 0.08, 1.4, 6), '#8A6A4A', { pos: [x, -0.3, z] });
    k.add(cyl(0.05, 0.05, 1.3, 6), '#8A6A4A', { pos: [0.45, 1.0, -1.5] });
    k.add(cyl(0.2, 0.16, 0.35, 8), PALETTE.lantern, { pos: [0.45, 1.75, -1.5] });
    pier.add(makeMesh(k, mat, 'pier'));
    f.place(pier, -TOBA.semiMinorDeg * 7 * 0.72, 1.2, 0, 90, TOBA.surfaceHeight);
    this.group.add(pier);
    this.bodies.push(addStatic(this.deps.physics, pier, [{ half: [0.55, 0.1, 1.7], offset: [0, 0.35, 0] }], 'wood'));

    // Perahu kecil yang terapung.
    const rng = mulberry32(2024);
    for (let i = 0; i < 4; i++) {
      const b = new Group();
      const bk = new Kit();
      bk.add(rbox(0.7, 0.3, 1.6, 0.12), i % 2 ? '#2F8FA6' : '#E5484D', { pos: [0, 0.2, 0] });
      bk.add(box(0.56, 0.08, 1.4), '#C98B55', { pos: [0, 0.25, 0] });
      bk.add(cyl(0.03, 0.03, 1.3, 5), '#8A6A4A', { pos: [0, 0.85, 0] });
      bk.add(cone(0.5, 1.0, 3), PALETTE.cream, { pos: [0, 0.95, 0.12], scale: [0.15, 1, 1] });
      b.add(makeMesh(bk, mat, 'boat'));
      f.place(b, (rng() - 0.5) * 2.4, (rng() - 0.5) * 7, 0, rng() * 360, TOBA.surfaceHeight);
      this.group.add(b);
      this.boats.push(b);
    }

    // Lampion (instanced, bercahaya hangat — material tanpa cahaya supaya menyala di malam hari).
    const lk = new Kit();
    lk.add(cyl(0.42, 0.32, 0.9, 8), PALETTE.lantern, { pos: [0, 0.45, 0] });
    lk.add(cyl(0.44, 0.44, 0.08, 8), '#E8742E', { pos: [0, 0.92, 0] });
    lk.add(cyl(0.18, 0.18, 0.1, 6), '#FFE6A8', { pos: [0, -0.05, 0] });
    const lm = new MeshBasicNodeMaterial({ vertexColors: true });
    this.lanterns = new InstancedMesh(lk.build(), lm, MAX_LANTERNS);
    this.lanterns.name = 'lanterns';
    this.lanterns.frustumCulled = false;
    this.group.add(this.lanterns);

    // Kunang-kunang (kecil, hanya terlihat malam).
    const fk = new Kit().add(cone(0.08, 0.16, 4), '#E8FF8A');
    this.fireflies = new InstancedMesh(fk.build(), new MeshBasicNodeMaterial({ vertexColors: true }), 60);
    this.fireflies.frustumCulled = false;
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng());
      const x = Math.cos(a) * r * TOBA.semiMinorDeg * 8;
      const z = Math.sin(a) * r * TOBA.semiMajorDeg * 8;
      this.flyPos.push(f.dirAt(x, z).multiplyScalar(lake + 1 + rng() * 3));
    }
    this.group.add(this.fireflies);

    // Lampion yang baru dilepas pengunjung.
    const rk = new Kit();
    rk.add(cyl(0.6, 0.46, 1.3, 10), '#FFD27A', { pos: [0, 0.65, 0] });
    rk.add(cyl(0.62, 0.62, 0.1, 10), '#E8742E', { pos: [0, 1.32, 0] });
    this.releasedObj.add(makeMesh(rk, lm, 'released-lantern', false));
    this.releasedObj.visible = false;
    this.group.add(this.releasedObj);

    this.nearestTag = new Billboard(() => '', {
      width: 5,
      height: 1.4,
      draw: (g, w, h) => {
        const d = this.data.find((x) => x.id === this.nearestId);
        if (!d) return;
        g.fillStyle = 'rgba(43,45,66,0.82)';
        g.beginPath();
        g.roundRect(4, 4, w - 8, h - 8, 40);
        g.fill();
        g.fillStyle = '#FFF6E6';
        g.font = `700 ${h * 0.36}px Fredoka, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`${flag(d.country)} ${d.text}`, w / 2, h * 0.44, w - 40);
        if (d.sample) {
          g.font = `600 ${h * 0.18}px "Nunito Sans", sans-serif`;
          g.fillText(tr('zones.lantern.sample'), w / 2, h * 0.8);
        }
      },
    });
    this.boards.push(this.nearestTag);
    this.nearestTag.object.visible = false;
    this.group.add(this.nearestTag.object);
  }

  /** Posisi stabil lampion dari seed (di atas Danau Toba). */
  private lanternPos(seed: number, time: number, out: Vector3): Vector3 {
    const rng = mulberry32(seed);
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.8;
    const x = Math.cos(a) * r * TOBA.semiMinorDeg * 7;
    const z = Math.sin(a) * r * TOBA.semiMajorDeg * 7;
    const h = 4 + rng() * 9 + Math.sin(time * 0.6 + seed) * 0.5;
    return this.frame.dirAt(x + Math.sin(time * 0.2 + seed) * 0.6, z, out).multiplyScalar(PLANET_RADIUS + TOBA.surfaceHeight + h);
  }

  setLanterns(list: LanternData[]): void {
    this.data = list.length ? list.slice(0, MAX_LANTERNS) : sampleLanterns();
  }

  override update(t: ZoneTick): void {
    if (!this.lanterns || !this.fireflies) return;
    let best = Infinity;
    let bestId = '';
    this.data.forEach((d, i) => {
      this.lanternPos(d.seed, t.time, _p);
      _up.copy(_p).normalize();
      _q.setFromUnitVectors(new Vector3(0, 1, 0), _up);
      _s.setScalar(1 + Math.sin(t.time * 2 + i) * 0.04);
      _m.compose(_p, _q, _s);
      this.lanterns!.setMatrixAt(i, _m);
      const dd = _p.distanceTo(t.planePos);
      if (dd < best) {
        best = dd;
        bestId = d.id;
      }
    });
    this.lanterns.count = this.data.length;
    this.lanterns.instanceMatrix.needsUpdate = true;
    if (this.nearestTag) {
      const show = best < 14;
      this.nearestTag.object.visible = show;
      if (show) {
        const d = this.data.find((x) => x.id === bestId)!;
        this.lanternPos(d.seed, t.time, this.nearestTag.object.position).addScaledVector(_up.copy(this.nearestTag.object.position).normalize(), 2.2);
        if (bestId !== this.nearestId) {
          this.nearestId = bestId;
          this.nearestTag.redraw();
        }
      }
    }
    this.fireflies.visible = t.night;
    if (t.night) {
      this.flyPos.forEach((p, i) => {
        _p.copy(p).addScaledVector(_up.set(Math.sin(t.time * 1.3 + i), Math.cos(t.time * 0.9 + i * 2), Math.sin(t.time * 1.1 + i * 3)), 0.6);
        _m.makeTranslation(_p.x, _p.y, _p.z);
        const blink = Math.max(0, Math.sin(t.time * 3 + i * 1.7));
        _m.scale(_s.setScalar(0.4 + blink));
        this.fireflies!.setMatrixAt(i, _m);
      });
      this.fireflies.instanceMatrix.needsUpdate = true;
    }
    this.boats.forEach((b, i) => {
      b.rotateZ(Math.sin(t.time * 1.4 + i) * 0.0015);
    });
    if (this.released) {
      this.released.t += t.dt;
      _up.copy(this.released.pos).normalize();
      this.releasedObj.position.copy(this.released.pos).addScaledVector(_up, this.released.t * 2.2 + Math.sin(this.released.t * 2) * 0.3);
      this.releasedObj.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), _up);
      this.releasedObj.visible = this.released.t < 14;
      if (this.released.t > 14) this.released = null;
    }
  }

  /** Animasi lepas lampion (API simpan di Fase 4; dipanggil UI setelah menulis pesan). */
  releaseLantern(): void {
    this.released = { t: 0, pos: this.frame.point(0, 1.5, 0) };
    bus.emit('interact', { zone: this.id, action: 'release-lantern' });
  }

  override action(): ZoneAction {
    return { label: 'actions.releaseLantern', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }

  override dispose(): void {
    this.lanterns?.geometry.dispose();
    this.fireflies?.geometry.dispose();
    super.dispose();
  }
}

/** Bendera dari kode negara ISO (regional indicator). */
export function flag(cc: string): string {
  const c = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🏮';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Lampion contoh lokal (ditandai jelas sebagai contoh, docs/09 bagian 5). */
export function sampleLanterns(): LanternData[] {
  const texts = ['Selamat terbang!', 'Halo dari Medan', 'Semangat belajar', 'Hello, world!', 'Terima kasih', 'Fly high!', 'Salam dari Toba', 'Keep coding'];
  const countries = ['ID', 'ID', 'ID', 'US', 'ID', 'GB', 'ID', 'JP'];
  return texts.map((text, i) => ({ id: `sample-${i}`, text, country: countries[i]!, seed: 1000 + i * 37, sample: true }));
}

void Color;
