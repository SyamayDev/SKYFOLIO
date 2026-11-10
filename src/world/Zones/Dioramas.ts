/**
 * Preset diorama pulau proyek (docs/02 bagian 3.5). Setiap preset punya model low-poly + interaksi kecil:
 * compass (jarum menunjuk pesawat, rambu bergoyang saat ditabrak), laundry (drum berputar, jemuran berkibar),
 * books (tumpukan buku fisika), robot (kepala menoleh, melambai), shop (peti fisika), school (bendera + bel),
 * rocket (roket melompat saat disentuh), garden (kincir mengikuti angin), lab (tabung berbuih),
 * stage (lampu sorot mengikuti pesawat), generic (pohon kelapa + papan foto).
 */
import { ConeGeometry, Group, Mesh, Quaternion, SphereGeometry, Vector3, type Object3D } from 'three';
import { PALETTE } from '../../config/palette';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import type { Prop } from '../../physics/Props';
import { Kit, box, cone, cyl, ico, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial } from '../../utils/modeling/materials';
import { Billboard } from '../Billboard';
import { PropKind, kindGeometry } from '../ScatterKinds';
import type { ZoneTick } from './Zone';
import { addProp, addSensor, addStatic, makeMesh, type SurfaceFrame, type ZoneDeps } from './ZoneKit';

export interface DioramaCtx {
  frame: SurfaceFrame;
  deps: ZoneDeps;
  /** Tinggi lantai pulau (di atas laut). */
  base: number;
  group: Group;
  boards: Billboard[];
  /** Offset lokal pusat diorama (x, z). */
  at: [number, number];
}

export interface Diorama {
  update(t: ZoneTick, near: boolean): void;
  props: Prop[];
}

const _v = new Vector3();
const _w = new Vector3();
const _q = new Quaternion();

function placed(ctx: DioramaCtx, obj: Object3D, dx = 0, dz = 0, y = 0, yaw = 0): Object3D {
  ctx.frame.place(obj, ctx.at[0] + dx, ctx.at[1] + dz, y, yaw, ctx.base);
  ctx.group.add(obj);
  return obj;
}

function mesh(k: Kit, ctx: DioramaCtx, name: string): Mesh {
  return makeMesh(k, ctx.deps.material, name);
}

/** Pegas sudut sederhana untuk benda yang "bergoyang" setelah disentuh. */
class Wobble {
  angle = 0;
  vel = 0;
  kick(v: number): void {
    this.vel += v;
  }
  step(dt: number): number {
    this.vel += (-this.angle * 60 - this.vel * 5) * dt;
    this.angle += this.vel * dt;
    return this.angle;
  }
}

/** Arah pesawat dari objek dalam ruang lokal objek (sudut yaw). */
function yawTo(obj: Object3D, target: Vector3): number {
  obj.updateMatrixWorld();
  _v.copy(target);
  obj.worldToLocal(_v);
  return Math.atan2(_v.x, -_v.z);
}

export function buildDiorama(kind: string, ctx: DioramaCtx): Diorama {
  const props: Prop[] = [];
  const physics = ctx.deps.physics;
  switch (kind) {
    case 'compass': {
      const plaza = new Group();
      const k = new Kit();
      k.add(cyl(4.2, 4.4, 0.3, 24), PALETTE.cream, { pos: [0, 0.15, 0] });
      k.add(torus(3.9, 0.12, 4, 32), '#2F8FA6', { pos: [0, 0.32, 0], rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const long = i % 2 === 0;
        k.add(cone(long ? 0.55 : 0.35, long ? 3.6 : 2.2, 4), long ? '#E5484D' : PALETTE.sun, {
          pos: [Math.sin(a) * (long ? 1.8 : 1.1), 0.36, -Math.cos(a) * (long ? 1.8 : 1.1)],
          rot: [-Math.PI / 2, 0, -a],
          scale: [1, 1, 0.15],
        });
      }
      plaza.add(mesh(k, ctx, 'compass-plaza'));
      placed(ctx, plaza);
      const needle = new Group();
      const nk = new Kit();
      nk.add(cyl(0.25, 0.25, 1.4, 8), PALETTE.ink, { pos: [0, 0.7, 0] });
      nk.add(cone(0.4, 2.4, 4), '#E5484D', { pos: [0, 1.5, -1.2], rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 0.3] });
      nk.add(cone(0.4, 2.4, 4), '#F4E7CD', { pos: [0, 1.5, 1.2], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.3] });
      nk.add(sphere(0.35, 8, 6), PALETTE.sun, { pos: [0, 1.5, 0] });
      const spin = new Group();
      spin.add(mesh(nk, ctx, 'compass-needle'));
      needle.add(spin);
      placed(ctx, needle, 0, 0, 0.3);
      // Rambu arah bidang ilmu (tulisan i18n) yang bergoyang saat ditabrak.
      const fields = ['eng', 'health', 'art', 'biz', 'sci'] as const;
      const wobbles: { w: Wobble; obj: Group }[] = [];
      fields.forEach((f, i) => {
        const a = (i / fields.length) * Math.PI * 2 + 0.3;
        const post = new Group();
        const pk = new Kit();
        pk.add(cyl(0.1, 0.12, 3, 6), '#8A6A4A', { pos: [0, 1.5, 0] });
        post.add(mesh(pk, ctx, 'sign-post'));
        const sign = new Billboard(() => tr(`zones.compass.${f}`), { width: 2.4, height: 0.7, sprite: false, bg: ['#E5484D', '#3DCB7A', '#B48CFF', '#FFC93C', '#3AA0FF'][i], color: '#2B2D42', fontSize: 52 });
        ctx.boards.push(sign);
        sign.object.position.set(0.9, 2.6, 0);
        post.add(sign.object);
        const root = new Group();
        root.add(post);
        placed(ctx, root, Math.cos(a) * 6, Math.sin(a) * 6, 0, (-a * 180) / Math.PI);
        const w = new Wobble();
        wobbles.push({ w, obj: post });
        root.updateMatrixWorld();
        const top = new Vector3(0, 2.2, 0).applyMatrix4(root.matrixWorld);
        addSensor(physics, top, 1.4, () => {
          w.kick(6);
          bus.emit('prop:hit', { material: 'wood', speed: 5, point: { x: top.x, y: top.y, z: top.z } });
        });
      });
      return {
        props,
        update: (t) => {
          spin.rotation.y = -yawTo(needle, t.planePos);
          for (const { w, obj } of wobbles) obj.rotation.z = w.step(t.dt) * 0.35;
        },
      };
    }
    case 'laundry': {
      const m = new Group();
      const k = new Kit();
      k.add(rbox(6, 6.4, 5, 0.6), '#F4F7FB', { pos: [0, 3.2, 0], jitter: 0.01 });
      k.add(rbox(5.6, 0.9, 0.3, 0.2), '#BFC9D6', { pos: [0, 5.9, -2.45] });
      for (let i = 0; i < 3; i++) k.add(cyl(0.22, 0.22, 0.2, 10), ['#E5484D', '#3DCB7A', '#3AA0FF'][i]!, { pos: [-1.6 + i * 0.8, 5.9, -2.65], rot: [Math.PI / 2, 0, 0] });
      k.add(torus(2.1, 0.32, 8, 26), '#BFC9D6', { pos: [0, 2.8, -2.5] });
      m.add(mesh(k, ctx, 'washer'));
      const drum = new Group();
      const dk = new Kit();
      dk.add(cyl(1.9, 1.9, 0.2, 20), '#9FD8F5', { rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        dk.add(rbox(0.9, 0.9, 0.3, 0.2), ['#FF5A5F', '#FFC93C', '#3DCB7A', '#B48CFF', '#FF9AC8'][i]!, { pos: [Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0.1] });
      }
      drum.add(mesh(dk, ctx, 'drum'));
      drum.position.set(0, 2.8, -2.45);
      m.add(drum);
      placed(ctx, m, 0, 0, 0, 180);
      const body = addStatic(physics, m, [{ half: [3, 3.2, 2.5], offset: [0, 3.2, 0] }], 'metal');
      void body;
      // Jemuran berkibar.
      const line = new Group();
      const lk = new Kit();
      for (const x of [-4, 4]) lk.add(cyl(0.1, 0.1, 3.6, 6), '#8A6A4A', { pos: [x, 1.8, 0] });
      lk.add(cyl(0.03, 0.03, 8, 4), PALETTE.ink, { pos: [0, 3.5, 0], rot: [0, 0, Math.PI / 2] });
      line.add(mesh(lk, ctx, 'clothesline'));
      const cloths: Group[] = [];
      for (let i = 0; i < 5; i++) {
        const c = new Group();
        const ck = new Kit();
        ck.add(box(1.1, 1.3, 0.05), ['#FF5A5F', '#FFC93C', '#3AA0FF', '#3DCB7A', '#FFFFFF'][i]!, { pos: [0, -0.65, 0] });
        c.add(mesh(ck, ctx, 'cloth'));
        c.position.set(-3.2 + i * 1.6, 3.5, 0);
        line.add(c);
        cloths.push(c);
      }
      placed(ctx, line, 7, 2, 0, 90);
      // Keranjang cucian.
      const basket = new Group();
      const bk = new Kit();
      bk.add(cyl(1.0, 0.8, 1.0, 10, true), '#C98B55', { pos: [0, 0.5, 0] });
      bk.add(sphere(0.7, 8, 6), '#FFFFFF', { pos: [0, 0.9, 0], scale: [1, 0.5, 1] });
      basket.add(mesh(bk, ctx, 'basket'));
      placed(ctx, basket, -5, 3);
      return {
        props,
        update: (t, near) => {
          drum.rotation.z += t.dt * (near ? 5 : 1.5);
          cloths.forEach((c, i) => {
            const gust = 0.25 + Math.min(1.2, t.planeVel.length() / 40) * (near ? 1 : 0.2);
            c.rotation.x = Math.sin(t.time * 4 + i) * 0.3 * gust + 0.2 * gust;
          });
        },
      };
    }
    case 'books': {
      const colors = ['#E5484D', '#3AA0FF', '#3DCB7A', '#FFC93C', '#B48CFF', '#FF9248'];
      for (let i = 0; i < 6; i++) {
        const g = new Group();
        const k = new Kit();
        k.add(rbox(3.2, 0.7, 2.2, 0.08), colors[i]!, {});
        k.add(box(3.0, 0.5, 0.05), '#FFF6E6', { pos: [0, 0, 1.1] });
        g.add(mesh(k, ctx, 'book'));
        placed(ctx, g, (i % 2) * 0.3, 0, 0.36 + i * 0.72, i * 12);
        props.push(addProp(ctx.deps, g, { mass: 2, material: 'wood', shapes: [{ half: [1.6, 0.35, 1.1] }] }));
      }
      return { props, update: () => undefined };
    }
    case 'robot': {
      const r = new Group();
      const k = new Kit();
      k.add(rbox(2.4, 3, 1.6, 0.4), '#C9CED6', { pos: [0, 3.2, 0] });
      k.add(rbox(1.2, 0.8, 0.1, 0.2), '#3AA0FF', { pos: [0, 3.5, -0.82] });
      for (const s of [-1, 1]) k.add(rbox(0.7, 2, 0.7, 0.25), '#9AA3AE', { pos: [s * 0.6, 1, 0] });
      r.add(mesh(k, ctx, 'robot-body'));
      const head = new Group();
      const hk = new Kit();
      hk.add(rbox(1.8, 1.4, 1.5, 0.4), '#E9EDF2', {});
      for (const s of [-1, 1]) hk.add(sphere(0.22, 8, 6), '#3AA0FF', { pos: [s * 0.4, 0.1, -0.76] });
      hk.add(cyl(0.05, 0.05, 0.6, 4), PALETTE.ink, { pos: [0, 1, 0] });
      hk.add(sphere(0.15, 6, 4), '#E5484D', { pos: [0, 1.35, 0] });
      head.add(mesh(hk, ctx, 'robot-head'));
      head.position.set(0, 5.4, 0);
      r.add(head);
      const arm = new Group();
      const ak = new Kit();
      ak.add(rbox(0.5, 2.2, 0.5, 0.2), '#9AA3AE', { pos: [0, 1.0, 0] });
      ak.add(sphere(0.4, 8, 6), PALETTE.sun, { pos: [0, 2.2, 0] });
      arm.add(mesh(ak, ctx, 'robot-arm'));
      arm.position.set(1.5, 4.2, 0);
      r.add(arm);
      placed(ctx, r);
      addStatic(physics, r, [{ half: [1.2, 2.6, 0.8], offset: [0, 2.6, 0] }], 'metal');
      return {
        props,
        update: (t, near) => {
          const y = yawTo(r, t.planePos);
          head.rotation.y += (Math.max(-1.2, Math.min(1.2, y)) * -1 - head.rotation.y) * Math.min(1, t.dt * 4);
          arm.rotation.z = -0.3 - (near ? 0.6 + Math.sin(t.time * 8) * 0.5 : 0.1);
        },
      };
    }
    case 'shop': {
      const s = new Group();
      const k = new Kit();
      k.add(rbox(6, 3.4, 4, 0.3), PALETTE.cream, { pos: [0, 1.7, 0] });
      for (let i = 0; i < 6; i++) k.add(box(1, 0.2, 1.8), i % 2 ? '#E5484D' : '#FFFFFF', { pos: [-2.5 + i, 3.5, -2.6], rot: [0.35, 0, 0] });
      k.add(rbox(4, 1.5, 0.1, 0.2), '#9FD8F5', { pos: [0, 1.8, -2.05] });
      s.add(mesh(k, ctx, 'shop'));
      placed(ctx, s, 0, 2);
      addStatic(physics, s, [{ half: [3, 1.7, 2], offset: [0, 1.7, 0] }], 'wood');
      for (let i = 0; i < 5; i++) {
        const c = new Group();
        const ck = new Kit();
        ck.add(rbox(1, 1, 1, 0.08), '#C98B55', { jitter: 0.05 });
        ck.add(box(1.02, 0.16, 1.02), '#8A6A4A', {});
        c.add(mesh(ck, ctx, 'crate'));
        placed(ctx, c, -2 + (i % 3) * 1.2, -3.2, 0.5 + Math.floor(i / 3) * 1.02, i * 9);
        props.push(addProp(ctx.deps, c, { mass: 1.2, material: 'wood', shapes: [{ half: [0.5, 0.5, 0.5] }] }));
      }
      return { props, update: () => undefined };
    }
    case 'school': {
      const s = new Group();
      const k = new Kit();
      k.add(rbox(9, 4, 4.5, 0.3), '#FFF4E0', { pos: [0, 2, 0] });
      k.add(box(9.4, 0.4, 4.9), '#E5484D', { pos: [0, 4.2, 0] });
      for (let i = -3; i <= 3; i++) k.add(rbox(0.9, 1.2, 0.1, 0.1), '#9FD8F5', { pos: [i * 1.2, 2.4, -2.3] });
      k.add(rbox(1.6, 2.4, 0.1, 0.2), '#7A4A2E', { pos: [0, 1.2, -2.31] });
      k.add(cyl(0.5, 0.5, 1, 4), PALETTE.sun, { pos: [0, 4.9, 0] });
      s.add(mesh(k, ctx, 'school'));
      placed(ctx, s, 0, 3);
      addStatic(physics, s, [{ half: [4.5, 2.2, 2.25], offset: [0, 2.2, 0] }], 'wood');
      const pole = new Group();
      const pk = new Kit();
      pk.add(cyl(0.08, 0.1, 7, 6), '#C9CED6', { pos: [0, 3.5, 0] });
      pole.add(mesh(pk, ctx, 'flagpole'));
      const flag = new Group();
      const fk = new Kit();
      fk.add(box(1.8, 0.6, 0.04), '#E5484D', { pos: [0.9, 0.3, 0] });
      fk.add(box(1.8, 0.6, 0.04), '#FFFFFF', { pos: [0.9, -0.3, 0] });
      flag.add(mesh(fk, ctx, 'flag'));
      flag.position.set(0, 6.3, 0);
      pole.add(flag);
      placed(ctx, pole, -6, -2);
      let rang = false;
      return {
        props,
        update: (t, near) => {
          flag.rotation.y = Math.sin(t.time * 3) * 0.25;
          flag.children[0]!.rotation.x = Math.sin(t.time * 6) * 0.08;
          if (near && !rang) {
            rang = true;
            bus.emit('toast', { text: tr('zones.diorama.bell'), kind: 'info', icon: '🔔' });
          } else if (!near) rang = false;
        },
      };
    }
    case 'rocket': {
      const pad = new Group();
      const k = new Kit();
      k.add(cyl(2.4, 2.6, 0.5, 12), '#9AA3AE', { pos: [0, 0.25, 0] });
      for (const s of [-1, 1]) k.add(box(0.3, 6, 0.3), '#E5484D', { pos: [s * 1.9, 3, 0] });
      pad.add(mesh(k, ctx, 'launch-pad'));
      placed(ctx, pad);
      addStatic(physics, pad, [{ half: [2.4, 0.25, 2.4], offset: [0, 0.25, 0] }], 'metal');
      const rocket = new Group();
      const rk = new Kit();
      rk.add(cyl(0.7, 0.8, 4, 12), '#FFFFFF', { pos: [0, 2, 0] });
      rk.add(cone(0.7, 1.6, 12), '#E5484D', { pos: [0, 4.8, 0] });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        rk.add(box(0.12, 1.2, 0.9), '#3AA0FF', { pos: [Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8], rot: [0, -a, 0] });
      }
      rk.add(cyl(0.3, 0.3, 0.1, 10), '#9FD8F5', { pos: [0, 3, -0.7], rot: [Math.PI / 2, 0, 0] });
      rocket.add(mesh(rk, ctx, 'rocket'));
      placed(ctx, rocket, 0, 0, 0.55);
      const prop = addProp(ctx.deps, rocket, { mass: 4, material: 'metal', shapes: [{ half: [0.75, 2.7, 0.75], offset: [0, 2.6, 0] }] });
      props.push(prop);
      let cooldown = 0;
      return {
        props,
        update: (t, near) => {
          cooldown -= t.dt;
          if (near && cooldown <= 0 && t.agl < 25) {
            cooldown = 10;
            const tr0 = prop.body.translation();
            _v.set(tr0.x, tr0.y, tr0.z).normalize();
            prop.body.applyImpulse({ x: _v.x * 60, y: _v.y * 60, z: _v.z * 60 }, true);
            ctx.deps.particles.burst({ x: tr0.x, y: tr0.y, z: tr0.z }, 30, ['#FFC93C', '#FF9248', '#FFFFFF'], { speed: 4, life: 1.2, size: 0.5 });
            bus.emit('toast', { text: tr('zones.diorama.rocket'), kind: 'info', icon: '🚀' });
          }
        },
      };
    }
    case 'garden': {
      const g = new Group();
      const k = new Kit();
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4;
        const r = 1.5 + (i % 5) * 0.9;
        k.add(ico(0.45, 0), ['#FF5A5F', '#FFC93C', '#FF9AC8', '#B48CFF'][i % 4]!, { pos: [Math.cos(a) * r, 0.35, Math.sin(a) * r], scale: [1, 0.6, 1] });
      }
      k.add(cyl(0.6, 1.0, 6, 8), '#F4E7CD', { pos: [0, 3, 0] });
      k.add(cone(1.1, 1.4, 8), '#E5484D', { pos: [0, 6.7, 0] });
      g.add(mesh(k, ctx, 'garden'));
      const blades = new Group();
      const bk = new Kit();
      for (let i = 0; i < 4; i++) bk.add(box(0.5, 3.4, 0.08), '#FFF6E6', { pos: [Math.cos((i * Math.PI) / 2) * 1.8, Math.sin((i * Math.PI) / 2) * 1.8, 0], rot: [0, 0, (i * Math.PI) / 2 + Math.PI / 2] });
      bk.add(sphere(0.3, 8, 6), PALETTE.ink, {});
      blades.add(mesh(bk, ctx, 'windmill-blades'));
      blades.position.set(0, 5.6, -1.1);
      g.add(blades);
      placed(ctx, g);
      addStatic(physics, g, [{ half: [0.8, 3, 0.8], offset: [0, 3, 0] }], 'wood');
      return {
        props,
        update: (t) => {
          blades.rotation.z += t.dt * (0.6 + t.wind.length() * 0.9);
        },
      };
    }
    case 'lab': {
      const l = new Group();
      const k = new Kit();
      k.add(rbox(7, 3.6, 5, 0.4), '#EEF6FF', { pos: [0, 1.8, 0] });
      k.add(new SphereGeometry(2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#9FD8F5', { pos: [0, 3.6, 0] });
      l.add(mesh(k, ctx, 'lab'));
      const glow = createUnlitMaterial('#7CFFB0');
      const tubes: Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const tube = new Mesh(cyl(0.45, 0.45, 2.4, 10), glow);
        tube.position.set(-2.4 + i * 1.6, 1.4, -3.2);
        l.add(tube);
        tubes.push(tube);
      }
      placed(ctx, l);
      addStatic(physics, l, [{ half: [3.5, 1.8, 2.5], offset: [0, 1.8, 0] }], 'metal');
      let bubbleT = 0;
      return {
        props,
        update: (t, near) => {
          bubbleT -= t.dt;
          tubes.forEach((tb, i) => tb.scale.set(1, 1 + Math.sin(t.time * 3 + i) * 0.05, 1));
          if (near && bubbleT <= 0) {
            bubbleT = 0.15;
            const tb = tubes[Math.floor(Math.random() * tubes.length)]!;
            tb.getWorldPosition(_w);
            _v.copy(_w).normalize();
            ctx.deps.particles.emit(_w.addScaledVector(_v, 1.3), _v.multiplyScalar(2), '#B6FFD9', { life: 1, size: 0.25, spread: 0.3 });
          }
        },
      };
    }
    case 'stage': {
      const s = new Group();
      const k = new Kit();
      k.add(rbox(8, 1, 5, 0.2), '#2B2D42', { pos: [0, 0.5, 0] });
      k.add(box(8.4, 0.3, 0.3), '#E5484D', { pos: [0, 5.2, 2.2] });
      for (const x of [-4, 4]) k.add(box(0.3, 5, 0.3), '#E5484D', { pos: [x, 2.6, 2.2] });
      k.add(box(7.6, 3.6, 0.1), '#6C7BD9', { pos: [0, 3, 2.4] });
      s.add(mesh(k, ctx, 'stage'));
      const lights: Group[] = [];
      for (const x of [-3, 0, 3]) {
        const g = new Group();
        const lk = new Kit();
        lk.add(cyl(0.3, 0.45, 0.8, 8), PALETTE.ink, { rot: [Math.PI / 2, 0, 0] });
        g.add(mesh(lk, ctx, 'spot'));
        const beam = new Mesh(new ConeGeometry(1.4, 7, 12, 1, true).translate(0, -3.5, 0).rotateX(-Math.PI / 2), createUnlitMaterial('#FFE6A8', { transparent: true, opacity: 0.18 }));
        beam.position.z = -0.4;
        g.add(beam);
        g.position.set(x, 5.2, 2.2);
        s.add(g);
        lights.push(g);
      }
      placed(ctx, s);
      addStatic(physics, s, [{ half: [4, 0.5, 2.5], offset: [0, 0.5, 0] }], 'wood');
      return {
        props,
        update: (t) => {
          for (const g of lights) {
            g.lookAt(t.planePos);
          }
        },
      };
    }
    case 'generic':
    default: {
      const g = new Group();
      for (let i = 0; i < 4; i++) {
        const palm = new Mesh(kindGeometry(PropKind.Palm), ctx.deps.material);
        palm.castShadow = true;
        palm.scale.setScalar(1.6);
        const a = i * 1.7;
        palm.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3);
        palm.rotation.y = a;
        g.add(palm);
      }
      placed(ctx, g);
      const palms = g.children;
      return {
        props,
        update: (t) => {
          palms.forEach((p, i) => (p.rotation.z = Math.sin(t.time * 1.3 + i) * 0.04));
        },
      };
    }
  }
}

void _q;
