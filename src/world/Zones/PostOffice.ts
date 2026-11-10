/**
 * Kantor Pos Udara: Kontak (docs/02 bagian 3.3).
 * - Kotak surat raksasa bermulut terbuka ke atas. Tombol Aksi menjatuhkan paket (rigid body sungguhan) dari
 *   pesawat; paket yang masuk ke kotak surat (sensor) membuka form kontak + konfeti + pesawat kertas.
 * - Balon sosial media (satu per tautan publik di socials.json) mengapung dengan pegas; menabraknya memantul
 *   dan memunculkan konfirmasi "Buka …?" (tidak langsung membuka tab baru).
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Mesh} from 'three';
import { Group, Quaternion, Vector3, type Object3D } from 'three';
import { PALETTE } from '../../config/palette';
import { AIRPORT } from '../../config/world';
import { content } from '../../content';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { GROUP, interactionGroups } from '../../physics/PhysicsWorld';
import { Prop } from '../../physics/Props';
import { Kit, box, cone, cyl, rbox, sphere } from '../../utils/modeling/Kit';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addSensor, addStatic, buildIsland, makeMesh, type ZoneDeps } from './ZoneKit';

interface Balloon {
  body: RAPIER.RigidBody;
  object: Object3D;
  home: Vector3;
  linkId: string;
  wobble: number;
  lastHit: number;
}

interface Parcel {
  prop: Prop;
  age: number;
}

const _v = new Vector3();
const _q = new Quaternion();
const _up = new Vector3();
const PARCEL_LIFE = 22;
const MAX_PARCELS = 6;
/** Pulau pos mungil di laut sebelah landasan (lihat content/world/zones.json). */
const ISLAND_R = 18;
const ISLAND_H = 1.8;

export class PostOffice extends Zone {
  private frame!: SurfaceFrame;
  private readonly balloons: Balloon[] = [];
  private readonly parcels: Parcel[] = [];
  private readonly paperPlane = new Group();
  private paperT = -1;
  private readonly mailboxTop = new Vector3();
  private dropCooldown = 0;

  constructor() {
    super('post-office');
    this.icon = '📮';
    this.color = '#FF5A5F';
    this.triggerRadius = 30;
  }

  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    // Pintu kantor pos menghadap landasan (kanan dari arah lepas landas), supaya terlihat dari titik start.
    this.frame = new SurfaceFrame(z?.lat ?? 10.03, z?.lon ?? 102.74, AIRPORT.headingDeg + 90, deps.planet, 0);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, ISLAND_H + 26, 0));
    deps.scatter.addExclusion(this.frame.dir, ISLAND_R + 4);
  }

  protected build(): void {
    const mat = this.deps.material;
    const f = this.frame;
    const ground = ISLAND_H;
    const isl = buildIsland(f, this.deps, { radius: ISLAND_R, height: ISLAND_H, seed: 5150, plateau: 0.64 });
    this.group.add(isl.mesh);
    this.colliders.push(isl.collider);
    // Gedung pos mungil.
    const house = new Group();
    const k = new Kit();
    k.add(rbox(8, 4, 6, 0.3), PALETTE.cream, { pos: [0, 2, 0], jitter: 0.02 });
    k.add(cyl(4.3, 4.3, 8.6, 3), '#E5484D', { pos: [0, 5.1, 0], rot: [-Math.PI / 2, 0, Math.PI / 2], scale: [1, 1, 0.75] });
    k.add(rbox(1.6, 2.6, 0.2, 0.2), '#7A4A2E', { pos: [0, 1.3, -3.05] });
    for (const s of [-1, 1]) k.add(rbox(1.4, 1.2, 0.15, 0.15), '#9FD8F5', { pos: [s * 2.6, 2.3, -3.05] });
    k.add(rbox(3.6, 1.0, 0.2, 0.3), PALETTE.sun, { pos: [0, 3.5, -3.15] });
    house.add(makeMesh(k, mat, 'post-house'));
    const sign = new Billboard(() => tr('zones.post.sign'), { width: 3.4, height: 0.9, sprite: false, fontSize: 70 });
    this.boards.push(sign);
    sign.object.position.set(0, 3.5, -3.28);
    sign.object.rotation.y = Math.PI;
    house.add(sign.object);
    f.place(house, -5, 2.5, 0, 0, ground);
    this.group.add(house);
    this.bodies.push(addStatic(this.deps.physics, house, [{ half: [4, 2, 3], offset: [0, 2, 0] }, { half: [4.2, 1.4, 2.6], offset: [0, 4.6, 0] }], 'wood'));

    // Kotak surat raksasa (dinding tebal, mulut terbuka di atas).
    const box0 = new Group();
    const mk = new Kit();
    const W = 6;
    const H = 7;
    const T = 0.5;
    mk.add(box(W, T, W), '#C83A3F', { pos: [0, T / 2, 0] });
    for (const [x, z, w, d] of [
      [0, -(W - T) / 2, W, T],
      [0, (W - T) / 2, W, T],
      [-(W - T) / 2, 0, T, W],
      [(W - T) / 2, 0, T, W],
    ] as [number, number, number, number][]) {
      mk.add(box(w, H, d), '#E5484D', { pos: [x, H / 2, z], jitter: 0.02 });
    }
    mk.add(rbox(W + 0.6, 0.4, W + 0.6, 0.15), PALETTE.sun, { pos: [0, H, 0] });
    mk.add(rbox(3.2, 1.2, 0.12, 0.2), PALETTE.cream, { pos: [0, H * 0.62, -W / 2 - 0.05] });
    mk.add(cyl(0.6, 0.6, 1.6, 8), '#8E98A5', { pos: [0, -0.4, 0] });
    box0.add(makeMesh(mk, mat, 'mailbox'));
    const label = new Billboard(() => tr('zones.post.mailbox'), { width: 3, height: 1, sprite: false, fontSize: 64 });
    this.boards.push(label);
    label.object.position.set(0, H * 0.62, -W / 2 - 0.13);
    label.object.rotation.y = Math.PI;
    box0.add(label.object);
    f.place(box0, 5.5, -1, 0.4, 0, ground);
    this.group.add(box0);
    this.bodies.push(
      addStatic(
        this.deps.physics,
        box0,
        [
          { half: [W / 2, T / 2, W / 2], offset: [0, T / 2, 0] },
          { half: [W / 2, H / 2, T / 2], offset: [0, H / 2, -(W - T) / 2] },
          { half: [W / 2, H / 2, T / 2], offset: [0, H / 2, (W - T) / 2] },
          { half: [T / 2, H / 2, W / 2], offset: [-(W - T) / 2, H / 2, 0] },
          { half: [T / 2, H / 2, W / 2], offset: [(W - T) / 2, H / 2, 0] },
        ],
        'metal',
      ),
    );
    box0.updateMatrixWorld();
    this.mailboxTop.set(0, H + 1, 0).applyMatrix4(box0.matrixWorld);
    const inside = new Vector3(0, 1.8, 0).applyMatrix4(box0.matrixWorld);
    this.colliders.push(
      addSensor(this.deps.physics, inside, 2.2, (owner) => {
        const p = this.parcels.find((x) => x.prop === owner);
        if (p) this.delivered(p);
      }),
    );

    // Balon sosial media.
    const links = content.get().socials.links.filter((l) => l.public);
    const colors: Record<string, string> = { sun: PALETTE.sun, leaf: PALETTE.leaf, sky: PALETTE.sky, berry: PALETTE.berry, ink: '#5D6178' };
    links.forEach((l, i) => {
      const a = (i / links.length) * Math.PI * 1.4 - 0.4;
      const x = Math.cos(a) * 13;
      const z = Math.sin(a) * 13 - 2;
      const g = new Group();
      const bk = new Kit();
      const col = colors[l.balloonColor ?? 'sky'] ?? PALETTE.sky;
      bk.add(sphere(1.6, 14, 10), col, { scale: [1, 1.15, 1], jitter: 0.02 });
      bk.add(cone(0.25, 0.4, 6), col, { pos: [0, -1.95, 0], rot: [Math.PI, 0, 0] });
      bk.add(sphere(0.45, 8, 6), '#FFFFFF', { pos: [-0.55, 0.7, -1.2], scale: [1, 1.3, 0.4] });
      bk.add(cyl(0.02, 0.02, 3.2, 3), PALETTE.ink, { pos: [0, -3.7, 0] });
      g.add(makeMesh(bk, this.deps.material, `balloon-${l.id}`));
      const tag = new Billboard(() => l.label, { width: 3.2, height: 0.9, bg: 'rgba(255,246,230,0.95)', fontSize: 62 });
      this.boards.push(tag);
      tag.object.position.set(0, 2.6, 0);
      g.add(tag.object);
      f.place(g, x, z, 9 + (i % 2) * 3, 0, ground);
      this.group.add(g);
      const home = g.position.clone();
      const R = this.deps.physics.R;
      const body = this.deps.physics.world.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(home.x, home.y, home.z).setLinearDamping(0.8).setAngularDamping(2).setCanSleep(false),
      );
      const c = this.deps.physics.world.createCollider(
        R.ColliderDesc.ball(1.7)
          .setDensity(0.05)
          .setRestitution(0.9)
          .setCollisionGroups(interactionGroups(GROUP.PROP, 0xffff))
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      const bal: Balloon = { body, object: g, home, linkId: l.id, wobble: i * 1.7, lastHit: -10 };
      this.deps.physics.setInfo(c, {
        kind: 'prop',
        material: 'rubber',
        onContact: (e) => {
          if (e.otherInfo?.kind !== 'plane') return;
          const now = performance.now() / 1000;
          if (now - bal.lastHit < 2) return;
          bal.lastHit = now;
          bus.emit('prop:hit', { material: 'rubber', speed: Math.max(4, e.impactSpeed), point: e.point });
          bus.emit('balloon:hit', { linkId: l.id });
          bus.emit('panel:open', { kind: 'link', id: l.id });
        },
      });
      this.bodies.push(body);
      this.balloons.push(bal);
    });

    // Pesawat kertas (efek setelah pesan terkirim).
    const pk = new Kit();
    pk.add(cone(0.6, 2.2, 3), '#FFFFFF', { rot: [-Math.PI / 2, 0, 0], scale: [1.4, 1, 0.25] });
    this.paperPlane.add(makeMesh(pk, this.deps.material, 'paper-plane', false));
    this.paperPlane.visible = false;
    this.group.add(this.paperPlane);
  }

  private delivered(p: Parcel): void {
    p.age = PARCEL_LIFE - 1.5;
    const pos = this.mailboxTop;
    this.deps.particles.burst(pos, 36, [PALETTE.sun, PALETTE.berry, PALETTE.sky, PALETTE.leaf], { speed: 6, up: _up.copy(pos).normalize(), upSpeed: 7, life: 1.4, size: 0.35, gravity: 6 });
    bus.emit('parcel:delivered', {});
    bus.emit('toast', { text: tr('zones.post.delivered'), kind: 'success', icon: '📬' });
    bus.emit('panel:open', { kind: 'contact' });
    this.paperT = 0;
  }

  /** Dipanggil UI setelah pesan terkirim → pesawat kertas meluncur dari kotak surat. */
  launchPaperPlane(): void {
    this.paperT = 0;
  }

  private dropParcel(t: ZoneTick): void {
    if (this.dropCooldown > 0) return;
    this.dropCooldown = 0.6;
    const g = new Group();
    const k = new Kit();
    k.add(rbox(1.0, 0.8, 1.0, 0.08), '#C98B55', { jitter: 0.04 });
    k.add(box(1.02, 0.14, 0.14), PALETTE.berry, {});
    k.add(box(0.14, 0.82, 1.02), PALETTE.berry, {});
    g.add(makeMesh(k, this.deps.material, 'parcel'));
    _up.copy(t.planePos).normalize();
    g.position.copy(t.planePos).addScaledVector(_up, -1.6);
    this.group.add(g);
    const prop = new Prop(this.deps.physics, this.deps.gravity, g, g.position, _q.identity(), {
      mass: 0.6,
      material: 'wood',
      shapes: [{ half: [0.5, 0.4, 0.5] }],
      restitution: 0.35,
    });
    prop.body.setLinvel({ x: t.planeVel.x * 0.9, y: t.planeVel.y * 0.9, z: t.planeVel.z * 0.9 }, true);
    prop.body.setAngvel({ x: Math.random() * 3, y: Math.random() * 3, z: Math.random() * 3 }, true);
    this.parcels.push({ prop, age: 0 });
    if (this.parcels.length > MAX_PARCELS) this.removeParcel(this.parcels.shift()!);
    bus.emit('interact', { zone: this.id, action: 'drop-parcel' });
  }

  private removeParcel(p: Parcel): void {
    this.deps.physics.removeSynced(p.prop.synced);
    this.deps.gravity.remove(p.prop.body);
    this.deps.physics.world.removeRigidBody(p.prop.body);
    this.group.remove(p.prop.object);
    p.prop.object.traverse((o) => (o as Mesh).geometry?.dispose());
  }

  override update(t: ZoneTick): void {
    this.dropCooldown -= t.dt;
    for (const b of this.balloons) {
      // Pegas lembut ke titik tambat + goyang angin.
      const p = b.body.translation();
      const v = b.body.linvel();
      b.wobble += t.dt;
      _v.set(b.home.x - p.x, b.home.y - p.y, b.home.z - p.z).multiplyScalar(1.8);
      _up.copy(b.home).normalize();
      _v.addScaledVector(_up, Math.sin(b.wobble * 1.3) * 0.6);
      _v.addScaledVector(t.wind, 0.2);
      const m = b.body.mass();
      b.body.applyImpulse({ x: (_v.x - v.x * 0.9) * m * t.dt * 2, y: (_v.y - v.y * 0.9) * m * t.dt * 2, z: (_v.z - v.z * 0.9) * m * t.dt * 2 }, true);
      b.object.position.set(p.x, p.y, p.z);
    }
    for (let i = this.parcels.length - 1; i >= 0; i--) {
      const p = this.parcels[i]!;
      p.age += t.dt;
      if (p.age > PARCEL_LIFE) {
        this.removeParcel(p);
        this.parcels.splice(i, 1);
      }
    }
    if (this.paperT >= 0) {
      this.paperT += t.dt;
      const k = this.paperT / 6;
      _up.copy(this.mailboxTop).normalize();
      const fwd = this.frame.fwd;
      this.paperPlane.visible = k < 1;
      this.paperPlane.position.copy(this.mailboxTop).addScaledVector(_up, k * 40 + Math.sin(k * 12) * 1.2).addScaledVector(fwd, k * 120);
      this.paperPlane.quaternion.copy(this.frame.quat);
      if (k >= 1) this.paperT = -1;
    }
  }

  override action(t: ZoneTick): ZoneAction | null {
    if (t.grounded) return { label: 'actions.contact', run: () => bus.emit('panel:open', { kind: 'contact' }) };
    return { label: 'actions.dropParcel', run: () => this.dropParcel(t) };
  }

  override dispose(): void {
    for (const p of this.parcels) this.removeParcel(p);
    this.parcels.length = 0;
    super.dispose();
  }
}
