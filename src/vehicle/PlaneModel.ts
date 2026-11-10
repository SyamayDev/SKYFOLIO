/**
 * Model visual pesawat PK-ARL, dibuat sepenuhnya lewat kode (docs/04 bagian 3.1) mengikuti gambar
 * referensi Aril (docs/references/image.png): pesawat mainan bersayap rendah yang gemuk, badan krem,
 * cowling merah dengan mesin radial terlihat, spinner krom, baling-baling biru muda, garis toska,
 * ujung sayap & sirip merah, roundel bintang, paku keling di sepanjang badan.
 *
 * Konvensi: depan = −Z, atas = +Y, kanan = +X. Ukuran cocok dengan collider di PlaneBody.ts.
 * Bagian bergerak diekspos supaya Plane.ts bisa menganimasikannya.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import { attribute, color, distance, dot, float, mix, normalView, oneMinus, positionGeometry, positionViewDirection, pow, sin, smoothstep, time, uniform, vec3 } from 'three/tsl';
import { EXTRA, PALETTE } from '../config/palette';
import { Kit, airfoilWing, box, cone, cyl, extrude, lathe, rbox, sphere, strut, torus } from '../utils/modeling/Kit';
import { createToonMaterial, createUnlitMaterial, toonGradient } from '../utils/modeling/materials';
import { PLANE_DIMENSIONS } from './PlaneBody';

const P = PALETTE;

/** Warna pesawat (dari gambar referensi, disesuaikan dengan palet SKYFOLIO). */
export const PLANE_COLORS = {
  body: '#F4E7CD',
  bodyShade: '#E9D9B8',
  red: '#E5484D',
  redDark: '#C83A3F',
  teal: '#2F8FA6',
  tealDark: '#256F82',
  prop: '#7CC3F0',
  chrome: '#DCE2EA',
  engine: '#3A3D4A',
  rivet: '#B9A687',
  star: P.sun,
};
const C = PLANE_COLORS;

export interface WheelVisual {
  /** Kaki roda (diturunkan sesuai kompresi suspensi). */
  leg: Object3D;
  /** Roda (berputar). */
  wheel: Object3D;
  restY: number;
}

function makeMesh(geo: BufferGeometry, mat: Material, name: string, shadow = true): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/** Tekstur nomor registrasi PK-ARL. */
function registrationTexture(text: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const draw = (): void => {
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = C.tealDark;
    g.font = '700 118px Fredoka, "Nunito Sans", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 6);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('700 64px Fredoka').then(draw, () => undefined);
  return tex;
}

/** Bintang lima sudut (bidang XY, tebal sepanjang Z). */
function starGeometry(r: number, depth: number): BufferGeometry {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return extrude(s, depth);
}

/**
 * Roundel: cakram toska + cincin merah + bintang kuning. Dibuat menghadap +Z lalu diputar dengan `rot`.
 */
function addRoundel(k: Kit, pos: [number, number, number], rot: [number, number, number], r: number): void {
  const m = (geo: BufferGeometry, color: string, offset: number): void => {
    geo.translate(0, 0, offset);
    k.add(geo, color, { pos, rot });
  };
  m(cyl(r, r, 0.012, 16).rotateX(Math.PI / 2), C.teal, 0);
  m(torus(r, r * 0.13, 4, 18), C.red, 0.004);
  m(starGeometry(r * 0.62, 0.012), C.star, 0.012);
}

/** Profil badan (radius, y) — y positif = depan; dipakai lathe dan untuk menaruh garis/paku keling. */
const FUSELAGE: [number, number][] = [
  [0.0, 1.36],
  [0.5, 1.34],
  [0.6, 1.16],
  [0.64, 0.72],
  [0.62, 0.1],
  [0.55, -0.6],
  [0.43, -1.25],
  [0.29, -1.78],
  [0.17, -2.18],
  [0.0, -2.32],
];

/** Radius badan di posisi z (z = −y profil). */
function fuselageRadius(z: number): number {
  const y = -z;
  for (let i = 0; i < FUSELAGE.length - 1; i++) {
    const [r0, y0] = FUSELAGE[i]!;
    const [r1, y1] = FUSELAGE[i + 1]!;
    if (y <= y0 && y >= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0;
}

export class PlaneModel {
  readonly root = new Group();
  readonly material: MeshToonNodeMaterial;
  readonly propeller = new Group();
  readonly blurDisc: Mesh;
  readonly aileronL = new Group();
  readonly aileronR = new Group();
  readonly elevator = new Group();
  readonly rudder = new Group();
  readonly wheels: WheelVisual[] = [];
  readonly navLights: { left: Mesh; right: Mesh; tail: Mesh };
  readonly canopy = new Group();
  readonly rocketKit = new Group();
  readonly flames: Mesh[] = [];
  readonly heatShell: Mesh;
  private readonly uThrust = uniform(0);
  private readonly uBody = uniform(new Color(C.body));
  private readonly uAccent = uniform(new Color(C.red));
  private readonly uTrim = uniform(new Color(C.teal));
  private readonly uSkinOn = uniform(0);
  private readonly uHeat = uniform(0);
  /** Titik duduk pilot (depan) dan co-pilot (belakang). */
  readonly pilotSeat = new Object3D();
  readonly copilotSeat = new Object3D();
  /** Titik kamera kokpit. */
  readonly cockpitEye = new Object3D();
  /** Titik knalpot (asap). */
  readonly exhaust = new Object3D();
  private readonly disposables: { dispose(): void }[] = [];

  constructor() {
    this.root.name = 'plane-PK-ARL';
    const mat = createToonMaterial();
    // Cat ulang (skin): warna verteks yang dekat dengan warna asli badan/aksen/garis dipetakan ke warna skin,
    // dengan variasi gelap-terang aslinya dipertahankan. Bawaan = identitas (tanpa perubahan).
    const vc = attribute('color', 'vec3');
    let paint = mix(vc, vc, 0);
    for (const [ref, u] of [
      [C.body, this.uBody],
      [C.bodyShade, this.uBody],
      [C.red, this.uAccent],
      [C.redDark, this.uAccent],
      [C.teal, this.uTrim],
      [C.tealDark, this.uTrim],
    ] as const) {
      const rc = new Color(ref);
      const refV = vec3(rc.r, rc.g, rc.b);
      const k = smoothstep(0.075, 0.02, distance(vc, refV)).mul(this.uSkinOn);
      const ratio = dot(vc, vec3(1 / 3)).div(dot(refV, vec3(1 / 3)).max(0.001));
      const darker = ref === C.bodyShade || ref === C.redDark || ref === C.tealDark ? 0.86 : 1;
      paint = mix(paint, u.mul(ratio).mul(darker), k);
    }
    mat.vertexColors = false;
    mat.colorNode = paint;
    this.material = mat;
    this.disposables.push(mat);
    const D = PLANE_DIMENSIONS;
    const W = D.wing;

    // ---------------- Badan statis (satu mesh gabungan)
    const k = new Kit();
    const fus = lathe(FUSELAGE, 18);
    fus.rotateX(-Math.PI / 2);
    k.add(fus, C.body, { pos: [0, 0.05, 0], jitter: 0.015 });

    // Garis toska di sisi badan (mengikuti lengkung badan) + baris paku keling.
    for (const side of [-1, 1]) {
      for (let z = -1.1; z < 1.95; z += 0.32) {
        const z1 = Math.min(1.95, z + 0.34);
        const a = new Vector3(side * (fuselageRadius(z) * 0.94 + 0.012), 0.24, z);
        const b = new Vector3(side * (fuselageRadius(z1) * 0.94 + 0.012), 0.22 - (z1 > 1 ? (z1 - 1) * 0.08 : 0), z1);
        k.add(strut(a, b, 0.032, 6), C.teal);
      }
      for (const [ang, y0] of [
        [0.05, 0.08],
        [-0.55, -0.22],
      ] as [number, number][]) {
        for (let z = -0.95; z < 1.85; z += 0.24) {
          const r = fuselageRadius(z) + 0.004;
          k.add(new OctahedronGeometry(0.024, 0), C.rivet, {
            pos: [side * r * Math.cos(ang), 0.05 + y0 + r * Math.sin(ang) * 0.2, z],
          });
        }
      }
    }
    // Cincin pembatas cowling-badan (krom tipis).
    k.add(torus(0.62, 0.025, 4, 22), C.chrome, { pos: [0, 0.05, -1.22] });

    // Cowling merah + muka mesin radial.
    const cowl = lathe(
      [
        [0.46, 0.0],
        [0.66, 0.04],
        [0.72, 0.22],
        [0.7, 0.42],
        [0.6, 0.53],
        [0.47, 0.5],
      ],
      20,
    );
    cowl.rotateX(-Math.PI / 2);
    k.add(cowl, C.red, { pos: [0, 0.05, -1.24], jitter: 0.02 });
    k.add(cyl(0.47, 0.47, 0.04, 18), C.engine, { pos: [0, 0.05, -1.66], rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      // Silinder mesin menghadap ke luar dengan sirip pendingin (cincin).
      const cx = Math.cos(a) * 0.29;
      const cy = 0.05 + Math.sin(a) * 0.29;
      k.add(cyl(0.085, 0.095, 0.26, 7), '#8E98A5', { pos: [cx, cy, -1.69], rot: [0, 0, a - Math.PI / 2] });
      k.add(cyl(0.06, 0.06, 0.04, 6), '#5D6673', { pos: [Math.cos(a) * 0.43, 0.05 + Math.sin(a) * 0.43, -1.69], rot: [0, 0, a - Math.PI / 2] });
    }
    // Knalpot pendek di kedua sisi.
    for (const side of [-1, 1]) {
      k.add(cyl(0.05, 0.06, 0.32, 6), C.engine, { pos: [side * 0.58, -0.22, -1.02], rot: [Math.PI / 2 - 0.4, 0, side * 0.35] });
    }
    this.exhaust.position.set(0.6, -0.3, -0.85);

    // Sayap utama rendah: bagian tengah krem + ujung merah membulat.
    const span = W.halfSpan * 2;
    const tipW = 0.62;
    k.add(airfoilWing(span - tipW * 2 + 0.06, W.halfChord * 2, 0.22, 0), C.body, { pos: [0, W.y, W.z], jitter: 0.015 });
    for (const side of [-1, 1]) {
      k.add(airfoilWing(tipW, W.halfChord * 2 - 0.04, 0.2, 0.18), C.red, {
        pos: [side * (W.halfSpan - tipW / 2), W.y, W.z],
        jitter: 0.02,
      });
      // Roundel di atas sayap dekat ujung.
      addRoundel(k, [side * 1.42, W.y + 0.152, W.z - 0.04], [-Math.PI / 2, 0, 0], 0.26);
      // Fillet sayap-badan.
      k.add(rbox(0.5, 0.2, 1.1, 0.09), C.bodyShade, { pos: [side * 0.42, W.y + 0.06, W.z + 0.05] });
    }

    // Ekor: stabilizer krem + ujung merah, sirip krem.
    const tp = D.tailPlane;
    k.add(airfoilWing(tp.halfSpan * 2 - 0.5, 0.5, 0.09, 0), C.body, { pos: [0, tp.y, tp.z - 0.1] });
    for (const side of [-1, 1]) {
      k.add(airfoilWing(0.32, 0.46, 0.09, 0.12), C.red, { pos: [side * (tp.halfSpan - 0.16), tp.y, tp.z - 0.1] });
    }
    k.add(rbox(0.09, 0.8, 0.6, 0.04), C.body, { pos: [0, 0.66, 1.96], rot: [-0.32, 0, 0] });
    for (const side of [-1, 1]) addRoundel(k, [side * 0.05, 0.6, 1.92], [0, side * Math.PI * 0.5, 0], 0.18);

    // Kokpit depan (Aril) & belakang (Piko): bibir toska + interior gelap + kaca depan kecil.
    for (const [z, r] of [
      [0.32, 0.31],
      [1.12, 0.27],
    ] as [number, number][]) {
      k.add(torus(r, 0.06, 6, 18), C.teal, { pos: [0, 0.6, z], rot: [Math.PI / 2, 0, 0], scale: [1, 1.25, 1] });
      k.add(cyl(r * 0.95, r * 0.95, 0.04, 14), '#3B2A22', { pos: [0, 0.57, z] });
    }
    // Fairing kanopi (tempat kanopi kaca tersimpan) di belakang kokpit Piko.
    k.add(rbox(0.5, 0.26, 0.66, 0.12), C.body, { pos: [0, 0.6, 1.62], rot: [-0.12, 0, 0] });
    for (const side of [-1, 1]) k.add(box(0.03, 0.03, 1.7), EXTRA.metal, { pos: [side * 0.34, 0.6, 0.86] });

    // Pod kit roket di bawah sayap.
    for (const side of [-1, 1]) {
      k.add(rbox(0.22, 0.2, 0.75, 0.09), C.body, { pos: [side * 1.2, W.y - 0.17, W.z] });
      k.add(cyl(0.07, 0.09, 0.08, 8), C.engine, { pos: [side * 1.2, W.y - 0.17, W.z + 0.39], rot: [Math.PI / 2, 0, 0] });
    }

    // Penyangga roda utama (toska) dari bawah sayap ke titik pasang roda.
    const mg = D.mainGear;
    for (const side of [-1, 1]) {
      k.add(strut(new Vector3(side * 0.34, W.y - 0.05, mg.z - 0.3), new Vector3(side * mg.x, mg.y, mg.z), 0.045, 6), C.teal);
      k.add(strut(new Vector3(side * 0.34, W.y - 0.05, mg.z + 0.32), new Vector3(side * mg.x, mg.y, mg.z), 0.045, 6), C.teal);
    }
    this.root.add(makeMesh(k.build(), mat, 'airframe'));

    // Kaca depan (transparan).
    const glass = new MeshToonNodeMaterial({ color: EXTRA.glass, transparent: true, opacity: 0.42, gradientMap: toonGradient() });
    glass.depthWrite = false;
    this.disposables.push(glass);
    // Kaca depan melengkung (pita bola di sisi depan kokpit Aril).
    const wind = new Mesh(new SphereGeometry(0.38, 10, 3, (7 * Math.PI) / 6, (2 * Math.PI) / 3, Math.PI / 4, Math.PI / 4), glass);
    wind.position.set(0, 0.6, 0.3);
    wind.name = 'windscreen';
    this.root.add(wind);

    // ---------------- Baling-baling (berputar): spinner krom + dua bilah biru muda.
    const pk = new Kit();
    const spinner = lathe(
      [
        [0.0, 0.46],
        [0.1, 0.43],
        [0.19, 0.32],
        [0.25, 0.15],
        [0.26, 0.0],
      ],
      16,
    );
    spinner.rotateX(-Math.PI / 2);
    pk.add(spinner, C.chrome, { pos: [0, 0, 0.02] });
    for (const s of [-1, 1]) {
      pk.add(rbox(0.22, 0.98, 0.06, 0.05), C.prop, { pos: [0, s * 0.62, 0.05], rot: [0, s * 0.32, 0] });
      pk.add(rbox(0.2, 0.18, 0.062, 0.05), '#A9DAF7', { pos: [0, s * 1.08, 0.05], rot: [0, s * 0.32, 0] });
    }
    this.propeller.add(makeMesh(pk.build(), mat, 'propeller'));
    this.propeller.position.set(0, 0.05, -1.78);
    this.root.add(this.propeller);
    const blurMat = createUnlitMaterial('#E6F4FF', { transparent: true, opacity: 0 });
    blurMat.side = DoubleSide;
    this.disposables.push(blurMat);
    const disc = new Mesh(cyl(1.2, 1.2, 0.01, 28), blurMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 0.05, -1.86);
    disc.name = 'prop-blur';
    disc.renderOrder = 5;
    this.blurDisc = disc;
    this.root.add(disc);

    // ---------------- Permukaan kendali (pivot di garis engsel)
    const hingeZ = W.z + W.halfChord - 0.02;
    const ailGeo = (): BufferGeometry => new Kit().add(rbox(1.25, 0.07, 0.26, 0.03), C.bodyShade, { pos: [0, 0, 0.13] }).build();
    this.aileronL.add(makeMesh(ailGeo(), mat, 'aileron-l'));
    this.aileronR.add(makeMesh(ailGeo(), mat, 'aileron-r'));
    this.aileronL.position.set(-1.55, W.y, hingeZ);
    this.aileronR.position.set(1.55, W.y, hingeZ);
    this.root.add(this.aileronL, this.aileronR);

    this.elevator.add(makeMesh(new Kit().add(rbox(1.5, 0.05, 0.26, 0.02), C.bodyShade, { pos: [0, 0, 0.13] }).build(), mat, 'elevator'));
    this.elevator.position.set(0, tp.y, tp.z + 0.14);
    this.root.add(this.elevator);

    const rk = new Kit();
    rk.add(rbox(0.08, 0.74, 0.32, 0.035), C.red, { pos: [0, 0.37, 0.16] });
    rk.add(rbox(0.085, 0.08, 0.3, 0.03), C.teal, { pos: [0, 0.2, 0.16] });
    this.rudder.add(makeMesh(rk.build(), mat, 'rudder'));
    this.rudder.position.set(0, 0.32, 2.18);
    this.rudder.rotation.x = -0.32;
    this.root.add(this.rudder);

    // Nomor registrasi di kedua sisi badan belakang dan di bawah sayap.
    const regTex = registrationTexture('PK-ARL');
    this.disposables.push(regTex);
    const regMat = new MeshBasicNodeMaterial({ map: regTex, transparent: true, depthWrite: false, side: DoubleSide });
    this.disposables.push(regMat);
    for (const side of [-1, 1]) {
      const z = 1.38;
      const plate = new Mesh(new PlaneGeometry(0.7, 0.21), regMat);
      plate.position.set(side * (fuselageRadius(z) + 0.012), 0.0, z);
      plate.rotation.set(0, side * Math.PI * 0.5, 0);
      plate.name = 'reg-side';
      this.root.add(plate);
    }
    const under = new Mesh(new PlaneGeometry(2.4, 0.74), regMat);
    under.position.set(0, W.y - 0.115, W.z);
    under.rotation.set(Math.PI / 2, 0, 0);
    under.name = 'reg-wing';
    this.root.add(under);

    // ---------------- Roda (kaki teleskopik + roda berputar)
    const tireGeo = (r: number, w: number): BufferGeometry => {
      const wk = new Kit();
      wk.add(torus(r * 0.72, r * 0.3, 7, 16), EXTRA.rubber, { rot: [0, Math.PI / 2, 0] });
      wk.add(cyl(r * 0.52, r * 0.52, w, 12), '#E9EDF2', { rot: [0, 0, Math.PI / 2] });
      wk.add(cyl(r * 0.2, r * 0.2, w + 0.04, 8), C.red, { rot: [0, 0, Math.PI / 2] });
      return wk.build();
    };
    const addWheel = (x: number, y: number, z: number, radius: number, rest: number): void => {
      const leg = new Group();
      leg.position.set(x, y, z);
      leg.add(makeMesh(new Kit().add(cyl(0.04, 0.04, rest, 6), C.teal, { pos: [0, -rest / 2, 0] }).build(), mat, 'leg'));
      const wheel = new Group();
      wheel.position.set(0, -rest, 0);
      wheel.add(makeMesh(tireGeo(radius, radius * 0.6), mat, 'wheel'));
      leg.add(wheel);
      this.root.add(leg);
      this.wheels.push({ leg, wheel, restY: y });
    };
    addWheel(-D.mainGear.x, D.mainGear.y, D.mainGear.z, 0.32, 0.6);
    addWheel(D.mainGear.x, D.mainGear.y, D.mainGear.z, 0.32, 0.6);
    addWheel(D.tailGear.x, D.tailGear.y, D.tailGear.z, 0.14, 0.35);

    // ---------------- Lampu navigasi (merah kiri, hijau kanan, putih ekor)
    const lamp = (hex: string, x: number, y: number, z: number, name: string): Mesh => {
      const m = createUnlitMaterial(hex);
      this.disposables.push(m);
      const mesh = new Mesh(sphere(0.07, 6, 4), m);
      mesh.position.set(x, y, z);
      mesh.name = name;
      this.root.add(mesh);
      return mesh;
    };
    this.navLights = {
      left: lamp('#FF4B55', -(W.halfSpan + 0.03), W.y, W.z, 'nav-left'),
      right: lamp('#3DFF7A', W.halfSpan + 0.03, W.y, W.z, 'nav-right'),
      tail: lamp('#FFFFFF', 0, 1.06, 2.3, 'nav-tail'),
    };

    // ---------------- Kanopi (tersimpan di fairing; animasi di Fase 2)
    const canopyMesh = new Mesh(new SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.72, 0.62, 1.9), glass);
    canopyMesh.position.set(0, 0.6, 0);
    canopyMesh.name = 'canopy-glass';
    this.canopy.add(canopyMesh);
    this.canopy.position.set(0, 0, 1.55);
    this.canopy.scale.set(0.6, 0.4, 0.35);
    this.canopy.visible = false;
    this.root.add(this.canopy);

    // ---------------- Kit roket (tersembunyi di pod; keluar di Fase 2)
    for (const side of [-1, 1]) {
      const rocket = makeMesh(
        new Kit()
          .add(cyl(0.09, 0.11, 0.7, 8), EXTRA.metal, { rot: [Math.PI / 2, 0, 0] })
          .add(cone(0.09, 0.2, 8), C.red, { pos: [0, 0, -0.45], rot: [-Math.PI / 2, 0, 0] })
          .build(),
        mat,
        'rocket',
      );
      rocket.position.set(side * 1.2, W.y - 0.17, W.z);
      this.rocketKit.add(rocket);
    }
    // Api roket (aditif) di belakang tiap roket; kuat-lemahnya dari uThrust.
    const fm = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    const along = positionGeometry.y.add(0.5);
    fm.colorNode = mix(color('#FFF3B0'), color('#FF6A2B'), along);
    fm.opacityNode = this.uThrust.mul(float(1).sub(along)).mul(sin(time.mul(60)).mul(0.15).add(0.85));
    this.disposables.push(fm);
    for (const side of [-1, 1]) {
      const flame = new Mesh(new ConeGeometry(0.1, 1, 10, 1, true), fm);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(side * 1.2, W.y - 0.17, W.z + 0.85);
      flame.name = 'rocket-flame';
      flame.renderOrder = 4;
      this.rocketKit.add(flame);
      this.flames.push(flame);
    }
    this.rocketKit.visible = false;
    this.root.add(this.rocketKit);

    // Cangkang panas masuk atmosfer: bola fresnel oranye di sekeliling pesawat, menebal di depan.
    const hm = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    const rimK = pow(oneMinus(dot(normalView, positionViewDirection).abs()), float(1.6));
    const front = smoothstep(0.2, -1.0, positionGeometry.z);
    hm.colorNode = mix(color('#FF6A1A'), color('#FFE9A0'), front.mul(0.8));
    hm.opacityNode = this.uHeat.mul(rimK.mul(0.75).add(front.mul(0.55))).mul(sin(time.mul(35)).mul(0.12).add(0.88)).min(0.92);
    this.disposables.push(hm);
    this.heatShell = new Mesh(new SphereGeometry(1, 20, 12), hm);
    this.heatShell.scale.set(3.1, 1.5, 2.6);
    this.heatShell.position.set(0, 0.1, 0.1);
    this.heatShell.visible = false;
    this.heatShell.renderOrder = 5;
    this.heatShell.name = 'heat-shell';
    this.root.add(this.heatShell);

    // Titik duduk & kamera.
    this.pilotSeat.position.set(0, 0.47, 0.32);
    this.copilotSeat.position.set(0, 0.49, 1.12);
    this.cockpitEye.position.set(0, 0.95, 0.42);
    this.root.add(this.pilotSeat, this.copilotSeat, this.cockpitEye, this.exhaust);
  }

  /**
   * Animasi per frame.
   * @param propRate putaran baling-baling (rad/dtk)
   */
  animate(
    dt: number,
    propRate: number,
    controls: { pitch: number; roll: number; yaw: number },
    propBent: number,
    navBlink: boolean,
    time: number,
  ): void {
    this.propeller.rotation.z += propRate * dt;
    this.propeller.rotation.x = propBent * Math.sin(time * 40) * 0.25;
    const blur = Math.min(1, Math.max(0, (Math.abs(propRate) - 18) / 40));
    const bm = this.blurDisc.material as MeshBasicNodeMaterial;
    bm.opacity = blur * 0.13;
    this.blurDisc.visible = blur > 0.01;
    this.propeller.visible = blur < 0.97 || Math.floor(time * 60) % 3 === 0;

    this.aileronL.rotation.x = controls.roll * 0.45;
    this.aileronR.rotation.x = -controls.roll * 0.45;
    this.elevator.rotation.x = -controls.pitch * 0.5;
    this.rudder.rotation.y = -controls.yaw * 0.5 - controls.roll * 0.2;

    const on = !navBlink || Math.sin(time * 6) > -0.2;
    this.navLights.left.visible = on;
    this.navLights.right.visible = on;
    this.navLights.tail.visible = !navBlink || Math.sin(time * 6 + 2) > 0;
  }

  /** Ganti cat pesawat. `null` = warna asli PK-ARL. */
  setPaint(p: { body: string; accent: string; trim: string } | null): void {
    this.uSkinOn.value = p ? 1 : 0;
    if (!p) return;
    this.uBody.value.set(p.body);
    this.uAccent.value.set(p.accent);
    this.uTrim.value.set(p.trim);
  }

  /** Kit roket, api, dan panas masuk atmosfer (dari SpaceFlight). */
  setSpaceFx(rocket: boolean, thrust: number, heat: number): void {
    this.rocketKit.visible = rocket;
    this.uThrust.value = thrust;
    for (const f of this.flames) {
      f.visible = thrust > 0.02;
      f.scale.set(1, 0.6 + thrust * 1.6, 1);
    }
    this.uHeat.value = heat;
    this.heatShell.visible = heat > 0.02;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose();
    });
    for (const d of this.disposables) d.dispose();
  }
}
