/**
 * Pegunungan Skill (docs/02 bagian 3.6): satu puncak per skill, tinggi = level/5 × SKILL_PEAK_MAX_HEIGHT.
 * Kelompok skill membentuk punggungan berbeda. Puncak level 5 bersalju dan berbendera "AHLI/EXPERT".
 * Cincin bernama melayang dekat puncak: menembusnya → papan skill + nada naik sesuai level.
 * Balon skill kecil beterbangan; ditabrak → pecah jadi konfeti dan menampilkan skill-nya.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, Quaternion, Vector3 } from 'three';
import { PALETTE } from '../../config/palette';
import { SKILL_PEAK_MAX_HEIGHT } from '../../config/world';
import { L, content, skillName } from '../../content';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { GROUP, interactionGroups } from '../../physics/PhysicsWorld';
import { SimplexNoise } from '../../utils/noise';
import { mulberry32 } from '../../utils/rng';
import { Kit, cyl, ico, torus } from '../../utils/modeling/Kit';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { SurfaceFrame, addSensor, makeMesh, type ZoneDeps } from './ZoneKit';

interface SkillRing {
  center: Vector3;
  normal: Vector3;
  radius: number;
  name: string;
  level: number;
  levelText: string;
  passed: boolean;
  prevSide: number;
  mesh: Mesh;
  flash: number;
}

interface SkillBalloon {
  obj: Group;
  home: Vector3;
  name: string;
  popped: number;
  phase: number;
}

const _v = new Vector3();
const _q = new Quaternion();
const RIDGE_SPACING = 30;
const PEAK_SPACING = 17;

/** Gunung low-poly bergerigi (kerucut bernoise) — geometri non-indexed berwarna per muka. */
function mountain(height: number, radius: number, seed: number, snow: boolean): BufferGeometry {
  const noise = new SimplexNoise(seed);
  const seg = 9;
  const rings = 5;
  const pts: Vector3[][] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const row: Vector3[] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2 + i * 0.35;
      const r = radius * t * (1 + noise.noise3(Math.cos(a), Math.sin(a), i * 0.7) * 0.25);
      const h = i === rings ? -2 : height * (1 - t) ** 1.15 * (1 + noise.noise3(j * 0.5, i * 0.5, 3) * 0.08);
      row.push(new Vector3(Math.cos(a) * r, h, Math.sin(a) * r));
    }
    pts.push(row);
  }
  const pos: number[] = [];
  const col: number[] = [];
  const rock = new Color(PALETTE.rock);
  const rock2 = new Color('#8A7F7A');
  const white = new Color(PALETTE.snow);
  const grass = new Color(PALETTE.grassBoreal);
  const tri = (a: Vector3, b: Vector3, c: Vector3, i: number): void => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const h = (a.y + b.y + c.y) / 3 / height;
    const cc = snow && h > 0.62 ? white : !snow && h > 0.82 ? white : h < 0.18 ? grass : i % 2 ? rock : rock2;
    for (let n = 0; n < 3; n++) col.push(cc.r, cc.g, cc.b);
  };
  const top = new Vector3(0, height, 0);
  for (let j = 0; j < seg; j++) tri(top, pts[1]![(j + 1) % seg]!, pts[1]![j]!, j);
  for (let i = 1; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = pts[i]![j]!;
      const b = pts[i]![(j + 1) % seg]!;
      const c = pts[i + 1]![j]!;
      const d = pts[i + 1]![(j + 1) % seg]!;
      tri(a, b, c, i + j);
      tri(b, d, c, i + j + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export class SkillPeaks extends Zone {
  private frame!: SurfaceFrame;
  private readonly rings: SkillRing[] = [];
  private readonly balloons: SkillBalloon[] = [];
  private readonly flags: Group[] = [];
  private noteIndex = 0;

  constructor() {
    super('skill-peaks');
    this.icon = '⛰️';
    this.color = '#9C8F86';
    this.triggerRadius = 60;
    this.height = 75;
  }

  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    this.frame = new SurfaceFrame(z?.lat ?? 29, z?.lon ?? 85, 90, deps.planet);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, SKILL_PEAK_MAX_HEIGHT + 18, 0));
    deps.scatter.addExclusion(this.frame.dir, 70);
  }

  protected build(): void {
    const f = this.frame;
    const c = content.get();
    const groups = c.skills.groups.filter((g) => g.skills.length);
    const rng = mulberry32(5150);
    groups.forEach((g, gi) => {
      const z = (gi - (groups.length - 1) / 2) * RIDGE_SPACING;
      // Papan nama punggungan.
      const label = new Billboard(() => L(g.label), { width: 9, height: 1.6, bg: 'rgba(255,246,230,0.95)', fontSize: 80 });
      this.boards.push(label);
      label.object.position.copy(f.point(-((g.skills.length + 1) / 2) * PEAK_SPACING, 14, z));
      this.group.add(label.object);
      g.skills.forEach((s, si) => {
        const x = (si - (g.skills.length - 1) / 2) * PEAK_SPACING + (rng() - 0.5) * 4;
        const zz = z + (rng() - 0.5) * 6;
        const h = (s.level / 5) * SKILL_PEAK_MAX_HEIGHT;
        const expert = s.level >= 5;
        const peak = new Mesh(mountain(h, 7 + h * 0.18, 100 + gi * 10 + si, expert), this.deps.material);
        peak.castShadow = true;
        peak.receiveShadow = true;
        peak.name = `peak-${s.id}`;
        const holder = new Group();
        holder.add(peak);
        f.place(holder, x, zz, -0.5);
        this.group.add(holder);
        // Collider convex dari titik-titik gunung.
        holder.updateMatrixWorld();
        const posAttr = peak.geometry.getAttribute('position');
        const pts = new Float32Array(posAttr.count * 3);
        for (let i = 0; i < posAttr.count; i++) {
          _v.fromBufferAttribute(posAttr, i).applyMatrix4(holder.matrixWorld);
          pts[i * 3] = _v.x;
          pts[i * 3 + 1] = _v.y;
          pts[i * 3 + 2] = _v.z;
        }
        const R = this.deps.physics.R;
        const desc = R.ColliderDesc.convexHull(pts);
        if (desc) {
          const col = this.deps.physics.world.createCollider(desc.setCollisionGroups(interactionGroups(GROUP.STATIC, 0xffff)).setFriction(0.9));
          this.deps.physics.setInfo(col, { kind: 'static', material: expert ? 'snow' : 'rock' });
          this.colliders.push(col);
        }
        const name = skillName(s.name);
        const lvlText = L(c.skills.levelScale[String(s.level)]);
        // Bendera AHLI untuk level 5.
        if (expert) {
          const fl = new Group();
          const fk = new Kit();
          fk.add(cyl(0.08, 0.08, 3.4, 5), PALETTE.ink, { pos: [0, 1.7, 0] });
          fl.add(makeMesh(fk, this.deps.material, 'flag-pole'));
          const cloth = new Billboard(() => tr('zones.skills.expert'), { width: 2.6, height: 1.2, sprite: false, bg: PALETTE.sun, fontSize: 70 });
          this.boards.push(cloth);
          cloth.object.position.set(1.35, 2.8, 0);
          fl.add(cloth.object);
          f.place(fl, x, zz, h - 1.2);
          this.group.add(fl);
          this.flags.push(fl);
        }
        // Cincin skill di samping puncak.
        const ringR = 3.6;
        const rk = new Kit().add(torus(ringR, 0.28, 8, 28), expert ? PALETTE.sun : '#9FD8F5', {});
        const ring = makeMesh(rk, this.deps.material, `ring-${s.id}`);
        const rg = new Group();
        rg.add(ring);
        const tag = new Billboard(() => `${name} · ${lvlText}`, { width: 6, height: 1.1, bg: 'rgba(43,45,66,0.85)', color: '#FFF6E6', fontSize: 64 });
        this.boards.push(tag);
        tag.object.position.set(0, ringR + 1.4, 0);
        rg.add(tag.object);
        f.place(rg, x - 7.5, zz, h * 0.78 + 4);
        this.group.add(rg);
        rg.updateMatrixWorld();
        const center = rg.getWorldPosition(new Vector3());
        const normal = new Vector3(0, 0, 1).applyQuaternion(rg.getWorldQuaternion(_q)).normalize();
        this.rings.push({ center, normal, radius: ringR, name, level: s.level, levelText: lvlText, passed: false, prevSide: 0, mesh: ring, flash: 0 });
        // Balon skill.
        const bg = new Group();
        const bk = new Kit();
        bk.add(ico(1.1, 1), ['#FF5A5F', '#3AA0FF', '#3DCB7A', '#FFC93C', '#B48CFF'][(gi + si) % 5]!, {});
        bk.add(cyl(0.02, 0.02, 2, 3), PALETTE.ink, { pos: [0, -2, 0] });
        bg.add(makeMesh(bk, this.deps.material, 'skill-balloon', false));
        f.place(bg, x + 6, zz + 5, h * 0.5 + 6);
        this.group.add(bg);
        const bal: SkillBalloon = { obj: bg, home: bg.position.clone(), name: `${name} · ${lvlText}`, popped: 0, phase: rng() * 6 };
        this.balloons.push(bal);
        this.colliders.push(
          addSensor(this.deps.physics, bg.position, 1.6, () => {
            if (bal.popped > 0) return;
            bal.popped = 20;
            bg.visible = false;
            this.deps.particles.burst(bg.position, 28, ['#FFC93C', '#FF5A5F', '#3AA0FF', '#3DCB7A', '#FFFFFF'], { speed: 5, life: 1.3, size: 0.3, gravity: 4 });
            bus.emit('prop:hit', { material: 'rubber', speed: 8, point: { x: bg.position.x, y: bg.position.y, z: bg.position.z } });
            bus.emit('toast', { text: bal.name, kind: 'success', icon: '🎈' });
          }),
        );
      });
    });
  }

  override update(t: ZoneTick): void {
    for (const r of this.rings) {
      _v.copy(t.planePos).sub(r.center);
      const side = Math.sign(_v.dot(r.normal));
      const inPlane = _v.addScaledVector(r.normal, -_v.dot(r.normal)).length() < r.radius;
      if (r.prevSide !== 0 && side !== r.prevSide && inPlane && t.planePos.distanceTo(r.center) < r.radius + 2) {
        r.flash = 1;
        if (!r.passed) {
          r.passed = true;
          bus.emit('ring:passed', { index: this.rings.indexOf(r), total: this.rings.length, label: r.name });
        }
        this.noteIndex++;
        bus.emit('toast', { text: tr('zones.skills.ring', { name: r.name, level: r.levelText }), kind: 'success', icon: '🎵' });
        bus.emit('interact', { zone: this.id, action: `skill-ring:${r.level}` });
        if (this.rings.every((x) => x.passed)) bus.emit('interact', { zone: this.id, action: 'all-skill-rings' });
      }
      r.prevSide = side;
      if (r.flash > 0) r.flash = Math.max(0, r.flash - t.dt * 1.5);
      r.mesh.scale.setScalar(1 + r.flash * 0.25);
      r.mesh.rotation.z += t.dt * 0.4;
    }
    for (const b of this.balloons) {
      if (b.popped > 0) {
        b.popped -= t.dt;
        if (b.popped <= 0) b.obj.visible = true;
      }
      b.phase += t.dt;
      _v.copy(b.home).normalize();
      b.obj.position.copy(b.home).addScaledVector(_v, Math.sin(b.phase * 0.8) * 1.2);
    }
    for (const fl of this.flags) fl.children[1]!.rotation.y = Math.sin(t.time * 2) * 0.15;
  }

  override action(): ZoneAction {
    return { label: 'actions.viewSkills', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}
