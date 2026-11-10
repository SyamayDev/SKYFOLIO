/**
 * Kehidupan latar (docs/02 bagian 5): kawanan burung (boids sederhana, menghindar dari pesawat, pulang saat
 * malam), kapal di jalur laut dengan buih, paus yang melompat & menyembur, kereta di rel melingkar,
 * balon udara fisika yang memantul saat ditabrak, dan aurora di kedua kutub.
 * Semua hanya di-update bila dekat kamera; jumlah mengikuti tier kualitas.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import { abs, attribute, color, float, instanceIndex, hash, mix, positionGeometry, sin, smoothstep, time, uniform, vec3 } from 'three/tsl';
import { PALETTE } from '../config/palette';
import { PLANET_RADIUS } from '../config/world';
import type { QualityTier } from '../config/quality';
import { bus } from '../core/EventBus';
import { GROUP, interactionGroups, type PhysicsWorld } from '../physics/PhysicsWorld';
import { bearingDirection, latLonToVec3 } from '../utils/geo';
import { mulberry32 } from '../utils/rng';
import { Kit, box, cone, cyl, rbox, sphere } from '../utils/modeling/Kit';
import { setFlatShading, toonGradient } from '../utils/modeling/materials';
import { quatFromUpForward } from '../utils/quat';
import type { Particles } from './Particles';
import type { Planet } from './Planet';

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _v = new Vector3();
const _w = new Vector3();
const _up = new Vector3();
const _s = new Vector3();

const FLOCKS: Record<QualityTier, number> = { low: 3, medium: 6, high: 9, ultra: 12 };
const PER_FLOCK = 9;

interface Flock {
  center: Vector3;
  heading: Vector3;
  alt: number;
  phase: number;
  scare: number;
}

interface Ship {
  start: Vector3;
  axis: Vector3;
  speed: number;
  angle: number;
}

interface Whale {
  pos: Vector3;
  t: number;
  next: number;
  mesh: Group;
}

interface Train {
  center: Vector3;
  points: Vector3[];
  t: number;
  cars: Group[];
  built: boolean;
  root: Group;
}

interface Balloon {
  body: RAPIER.RigidBody;
  obj: Group;
  home: Vector3;
  phase: number;
  lastHit: number;
}

export class AmbientLife {
  readonly group = new Group();
  private birds: InstancedMesh;
  private readonly flocks: Flock[] = [];
  private ships: InstancedMesh;
  private readonly shipList: Ship[] = [];
  private readonly whales: Whale[] = [];
  private readonly trains: Train[] = [];
  private readonly balloons: Balloon[] = [];
  private readonly auroraMat: MeshBasicNodeMaterial;
  private readonly auroraNight = uniform(1);
  private wakeT = 0;
  enabled = true;
  private tier: QualityTier = 'high';

  constructor(
    scene: Scene,
    private readonly planet: Planet,
    private readonly physics: PhysicsWorld,
    private readonly particles: Particles,
    material: MeshToonNodeMaterial,
    tier: QualityTier,
  ) {
    this.group.name = 'ambient-life';
    scene.add(this.group);
    this.tier = tier;
    const rng = mulberry32(6060);

    // --- Burung: sayap mengepak di vertex shader (|x| besar = ujung sayap naik-turun).
    const bk = new Kit();
    bk.add(cone(0.12, 0.6, 4), '#2B2D42', { rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 0.7] });
    const wing = new BufferGeometry();
    wing.setAttribute('position', new Float32BufferAttribute([0, 0, -0.1, -0.9, 0, 0.15, 0, 0, 0.25, 0, 0, -0.1, 0, 0, 0.25, 0.9, 0, 0.15], 3));
    bk.add(wing, '#3A3D55', {});
    const bm = new MeshToonNodeMaterial({ vertexColors: true, gradientMap: toonGradient(), side: DoubleSide });
    setFlatShading(bm);
    const flap = sin(time.mul(14).add(hash(instanceIndex).mul(20))).mul(abs(positionGeometry.x)).mul(0.7);
    bm.positionNode = vec3(positionGeometry.x, positionGeometry.y.add(flap), positionGeometry.z);
    const maxBirds = FLOCKS.ultra * PER_FLOCK;
    this.birds = new InstancedMesh(bk.build(), bm, maxBirds);
    this.birds.frustumCulled = false;
    this.birds.count = 0;
    this.group.add(this.birds);
    for (let i = 0; i < FLOCKS.ultra; i++) this.flocks.push({ center: new Vector3(), heading: new Vector3(), alt: 0, phase: rng() * 10, scare: 0 });
    this.respawnFlocksAround(latLonToVec3(7.2, 97.7, PLANET_RADIUS), rng);

    // --- Kapal di jalur lingkaran besar samudra.
    const sk = new Kit();
    sk.add(rbox(1.6, 0.8, 5, 0.25), '#E5484D', { pos: [0, 0.2, 0] });
    sk.add(box(1.5, 0.15, 4.6), PALETTE.cream, { pos: [0, 0.65, 0] });
    sk.add(rbox(1.2, 1.1, 1.6, 0.15), '#FFFFFF', { pos: [0, 1.2, 0.9] });
    sk.add(cyl(0.25, 0.3, 1.1, 8), '#2B2D42', { pos: [0, 2.2, 0.9] });
    for (let i = 0; i < 3; i++) sk.add(box(1.0, 0.7, 0.9), ['#3AA0FF', '#FFC93C', '#3DCB7A'][i]!, { pos: [0, 1.05, -0.6 - i * 0.95] });
    this.ships = new InstancedMesh(sk.build(), material, 12);
    this.ships.frustumCulled = false;
    this.group.add(this.ships);
    const routes: [number, number, number][] = [
      [-5, 80, 75],
      [-20, 70, 110],
      [10, 150, 95],
      [25, -150, 80],
      [30, -40, 60],
      [-30, -20, 120],
      [5, 60, 40],
      [-40, 100, 90],
      [15, -60, 135],
      [-10, 170, 70],
      [0, 100, 135],
      [-35, 20, 95],
    ];
    for (const [lat, lon, heading] of routes) {
      const start = latLonToVec3(lat, lon, 1);
      const dir = bearingDirection(start, heading);
      this.shipList.push({ start, axis: new Vector3().crossVectors(start, dir).normalize(), speed: 0.0012 + rng() * 0.0008, angle: rng() * Math.PI * 2 });
    }

    // --- Paus (melompat berkala saat dekat kamera).
    const wk = new Kit();
    wk.add(sphere(1.4, 10, 8), '#3B5A80', { scale: [1, 0.8, 2.6] });
    wk.add(sphere(1.2, 10, 8), '#E9EDF2', { pos: [0, -0.4, 0.2], scale: [0.9, 0.5, 2.2] });
    wk.add(cone(1.0, 1.6, 4), '#3B5A80', { pos: [0, 0, 4], rot: [Math.PI / 2, 0, 0], scale: [1.6, 1, 0.3] });
    const whaleGeo = wk.build();
    for (const [lat, lon] of [
      [-8, 90],
      [20, -160],
      [-35, 40],
      [45, -40],
    ] as [number, number][]) {
      const g = new Group();
      const m = new Mesh(whaleGeo, material);
      m.castShadow = true;
      g.add(m);
      g.visible = false;
      this.group.add(g);
      this.whales.push({ pos: latLonToVec3(lat, lon, PLANET_RADIUS), t: -1, next: rng() * 8, mesh: g });
    }

    // --- Kereta di rel melingkar (Eropa, Amerika Utara, Asia Timur).
    for (const [lat, lon] of [
      [50, 15],
      [40, -95],
      [34, 112],
    ] as [number, number][]) {
      const root = new Group();
      this.group.add(root);
      this.trains.push({ center: latLonToVec3(lat, lon, 1), points: [], t: rng(), cars: [], built: false, root });
    }

    // --- Balon udara (fisika: rigid body ringan dengan pegas apung, memantul saat ditabrak).
    const spots: [number, number][] = [
      [38.6, 34.8],
      [35.1, -106.6],
      [21.2, 94.9],
      [4.3, 98.1],
      [-33.8, 151.0],
      [47.5, 8.0],
    ];
    const colors = ['#E5484D', '#FFC93C', '#3AA0FF', '#3DCB7A', '#B48CFF', '#FF9248'];
    spots.forEach(([lat, lon], i) => {
      const g = new Group();
      const k = new Kit();
      k.add(sphere(3.2, 12, 10), colors[i]!, { pos: [0, 5.2, 0], scale: [1, 1.15, 1], jitter: 0.03 });
      for (let s = 0; s < 6; s++) k.add(box(0.5, 6.6, 0.05), colors[(i + 2) % colors.length]!, { pos: [Math.cos((s / 6) * Math.PI * 2) * 2.4, 5.2, Math.sin((s / 6) * Math.PI * 2) * 2.4], rot: [0, -(s / 6) * Math.PI * 2, 0], scale: [1, 0.85, 1] });
      k.add(cone(1.2, 1.4, 8), colors[i]!, { pos: [0, 1.6, 0], rot: [Math.PI, 0, 0] });
      k.add(rbox(1.2, 0.9, 1.2, 0.15), '#8A6A4A', { pos: [0, 0.2, 0] });
      const m = new Mesh(k.build(), material);
      m.castShadow = true;
      g.add(m);
      const dir = latLonToVec3(lat, lon, 1);
      const h = Math.max(0, planet.heightAt(dir, 0));
      const home = dir.clone().multiplyScalar(PLANET_RADIUS + h + 24 + (i % 3) * 6);
      g.position.copy(home);
      g.quaternion.copy(quatFromUpForward(dir, bearingDirection(dir, 0), _q));
      this.group.add(g);
      const R = physics.R;
      const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(home.x, home.y, home.z).setLinearDamping(0.6).setAngularDamping(3).setCanSleep(true));
      body.lockRotations(true, true);
      const col = physics.world.createCollider(
        R.ColliderDesc.ball(3.4).setTranslation(0, 0, 0).setDensity(0.02).setRestitution(0.85).setCollisionGroups(interactionGroups(GROUP.PROP, 0xffff)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      const bal: Balloon = { body, obj: g, home, phase: i, lastHit: -10 };
      physics.setInfo(col, {
        kind: 'prop',
        material: 'fabric',
        onContact: (e) => {
          const now = performance.now() / 1000;
          if (e.otherInfo?.kind !== 'plane' || now - bal.lastHit < 1.5) return;
          bal.lastHit = now;
          bus.emit('prop:hit', { material: 'rubber', speed: Math.max(5, e.impactSpeed), point: e.point });
        },
      });
      this.balloons.push(bal);
    });

    // --- Aurora: pita bercahaya di sekitar kedua kutub.
    const am = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    am.fog = false;
    const v = attribute('uvh', 'vec2');
    const wave = sin(v.x.mul(40).add(time.mul(0.6))).mul(0.5).add(0.5);
    const fade = smoothstep(0, 0.25, v.y).mul(smoothstep(1, 0.4, v.y));
    am.colorNode = mix(color(new Color('#3DFF9A')), color(new Color('#7C6CFF')), v.y.mul(0.8).add(wave.mul(0.2))).mul(fade).mul(wave.mul(0.6).add(0.4)).mul(this.auroraNight).mul(float(0.9));
    this.auroraMat = am;
    for (const sign of [1, -1]) {
      const pos: number[] = [];
      const uvh: number[] = [];
      const idx: number[] = [];
      const seg = 160;
      for (let i = 0; i <= seg; i++) {
        const lon = (i / seg) * 360 - 180;
        const lat = sign * (68 + Math.sin(i * 0.37) * 3);
        for (let j = 0; j < 2; j++) {
          const p = latLonToVec3(lat, lon, PLANET_RADIUS + 55 + j * 38);
          pos.push(p.x, p.y, p.z);
          uvh.push(i / seg, j);
        }
      }
      for (let i = 0; i < seg; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setAttribute('uvh', new Float32BufferAttribute(uvh, 2));
      g.setIndex(idx);
      const mesh = new Mesh(g, am);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.name = `aurora-${sign > 0 ? 'n' : 's'}`;
      this.group.add(mesh);
    }
  }

  setTier(tier: QualityTier): void {
    this.tier = tier;
  }

  private respawnFlocksAround(center: Vector3, rng: () => number): void {
    for (const f of this.flocks) this.respawnFlock(f, center, rng);
  }

  private respawnFlock(f: Flock, around: Vector3, rng: () => number = Math.random): void {
    _up.copy(around).normalize();
    const b = bearingDirection(_up, rng() * 360, _v);
    const d = 30 + rng() * 90;
    f.center.copy(_up).addScaledVector(b, d / PLANET_RADIUS).normalize();
    f.heading.copy(bearingDirection(f.center, rng() * 360, _w));
    f.alt = 14 + rng() * 22;
    f.scare = 0;
  }

  update(dt: number, t: number, camPos: Vector3, planePos: Vector3, night: boolean, sunUp: number): void {
    if (!this.enabled) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const nFlocks = night ? Math.ceil(FLOCKS[this.tier] / 3) : FLOCKS[this.tier];
    let bi = 0;
    _up.copy(camPos).normalize();
    for (let i = 0; i < nFlocks; i++) {
      const f = this.flocks[i]!;
      // Terlalu jauh dari kamera → pindah ke dekat kamera.
      if (f.center.angleTo(_up) * PLANET_RADIUS > 170) this.respawnFlock(f, camPos);
      f.phase += dt;
      // Berkelok pelan; kabur dari pesawat.
      const pos = _p.copy(f.center).multiplyScalar(PLANET_RADIUS + f.alt + Math.max(0, this.planet.heightAt(f.center, 0)));
      const dPlane = pos.distanceTo(planePos);
      if (dPlane < 14) f.scare = 1;
      f.scare = Math.max(0, f.scare - dt * 0.3);
      if (f.scare > 0.5) {
        _w.copy(pos).sub(planePos);
        _w.addScaledVector(f.center, -_w.dot(f.center)).normalize();
        f.heading.lerp(_w, dt * 4).normalize();
        f.alt += dt * 6;
      } else {
        f.heading.applyAxisAngle(f.center, Math.sin(f.phase * 0.3) * dt * 0.3);
        f.alt += (24 - f.alt) * dt * 0.2;
      }
      const speed = 6 + f.scare * 10;
      f.center.addScaledVector(f.heading, (speed * dt) / PLANET_RADIUS).normalize();
      f.heading.addScaledVector(f.center, -f.heading.dot(f.center)).normalize();
      quatFromUpForward(f.center, f.heading, _q);
      for (let j = 0; j < PER_FLOCK; j++) {
        const a = j * 2.4 + f.phase * 0.7;
        const r = 1.2 + (j % 3) * 0.9;
        _v.set(Math.cos(a) * r, Math.sin(f.phase * 2 + j) * 0.5, Math.sin(a) * r * 0.6 + j * 0.3).applyQuaternion(_q);
        _w.copy(pos).add(_v);
        _s.setScalar(0.9 + (j % 3) * 0.15);
        _m.compose(_w, _q, _s);
        this.birds.setMatrixAt(bi++, _m);
      }
    }
    this.birds.count = bi;
    this.birds.instanceMatrix.needsUpdate = true;

    // Kapal.
    this.wakeT -= dt;
    this.shipList.forEach((s, i) => {
      s.angle += dt * s.speed;
      _p.copy(s.start).applyAxisAngle(s.axis, s.angle);
      _w.copy(s.axis).cross(_p).normalize();
      quatFromUpForward(_p, _w.negate(), _q);
      const bob = Math.sin(t * 1.3 + i) * 0.08;
      _v.copy(_p).multiplyScalar(PLANET_RADIUS + 0.05 + bob);
      _m.compose(_v, _q, _s.setScalar(1));
      this.ships.setMatrixAt(i, _m);
      if (this.wakeT <= 0 && _v.distanceTo(camPos) < 120) {
        _w.copy(_v).addScaledVector(_w.set(0, 0, 2.8).applyQuaternion(_q), 1);
        this.particles.emit(_w, _p.multiplyScalar(0.4), '#F4FFFF', { life: 2.2, size: 0.5, sizeEnd: 1.4, drag: 2, spread: 0.6 });
      }
    });
    if (this.wakeT <= 0) this.wakeT = 0.18;
    this.ships.instanceMatrix.needsUpdate = true;

    // Paus.
    for (const w of this.whales) {
      const near = w.pos.distanceTo(camPos) < 260;
      if (!near) {
        w.mesh.visible = false;
        continue;
      }
      if (w.t < 0) {
        w.next -= dt;
        if (w.next <= 0) w.t = 0;
        w.mesh.visible = false;
        continue;
      }
      w.t += dt;
      const k = w.t / 2.6;
      _up.copy(w.pos).normalize();
      const fwd = bearingDirection(_up, 70, _w);
      const arc = Math.sin(k * Math.PI);
      _p.copy(_up).addScaledVector(fwd, ((k - 0.5) * 9) / PLANET_RADIUS).normalize();
      w.mesh.visible = k < 1;
      w.mesh.position.copy(_p).multiplyScalar(PLANET_RADIUS - 2 + arc * 5);
      quatFromUpForward(_p, fwd, w.mesh.quaternion);
      w.mesh.rotateX((k - 0.5) * 1.6);
      if (Math.abs(k - 0.08) < dt / 2.6 || Math.abs(k - 0.92) < dt / 2.6) {
        this.particles.burst(_v.copy(_p).multiplyScalar(PLANET_RADIUS + 0.3), 22, ['#FFFFFF', '#BDE8FF'], { speed: 3, up: _p, upSpeed: 6, life: 1.2, size: 0.4, gravity: 8 });
        bus.emit('plane:splash', { speed: 3, point: { x: _v.x, y: _v.y, z: _v.z } });
      }
      if (k >= 1) {
        w.t = -1;
        w.next = 6 + Math.random() * 10;
      }
    }

    // Kereta.
    for (const tr of this.trains) {
      const d = tr.center.angleTo(_up) * PLANET_RADIUS;
      if (d > 260) {
        tr.root.visible = false;
        continue;
      }
      tr.root.visible = true;
      if (!tr.built) this.buildTrain(tr);
      tr.t = (tr.t + dt * 0.02) % 1;
      tr.cars.forEach((car, ci) => {
        const u = (tr.t - ci * 0.012 + 1) % 1;
        const n = tr.points.length;
        const fi = u * n;
        const a = tr.points[Math.floor(fi) % n]!;
        const b = tr.points[(Math.floor(fi) + 1) % n]!;
        car.position.lerpVectors(a, b, fi - Math.floor(fi));
        _w.subVectors(b, a);
        quatFromUpForward(_v.copy(car.position).normalize(), _w, car.quaternion);
      });
    }

    // Balon udara: pegas apung lembut ke titik melayang.
    for (const b of this.balloons) {
      const tr0 = b.body.translation();
      _p.set(tr0.x, tr0.y, tr0.z);
      if (_p.distanceTo(camPos) > 300) {
        if (!b.body.isSleeping()) b.body.sleep();
        continue;
      }
      b.phase += dt;
      const lv = b.body.linvel();
      _v.copy(b.home).sub(_p).multiplyScalar(0.8);
      _up.copy(b.home).normalize();
      _v.addScaledVector(_up, Math.sin(b.phase * 0.4) * 0.5);
      const m = b.body.mass();
      b.body.applyImpulse({ x: (_v.x - lv.x * 0.6) * m * dt, y: (_v.y - lv.y * 0.6) * m * dt, z: (_v.z - lv.z * 0.6) * m * dt }, true);
      b.obj.position.copy(_p);
    }

    // Hanya saat matahari di bawah horizon kamera (aurora tak terlihat di langit siang/senja).
    const k = Math.max(0, Math.min(1, (-0.04 - sunUp) / 0.2));
    this.auroraNight.value = k;
    for (const c of this.group.children) if (c.name.startsWith('aurora')) c.visible = k > 0.01;
  }

  private buildTrain(tr: Train): void {
    tr.built = true;
    const n = 90;
    const east = new Vector3(0, 1, 0).cross(tr.center).normalize();
    const north = new Vector3().crossVectors(tr.center, east);
    const R = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dir = tr.center
        .clone()
        .addScaledVector(east, (Math.cos(a) * R) / PLANET_RADIUS)
        .addScaledVector(north, (Math.sin(a) * R * 0.7) / PLANET_RADIUS)
        .normalize();
      tr.points.push(dir.multiplyScalar(PLANET_RADIUS + Math.max(0.5, this.planet.heightAt(dir, 0)) + 0.35));
    }
    // Rel (segmen balok di sepanjang lintasan).
    const rk = new Kit();
    for (let i = 0; i < n; i++) {
      const a = tr.points[i]!;
      const b = tr.points[(i + 1) % n]!;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const g = new Group();
      g.position.copy(mid);
      quatFromUpForward(mid.clone().normalize(), b.clone().sub(a), g.quaternion);
      g.updateMatrix();
      const len = a.distanceTo(b);
      rk.addMatrix(box(1.4, 0.12, len), '#8A6A4A', g.matrix);
    }
    const rails = new Mesh(rk.build(), this.ships.material as MeshToonNodeMaterial);
    rails.receiveShadow = true;
    tr.root.add(rails);
    const colors = ['#E5484D', '#3AA0FF', '#FFC93C', '#3DCB7A'];
    for (let c = 0; c < 4; c++) {
      const g = new Group();
      const k = new Kit();
      k.add(rbox(1.3, 1.2, 2.4, 0.2), colors[c]!, { pos: [0, 0.75, 0] });
      if (c === 0) {
        k.add(cyl(0.25, 0.3, 0.8, 8), '#2B2D42', { pos: [0, 1.7, -0.6] });
        k.add(rbox(1.2, 0.5, 0.8, 0.15), '#FFFFFF', { pos: [0, 1.5, 0.6] });
      } else for (let w = -1; w <= 1; w++) k.add(box(0.05, 0.4, 0.5), '#9FD8F5', { pos: [0.66, 0.95, w * 0.7] });
      const m = new Mesh(k.build(), this.ships.material as MeshToonNodeMaterial);
      m.castShadow = true;
      g.add(m);
      tr.root.add(g);
      tr.cars.push(g);
    }
  }

  dispose(): void {
    this.birds.geometry.dispose();
    this.ships.geometry.dispose();
    this.auroraMat.dispose();
    for (const b of this.balloons) this.physics.world.removeRigidBody(b.body);
  }
}
