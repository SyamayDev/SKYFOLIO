/**
 * Bandara Asal Medan versi awal (docs/02 bagian 3.1).
 * Semua bagian ditempatkan lewat AirportFrame supaya cocok dengan medan yang diratakan build-earth.
 * Landasan dibuat melengkung mengikuti bola planet (landasan 40 unit melengkung ±0,5 unit).
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
} from 'three';
import { AIRPORT } from '../../config/world';
import { RESPAWN } from '../../config/flight';
import { EXTRA, PALETTE } from '../../config/palette';
import type { InputDevice } from '../../core/EventBus';
import { tr } from '../../i18n';
import { GROUP, interactionGroups, type PhysicsWorld, type SurfaceMaterial } from '../../physics/PhysicsWorld';
import { Prop } from '../../physics/Props';
import type { RadialGravity } from '../../physics/RadialGravity';
import { Kit, box, cyl, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { createUnlitVertexColorMaterial } from '../../utils/modeling/materials';
import { quatFromUpForward } from '../../utils/quat';
import { DEG2RAD } from '../../utils/math';
import type { SpawnPoint } from '../../vehicle/Plane';
import { AirportFrame } from '../AirportLayout';
import { Billboard, roundRect } from '../Billboard';
import { buildMosque, buildPalace, type StaticShape } from '../Landmarks/MedanLandmarks';
import { RunwayLetters } from './RunwayLetters';
import { TrainingRings } from './TrainingRings';

const _m = new Matrix4();
const ONE = new Vector3(1, 1, 1);
const POST_FWD = new Vector3(1, 0.3, 0.2);
const _v = new Vector3();
const _w = new Vector3();
const _q = new Quaternion();

/** Grid melengkung di permukaan bandara (koordinat lokal along/side), menghadap ke atas. */
function curvedRect(
  frame: AirportFrame,
  a0: number,
  a1: number,
  s0: number,
  s1: number,
  lift: number,
  segA: number,
  segS = 1,
): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segA; i++) {
    for (let j = 0; j <= segS; j++) {
      const p = frame.onSurface(a0 + ((a1 - a0) * i) / segA, s0 + ((s1 - s0) * j) / segS, lift, _v);
      pos.push(p.x, p.y, p.z);
    }
  }
  const row = segS + 1;
  for (let i = 0; i < segA; i++) {
    for (let j = 0; j < segS; j++) {
      const p00 = i * row + j;
      const p10 = (i + 1) * row + j;
      const p01 = i * row + j + 1;
      const p11 = (i + 1) * row + j + 1;
      // depan × kanan = bawah → urutan dibalik supaya menghadap atas.
      idx.push(p00, p01, p10, p10, p01, p11);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Orientasi lokal (atas = atas planet, depan = arah tertentu). */
function localQuat(position: Vector3, forward: Vector3): Quaternion {
  return quatFromUpForward(_w.copy(position).normalize(), forward, new Quaternion());
}

export class HomeAirport {
  readonly group = new Group();
  readonly frame = new AirportFrame();
  readonly letters: RunwayLetters;
  readonly rings: TrainingRings;
  readonly luggage: Prop[] = [];
  /** Koper digambar sebagai 2 InstancedMesh (badan berwarna + detail); tiap koper tetap rigid body sendiri. */
  private readonly luggageProxies: Object3D[] = [];
  private readonly luggageColors: string[] = [];
  private luggageBody: InstancedMesh | null = null;
  private luggageDetail: InstancedMesh | null = null;
  readonly sign: Billboard;
  private readonly statics: RAPIER.RigidBody[] = [];
  private readonly windsock = new Group();
  private readonly sock = new Group();
  private readonly lights: InstancedMesh;
  private readonly lightBase: Color[] = [];
  private device: InputDevice = 'keyboard';

  constructor(
    private readonly physics: PhysicsWorld,
    gravity: RadialGravity,
    private readonly material: Material,
    private readonly groundHeight: (dir: Vector3) => number | null,
  ) {
    this.group.name = 'home-airport';
    const f = this.frame;
    const hl = f.halfLength;
    const hw = f.halfWidth;

    // ---------------- Landasan, marka, apron
    const k = new Kit();
    k.add(curvedRect(f, -hl, hl, -hw, hw, 0.06, 40, 4), EXTRA.runway, { jitter: 0.015 });
    // Bahu landasan (lebih terang)
    for (const s of [-1, 1]) k.add(curvedRect(f, -hl, hl, s > 0 ? hw : -hw - 0.6, s > 0 ? hw + 0.6 : -hw, 0.05, 20), '#8A8F9C');
    // Garis tepi, garis tengah putus-putus, ambang (zebra), zona sentuh.
    const W = EXTRA.runwayMark;
    for (const s of [-1, 1]) k.add(curvedRect(f, -hl + 0.5, hl - 0.5, s * (hw - 0.35) - 0.09, s * (hw - 0.35) + 0.09, 0.075, 20), W);
    for (let a = -hl + 6; a < hl - 6; a += 4.5) k.add(curvedRect(f, a, a + 2.4, -0.12, 0.12, 0.075, 2), W);
    for (const end of [-1, 1]) {
      const a0 = end < 0 ? -hl + 0.8 : hl - 3.8;
      for (let i = 0; i < 4; i++) {
        const s = -hw + 0.9 + i * 0.75;
        k.add(curvedRect(f, a0, a0 + 3, s, s + 0.35, 0.075, 2), W);
        k.add(curvedRect(f, a0, a0 + 3, -s - 0.35, -s, 0.075, 2), W);
      }
      const tz = end < 0 ? -hl + 9 : hl - 11;
      for (const s of [-1, 1]) k.add(curvedRect(f, tz, tz + 2, s * 1.2 - 0.45, s * 1.2 + 0.45, 0.075, 2), W);
    }
    // Apron + garis taksi kuning ke hangar.
    k.add(curvedRect(f, -21, -5, hw + 0.6, 13, 0.05, 8, 4), '#A9AEB8', { jitter: 0.01 });
    k.add(curvedRect(f, -13.2, -12.8, hw - 0.2, 9, 0.07, 1, 4), PALETTE.sun);
    k.add(curvedRect(f, -17, -9, 4.0, 4.3, 0.075, 4), PALETTE.sun);
    const runway = new Mesh(k.build(), material);
    runway.receiveShadow = true;
    runway.name = 'runway';
    this.group.add(runway);

    // Nomor landasan "15" (ujung awal) dan "33" (ujung akhir) — heading 150°.
    this.addRunwayNumber('15', -hl + 5.6, 1);
    this.addRunwayNumber('33', hl - 5.6, -1);

    // ---------------- Lampu landasan (instanced, tanpa cahaya)
    const lightPos: Vector3[] = [];
    const lightCol: string[] = [];
    for (let a = -hl; a <= hl + 0.01; a += 4) {
      for (const s of [-1, 1]) {
        lightPos.push(f.onSurface(a, s * (hw + 0.35), 0.18));
        lightCol.push('#FFF1C4');
      }
    }
    for (let i = 0; i < 6; i++) {
      const s = -hw + 0.7 + i * ((hw * 2 - 1.4) / 5);
      lightPos.push(f.onSurface(-hl - 0.4, s, 0.18));
      lightCol.push('#3DFF7A');
      lightPos.push(f.onSurface(hl + 0.4, s, 0.18));
      lightCol.push('#FF4B55');
    }
    // PAPI: 2 merah + 2 putih di kiri zona sentuh.
    for (let i = 0; i < 4; i++) {
      lightPos.push(f.onSurface(-hl + 9, -hw - 1.6 - i * 0.7, 0.35));
      lightCol.push(i < 2 ? '#FFFFFF' : '#FF4B55');
    }
    const lampGeo = new Kit().add(sphere(0.13, 6, 4), '#FFFFFF').build();
    this.lights = new InstancedMesh(lampGeo, createUnlitVertexColorMaterial(), lightPos.length);
    this.lights.name = 'runway-lights';
    const postKit = new Kit();
    lightPos.forEach((p, i) => {
      _m.makeTranslation(p.x, p.y, p.z);
      this.lights.setMatrixAt(i, _m);
      const c = new Color(lightCol[i]!);
      this.lightBase.push(c);
      this.lights.setColorAt(i, c);
      // Tiang kecil di bawah lampu.
      const up = _v.copy(p).normalize();
      _m.compose(_w.copy(p).addScaledVector(up, -0.12), quatFromUpForward(up, POST_FWD, _q), ONE);
      postKit.addMatrix(cyl(0.04, 0.05, 0.3, 4), PALETTE.ink, _m);
    });
    this.lights.instanceMatrix.needsUpdate = true;
    this.lights.frustumCulled = false;
    this.group.add(this.lights);
    const posts = new Mesh(postKit.build(), material);
    posts.name = 'light-posts';
    this.group.add(posts);

    // ---------------- Hangar
    this.buildHangar(-13, 9.6);

    // ---------------- Kantong angin
    this.buildWindsock(-6, 8.6);

    // ---------------- Koper (fisika)
    this.buildLuggage(gravity, -19, 6.6, 7);
    this.buildLuggage(gravity, -8.5, 7.2, 6);
    this.finishLuggage();

    // ---------------- Papan tutorial (berganti sesuai perangkat)
    this.sign = new Billboard(() => '', {
      width: 5.6,
      height: 2.9,
      sprite: false,
      draw: (g, w, h) => this.drawSign(g, w, h),
    });
    this.placeSign(-12, -7.2);

    // ---------------- Huruf + cincin
    this.letters = new RunwayLetters(physics, gravity, material, f, RESPAWN.SPAWN_ALONG + 8.5);
    this.group.add(this.letters.group);
    this.rings = new TrainingRings(material, f);
    this.group.add(this.rings.group);

    // ---------------- Landmark Medan (versi sederhana) di daratan sisi kanan landasan.
    this.placeLandmark(buildPalace(material), 11, 11.2, 'rock');
    this.placeLandmark(buildMosque(material), 16.5, 11.6, 'rock');
  }

  // --- Builder ---------------------------------------------------------------------------------

  private addStatic(position: Vector3, rotation: Quaternion, shapes: StaticShape[], material: SurfaceMaterial): void {
    const R = this.physics.R;
    const body = this.physics.world.createRigidBody(
      R.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }),
    );
    for (const s of shapes) {
      const c = this.physics.world.createCollider(
        R.ColliderDesc.cuboid(s.half[0], s.half[1], s.half[2])
          .setTranslation(s.offset[0], s.offset[1], s.offset[2])
          .setCollisionGroups(interactionGroups(GROUP.STATIC, 0xffff))
          .setFriction(0.7)
          .setRestitution(0.2),
        body,
      );
      this.physics.setInfo(c, { kind: 'static', material });
    }
    this.statics.push(body);
  }

  private addRunwayNumber(text: string, along: number, dir: 1 | -1): void {
    const b = new Billboard(() => text, {
      width: 3,
      height: 3,
      sprite: false,
      draw: (g, w, h) => {
        g.fillStyle = '#FFFFFF';
        g.font = `700 ${Math.round(h * 0.62)}px Fredoka, "Nunito Sans", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + h * 0.04);
      },
    });
    const p = this.frame.onSurface(along, 0, 0.08);
    const up = p.clone().normalize();
    const fwd = this.frame.forwardAt(along, 0, new Vector3()).multiplyScalar(dir);
    const right = new Vector3().crossVectors(fwd, up);
    _m.makeBasis(right, fwd, up);
    b.object.quaternion.setFromRotationMatrix(_m);
    b.object.position.copy(p);
    this.group.add(b.object);
  }

  private buildHangar(along: number, side: number): void {
    const p = this.frame.onSurface(along, side, 0);
    const toRunway = this.frame.toWorld(along, side - 1, 0).sub(this.frame.toWorld(along, side, 0)).normalize();
    // Model hangar: bukaan menghadap −Z (ke landasan).
    const q = localQuat(p, toRunway);
    const k = new Kit();
    const W = 9;
    const D = 7;
    const H = 3.2;
    k.add(box(W + 0.6, 0.12, D + 0.4), '#B9BEC7', { pos: [0, 0.06, 0] });
    k.add(box(W, H, 0.3), PALETTE.cream, { pos: [0, H / 2, D / 2], jitter: 0.02 });
    for (const s of [-1, 1]) {
      k.add(box(0.3, H, D), PALETTE.cream, { pos: [s * (W / 2), H / 2, 0], jitter: 0.02 });
      k.add(box(0.45, H + 0.2, 0.45), PALETTE.ink, { pos: [s * (W / 2), H / 2, -D / 2] });
      // Jendela samping
      for (let i = -1; i <= 1; i++) k.add(rbox(0.06, 0.6, 1.1, 0.1), EXTRA.glass, { pos: [s * (W / 2 + 0.16), H * 0.62, i * 2] });
    }
    // Atap melengkung (setengah silinder, sumbu sepanjang Z).
    const roof = new CylinderGeometry(W / 2 + 0.2, W / 2 + 0.2, D + 0.5, 14, 1, false, -Math.PI / 2, Math.PI);
    roof.rotateX(-Math.PI / 2);
    roof.scale(1, 0.55, 1);
    k.add(roof, PALETTE.sky, { pos: [0, H, 0], jitter: 0.02 });
    // Garis putih di atap
    for (const z of [-2.2, 0, 2.2]) {
      const strip = new CylinderGeometry(W / 2 + 0.24, W / 2 + 0.24, 0.25, 14, 1, true, -Math.PI / 2, Math.PI);
      strip.rotateX(-Math.PI / 2);
      strip.scale(1, 0.55, 1);
      k.add(strip, PALETTE.cream, { pos: [0, H, z] });
    }
    k.add(box(W, 0.35, 0.4), PALETTE.ink, { pos: [0, H + 0.1, -D / 2] });
    const mesh = new Mesh(k.build(), this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'hangar';
    const g = new Group();
    g.position.copy(p);
    g.quaternion.copy(q);
    g.add(mesh);
    // Papan nama di atas pintu.
    const plate = new Billboard(() => 'SKYFOLIO · PK-ARL', {
      width: 6,
      height: 0.9,
      sprite: false,
      draw: (ctx, w, h) => {
        ctx.fillStyle = PALETTE.sun;
        roundRect(ctx, 4, 4, w - 8, h - 8, h * 0.35);
        ctx.fill();
        ctx.fillStyle = PALETTE.ink;
        ctx.font = `700 ${Math.round(h * 0.6)}px Fredoka, "Nunito Sans", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SKYFOLIO · PK-ARL', w / 2, h / 2 + 4);
      },
    });
    plate.object.position.set(0, H + 1.0, -D / 2 - 0.65);
    plate.object.rotation.y = Math.PI;
    g.add(plate.object);
    this.group.add(g);
    this.addStatic(
      p,
      q,
      [
        { half: [W / 2, H / 2, 0.15], offset: [0, H / 2, D / 2] },
        { half: [0.2, H / 2, D / 2], offset: [-W / 2, H / 2, 0] },
        { half: [0.2, H / 2, D / 2], offset: [W / 2, H / 2, 0] },
        { half: [W / 2, 0.6, D / 2], offset: [0, H + 1.4, 0] },
      ],
      'metal',
    );
  }

  private buildWindsock(along: number, side: number): void {
    const p = this.frame.onSurface(along, side, 0);
    const q = localQuat(p, this.frame.forwardAt(along, side, new Vector3()));
    const pole = new Kit()
      .add(cyl(0.06, 0.08, 3.4, 6), EXTRA.metal, { pos: [0, 1.7, 0] })
      .add(box(0.5, 0.1, 0.5), PALETTE.ink, { pos: [0, 0.05, 0] })
      .add(torus(0.28, 0.035, 4, 12), PALETTE.ink, { pos: [0, 3.35, 0.0], rot: [0, Math.PI / 2, 0] })
      .build();
    const poleMesh = new Mesh(pole, this.material);
    poleMesh.castShadow = true;
    this.windsock.add(poleMesh);
    // Kaus angin: segmen kerucut bergaris oranye/putih, pivot di ujung tiang.
    const sk = new Kit();
    for (let i = 0; i < 5; i++) {
      const r0 = 0.28 - i * 0.04;
      const r1 = 0.28 - (i + 1) * 0.04;
      const seg = new CylinderGeometry(r1, r0, 0.42, 10, 1, true);
      seg.rotateX(-Math.PI / 2);
      sk.add(seg, i % 2 ? '#FFFFFF' : '#FF7A3D', { pos: [0, 0, -0.21 - i * 0.42] });
    }
    const sockMesh = new Mesh(sk.build(), this.material);
    sockMesh.castShadow = true;
    this.sock.add(sockMesh);
    this.sock.position.set(0, 3.35, 0);
    this.windsock.add(this.sock);
    this.windsock.position.copy(p);
    this.windsock.quaternion.copy(q);
    this.windsock.name = 'windsock';
    this.group.add(this.windsock);
    this.addStatic(p, q, [{ half: [0.1, 1.7, 0.1], offset: [0, 1.7, 0] }], 'metal');
  }

  private buildLuggage(gravity: RadialGravity, along: number, side: number, count: number): void {
    const colors = [PALETTE.berry, PALETTE.sky, PALETTE.sun, PALETTE.leaf, '#B58CFF', PALETTE.lantern, '#FF9AA2'];
    const fwd = this.frame.forwardAt(along, side, new Vector3());
    let placed = 0;
    // Piramida: 3 di bawah, 2 di tengah, 1-2 di atas.
    const layout: [number, number, number][] = [
      [-0.55, 0, 0],
      [0.55, 0, 0],
      [0, 0, 0.75],
      [-0.28, 1, 0.3],
      [0.32, 1, 0.3],
      [0.0, 2, 0.35],
      [0.0, 0, -0.75],
    ];
    for (const [dx, layer, dz] of layout) {
      if (placed >= count) break;
      const w = 0.95;
      const h = 0.62;
      const d = 0.38;
      // Modulo positif: posisi tumpukan bisa negatif (along < 0) → indeks negatif = undefined = koper putih.
      const n = colors.length;
      this.luggageColors.push(colors[(((placed + Math.round(along)) % n) + n) % n]!);
      // Proksi tak terlihat: pose rigid body ditulis ke sini, lalu disalin ke instans (lihat syncLuggage).
      const mesh = new Object3D();
      this.luggageProxies.push(mesh);
      const pos = this.frame.onSurface(along + dz, side + dx, h / 2 + layer * (h + 0.02) + 0.04);
      const rot = localQuat(pos, _v.copy(fwd).applyAxisAngle(_w.copy(pos).normalize(), (placed * 0.37) % 0.6));
      this.luggage.push(
        new Prop(this.physics, gravity, mesh, pos, rot, {
          mass: 0.07,
          material: 'fabric',
          shapes: [{ half: [w / 2, h / 2, d / 2] }],
          friction: 0.8,
          restitution: 0.2,
        }),
      );
      placed++;
    }
  }

  /** Ukuran koper sama dengan collider di buildLuggage. */
  private finishLuggage(): void {
    const n = this.luggageProxies.length;
    if (!n) return;
    const w = 0.95;
    const h = 0.62;
    const d = 0.38;
    const kb = new Kit();
    kb.add(rbox(w, h, d, 0.08), '#FFFFFF', { jitter: 0.03 });
    const kd = new Kit();
    kd.add(torus(0.13, 0.03, 4, 8, Math.PI), PALETTE.ink, { pos: [0, h / 2, 0] });
    kd.add(box(0.08, h + 0.02, d + 0.02), '#FFFFFF', { pos: [-w * 0.25, 0, 0] });
    kd.add(box(0.2, 0.14, 0.02), PALETTE.cream, { pos: [w * 0.2, h * 0.1, d / 2 + 0.01] });
    const body = new InstancedMesh(kb.build(), this.material, n);
    const detail = new InstancedMesh(kd.build(), this.material, n);
    for (let i = 0; i < n; i++) body.setColorAt(i, _color.set(this.luggageColors[i]!));
    body.name = 'luggage-body';
    detail.name = 'luggage-detail';
    for (const m of [body, detail]) {
      m.castShadow = true;
      m.receiveShadow = true;
      // Instans bergerak (fisika) → batas bola tidak tetap; grup bandara sudah di-cull horizon.
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.luggageBody = body;
    this.luggageDetail = detail;
    this.syncLuggage(true);
  }

  /** Salin pose proksi (hasil interpolasi fisika) ke instans; dilewati bila semua koper tidur. */
  private syncLuggage(force = false): void {
    const body = this.luggageBody;
    const detail = this.luggageDetail;
    if (!body || !detail) return;
    let awake = force;
    for (const l of this.luggage) if (!l.body.isSleeping()) awake = true;
    if (!awake) return;
    for (let i = 0; i < this.luggageProxies.length; i++) {
      const p = this.luggageProxies[i]!;
      p.updateMatrix();
      body.setMatrixAt(i, p.matrix);
      detail.setMatrixAt(i, p.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    detail.instanceMatrix.needsUpdate = true;
  }

  private placeSign(along: number, side: number): void {
    const groundP = this.groundAt(along, side);
    const p = groundP.clone();
    const up = p.clone().normalize();
    // Menghadap titik spawn (pesawat datang dari belakang).
    const spawn = this.frame.onSurface(RESPAWN.SPAWN_ALONG - 8, 0, 0);
    const face = spawn.sub(p);
    face.addScaledVector(up, -face.dot(up)).normalize();
    const q = quatFromUpForward(up, face.negate(), new Quaternion());
    const g = new Group();
    g.position.copy(p);
    g.quaternion.copy(q);
    const k = new Kit();
    for (const s of [-1, 1]) k.add(cyl(0.09, 0.11, 3.2, 6), '#8B5A2B', { pos: [s * 2.2, 1.4, 0] });
    k.add(rbox(5.9, 3.2, 0.18, 0.12), PALETTE.ink, { pos: [0, 2.6, 0.06] });
    const frameMesh = new Mesh(k.build(), this.material);
    frameMesh.castShadow = true;
    g.add(frameMesh);
    // Papan menghadap +Z grup (ke arah pesawat datang), sedikit di depan rangka.
    this.sign.object.position.set(0, 2.6, 0.17);
    g.add(this.sign.object);
    this.group.add(g);
    this.addStatic(p, q, [{ half: [2.95, 1.6, 0.12], offset: [0, 2.6, 0] }], 'wood');
  }

  private placeLandmark(model: { group: Group; shapes: StaticShape[] }, along: number, side: number, mat: SurfaceMaterial): void {
    const p = this.groundAt(along, side, -0.2);
    const toRunway = this.frame.toWorld(along, side - 1, 0).sub(this.frame.toWorld(along, side, 0));
    const q = localQuat(p, toRunway);
    model.group.position.copy(p);
    model.group.quaternion.copy(q);
    this.group.add(model.group);
    this.addStatic(p, q, model.shapes, mat);
  }

  /** Titik di tanah (raycast medan) pada koordinat lokal bandara. */
  private groundAt(along: number, side: number, lift = 0): Vector3 {
    const dir = this.frame.toWorld(along, side, 0).normalize();
    const h = this.groundHeight(dir) ?? AIRPORT.elevation;
    return this.frame.toWorld(along, side, h + lift);
  }

  // --- Papan tutorial -----------------------------------------------------------------------------

  setDevice(device: InputDevice): void {
    if (device === this.device) return;
    this.device = device;
    this.sign.redraw();
  }

  private drawSign(g: CanvasRenderingContext2D, w: number, h: number): void {
    g.fillStyle = '#FFF6E6';
    roundRect(g, 10, 10, w - 20, h - 20, 40);
    g.fill();
    g.fillStyle = PALETTE.sun;
    roundRect(g, 10, 10, w - 20, 110, 40);
    g.fill();
    g.fillRect(10, 80, w - 20, 40);
    g.fillStyle = PALETTE.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 64px Fredoka, "Nunito Sans", system-ui, sans-serif';
    g.fillText(tr('signs.welcome'), w / 2, 68, w - 60);
    // Ikon perangkat
    const cx = 120;
    const cy = 250;
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = 8;
    if (this.device === 'keyboard') {
      const key = (x: number, y: number, label: string): void => {
        g.fillStyle = '#FFFFFF';
        roundRect(g, x - 34, y - 34, 68, 68, 14);
        g.fill();
        g.stroke();
        g.fillStyle = PALETTE.ink;
        g.font = '700 40px Fredoka, system-ui, sans-serif';
        g.fillText(label, x, y + 2);
      };
      key(cx, cy - 40, 'W');
      key(cx - 74, cy + 36, 'A');
      key(cx, cy + 36, 'S');
      key(cx + 74, cy + 36, 'D');
    } else if (this.device === 'touch') {
      g.fillStyle = 'rgba(58,160,255,0.25)';
      g.beginPath();
      g.arc(cx, cy, 80, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = PALETTE.sky;
      g.beginPath();
      g.arc(cx, cy - 34, 36, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else {
      g.fillStyle = '#FFFFFF';
      roundRect(g, cx - 100, cy - 55, 200, 110, 50);
      g.fill();
      g.stroke();
      g.fillStyle = PALETTE.ink;
      g.beginPath();
      g.arc(cx - 45, cy - 5, 22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = PALETTE.berry;
      g.beginPath();
      g.arc(cx + 50, cy - 10, 14, 0, Math.PI * 2);
      g.fill();
    }
    // Teks instruksi (dibungkus per kata).
    const text = `${tr(`tutorial.${this.device}.gas`)}\n${tr(`tutorial.${this.device}.climb`)}`;
    g.fillStyle = PALETTE.ink;
    g.textAlign = 'left';
    g.font = '600 34px "Nunito Sans", system-ui, sans-serif';
    let y = 170;
    const maxW = w - 290;
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (g.measureText(test).width > maxW) {
          g.fillText(line, 250, y);
          y += 42;
          line = word;
        } else line = test;
      }
      g.fillText(line, 250, y);
      y += 54;
    }
  }

  // --- Spawn & update ----------------------------------------------------------------------------

  /** Arah landasan di posisi `pos` bila berada di landasan (dibalik bila pesawat menghadap sebaliknya). */
  runwayHeading(pos: Vector3, forward: Vector3, out: Vector3): Vector3 | null {
    const l = this.frame.toLocal(_v.copy(pos).normalize(), _local2);
    if (Math.abs(l.along) > this.frame.halfLength + 2 || Math.abs(l.side) > this.frame.halfWidth + 2.5) return null;
    this.frame.forwardAt(l.along, l.side, out);
    if (out.dot(forward) < 0) out.negate();
    return out;
  }

  spawnPoint(): SpawnPoint {
    const along = RESPAWN.SPAWN_ALONG;
    // Posisi tiga titik (roda utama + roda ekor) → hidung naik ±9,3°, pusat badan 1,2 di atas landasan.
    const position = this.frame.onSurface(along, 0, 1.2);
    const fwd = this.frame.forwardAt(along, 0, new Vector3());
    const q = localQuat(position, fwd);
    q.multiply(_q.setFromAxisAngle(_v.set(1, 0, 0), 9.3 * DEG2RAD));
    return { position, rotation: q };
  }

  update(dt: number, time: number, planePos: Vector3, wind: Vector3, night: boolean): void {
    this.letters.update(dt);
    this.rings.update(dt, planePos, time);
    for (const l of this.luggage) l.manageSleep(planePos);
    this.syncLuggage();
    for (const l of this.letters.letters) l.prop.manageSleep(planePos);

    // Kantong angin mengikuti arah dan kecepatan angin (melorot saat tenang).
    const up = _v.copy(this.windsock.position).normalize();
    const speed = wind.length();
    if (speed > 0.01) {
      _w.copy(wind).addScaledVector(up, -wind.dot(up));
      // Ubah arah angin ke rangka lokal kantong angin.
      _q.copy(this.windsock.quaternion).invert();
      _w.applyQuaternion(_q);
      const yaw = Math.atan2(-_w.x, -_w.z);
      this.sock.rotation.y = yaw + Math.PI;
      const lift = Math.min(1, speed / 6);
      this.sock.rotation.x = -(1 - lift) * 1.1 + Math.sin(time * 7) * 0.05 * lift;
      this.sock.rotation.z = Math.sin(time * 5.3) * 0.06;
    }
    // Lampu sedikit berdenyut saat malam.
    if (night) {
      const pulse = 0.85 + Math.sin(time * 3) * 0.15;
      this.lightBase.forEach((c, i) => this.lights.setColorAt(i, _color.copy(c).multiplyScalar(pulse)));
      if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const b of this.statics) this.physics.world.removeRigidBody(b);
    this.luggageBody?.geometry.dispose();
    this.luggageDetail?.geometry.dispose();
    this.rings.dispose();
    this.sign.dispose();
  }
}

const _color = new Color();
const _local2 = { along: 0, side: 0 };
