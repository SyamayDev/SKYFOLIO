/**
 * Model visual biplane PK-ARL (docs/04 bagian 3.1), dibuat sepenuhnya lewat kode.
 * Konvensi: depan = −Z, atas = +Y, kanan = +X. Ukuran cocok dengan collider di PlaneBody.ts.
 * Bagian bergerak diekspos supaya Plane.ts bisa menganimasikannya.
 */
import { CanvasTexture, DoubleSide, Group, Mesh, Object3D, PlaneGeometry, SRGBColorSpace, Vector3, type Material } from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import { EXTRA, PALETTE } from '../config/palette';
import { Kit, airfoilWing, box, cone, cyl, lathe, rbox, sphere, strut, torus } from '../utils/modeling/Kit';
import { createToonMaterial, createUnlitMaterial, toonGradient } from '../utils/modeling/materials';
import { PLANE_DIMENSIONS } from './PlaneBody';

const P = PALETTE;

export interface WheelVisual {
  /** Kaki roda (diturunkan sesuai kompresi suspensi). */
  leg: Object3D;
  /** Roda (berputar). */
  wheel: Object3D;
  restY: number;
}

function makeMesh(geo: ReturnType<Kit['build']>, mat: Material, name: string, shadow = true): Mesh {
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
    g.fillStyle = P.ink;
    g.font = '700 118px Fredoka, "Nunito Sans", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 6);
    tex.needsUpdate = true;
  };
  draw();
  // Gambar ulang saat font Fredoka selesai dimuat.
  document.fonts?.load('700 64px Fredoka').then(draw, () => undefined);
  return tex;
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
    this.material = mat;
    this.disposables.push(mat);
    const D = PLANE_DIMENSIONS;

    // ---------------- Badan statis (satu mesh gabungan)
    const k = new Kit();
    // Badan gemuk (lathe sepanjang Y lalu diputar ke −Z = depan).
    const fus = lathe(
      [
        [0.0, 1.27],
        [0.42, 1.25],
        [0.52, 1.0],
        [0.57, 0.55],
        [0.56, 0.0],
        [0.5, -0.6],
        [0.4, -1.2],
        [0.27, -1.7],
        [0.15, -2.1],
        [0.0, -2.28],
      ],
      14,
    );
    fus.rotateX(-Math.PI / 2);
    k.add(fus, P.cream, { pos: [0, 0.05, 0], jitter: 0.02 });
    // Garis biru di sisi badan.
    for (const side of [-1, 1]) {
      k.add(rbox(0.04, 0.12, 2.6, 0.02), P.sky, { pos: [side * 0.555, 0.08, 0.2], rot: [0.05, 0, 0] });
      k.add(rbox(0.04, 0.06, 1.6, 0.02), P.sun, { pos: [side * 0.52, -0.1, 0.65], rot: [0.08, 0, 0] });
    }
    // Cowling mesin radial.
    const cowl = lathe(
      [
        [0.3, 0.42],
        [0.5, 0.4],
        [0.6, 0.28],
        [0.62, 0.0],
        [0.56, -0.1],
      ],
      14,
    );
    cowl.rotateX(-Math.PI / 2);
    k.add(cowl, P.sky, { pos: [0, 0.05, -1.3] });
    k.add(cyl(0.3, 0.3, 0.06, 12), P.ink, { pos: [0, 0.05, -1.72], rot: [Math.PI / 2, 0, 0] });
    // Silinder mesin (benjolan) di sekeliling cowling.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.add(rbox(0.16, 0.16, 0.22, 0.05), EXTRA.metal, {
        pos: [Math.cos(a) * 0.5, 0.05 + Math.sin(a) * 0.5, -1.62],
        rot: [0, 0, a],
      });
    }
    // Knalpot.
    k.add(cyl(0.05, 0.06, 0.6, 6), P.ink, { pos: [0.5, -0.3, -0.9], rot: [Math.PI / 2, 0, 0] });
    this.exhaust.position.set(0.5, -0.32, -0.55);

    // Sayap atas dan bawah (profil airfoil).
    const up = D.upperWing;
    const lo = D.lowerWing;
    k.add(airfoilWing(up.halfSpan * 2, up.halfChord * 2 - 0.3, 0.16, 0.22), P.sun, { pos: [0, up.y, up.z - 0.12], jitter: 0.02 });
    k.add(airfoilWing(lo.halfSpan * 2, lo.halfChord * 2 - 0.26, 0.15, 0.2), P.sun, {
      pos: [0, lo.y, lo.z - 0.1],
      jitter: 0.02,
    });
    // Garis biru di ujung sayap atas (dilihat dari atas).
    for (const side of [-1, 1]) {
      k.add(box(0.14, 0.02, 0.62), P.sky, { pos: [side * 1.9, up.y + 0.085, up.z - 0.12] });
      k.add(box(0.14, 0.02, 0.62), P.sky, { pos: [side * 1.62, up.y + 0.085, up.z - 0.12] });
    }
    // Strut antar sayap (dua pasang) + kabel.
    for (const side of [-1, 1]) {
      const x = side * 1.55;
      const fT = new Vector3(x, up.y - 0.05, up.z - 0.35);
      const fB = new Vector3(x * 0.98, lo.y + 0.05, lo.z - 0.3);
      const bT = new Vector3(x, up.y - 0.05, up.z + 0.25);
      const bB = new Vector3(x * 0.98, lo.y + 0.05, lo.z + 0.25);
      k.add(strut(fT, fB, 0.045, 6), P.cream);
      k.add(strut(bT, bB, 0.045, 6), P.cream);
      k.add(strut(new Vector3(x * 0.3, up.y - 0.05, up.z - 0.1), new Vector3(x * 0.93, lo.y + 0.05, lo.z), 0.012, 4), P.ink);
      k.add(strut(new Vector3(x * 0.93, up.y - 0.05, up.z), new Vector3(x * 0.3, lo.y + 0.05, lo.z - 0.1), 0.012, 4), P.ink);
      // Strut kabin dari badan ke sayap atas.
      k.add(strut(new Vector3(side * 0.28, 0.5, -0.85), new Vector3(side * 0.42, up.y - 0.06, up.z - 0.25), 0.035, 5), P.ink);
      k.add(strut(new Vector3(side * 0.28, 0.5, -0.35), new Vector3(side * 0.42, up.y - 0.06, up.z + 0.2), 0.035, 5), P.ink);
    }

    // Ekor: stabilizer horizontal + sirip.
    const tp = D.tailPlane;
    k.add(airfoilWing(tp.halfSpan * 2, 0.42, 0.08, 0.12), P.sun, { pos: [0, tp.y, tp.z - 0.12] });
    k.add(rbox(0.08, 0.72, 0.5, 0.04), P.cream, { pos: [0, 0.62, 2.0], rot: [-0.32, 0, 0] });
    k.add(rbox(0.09, 0.14, 0.42, 0.04), P.sky, { pos: [0, 0.82, 2.06], rot: [-0.32, 0, 0] });

    // Kokpit: bibir kulit + kaca depan kecil.
    for (const [z, r] of [
      [0.32, 0.3],
      [1.12, 0.27],
    ] as [number, number][]) {
      k.add(torus(r, 0.055, 5, 14), '#7A4A2E', { pos: [0, 0.53, z], rot: [Math.PI / 2, 0, 0], scale: [1, 1.25, 1] });
      k.add(cyl(r * 0.95, r * 0.95, 0.04, 12), '#3B2A22', { pos: [0, 0.5, z] });
    }
    // Fairing kanopi (tempat kanopi kaca tersimpan) di belakang kokpit Piko.
    k.add(rbox(0.5, 0.26, 0.7, 0.12), P.cream, { pos: [0, 0.55, 1.65], rot: [-0.1, 0, 0] });

    // Rel kanopi (detail).
    for (const side of [-1, 1]) k.add(box(0.03, 0.03, 1.8), EXTRA.metal, { pos: [side * 0.33, 0.56, 0.9] });

    // Pod kit roket di bawah sayap bawah.
    for (const side of [-1, 1]) {
      k.add(rbox(0.22, 0.2, 0.75, 0.09), P.cream, { pos: [side * 1.15, lo.y - 0.15, lo.z - 0.05] });
      k.add(cyl(0.07, 0.09, 0.08, 8), P.ink, { pos: [side * 1.15, lo.y - 0.15, lo.z + 0.34], rot: [Math.PI / 2, 0, 0] });
    }

    // Kaki roda utama (statis bagian atas) — roda bergerak terpisah.
    const mg = D.mainGear;
    for (const side of [-1, 1]) {
      k.add(strut(new Vector3(side * 0.2, -0.4, mg.z - 0.25), new Vector3(side * mg.x, mg.y, mg.z), 0.04, 5), P.ink);
      k.add(strut(new Vector3(side * 0.2, -0.4, mg.z + 0.3), new Vector3(side * mg.x, mg.y, mg.z), 0.04, 5), P.ink);
    }
    this.root.add(makeMesh(k.build(), mat, 'airframe'));

    // ---------------- Baling-baling (berputar)
    const pk = new Kit();
    pk.add(cone(0.2, 0.42, 10), P.berry, { pos: [0, 0, -0.18], rot: [-Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) {
      pk.add(rbox(0.16, 0.85, 0.05, 0.03), EXTRA.wood, { pos: [0, s * 0.52, 0], rot: [0, s * 0.35, 0] });
      pk.add(rbox(0.15, 0.22, 0.052, 0.03), P.berry, { pos: [0, s * 1.02, 0], rot: [0, s * 0.35, 0] });
    }
    this.propeller.add(makeMesh(pk.build(), mat, 'propeller'));
    this.propeller.position.set(0, 0.05, -1.78);
    this.root.add(this.propeller);
    // Cakram blur (transparan) saat baling-baling cepat.
    const blurMat = createUnlitMaterial('#FFF6E6', { transparent: true, opacity: 0 });
    blurMat.side = DoubleSide;
    this.disposables.push(blurMat);
    const disc = new Mesh(cyl(1.12, 1.12, 0.01, 28), blurMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 0.05, -1.8);
    disc.name = 'prop-blur';
    disc.renderOrder = 5;
    this.blurDisc = disc;
    this.root.add(disc);

    // ---------------- Permukaan kendali (pivot di garis engsel)
    const ailGeo = (): ReturnType<Kit['build']> =>
      new Kit().add(rbox(1.15, 0.06, 0.26, 0.025), P.sky, { pos: [0, 0, 0.13] }).build();
    this.aileronL.add(makeMesh(ailGeo(), mat, 'aileron-l'));
    this.aileronR.add(makeMesh(ailGeo(), mat, 'aileron-r'));
    const hingeZ = up.z - 0.12 + (up.halfChord * 2 - 0.3) / 2 + 0.02;
    this.aileronL.position.set(-1.65, up.y, hingeZ);
    this.aileronR.position.set(1.65, up.y, hingeZ);
    this.root.add(this.aileronL, this.aileronR);

    this.elevator.add(makeMesh(new Kit().add(rbox(1.75, 0.05, 0.28, 0.02), P.sky, { pos: [0, 0, 0.14] }).build(), mat, 'elevator'));
    this.elevator.position.set(0, tp.y, tp.z + 0.1);
    this.root.add(this.elevator);

    const rk = new Kit();
    rk.add(rbox(0.07, 0.7, 0.3, 0.03), P.berry, { pos: [0, 0.35, 0.15] });
    this.rudder.add(makeMesh(rk.build(), mat, 'rudder'));
    this.rudder.position.set(0, 0.3, 2.22);
    this.rudder.rotation.x = -0.32;
    this.root.add(this.rudder);

    // Nomor registrasi di sirip (kedua sisi) dan di bawah sayap bawah.
    const regTex = registrationTexture('PK-ARL');
    this.disposables.push(regTex);
    const regMat = new MeshBasicNodeMaterial({ map: regTex, transparent: true, depthWrite: false, side: DoubleSide });
    this.disposables.push(regMat);
    for (const side of [-1, 1]) {
      const plate = new Mesh(new PlaneGeometry(0.62, 0.19), regMat);
      plate.position.set(side * 0.047, 0.55, 1.98);
      plate.rotation.set(-0.32, side * Math.PI * 0.5, 0);
      plate.name = 'reg-fin';
      this.root.add(plate);
    }
    const under = new Mesh(new PlaneGeometry(2.6, 0.8), regMat);
    under.position.set(0, lo.y - 0.085, lo.z - 0.1);
    under.rotation.set(Math.PI / 2, 0, 0);
    under.name = 'reg-wing';
    this.root.add(under);

    // ---------------- Roda (kaki teleskopik + roda berputar)
    const tireGeo = (r: number, w: number): ReturnType<Kit['build']> => {
      const wk = new Kit();
      wk.add(torus(r * 0.72, r * 0.3, 6, 14), EXTRA.rubber, { rot: [0, Math.PI / 2, 0] });
      wk.add(cyl(r * 0.5, r * 0.5, w, 10), P.cream, { rot: [0, 0, Math.PI / 2] });
      wk.add(cyl(r * 0.18, r * 0.18, w + 0.04, 6), P.berry, { rot: [0, 0, Math.PI / 2] });
      return wk.build();
    };
    const addWheel = (x: number, y: number, z: number, radius: number, rest: number, mud: boolean): void => {
      const leg = new Group();
      leg.position.set(x, y, z);
      const legMesh = makeMesh(new Kit().add(cyl(0.035, 0.035, rest, 5), EXTRA.metal, { pos: [0, -rest / 2, 0] }).build(), mat, 'leg');
      leg.add(legMesh);
      const wheel = new Group();
      wheel.position.set(0, -rest, 0);
      wheel.add(makeMesh(tireGeo(radius, radius * 0.55), mat, 'wheel'));
      leg.add(wheel);
      if (mud) {
        const guard = makeMesh(
          new Kit()
            .add(torus(radius * 1.12, 0.04, 4, 10, Math.PI * 0.9), P.sun, { rot: [0, Math.PI / 2, Math.PI * 0.05] })
            .build(),
          mat,
          'mudguard',
        );
        guard.position.set(0, -rest, 0);
        leg.add(guard);
      }
      this.root.add(leg);
      this.wheels.push({ leg, wheel, restY: y });
    };
    addWheel(-D.mainGear.x, D.mainGear.y, D.mainGear.z, 0.32, 0.6, true);
    addWheel(D.mainGear.x, D.mainGear.y, D.mainGear.z, 0.32, 0.6, true);
    addWheel(D.tailGear.x, D.tailGear.y, D.tailGear.z, 0.14, 0.35, false);

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
      left: lamp('#FF4B55', -(up.halfSpan + 0.02), up.y, up.z - 0.1, 'nav-left'),
      right: lamp('#3DFF7A', up.halfSpan + 0.02, up.y, up.z - 0.1, 'nav-right'),
      tail: lamp('#FFFFFF', 0, 1.02, 2.28, 'nav-tail'),
    };

    // ---------------- Kanopi (tersimpan; animasi di Fase 2)
    const glass = new MeshToonNodeMaterial({ color: EXTRA.glass, transparent: true, opacity: 0.35, gradientMap: toonGradient() });
    glass.depthWrite = false;
    this.disposables.push(glass);
    const canopyMesh = new Mesh(sphere(0.5, 14, 8).scale(0.72, 0.62, 1.9), glass);
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
          .add(cone(0.09, 0.2, 8), P.berry, { pos: [0, 0, -0.45], rot: [-Math.PI / 2, 0, 0] })
          .build(),
        mat,
        'rocket',
      );
      rocket.position.set(side * 1.15, lo.y - 0.15, lo.z - 0.05);
      this.rocketKit.add(rocket);
    }
    this.rocketKit.visible = false;
    this.root.add(this.rocketKit);

    // Titik duduk & kamera.
    this.pilotSeat.position.set(0, 0.42, 0.32);
    this.copilotSeat.position.set(0, 0.44, 1.12);
    this.cockpitEye.position.set(0, 0.9, 0.42);
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
    // Baling-baling "bengkok" setelah tabrakan besar: goyang sumbu.
    this.propeller.rotation.x = propBent * Math.sin(time * 40) * 0.25;
    const blur = Math.min(1, Math.max(0, (Math.abs(propRate) - 18) / 40));
    const bm = this.blurDisc.material as MeshBasicNodeMaterial;
    bm.opacity = blur * 0.32;
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

  dispose(): void {
    this.root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose();
    });
    for (const d of this.disposables) d.dispose();
  }
}
