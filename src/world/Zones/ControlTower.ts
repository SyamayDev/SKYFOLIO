/**
 * Menara Kontrol: Tentang Aril (docs/02 bagian 3.2). Menara tinggi dengan piringan radar berputar,
 * lampu suar, dinding bingkai foto (foto dari content/media bila ada), dan papan profil dari content/.
 * Saat mendekat, "radio ATC" membacakan bio Aril (teks/subtitle; suara di Fase 2).
 */
import { Group, Mesh, TextureLoader, type Texture } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { PALETTE } from '../../config/palette';
import { L, content } from '../../content';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { Kit, box, cone, cyl, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial } from '../../utils/modeling/materials';
import { Billboard, roundRect } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addStatic, infoBoard, makeMesh, type ZoneDeps } from './ZoneKit';

export class ControlTower extends Zone {
  private frame!: SurfaceFrame;
  private readonly radarDish = new Group();
  private beacon: Mesh | null = null;
  private atcDone = false;
  private photos: Texture[] = [];
  private photoMat: MeshBasicNodeMaterial | null = null;
  private photoIdx = 0;
  private photoTimer = 0;

  constructor() {
    super('control-tower');
    this.icon = '🗼';
    this.color = '#3AA0FF';
    this.triggerRadius = 24;
  }

  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    this.frame = new SurfaceFrame(z?.lat ?? 3.85, z?.lon ?? 98.35, 200, deps.planet);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, 30, 0));
    deps.scatter.addExclusion(this.frame.dir, 16);
  }

  protected build(): void {
    const mat = this.deps.material;
    const f = this.frame;
    const tower = new Group();
    const k = new Kit();
    // Gedung dasar + menara + kabin kaca segi delapan.
    k.add(rbox(7, 2.4, 5, 0.3), PALETTE.cream, { pos: [0, 1.2, 0], jitter: 0.02 });
    k.add(box(7.4, 0.25, 5.4), '#2F8FA6', { pos: [0, 2.5, 0] });
    for (let i = -2; i <= 2; i++) k.add(rbox(0.8, 0.9, 0.08, 0.1), '#9FD8F5', { pos: [i * 1.3, 1.4, -2.52] });
    k.add(cyl(1.25, 1.55, 13, 10), '#F4E7CD', { pos: [0, 8.9, 0], jitter: 0.02 });
    for (let y = 4; y < 15; y += 2.5) k.add(torus(1.42 - (y - 4) * 0.018, 0.08, 4, 14), '#E5484D', { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
    k.add(cyl(2.6, 2.2, 0.5, 8), PALETTE.cream, { pos: [0, 15.6, 0] });
    k.add(cyl(2.55, 2.55, 2.3, 8), '#9FD8F5', { pos: [0, 17.05, 0] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      k.add(box(0.14, 2.3, 0.14), PALETTE.ink, { pos: [Math.cos(a) * 2.5, 17.05, Math.sin(a) * 2.5] });
    }
    k.add(cyl(2.9, 2.6, 0.35, 8), '#2F8FA6', { pos: [0, 18.35, 0] });
    k.add(cone(2.2, 1.4, 8), '#E5484D', { pos: [0, 19.2, 0] });
    k.add(cyl(0.12, 0.12, 2.2, 6), PALETTE.ink, { pos: [0, 20.9, 0] });
    tower.add(makeMesh(k, mat, 'tower'));
    // Piringan radar berputar.
    const rk = new Kit();
    rk.add(cyl(0.12, 0.12, 0.9, 6), PALETTE.ink, { pos: [0, 0.45, 0] });
    rk.add(rbox(2.6, 0.12, 0.2, 0.05), '#C9CED6', { pos: [0, 1.0, 0] });
    rk.add(sphere(0.9, 10, 6).scale(1, 1, 0.35), '#E9EDF2', { pos: [0.9, 1.2, 0], rot: [0, Math.PI / 2, 0] });
    this.radarDish.add(makeMesh(rk, mat, 'radar'));
    this.radarDish.position.set(1.6, 18.5, 0);
    tower.add(this.radarDish);
    const beacon = new Mesh(sphere(0.32, 8, 6), createUnlitMaterial('#7CFFB0'));
    beacon.position.set(0, 22.1, 0);
    this.beacon = beacon;
    tower.add(beacon);
    f.place(tower, 0, 0);
    this.group.add(tower);
    this.bodies.push(
      addStatic(this.deps.physics, tower, [
        { half: [3.5, 1.3, 2.5], offset: [0, 1.2, 0] },
        { half: [1.5, 6.5, 1.5], offset: [0, 8.9, 0] },
        { half: [2.7, 1.9, 2.7], offset: [0, 17.1, 0] },
      ], 'metal'),
    );

    // Papan profil.
    const c = content.get();
    const board = infoBoard(
      () => c.profile.name,
      () => `${L(c.profile.tagline)}\n${L(c.profile.education.program)} · ${c.profile.education.campus}\n${c.profile.hometown.city}\n${tr('zones.board.openPanel')}`,
      { width: 9, height: 4.8, accent: '#3AA0FF' },
    );
    this.boards.push(board);
    const bg = new Group();
    bg.add(board.object);
    board.object.position.set(0, 3.9, 0);
    const pk = new Kit();
    for (const s of [-1, 1]) pk.add(cyl(0.12, 0.12, 4, 6), '#8A6A4A', { pos: [s * 3.8, 1.9, -0.1] });
    bg.add(makeMesh(pk, mat, 'board-posts'));
    f.place(bg, -9, -6, 0, 20);
    this.group.add(bg);

    // Dinding bingkai foto (foto profil/galeri bila ada; placeholder bergambar bila belum).
    const wall = new Group();
    const wk = new Kit();
    wk.add(rbox(7.2, 4.6, 0.4, 0.2), '#8B5A3C', { pos: [0, 3.2, 0] });
    wk.add(box(0.3, 1.4, 0.3), '#5E3A26', { pos: [-3, 0.6, 0] });
    wk.add(box(0.3, 1.4, 0.3), '#5E3A26', { pos: [3, 0.6, 0] });
    wall.add(makeMesh(wk, mat, 'photo-wall'));
    const imgs = [c.profilePhoto, ...c.gallery].filter((x): x is NonNullable<typeof x> => !!x);
    const pm = new MeshBasicNodeMaterial({ color: 0xffffff });
    this.photoMat = pm;
    if (imgs.length) {
      const loader = new TextureLoader();
      for (const im of imgs.slice(0, 8)) {
        loader.load(im.src.replace(/-\d+\.(\w+)\.webp$/, (m) => m), (tex) => {
          this.photos.push(tex);
          if (this.photos.length === 1) {
            pm.map = tex;
            pm.needsUpdate = true;
          }
        });
      }
    } else {
      const ph = new Billboard(() => c.profile.nickname, {
        width: 6.4,
        height: 3.8,
        sprite: false,
        draw: (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#4DB8FF');
          grad.addColorStop(1, '#FFC93C');
          g.fillStyle = grad;
          roundRect(g, 0, 0, w, h, 30);
          g.fill();
          g.fillStyle = '#FFF6E6';
          g.font = `700 ${h * 0.42}px Fredoka, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(`✈ ${c.profile.nickname}`, w / 2, h * 0.45);
          g.font = `600 ${h * 0.1}px "Nunito Sans", sans-serif`;
          g.fillText(tr('zones.tower.photoSoon'), w / 2, h * 0.8);
        },
      });
      this.boards.push(ph);
      ph.object.position.set(0, 3.2, 0.22);
      wall.add(ph.object);
    }
    if (imgs.length) {
      const pic = new Mesh(box(6.4, 3.8, 0.02), pm);
      pic.position.set(0, 3.2, 0.22);
      wall.add(pic);
    }
    f.place(wall, 9, -5, 0, -25);
    this.group.add(wall);
    this.bodies.push(addStatic(this.deps.physics, wall, [{ half: [3.6, 2.3, 0.25], offset: [0, 3.2, 0] }], 'wood'));
  }

  override update(t: ZoneTick): void {
    this.radarDish.rotation.y += t.dt * 1.6;
    if (this.beacon) this.beacon.visible = Math.sin(t.time * 3) > -0.3 || !t.night;
    if (this.photos.length > 1 && this.photoMat) {
      this.photoTimer += t.dt;
      if (this.photoTimer > 6) {
        this.photoTimer = 0;
        this.photoIdx = (this.photoIdx + 1) % this.photos.length;
        this.photoMat.map = this.photos[this.photoIdx]!;
        this.photoMat.needsUpdate = true;
      }
    }
  }

  override onEnter(): void {
    if (this.atcDone) return;
    this.atcDone = true;
    const c = content.get();
    bus.emit('piko:say', {
      text: tr('zones.tower.atc', { name: c.profile.name, nick: c.profile.nickname, tagline: L(c.profile.tagline), campus: c.profile.education.campus }),
      mood: 'happy',
      priority: 3,
    });
  }

  override action(): ZoneAction {
    return { label: 'actions.viewProfile', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }

  override dispose(): void {
    for (const p of this.photos) p.dispose();
    this.photoMat?.dispose();
    super.dispose();
  }
}
