/**
 * Kota Kontribusi (docs/02 bagian 3.8): satu gedung per hari selama 53 minggu (grid 53×7), tinggi
 * log2(commit + 1) × 2,2, hijau muda → hijau tua, jendela menyala sebanding kontribusi saat malam.
 * Data dari `npm run sync:github` (butuh GITHUB_TOKEN). Tanpa data: lokasi konstruksi dengan crane berputar.
 */
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { PALETTE } from '../../config/palette';
import { PLANET_RADIUS } from '../../config/world';
import { content } from '../../content';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { Kit, box, cyl, rbox } from '../../utils/modeling/Kit';
import { quatFromUpForward } from '../../utils/quat';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addStatic, infoBoard, makeMesh, type ZoneDeps } from './ZoneKit';

export interface ContributionDay {
  date: string;
  count: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const CELL = 2.2;

export class ContributionCity extends Zone {
  private frame!: SurfaceFrame;
  private readonly cranes: Group[] = [];
  private days: ContributionDay[] = [];

  constructor() {
    super('contribution-city');
    this.icon = '🏙️';
    this.color = '#3DCB7A';
    this.triggerRadius = 55;
  }

  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    this.frame = new SurfaceFrame(z?.lat ?? -25, z?.lon ?? 134, 90, deps.planet);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, 32, 0));
    deps.scatter.addExclusion(this.frame.dir, 70);
    this.days = (content.get() as { contributions?: ContributionDay[] }).contributions ?? [];
  }

  protected build(): void {
    const f = this.frame;
    const mat = this.deps.material;
    const base = f.ground;
    if (this.days.length) this.buildCity(base);
    else this.buildConstruction(base);
    const board = infoBoard(
      () => tr('zones.city.title'),
      () => (this.days.length ? tr('zones.city.total', { n: this.days.reduce((a, d) => a + d.count, 0) }) : tr('zones.city.construction')),
      { width: 10, height: 4.4, accent: PALETTE.leaf },
    );
    this.boards.push(board);
    const bg = new Group();
    board.object.position.set(0, 4.4, 0);
    bg.add(board.object);
    const pk = new Kit();
    for (const s of [-1, 1]) pk.add(cyl(0.15, 0.15, 4.4, 6), '#8A6A4A', { pos: [s * 4.4, 2.2, -0.05] });
    bg.add(makeMesh(pk, mat, 'city-board'));
    f.place(bg, 0, 40, 0, 180, base);
    this.group.add(bg);
  }

  private buildCity(base: number): void {
    const k = new Kit().add(box(1.6, 1, 1.6), '#FFFFFF', { pos: [0, 0.5, 0] }).add(box(1.62, 0.3, 1.62), '#2B2D42', { pos: [0, 0.65, 0] });
    const mesh = new InstancedMesh(k.build(), this.deps.material, this.days.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const light = new Color('#CAFFBF');
    const dark = new Color('#2E8A5A');
    const max = Math.max(1, ...this.days.map((d) => d.count));
    this.days.forEach((d, i) => {
      const week = Math.floor(i / 7);
      const dow = i % 7;
      const x = (week - 26) * CELL;
      const z = (dow - 3) * CELL;
      const h = Math.max(0.25, Math.log2(d.count + 1) * 2.2);
      const dir = this.frame.dirAt(x, z, _p);
      const up = dir.clone();
      quatFromUpForward(up, this.frame.fwd, _q);
      _s.set(1, h, 1);
      _m.compose(dir.multiplyScalar(PLANET_RADIUS + base - 0.1), _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.copy(light).lerp(dark, Math.min(1, d.count / max)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
  }

  private buildConstruction(base: number): void {
    const f = this.frame;
    const mat = this.deps.material;
    // Pagar proyek + tumpukan balok + fondasi.
    const site = new Group();
    const k = new Kit();
    k.add(box(40, 0.4, 20), '#C9B79C', { pos: [0, 0.2, 0] });
    for (let i = -10; i <= 10; i++) {
      k.add(box(1.8, 1.4, 0.12), i % 2 ? PALETTE.sun : PALETTE.ink, { pos: [i * 2, 0.9, -10.5] });
      k.add(box(1.8, 1.4, 0.12), i % 2 ? PALETTE.sun : PALETTE.ink, { pos: [i * 2, 0.9, 10.5] });
    }
    for (let i = 0; i < 9; i++) k.add(rbox(1.4, 0.7, 3, 0.1), ['#E5484D', '#3AA0FF', '#3DCB7A'][i % 3]!, { pos: [-14 + (i % 3) * 1.6, 0.75 + Math.floor(i / 3) * 0.72, 4] });
    for (let i = 0; i < 6; i++) k.add(box(2, i * 1.1 + 1, 2), '#BFC9D6', { pos: [4 + i * 2.6, (i * 1.1 + 1) / 2 + 0.4, -3] });
    site.add(makeMesh(k, mat, 'construction'));
    f.place(site, 0, 0, 0, 0, base);
    this.group.add(site);
    this.bodies.push(addStatic(this.deps.physics, site, [{ half: [20, 0.2, 10], offset: [0, 0.2, 0] }], 'rock'));
    // Dua crane berputar.
    for (const [x, z] of [
      [-8, -4],
      [12, 5],
    ] as [number, number][]) {
      const crane = new Group();
      const ck = new Kit();
      ck.add(box(1, 18, 1), PALETTE.sun, { pos: [0, 9, 0] });
      ck.add(box(3, 1, 3), '#9AA3AE', { pos: [0, 0.5, 0] });
      crane.add(makeMesh(ck, mat, 'crane-mast'));
      const jib = new Group();
      const jk = new Kit();
      jk.add(box(16, 0.8, 0.8), PALETTE.sun, { pos: [4, 0, 0] });
      jk.add(box(2, 1.6, 1.6), PALETTE.ink, { pos: [-3.6, -0.4, 0] });
      jk.add(rbox(1.6, 1.2, 1.4, 0.2), '#9FD8F5', { pos: [0.4, -1, 0] });
      jk.add(cyl(0.04, 0.04, 6, 3), PALETTE.ink, { pos: [9, -3, 0] });
      jk.add(box(1.4, 0.6, 1.4), '#E5484D', { pos: [9, -6.2, 0] });
      jib.add(makeMesh(jk, mat, 'crane-jib'));
      jib.position.y = 18.4;
      crane.add(jib);
      f.place(crane, x, z, 0.4, 0, base);
      this.group.add(crane);
      this.cranes.push(jib);
      this.bodies.push(addStatic(this.deps.physics, crane, [{ half: [0.5, 9, 0.5], offset: [0, 9, 0] }], 'metal'));
    }
  }

  override update(t: ZoneTick): void {
    this.cranes.forEach((j, i) => (j.rotation.y += t.dt * (0.25 + i * 0.1) * (i % 2 ? -1 : 1)));
  }

  override action(): ZoneAction {
    return { label: 'actions.viewCity', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}
