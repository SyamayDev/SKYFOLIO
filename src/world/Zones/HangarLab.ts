/**
 * Hangar Eksperimen & Kawah Nekat (docs/02 bagian 3.9): pulau gunung api di Selat Sunda dengan kepulan asap
 * dan cahaya lava saat malam, hangar berisi "mesin aneh" (proyek bertag `experiment`; mesin generik bila
 * belum ada), dan kawah yang bisa diterjuni → layar memutih, counter global (Fase 4), muncul lagi di bandara.
 */
import { Group, Mesh, Vector3 } from 'three';
import { PALETTE } from '../../config/palette';
import { content } from '../../content';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { Kit, box, cyl, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial } from '../../utils/modeling/materials';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addStatic, buildIsland, infoBoard, makeMesh, type ZoneDeps } from './ZoneKit';

const VOLCANO_R = 22;
const VOLCANO_H = 16;
const _v = new Vector3();
const _up = new Vector3();

export class HangarLab extends Zone {
  private frame!: SurfaceFrame;
  private lava: Mesh | null = null;
  private readonly gizmos: Group[] = [];
  private readonly crater = new Vector3();
  private smokeT = 0;
  private diveCooldown = 0;
  private counterBoard: Billboard | null = null;
  /** Jumlah penerjun global (dari /api/counters; null = offline). */
  craterCount: number | null = null;

  constructor() {
    super('hangar-lab');
    this.icon = '🌋';
    this.color = '#FF9248';
    this.triggerRadius = 40;
  }

  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    this.frame = new SurfaceFrame(z?.lat ?? -6.1, z?.lon ?? 105.42, 30, deps.planet, 0);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, VOLCANO_H + 22, 0));
    this.crater.copy(this.frame.point(0, VOLCANO_H - 3, 0));
    deps.scatter.addExclusion(this.frame.dir, VOLCANO_R + 6);
  }

  protected build(): void {
    const f = this.frame;
    const mat = this.deps.material;
    const isl = buildIsland(f, this.deps, { radius: VOLCANO_R, height: VOLCANO_H, seed: 1883, plateau: 0.08, crater: 0.2, grass: '#5FA65A' });
    this.group.add(isl.mesh);
    this.colliders.push(isl.collider);
    const lava = new Mesh(cyl(VOLCANO_R * 0.17, VOLCANO_R * 0.17, 0.2, 16), createUnlitMaterial('#FF7A2E'));
    f.place(lava, 0, 0, VOLCANO_H - 5.2, 0, 0);
    this.lava = lava;
    this.group.add(lava);

    // Hangar eksperimen di kaki gunung.
    const hangar = new Group();
    const k = new Kit();
    k.add(cyl(5, 5, 12, 16, false), '#9AA3AE', { pos: [0, 0, 0], rot: [0, 0, Math.PI / 2], scale: [1, 1, 1] });
    k.add(box(12.2, 0.4, 10.4), '#5B6170', { pos: [0, -0.2, 0] });
    hangar.add(makeMesh(k, mat, 'lab-hangar'));
    f.place(hangar, VOLCANO_R * 0.62, -2, -0.6, 0, 0);
    hangar.position.addScaledVector(_up.copy(hangar.position).normalize(), 0.5);
    this.group.add(hangar);
    this.bodies.push(addStatic(this.deps.physics, hangar, [{ half: [6, 3.6, 4.8], offset: [0, 1.4, 0] }], 'metal'));
    const exp = content.get().projects.filter((p) => p.tags.includes('experiment'));
    const label = new Billboard(() => (exp.length ? exp.map((p) => p.title).join(' · ') : tr('zones.lab.machines')), { width: 9, height: 1.3, bg: PALETTE.sun, fontSize: 64 });
    this.boards.push(label);
    label.object.position.set(0, 6.2, 0);
    hangar.add(label.object);
    // Mesin aneh berputar-putar di depan hangar.
    for (let i = 0; i < 3; i++) {
      const g = new Group();
      const gk = new Kit();
      gk.add(rbox(1.6, 1.6, 1.6, 0.3), ['#B48CFF', '#3AA0FF', '#3DCB7A'][i]!, { pos: [0, 0.8, 0] });
      gk.add(torus(1.3, 0.12, 4, 16), PALETTE.sun, { pos: [0, 2.2, 0] });
      gk.add(sphere(0.35, 8, 6), '#E5484D', { pos: [1.3, 2.2, 0] });
      g.add(makeMesh(gk, mat, 'gizmo'));
      f.place(g, VOLCANO_R * 0.62 - 4 + i * 4, 7, 0, 0, 0);
      g.position.setLength(g.position.length() + 0.9);
      this.group.add(g);
      this.gizmos.push(g);
    }
    // Papan counter di bibir kawah.
    this.counterBoard = infoBoard(
      () => tr('zones.lab.crater'),
      () => (this.craterCount == null ? tr('zones.lab.counterOffline') : tr('zones.lab.counter', { n: this.craterCount })),
      { width: 7, height: 3.6, accent: '#FF9248', sprite: true },
    );
    this.boards.push(this.counterBoard);
    this.counterBoard.object.position.copy(f.point(0, VOLCANO_H + 8, -VOLCANO_R * 0.32));
    this.group.add(this.counterBoard.object);
  }

  setCraterCount(n: number | null): void {
    this.craterCount = n;
    this.counterBoard?.redraw();
  }

  override update(t: ZoneTick): void {
    if (this.lava) {
      const s = 1 + Math.sin(t.time * 2) * 0.05;
      this.lava.scale.set(s, 1, s);
    }
    this.gizmos.forEach((g, i) => g.children[0]!.rotateY(t.dt * (1 + i)));
    // Kepulan asap dari kawah.
    this.smokeT -= t.dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.12;
      _up.copy(this.crater).normalize();
      _v.copy(this.crater).addScaledVector(_up, 2);
      this.deps.particles.emit(_v, _up.clone().multiplyScalar(3.5), t.night ? '#7A6A68' : '#C9C3C0', { life: 3.2, size: 1.6, sizeEnd: 3.2, drag: 0.4, spread: 0.8 });
      if (t.night && Math.random() < 0.3) this.deps.particles.emit(_v, _up.clone().multiplyScalar(5), '#FF9248', { life: 1, size: 0.4, spread: 1.4, gravity: 3 });
    }
    // Terjun ke kawah.
    this.diveCooldown -= t.dt;
    if (this.diveCooldown <= 0 && t.planePos.distanceTo(this.crater) < VOLCANO_R * 0.22) {
      this.diveCooldown = 6;
      bus.emit('interact', { zone: this.id, action: 'crater-dive' });
    }
  }

  override action(): ZoneAction {
    return { label: 'actions.viewLab', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}
