/**
 * Kanopi otomatis (docs/04 bagian 7.4): kubah kaca berengsel di belakang kokpit.
 * Menutup saat hujan, masuk awan tebal, atau di stratosfer/angkasa/Bulan; terbuka 8 detik setelah reda.
 * Saat hujan & tertutup: wiper menyapu dan tetesan air meluncur ke belakang mengikuti kecepatan.
 * Di angkasa Aril dan Piko memakai helm gelembung.
 */
import type { Object3D} from 'three';
import { Group, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import { color, dot, float, normalView, oneMinus, positionViewDirection, pow } from 'three/tsl';
import { bus, type FlightRegime } from '../core/EventBus';
import { toonGradient } from '../utils/modeling/materials';
import { Kit, box, rbox } from '../utils/modeling/Kit';
import { mulberry32 } from '../utils/rng';

export type CanopyMode = 'auto' | 'open' | 'closed';

export interface CanopyContext {
  rain: number;
  cloud: number;
  regime: FlightRegime;
  airspeed: number;
  mode: CanopyMode;
}

const OPEN_DELAY = 8;
const rim = () => pow(oneMinus(dot(normalView, positionViewDirection).abs()), float(2.5));
const DROPS = 26;
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

export class Canopy {
  readonly group = new Group();
  /** 0 = terbuka, 1 = tertutup. */
  k = 0;
  closed = false;
  private readonly hinge = new Group();
  private readonly wipers: Object3D[] = [];
  private readonly drops: InstancedMesh;
  private readonly dropState: { u: number; v: number; speed: number; size: number }[] = [];
  private readonly helmets: Mesh[] = [];
  private clearTimer = 0;
  private wiperT = 0;
  private wiperOn = false;
  private lastSweep = 0;
  private readonly materials: Material[] = [];

  constructor(frameMaterial: Material, pilotHead: Vector3, copilotHead: Vector3) {
    this.group.name = 'canopy';
    // Engsel di belakang kursi Piko; kubah memanjang menutup dua kursi.
    this.hinge.position.set(0, 0.62, 1.55);
    this.group.add(this.hinge);
    const glass = new MeshToonNodeMaterial({ color: '#BFE6FF', transparent: true, opacity: 0.3, gradientMap: toonGradient() });
    glass.depthWrite = false;
    // Tepi kaca sedikit lebih terang (fresnel) supaya bentuk kubah terbaca.
    glass.emissiveNode = color('#E8F7FF').mul(rim().mul(0.5));
    this.materials.push(glass);
    const dome = new Mesh(new SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.scale.set(1.02, 0.78, 1.75);
    dome.position.set(0, 0, -0.82);
    dome.renderOrder = 2;
    this.hinge.add(dome);
    // Rangka toska: busur depan, tengah, belakang.
    const k = new Kit();
    for (const z of [-0.0, -0.82, -1.62]) {
      const t = new TorusGeometry(0.5, 0.025, 4, 18, Math.PI);
      t.scale(1.02, 0.78 * (z === -0.82 ? 1 : z === 0 ? 0.55 : 0.55), 1);
      t.translate(0, 0, z);
      k.add(t, '#2F8FA6');
    }
    k.add(rbox(0.06, 0.04, 1.65, 0.02), '#2F8FA6', { pos: [0, 0.39, -0.82] });
    const frame = new Mesh(k.build(), frameMaterial);
    frame.name = 'canopy-frame';
    this.hinge.add(frame);

    // Wiper: dua lengan tipis pada kaca depan kubah.
    for (const x of [-0.16, 0.16]) {
      const w = new Group();
      w.position.set(x, -0.02, -1.5);
      const wk = new Kit();
      wk.add(box(0.018, 0.34, 0.018), '#2B2D42', { pos: [0, 0.17, 0] });
      wk.add(box(0.03, 0.3, 0.012), '#3A3D4A', { pos: [0, 0.2, -0.015] });
      const wm = new Mesh(wk.build(), frameMaterial);
      w.rotation.x = -0.55;
      w.add(wm);
      w.visible = false;
      this.hinge.add(w);
      this.wipers.push(w);
    }

    // Tetesan air di kaca.
    const dm = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    dm.colorNode = color('#EAF6FF');
    dm.opacityNode = float(0.55);
    this.materials.push(dm);
    this.drops = new InstancedMesh(new SphereGeometry(1, 6, 4), dm, DROPS);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 3;
    this.hinge.add(this.drops);
    const rng = mulberry32(31);
    for (let i = 0; i < DROPS; i++) this.dropState.push({ u: rng() * 2 - 1, v: rng(), speed: 0.4 + rng(), size: 0.012 + rng() * 0.018 });

    // Helm gelembung (angkasa).
    const hm = new MeshToonNodeMaterial({ color: '#DDF3FF', transparent: true, opacity: 0.22, gradientMap: toonGradient() });
    hm.depthWrite = false;
    hm.emissiveNode = color('#FFFFFF').mul(rim().mul(0.45));
    this.materials.push(hm);
    for (const [pos, r] of [
      [pilotHead, 0.34],
      [copilotHead, 0.3],
    ] as [Vector3, number][]) {
      const h = new Mesh(new SphereGeometry(r, 14, 10), hm);
      h.position.copy(pos);
      h.visible = false;
      h.renderOrder = 2;
      this.group.add(h);
      this.helmets.push(h);
    }
    this.apply();
  }

  update(dt: number, c: CanopyContext): void {
    const spaceLike = c.regime === 'space' || c.regime === 'moon' || c.regime === 'stratosphere';
    const weatherClose = c.rain > 0.08 || c.cloud > 0.4;
    let want: boolean;
    if (c.mode === 'closed' || spaceLike) want = true;
    else if (c.mode === 'open') want = false;
    else {
      if (weatherClose) this.clearTimer = 0;
      else this.clearTimer += dt;
      want = weatherClose || (this.closed && this.clearTimer < OPEN_DELAY);
    }
    if (want !== this.closed) {
      this.closed = want;
      bus.emit('canopy', { closed: want });
    }
    const target = this.closed ? 1 : 0;
    const before = this.k;
    this.k += Math.sign(target - this.k) * Math.min(Math.abs(target - this.k), dt / 0.9);
    if (before !== this.k) this.apply();

    // Helm hanya di angkasa/Bulan.
    const helmet = c.regime === 'space' || c.regime === 'moon';
    for (const h of this.helmets) h.visible = helmet;

    // Wiper
    this.wiperOn = this.k > 0.95 && c.rain > 0.05;
    for (const w of this.wipers) w.visible = this.k > 0.9;
    if (this.wiperOn) {
      this.wiperT += dt * (1.6 + c.rain * 1.4);
      const a = Math.sin(this.wiperT * Math.PI);
      for (const [i, w] of this.wipers.entries()) w.rotation.z = (i === 0 ? 1 : -1) * (0.15 + Math.abs(a) * 1.1);
      const sweep = Math.floor(this.wiperT);
      if (sweep !== this.lastSweep) {
        this.lastSweep = sweep;
        bus.emit('wiper', {});
      }
    }

    // Tetesan: muncul saat hujan, meluncur ke belakang (lebih cepat saat melaju), disapu wiper.
    const n = this.k > 0.9 ? Math.round(DROPS * Math.min(1, c.rain * 1.6)) : 0;
    this.drops.count = n;
    if (n) {
      const flow = 0.05 + Math.min(1, c.airspeed / 40) * 0.9;
      for (let i = 0; i < n; i++) {
        const d = this.dropState[i]!;
        d.v += dt * flow * d.speed;
        if (d.v > 1) {
          d.v = 0;
          d.u = Math.random() * 1.8 - 0.9;
        }
        // Permukaan kubah: u = posisi menyamping, v = dari depan (0) ke belakang (1).
        const z = -1.62 + d.v * 1.55;
        const lat = d.u * 1.2;
        const ez = (z + 0.82) / (0.5 * 1.75);
        const rr = Math.sqrt(Math.max(0, 1 - ez * ez));
        _p.set(Math.sin(lat) * 0.51 * rr * 1.02, Math.cos(lat) * 0.51 * rr * 0.78, z);
        _s.set(d.size, d.size, d.size * (1 + flow * 2));
        _m.compose(_p, _q.identity(), _s);
        this.drops.setMatrixAt(i, _m);
      }
      this.drops.instanceMatrix.needsUpdate = true;
    }
  }

  private apply(): void {
    // Terbuka = kubah berputar ke belakang di engselnya.
    const e = this.k * this.k * (3 - 2 * this.k);
    this.hinge.rotation.x = (1 - e) * -1.75;
    this.hinge.visible = true;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
