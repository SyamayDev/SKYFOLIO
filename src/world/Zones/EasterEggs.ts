/**
 * Zona easter egg (docs/02 bagian 3.10) dari content/easter-eggs.json. Semua desain generik buatan sendiri
 * (tanpa nama/logo/karakter game atau merek):
 * - Panggung MC: mikrofon raksasa, lampu sorot mengikuti pesawat, tepuk tangan saat terbang rendah.
 * - Dapur Aril: kuali raksasa di atas tungku, bahan halal yang dijatuhkan ke kuali → uap + resep.
 * - Pulau Gym: barbel raksasa yang celahnya bisa diterbangi (papan PR), dumbel & rak beban fisika.
 * - Desa Benteng: tembok balok fisika yang roboh lalu tersusun lagi, balon air dari pesawat, ketapel.
 * - Taman Balok: karakter balok berjoget saat pesawat lewat, balok raksasa yang bisa ditumpuk/dirobohkan.
 */
import { ConeGeometry, Group, Mesh, Quaternion, Vector3, type Object3D } from 'three';
import { PALETTE } from '../../config/palette';
import { L, content } from '../../content';
import { bus } from '../../core/EventBus';
import { patchProgress, progress } from '../../game/Progress';
import { tr, type I18nKey } from '../../i18n';
import { Prop } from '../../physics/Props';
import { Kit, box, cone, cyl, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial } from '../../utils/modeling/materials';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addProp, addSensor, addStatic, buildIsland, infoBoard, makeMesh, type ZoneDeps } from './ZoneKit';

const _v = new Vector3();
const _up = new Vector3();
const _q = new Quaternion();

/** Zona permukaan sederhana: posisi dari zones.json, rangka lokal, papan info. */
abstract class SurfaceZone extends Zone {
  protected frame!: SurfaceFrame;
  constructor(
    id: string,
    icon: string,
    color: string,
    private readonly fallback: [number, number],
    private readonly exclusion = 30,
    private readonly floorOnSea = false,
  ) {
    super(id);
    this.icon = icon;
    this.color = color;
    this.triggerRadius = 32;
  }
  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    this.frame = new SurfaceFrame(z?.lat ?? this.fallback[0], z?.lon ?? this.fallback[1], 90, deps.planet, this.floorOnSea ? 0 : 0);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, 26, 0));
    deps.scatter.addExclusion(this.frame.dir, this.exclusion);
  }
  protected board(titleKey: I18nKey, bodyKey: I18nKey, x: number, z: number, yaw: number, accent: string): void {
    const b = infoBoard(() => tr(titleKey), () => tr(bodyKey), { width: 8, height: 4, accent });
    this.boards.push(b);
    const g = new Group();
    b.object.position.set(0, 3.4, 0);
    g.add(b.object);
    const pk = new Kit();
    for (const s of [-1, 1]) pk.add(cyl(0.12, 0.12, 3.4, 6), '#8A6A4A', { pos: [s * 3.5, 1.7, -0.05] });
    g.add(makeMesh(pk, this.deps.material, 'board'));
    this.frame.place(g, x, z, 0, yaw);
    this.group.add(g);
    this.bodies.push(addStatic(this.deps.physics, g, [{ half: [4, 2, 0.15], offset: [0, 3.4, 0] }], 'wood'));
  }
  protected put(obj: Object3D, x: number, z: number, y = 0, yaw = 0): Object3D {
    this.frame.place(obj, x, z, y, yaw);
    this.group.add(obj);
    return obj;
  }
  protected removeProp(p: Prop): void {
    this.deps.physics.removeSynced(p.synced);
    this.deps.gravity.remove(p.body);
    this.deps.physics.world.removeRigidBody(p.body);
    this.group.remove(p.object);
  }
  /** Jatuhkan benda fisika dari bawah pesawat dengan kecepatan pesawat. */
  protected drop(t: ZoneTick, obj: Group, half: [number, number, number], mass: number, material: 'wood' | 'rubber' | 'fabric'): Prop {
    _up.copy(t.planePos).normalize();
    obj.position.copy(t.planePos).addScaledVector(_up, -1.8);
    this.group.add(obj);
    const p = new Prop(this.deps.physics, this.deps.gravity, obj, obj.position, _q.identity(), { mass, material, shapes: [{ half }], restitution: 0.3 });
    p.body.setLinvel({ x: t.planeVel.x * 0.85, y: t.planeVel.y * 0.85, z: t.planeVel.z * 0.85 }, true);
    return p;
  }
}

// ------------------------------------------------------------------------------------ Panggung MC

export class McStage extends SurfaceZone {
  private readonly lights: Group[] = [];
  private applauseCd = 0;
  private mic: Group | null = null;
  constructor() {
    super('mc-stage', '🎤', '#B48CFF', [48.5, 9]);
  }
  protected build(): void {
    const mat = this.deps.material;
    const stage = new Group();
    const k = new Kit();
    k.add(rbox(18, 1.6, 10, 0.3), '#2B2D42', { pos: [0, 0.8, 0] });
    k.add(box(18.6, 0.4, 0.4), '#E5484D', { pos: [0, 10, 4.6] });
    for (const x of [-9, 9]) k.add(box(0.6, 10, 0.6), '#E5484D', { pos: [x, 5, 4.6] });
    k.add(box(17, 8, 0.2), '#6C7BD9', { pos: [0, 5.6, 4.9] });
    for (let i = 0; i < 7; i++) k.add(box(2.2, 0.2, 0.6), PALETTE.sun, { pos: [-7.2 + i * 2.4, 1.7, -4.6] });
    // Kursi penonton.
    for (let r = 0; r < 3; r++) for (let c = -5; c <= 5; c++) k.add(rbox(1, 0.9, 1, 0.15), r % 2 ? '#E5484D' : '#3AA0FF', { pos: [c * 1.6, 0.45, -9 - r * 2] });
    stage.add(makeMesh(k, mat, 'mc-stage'));
    this.put(stage, 0, 0);
    this.bodies.push(addStatic(this.deps.physics, stage, [{ half: [9, 0.8, 5], offset: [0, 0.8, 0] }, { half: [8.5, 4, 0.2], offset: [0, 5.6, 4.9] }], 'wood'));
    // Mikrofon raksasa.
    const mic = new Group();
    const mk = new Kit();
    mk.add(cyl(0.25, 0.25, 7, 8), '#C9CED6', { pos: [0, 3.5, 0] });
    mk.add(cyl(1.4, 1.6, 0.4, 12), PALETTE.ink, { pos: [0, 0.2, 0] });
    mk.add(sphere(1.3, 14, 10), '#9AA3AE', { pos: [0, 7.6, 0], scale: [1, 1.25, 1] });
    mk.add(torus(1.32, 0.12, 6, 18), PALETTE.ink, { pos: [0, 7.4, 0], rot: [Math.PI / 2, 0, 0] });
    mic.add(makeMesh(mk, mat, 'giant-mic'));
    this.put(mic, 0, 0, 1.6);
    this.mic = mic;
    this.bodies.push(addStatic(this.deps.physics, mic, [{ half: [0.3, 3.5, 0.3], offset: [0, 3.5, 0] }, { half: [1.3, 1.5, 1.3], offset: [0, 7.6, 0] }], 'metal'));
    for (const x of [-7, -2.5, 2.5, 7]) {
      const g = new Group();
      const lk = new Kit();
      lk.add(cyl(0.4, 0.6, 1.2, 8), PALETTE.ink, { rot: [Math.PI / 2, 0, 0] });
      g.add(makeMesh(lk, mat, 'spot'));
      const beam = new Mesh(new ConeGeometry(2.4, 26, 14, 1, true).translate(0, -13, 0).rotateX(-Math.PI / 2), createUnlitMaterial('#FFE6A8', { transparent: true, opacity: 0.14 }));
      g.add(beam);
      g.position.set(x, 10.4, 4.4);
      stage.add(g);
      this.lights.push(g);
    }
    this.board('zones.mc.title', 'zones.mc.body', 14, -6, -30, '#B48CFF');
  }
  override update(t: ZoneTick): void {
    for (const g of this.lights) g.lookAt(t.planePos);
    if (this.mic) this.mic.rotation.z = Math.sin(t.time * 1.2) * 0.02;
    this.applauseCd -= t.dt;
    if (this.applauseCd <= 0 && t.agl < 22 && t.planePos.distanceTo(this.center) < 26) {
      this.applauseCd = 12;
      bus.emit('toast', { text: tr('zones.mc.applause'), kind: 'success', icon: '👏' });
      bus.emit('interact', { zone: this.id, action: 'mc-applause' });
      bus.emit('piko:say', { text: tr('zones.mc.test'), mood: 'cheer', priority: 1 });
    }
  }
  override action(): ZoneAction {
    return { label: 'actions.viewMc', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}

// ------------------------------------------------------------------------------------ Dapur Aril

const INGREDIENTS = [
  { id: 'beef', color: '#B5463A', recipe: 'rendang' },
  { id: 'chicken', color: '#F2C48D', recipe: 'sate' },
  { id: 'lamb', color: '#C97A5E', recipe: 'steak' },
  { id: 'spice', color: '#E8A33D', recipe: 'rendang' },
  { id: 'chili', color: '#E5484D', recipe: 'sate' },
] as const;

export class ArilKitchen extends SurfaceZone {
  private readonly drops: { prop: Prop; age: number; ing: (typeof INGREDIENTS)[number] }[] = [];
  private nextIng = 0;
  private cooked: string[] = [];
  private steam = 0;
  private readonly wokTop = new Vector3();
  constructor() {
    super('aril-kitchen', '🍳', '#FF9248', [38.9, 35.2]);
  }
  protected build(): void {
    const mat = this.deps.material;
    const stove = new Group();
    const k = new Kit();
    k.add(rbox(10, 3, 10, 0.5), '#8B5A3C', { pos: [0, 1.5, 0] });
    k.add(cyl(4.6, 4.2, 0.4, 16), PALETTE.ink, { pos: [0, 3.2, 0] });
    // Kuali (setengah bola terbuka).
    const wokR = 5.4;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.add(box(3.6, 0.35, 0.5), '#3A3D4A', { pos: [Math.cos(a) * wokR * 0.75, 4.6, Math.sin(a) * wokR * 0.75], rot: [0, -a + Math.PI / 2, 0.9] });
    }
    k.add(cyl(wokR * 0.45, wokR * 0.45, 0.3, 14), '#3A3D4A', { pos: [0, 3.6, 0] });
    k.add(torus(wokR, 0.25, 6, 24), '#5D6673', { pos: [0, 5.9, 0], rot: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) k.add(rbox(1.8, 0.4, 0.6, 0.15), '#2B2D42', { pos: [s * (wokR + 0.9), 5.8, 0] });
    stove.add(makeMesh(k, mat, 'wok'));
    const fire = new Mesh(cone(3.4, 1.4, 10), createUnlitMaterial('#FF9248'));
    fire.position.set(0, 3.1, 0);
    stove.add(fire);
    this.put(stove, 0, 0);
    this.bodies.push(addStatic(this.deps.physics, stove, [{ half: [5, 1.5, 5], offset: [0, 1.5, 0] }], 'metal'));
    stove.updateMatrixWorld();
    this.wokTop.set(0, 6.5, 0).applyMatrix4(stove.matrixWorld);
    const inside = new Vector3(0, 4.4, 0).applyMatrix4(stove.matrixWorld);
    this.colliders.push(
      addSensor(this.deps.physics, inside, 3.2, (owner) => {
        const d = this.drops.find((x) => x.prop === owner);
        if (d) this.cook(d.ing);
        else if (owner instanceof Prop) this.cook(INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]!);
      }),
    );
    // Peti bahan halal di sekitar dapur (bisa didorong ke kuali).
    INGREDIENTS.forEach((ing, i) => {
      const g = new Group();
      const ck = new Kit();
      ck.add(rbox(1.4, 1.2, 1.4, 0.1), '#C98B55', { jitter: 0.05 });
      ck.add(rbox(1.0, 0.5, 1.0, 0.2), ing.color, { pos: [0, 0.75, 0] });
      g.add(makeMesh(ck, mat, `crate-${ing.id}`));
      const tag = new Billboard(() => tr(`zones.kitchen.ing.${ing.id}` as I18nKey), { width: 2.4, height: 0.7, bg: 'rgba(255,246,230,0.95)', fontSize: 50 });
      this.boards.push(tag);
      tag.object.position.set(0, 1.7, 0);
      g.add(tag.object);
      const a = (i / INGREDIENTS.length) * Math.PI * 2;
      this.put(g, Math.cos(a) * 10, Math.sin(a) * 10, 0.7);
      addProp(this.deps, g, { mass: 1.4, material: 'wood', shapes: [{ half: [0.7, 0.6, 0.7] }] });
    });
    this.board('zones.kitchen.title', 'zones.kitchen.body', -14, 6, 40, '#FF9248');
  }
  private cook(ing: (typeof INGREDIENTS)[number]): void {
    this.steam = 2.5;
    this.cooked.push(ing.recipe);
    bus.emit('prop:hit', { material: 'water', speed: 6, point: { x: this.wokTop.x, y: this.wokTop.y, z: this.wokTop.z } });
    bus.emit('toast', { text: tr('zones.kitchen.cooked', { dish: tr(`zones.kitchen.dish.${ing.recipe}` as I18nKey) }), kind: 'success', icon: '🍲' });
    bus.emit('interact', { zone: this.id, action: `cook:${ing.recipe}` });
  }
  override update(t: ZoneTick): void {
    if (this.steam > 0) {
      this.steam -= t.dt;
      _up.copy(this.wokTop).normalize();
      this.deps.particles.emit(_v.copy(this.wokTop).addScaledVector(_up, 0.5), _up.clone().multiplyScalar(3), '#FFFFFF', { life: 1.6, size: 0.9, sizeEnd: 2, drag: 0.5, spread: 1.5 });
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]!;
      d.age += t.dt;
      if (d.age > 18) {
        this.removeProp(d.prop);
        this.drops.splice(i, 1);
      }
    }
  }
  override action(t: ZoneTick): ZoneAction {
    if (t.grounded) return { label: 'actions.viewKitchen', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
    return {
      label: 'actions.dropIngredient',
      run: () => {
        const ing = INGREDIENTS[this.nextIng++ % INGREDIENTS.length]!;
        const g = new Group();
        g.add(makeMesh(new Kit().add(rbox(0.9, 0.8, 0.9, 0.1), '#C98B55', {}).add(rbox(0.7, 0.4, 0.7, 0.15), ing.color, { pos: [0, 0.5, 0] }), this.deps.material, 'ingredient'));
        const p = this.drop(t, g, [0.45, 0.4, 0.45], 0.8, 'wood');
        this.drops.push({ prop: p, age: 0, ing });
        if (this.drops.length > 6) this.removeProp(this.drops.shift()!.prop);
      },
    };
  }
}

// ------------------------------------------------------------------------------------ Pulau Gym

export class GymIsland extends SurfaceZone {
  private readonly gate = new Vector3();
  private readonly gateNormal = new Vector3();
  private prevSide = 0;
  private prBoard: Billboard | null = null;
  constructor() {
    super('gym-island', '🏋️', '#E5484D', [20.5, -157], 10, true);
  }
  protected build(): void {
    const mat = this.deps.material;
    const f = this.frame;
    if (f.ground < 0.5) {
      const isl = buildIsland(f, this.deps, { radius: 26, height: 2, seed: 4242, plateau: 0.6 });
      this.group.add(isl.mesh);
      this.colliders.push(isl.collider);
    }
    const base = Math.max(2, f.ground);
    // Barbel raksasa: dua piringan besar + batang tinggi; celah di bawah batang bisa diterbangi.
    const bar = new Group();
    const k = new Kit();
    const gap = 14;
    for (const s of [-1, 1]) {
      k.add(cyl(6.5, 6.5, 1.6, 20), '#2B2D42', { pos: [s * gap * 0.5, 6.6, 0], rot: [0, 0, Math.PI / 2] });
      k.add(cyl(5.2, 5.2, 1.8, 20), '#E5484D', { pos: [s * (gap * 0.5 + 1.4), 6.6, 0], rot: [0, 0, Math.PI / 2] });
      k.add(cyl(1, 1.2, 0.4, 10), '#C9CED6', { pos: [s * (gap * 0.5 + 2.6), 6.6, 0], rot: [0, 0, Math.PI / 2] });
    }
    k.add(cyl(0.7, 0.7, gap + 7, 12), '#C9CED6', { pos: [0, 12.2, 0], rot: [0, 0, Math.PI / 2] });
    bar.add(makeMesh(k, mat, 'giant-barbell'));
    f.place(bar, 0, 0, 0, 0, base);
    this.group.add(bar);
    this.bodies.push(
      addStatic(this.deps.physics, bar, [
        { half: [0.9, 6.5, 6.5], offset: [-gap * 0.5, 6.6, 0] },
        { half: [0.9, 6.5, 6.5], offset: [gap * 0.5, 6.6, 0] },
        { half: (gap + 7) / 2 > 0 ? [(gap + 7) / 2, 0.7, 0.7] : [1, 1, 1], offset: [0, 12.2, 0] },
      ], 'metal'),
    );
    bar.updateMatrixWorld();
    this.gate.set(0, 6, 0).applyMatrix4(bar.matrixWorld);
    this.gateNormal.set(0, 0, 1).applyQuaternion(bar.getWorldQuaternion(_q));
    // Papan PR.
    this.prBoard = infoBoard(() => tr('zones.gym.pr'), () => tr('zones.gym.prCount', { n: progress.get().counters['gym-pr'] ?? 0 }), { width: 6, height: 3.4, accent: '#E5484D', sprite: true });
    this.boards.push(this.prBoard);
    this.prBoard.object.position.copy(f.point(0, base - f.ground + 20, 0));
    this.group.add(this.prBoard.object);
    // Dumbel & rak beban (fisika).
    for (let i = 0; i < 6; i++) {
      const g = new Group();
      const dk = new Kit();
      dk.add(cyl(0.18, 0.18, 1.6, 8), '#C9CED6', { rot: [0, 0, Math.PI / 2] });
      for (const s of [-1, 1]) dk.add(cyl(0.55, 0.55, 0.35, 10), '#2B2D42', { pos: [s * 0.7, 0, 0], rot: [0, 0, Math.PI / 2] });
      g.add(makeMesh(dk, mat, 'dumbbell'));
      f.place(g, -14 + (i % 3) * 2.4, 8 + Math.floor(i / 3) * 2.4, 0.6, i * 25, base);
      this.group.add(g);
      addProp(this.deps, g, { mass: 2.4, material: 'metal', shapes: [{ half: [0.85, 0.55, 0.55] }] });
    }
    this.board('zones.gym.title', 'zones.gym.body', 14, 9, -40, '#E5484D');
  }
  override update(t: ZoneTick): void {
    _v.copy(t.planePos).sub(this.gate);
    const side = Math.sign(_v.dot(this.gateNormal));
    if (this.prevSide !== 0 && side !== this.prevSide && _v.length() < 9) {
      patchProgress((p) => {
        p.counters['gym-pr'] = (p.counters['gym-pr'] ?? 0) + 1;
      });
      this.prBoard?.redraw();
      bus.emit('toast', { text: tr('zones.gym.lift', { n: progress.get().counters['gym-pr'] ?? 0 }), kind: 'success', icon: '💪' });
      bus.emit('interact', { zone: this.id, action: 'gym-pr' });
      bus.emit('prop:hit', { material: 'metal', speed: 9, point: { x: this.gate.x, y: this.gate.y, z: this.gate.z } });
    }
    this.prevSide = side;
  }
  override action(): ZoneAction {
    return { label: 'actions.viewGym', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}

// ------------------------------------------------------------------------------------ Desa Benteng

export class FortVillage extends SurfaceZone {
  private readonly blocks: Prop[] = [];
  private idle = 0;
  private broken = false;
  private readonly balloons: { prop: Prop; age: number }[] = [];
  private catapultArm: Group | null = null;
  constructor() {
    super('fort-village', '🏰', '#C98B55', [8, 20]);
  }
  protected build(): void {
    const mat = this.deps.material;
    // Tembok balok persegi (fisika) yang tersusun lagi setelah diam 20 detik.
    const side = 12;
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 6; i++) {
        for (let h = 0; h < 3; h++) {
          const g = new Group();
          g.add(makeMesh(new Kit().add(rbox(2, 1.2, 1.2, 0.08), h % 2 ? '#D9B48A' : '#C99D6E', { jitter: 0.05 }), mat, 'wall-block'));
          const t = -side / 2 + 1 + i * 2 + (h % 2) * 0.5;
          const pos: [number, number] = s === 0 ? [t, -side / 2] : s === 1 ? [side / 2, t] : s === 2 ? [-t, side / 2] : [-side / 2, -t];
          if (s === 0 && (i === 2 || i === 3) && h < 2) continue; // gerbang
          this.put(g, pos[0], pos[1], 0.62 + h * 1.22, s % 2 ? 90 : 0);
          const p = addProp(this.deps, g, { mass: 0.9, material: 'wood', shapes: [{ half: [1, 0.6, 0.6] }], friction: 0.9 });
          p.body.sleep();
          this.blocks.push(p);
        }
      }
    }
    // Menara sudut + rumah di dalam.
    const k = new Kit();
    for (const [x, z] of [
      [-side / 2, -side / 2],
      [side / 2, -side / 2],
      [side / 2, side / 2],
      [-side / 2, side / 2],
    ] as [number, number][]) {
      k.add(cyl(1.6, 1.8, 6, 8), '#B98A5E', { pos: [x, 3, z] });
      k.add(cone(2.2, 2.6, 8), '#E5484D', { pos: [x, 7.3, z] });
    }
    k.add(rbox(4, 3, 4, 0.2), PALETTE.cream, { pos: [0, 1.5, 0] });
    k.add(cone(3.4, 2.4, 4), '#3AA0FF', { pos: [0, 4.2, 0], rot: [0, Math.PI / 4, 0] });
    const towers = new Group();
    towers.add(makeMesh(k, mat, 'fort-towers'));
    this.put(towers, 0, 0);
    this.bodies.push(
      addStatic(this.deps.physics, towers, [
        { half: [1.6, 3, 1.6], offset: [-side / 2, 3, -side / 2] },
        { half: [1.6, 3, 1.6], offset: [side / 2, 3, -side / 2] },
        { half: [1.6, 3, 1.6], offset: [side / 2, 3, side / 2] },
        { half: [1.6, 3, 1.6], offset: [-side / 2, 3, side / 2] },
        { half: [2, 1.5, 2], offset: [0, 1.5, 0] },
      ], 'rock'),
    );
    // Ketapel (lengan berayun).
    const cat = new Group();
    cat.add(makeMesh(new Kit().add(box(2.4, 0.6, 3), '#8A6A4A', { pos: [0, 0.6, 0] }).add(box(0.3, 2, 0.3), '#8A6A4A', { pos: [0, 1.6, 0] }), mat, 'catapult-base'));
    const arm = new Group();
    arm.add(makeMesh(new Kit().add(box(0.3, 0.3, 4), '#C98B55', { pos: [0, 0, 1.2] }).add(cyl(0.6, 0.5, 0.4, 8, true), '#8A6A4A', { pos: [0, 0.2, 3.1] }), mat, 'catapult-arm'));
    arm.position.y = 2.5;
    cat.add(arm);
    this.catapultArm = arm;
    this.put(cat, 16, 4, 0, -60);
    this.board('zones.fort.title', 'zones.fort.body', -16, 8, 50, '#C98B55');
  }
  override update(t: ZoneTick): void {
    if (this.catapultArm) this.catapultArm.rotation.x = -0.4 + Math.max(0, Math.sin(t.time * 0.8)) * 1.4;
    let moving = 0;
    let displaced = 0;
    for (const b of this.blocks) {
      if (!b.body.isSleeping() && b.speed > 0.3) moving++;
      const p = b.body.translation();
      if (_v.set(p.x, p.y, p.z).distanceTo(b.home) > 1) displaced++;
    }
    if (!this.broken && displaced > 8) {
      this.broken = true;
      bus.emit('interact', { zone: this.id, action: 'fort-broken' });
      bus.emit('toast', { text: tr('zones.fort.broken'), kind: 'success', icon: '💥' });
    }
    this.idle = moving > 0 ? 0 : this.idle + t.dt;
    if (displaced > 0 && this.idle > 20) {
      // Tersusun lagi dengan "pop".
      for (const b of this.blocks) {
        b.resetHome();
        b.body.sleep();
      }
      this.broken = false;
      this.idle = 0;
      bus.emit('toast', { text: tr('zones.fort.rebuilt'), kind: 'info', icon: '🧱' });
    }
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i]!;
      b.age += t.dt;
      if (b.age > 8) {
        this.removeProp(b.prop);
        this.balloons.splice(i, 1);
      }
    }
  }
  override action(t: ZoneTick): ZoneAction {
    if (t.grounded) return { label: 'actions.viewFort', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
    return {
      label: 'actions.dropWaterBalloon',
      run: () => {
        const g = new Group();
        g.add(makeMesh(new Kit().add(sphere(0.7, 10, 8), '#3AA0FF', { scale: [1, 1.15, 1] }), this.deps.material, 'water-balloon'));
        const p = this.drop(t, g, [0.6, 0.7, 0.6], 3, 'rubber');
        const b = { prop: p, age: 0 };
        // Pecah saat menyentuh apa pun: cipratan + sedikit dorongan ke balok sekitar (impuls fisika).
        for (let c = 0; c < p.body.numColliders(); c++) {
          const col = p.body.collider(c);
          const info = this.deps.physics.infoOf(col);
          if (!info) continue;
          info.onContact = (e) => {
            if (b.age < 0.15 || b.age > 7.9) return;
            b.age = 7.9;
            this.deps.particles.burst(e.point, 26, ['#9FD8F5', '#3AA0FF', '#FFFFFF'], { speed: 5, life: 0.9, size: 0.3, gravity: 6 });
            bus.emit('plane:splash', { speed: 6, point: { x: e.point.x, y: e.point.y, z: e.point.z } });
            for (const blk of this.blocks) {
              const q = blk.body.translation();
              _v.set(q.x - e.point.x, q.y - e.point.y, q.z - e.point.z);
              const d = _v.length();
              if (d < 4) blk.body.applyImpulse(_v.normalize().multiplyScalar((4 - d) * 2.2), true);
            }
          };
        }
        this.balloons.push(b);
      },
    };
  }
}

// ------------------------------------------------------------------------------------ Taman Balok

export class BlockPark extends SurfaceZone {
  private readonly dancers: Group[] = [];
  private dance = 0;
  constructor() {
    super('block-park', '🧱', '#3DCB7A', [-12, -55]);
  }
  protected build(): void {
    const mat = this.deps.material;
    const colors = ['#E5484D', '#3AA0FF', '#3DCB7A', '#FFC93C', '#B48CFF', '#FF9248'];
    // Karakter balok generik: badan kotak, kepala kotak, mata titik.
    for (let i = 0; i < 8; i++) {
      const g = new Group();
      const k = new Kit();
      const c = colors[i % colors.length]!;
      k.add(rbox(1.6, 2, 1, 0.1), c, { pos: [0, 2.2, 0] });
      k.add(rbox(1.4, 1.4, 1.4, 0.12), '#FFD3B0', { pos: [0, 4, 0] });
      for (const s of [-1, 1]) {
        k.add(box(0.2, 0.25, 0.05), PALETTE.ink, { pos: [s * 0.3, 4.1, -0.72] });
        k.add(rbox(0.6, 1.2, 0.6, 0.08), '#3B4A7A', { pos: [s * 0.45, 0.6, 0] });
        k.add(rbox(0.5, 1.6, 0.5, 0.08), c, { pos: [s * 1.1, 2.4, 0] });
      }
      g.add(makeMesh(k, mat, 'block-dancer'));
      const a = (i / 8) * Math.PI * 2;
      this.put(g, Math.cos(a) * 8, Math.sin(a) * 8, 0, (-a * 180) / Math.PI + 90);
      this.dancers.push(g);
    }
    // Balok raksasa bertumpuk (fisika).
    for (let i = 0; i < 10; i++) {
      const g = new Group();
      g.add(makeMesh(new Kit().add(rbox(2.4, 2.4, 2.4, 0.15), colors[i % colors.length]!, { jitter: 0.03 }), mat, 'giant-block'));
      this.put(g, -3 + (i % 3) * 2.5, -14, 1.22 + Math.floor(i / 3) * 2.42, 0);
      const p = addProp(this.deps, g, { mass: 2, material: 'wood', shapes: [{ half: [1.2, 1.2, 1.2] }] });
      p.body.sleep();
    }
    this.board('zones.blocks.title', 'zones.blocks.body', 14, -10, -40, '#3DCB7A');
  }
  override update(t: ZoneTick): void {
    const near = t.planePos.distanceTo(this.center) < 45;
    this.dance += t.dt * (near ? 1 : -1);
    this.dance = Math.max(0, Math.min(1, this.dance));
    this.dancers.forEach((d, i) => {
      const k = this.dance;
      const ph = t.time * 6 + i;
      d.children[0]!.position.set(0, Math.abs(Math.sin(ph)) * 0.8 * k, 0);
      d.children[0]!.rotation.set(0, Math.sin(ph * 0.5) * 0.6 * k, Math.sin(ph) * 0.15 * k);
    });
  }
  override action(): ZoneAction {
    return { label: 'actions.viewBlocks', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}

void L;
