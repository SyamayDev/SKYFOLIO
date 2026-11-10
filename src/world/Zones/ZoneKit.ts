/**
 * Perkakas bersama untuk membangun zona di planet bulat (docs/02 bagian 3):
 * - `SurfaceFrame`: rangka lokal di permukaan (x = kanan, y = atas, −z = arah hadap) yang menempel ke
 *   tinggi medan sungguhan (Planet.heightAt), sehingga setiap benda berdiri tepat di tanah.
 * - Collider statis kuboid, props fisika, dan pulau prosedural (mesh + trimesh) untuk zona di laut.
 * - Penanda POI yang terlihat dari jauh.
 */
import { drawIcon, isIconName } from '../../ui/icons';
import type RAPIER from '@dimforge/rapier3d-compat';
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, Quaternion, Vector3, type Material, type Object3D } from 'three';
import { PALETTE } from '../../config/palette';
import { PLANET_RADIUS } from '../../config/world';
import { GROUP, interactionGroups, type PhysicsWorld, type SurfaceMaterial } from '../../physics/PhysicsWorld';
import { Prop, type PropOptions } from '../../physics/Props';
import type { RadialGravity } from '../../physics/RadialGravity';
import { bearingDirection, latLonToVec3 } from '../../utils/geo';
import { SimplexNoise } from '../../utils/noise';
import { mulberry32 } from '../../utils/rng';
import { quatFromUpForward } from '../../utils/quat';
import type { Kit } from '../../utils/modeling/Kit';
import { Billboard, roundRect } from '../Billboard';
import type { Planet } from '../Planet';
import type { Particles } from '../Particles';
import type { Scatter } from '../Scatter';

export interface ZoneDeps {
  physics: PhysicsWorld;
  gravity: RadialGravity;
  planet: Planet;
  scatter: Scatter;
  material: Material;
  particles: Particles;
}

export interface StaticBox {
  half: [number, number, number];
  offset?: [number, number, number];
  rotation?: Quaternion;
}

const _p = new Vector3();
const _q = new Quaternion();
const _d = new Vector3();

/** Rangka lokal di permukaan planet pada lat/lon, menghadap `headingDeg`. */
export class SurfaceFrame {
  readonly dir = new Vector3();
  readonly up = new Vector3();
  readonly east = new Vector3();
  readonly north = new Vector3();
  readonly fwd = new Vector3();
  readonly right = new Vector3();
  readonly quat = new Quaternion();
  readonly origin = new Vector3();
  /** Tinggi tanah di titik pusat (di atas laut). */
  readonly ground: number;

  constructor(
    readonly lat: number,
    readonly lon: number,
    readonly headingDeg: number,
    private readonly planet: Planet,
    /** Tinggi minimum (mis. lantai pulau/air). */
    readonly floor = 0,
  ) {
    latLonToVec3(lat, lon, 1, this.dir);
    this.up.copy(this.dir);
    bearingDirection(this.dir, headingDeg, this.fwd);
    this.right.crossVectors(this.fwd, this.up).normalize();
    this.east.crossVectors(new Vector3(0, 1, 0), this.up).normalize();
    this.north.crossVectors(this.up, this.east).normalize();
    quatFromUpForward(this.up, this.fwd, this.quat);
    this.ground = Math.max(floor, planet.heightAt(this.dir, floor));
    this.origin.copy(this.dir).multiplyScalar(PLANET_RADIUS + this.ground);
  }

  /** Arah satuan untuk offset lokal (x kanan, z belakang) — mengikuti lengkung bola. */
  dirAt(x: number, z: number, out = new Vector3()): Vector3 {
    return out
      .copy(this.dir)
      .addScaledVector(this.right, x / PLANET_RADIUS)
      .addScaledVector(this.fwd, -z / PLANET_RADIUS)
      .normalize();
  }

  /** Tinggi tanah di offset lokal. */
  groundAt(x: number, z: number): number {
    return Math.max(this.floor, this.planet.heightAt(this.dirAt(x, z, _d), this.floor));
  }

  /**
   * Posisi + rotasi untuk objek di offset lokal (x, z), `y` di atas tanah (atau di atas `baseHeight`
   * bila diberikan, misalnya lantai datar zona).
   */
  place(obj: Object3D, x: number, z: number, y = 0, yawDeg = 0, baseHeight?: number): Object3D {
    const d = this.dirAt(x, z, _d);
    const h = baseHeight ?? this.groundAt(x, z);
    obj.position.copy(d).multiplyScalar(PLANET_RADIUS + h + y);
    const fwd = bearingDirection(d, this.headingDeg + yawDeg, _p);
    quatFromUpForward(d, fwd, obj.quaternion);
    return obj;
  }

  /** Titik dunia untuk offset lokal (x, y, z) relatif tanah pusat (tanpa sampling ulang tinggi). */
  point(x: number, y: number, z: number, out = new Vector3()): Vector3 {
    const d = this.dirAt(x, z, out);
    return d.multiplyScalar(PLANET_RADIUS + this.ground + y);
  }
}

export function makeMesh(k: Kit, mat: Material, name: string, shadow = true): Mesh {
  const m = new Mesh(k.build(), mat);
  m.name = name;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** Collider statis kuboid (bangunan, menara, papan) di posisi/rotasi objek. */
export function addStatic(physics: PhysicsWorld, obj: Object3D, boxes: StaticBox[], material: SurfaceMaterial): RAPIER.RigidBody {
  const R = physics.R;
  obj.updateMatrixWorld();
  obj.getWorldPosition(_p);
  obj.getWorldQuaternion(_q);
  const body = physics.world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(_p.x, _p.y, _p.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }),
  );
  for (const b of boxes) {
    const cd = R.ColliderDesc.cuboid(b.half[0], b.half[1], b.half[2])
      .setCollisionGroups(interactionGroups(GROUP.STATIC, 0xffff))
      .setFriction(0.7)
      .setRestitution(0.2);
    if (b.offset) cd.setTranslation(b.offset[0], b.offset[1], b.offset[2]);
    if (b.rotation) cd.setRotation({ x: b.rotation.x, y: b.rotation.y, z: b.rotation.z, w: b.rotation.w });
    physics.setInfo(physics.world.createCollider(cd, body), { kind: 'static', material });
  }
  return body;
}

/** Collider sensor bola (pemicu) — tidak menghalangi, memanggil `onEnter` saat bersentuhan. */
export function addSensor(physics: PhysicsWorld, pos: Vector3, radius: number, onEnter: (other: unknown) => void): RAPIER.Collider {
  const R = physics.R;
  const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z));
  const c = physics.world.createCollider(
    R.ColliderDesc.ball(radius)
      .setSensor(true)
      .setCollisionGroups(interactionGroups(GROUP.STATIC, GROUP.PROP | GROUP.PLANE))
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    body,
  );
  physics.setInfo(c, { kind: 'static', material: 'fabric', onContact: (e) => onEnter(e.otherInfo?.owner) });
  return c;
}

export function addProp(deps: ZoneDeps, obj: Object3D, opts: PropOptions): Prop {
  obj.updateMatrixWorld();
  const pos = obj.getWorldPosition(new Vector3());
  const rot = obj.getWorldQuaternion(new Quaternion());
  return new Prop(deps.physics, deps.gravity, obj, pos, rot, opts);
}

// ---------------------------------------------------------------------------------------------
// Pulau prosedural (zona di laut: Kepulauan Proyek, Pulau Gym, gunung api Kawah Nekat)

export interface IslandOptions {
  radius: number;
  height: number;
  seed: number;
  /** Rasio datar di puncak (0 = bukit, 0,6 = dataran luas untuk landasan). */
  plateau?: number;
  /** Kawah gunung api (radius relatif, 0 = tidak ada). */
  crater?: number;
  grass?: string;
}

/**
 * Pulau low-poly mengikuti lengkung bola: cincin pasir di garis air, rumput di atas, batu di lereng curam.
 * Mengembalikan mesh (warna per muka) + collider trimesh statis.
 */
export function buildIsland(frame: SurfaceFrame, deps: ZoneDeps, o: IslandOptions): { mesh: Mesh; collider: RAPIER.Collider } {
  const rings = 9;
  const seg = Math.max(18, Math.round(o.radius * 3.2));
  const noise = new SimplexNoise(o.seed);
  const rng = mulberry32(o.seed);
  const plateau = o.plateau ?? 0.35;
  const rows: Vector3[][] = [];
  const heights: number[][] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const row: Vector3[] = [];
    const hr: number[] = [];
    for (let j = 0; j < (i === 0 ? 1 : seg); j++) {
      const a = (j / seg) * Math.PI * 2 + (i % 2) * (Math.PI / seg);
      const wob = 1 + noise.noise3(Math.cos(a) * 1.3, Math.sin(a) * 1.3, o.seed * 0.01) * 0.22;
      const r = t * o.radius * wob;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      let h: number;
      const tt = t * (1 / Math.max(0.0001, wob));
      if (tt <= plateau) h = o.height;
      else h = o.height * (1 - smooth((tt - plateau) / (1 - plateau)));
      if (o.crater && tt < o.crater) h = o.height - (o.crater - tt) * o.height * 1.6;
      h += noise.noise3(x * 0.3, z * 0.3, 2.7) * Math.min(0.5, o.height * 0.08) * (1 - tt);
      if (i === rings) h = -1.6;
      else if (i === rings - 1) h = Math.min(h, 0.45 + rng() * 0.15);
      row.push(new Vector3(x, h, z));
      hr.push(h);
    }
    rows.push(row);
    heights.push(hr);
  }
  const pos: number[] = [];
  const col: number[] = [];
  const sand = new Color(PALETTE.sand);
  const grass = new Color(o.grass ?? PALETTE.grassTropic);
  const rock = new Color(PALETTE.rock);
  const wet = new Color('#DDB679');
  const tmp = new Color();
  const v = new Vector3();
  const pushTri = (a: Vector3, b: Vector3, c: Vector3): void => {
    for (const p of [a, b, c]) {
      frame.dirAt(p.x, p.z, v).multiplyScalar(PLANET_RADIUS + frame.floor + p.y);
      pos.push(v.x, v.y, v.z);
    }
    const hMin = Math.min(a.y, b.y, c.y);
    const hMax = Math.max(a.y, b.y, c.y);
    const avg = (a.y + b.y + c.y) / 3;
    if (hMax < 0.7) tmp.copy(avg < 0.2 ? wet : sand);
    else if (hMax - hMin > 2.2 || (o.crater && avg > o.height * 0.75)) tmp.copy(rock);
    else tmp.copy(grass).multiplyScalar(0.92 + rng() * 0.12);
    for (let k = 0; k < 3; k++) col.push(tmp.r, tmp.g, tmp.b);
  };
  for (let i = 0; i < rings; i++) {
    const inner = rows[i]!;
    const outer = rows[i + 1]!;
    for (let j = 0; j < seg; j++) {
      const o0 = outer[j]!;
      const o1 = outer[(j + 1) % seg]!;
      if (i === 0) {
        pushTri(inner[0]!, o1, o0);
        continue;
      }
      const i0 = inner[j]!;
      const i1 = inner[(j + 1) % seg]!;
      pushTri(i0, i1, o0);
      pushTri(i1, o1, o0);
    }
  }
  // Winding: pastikan menghadap atas (cek satu segitiga).
  const geo = new BufferGeometry();
  const arr = new Float32Array(pos);
  const a = new Vector3(arr[0], arr[1], arr[2]);
  const b = new Vector3(arr[3], arr[4], arr[5]);
  const c = new Vector3(arr[6], arr[7], arr[8]);
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  if (n.dot(a) < 0) {
    for (let k = 0; k < arr.length; k += 9) {
      for (let q = 0; q < 3; q++) {
        const t = arr[k + 3 + q]!;
        arr[k + 3 + q] = arr[k + 6 + q]!;
        arr[k + 6 + q] = t;
      }
    }
  }
  geo.setAttribute('position', new Float32BufferAttribute(arr, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, deps.material);
  mesh.name = 'island';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const R = deps.physics.R;
  const idx = new Uint32Array(arr.length / 3);
  for (let k = 0; k < idx.length; k++) idx[k] = k;
  const collider = deps.physics.world.createCollider(
    R.ColliderDesc.trimesh(arr, idx, R.TriMeshFlags.MERGE_DUPLICATE_VERTICES | R.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setCollisionGroups(interactionGroups(GROUP.TERRAIN, 0xffff))
      .setFriction(0.8)
      .setRestitution(0.1),
  );
  deps.physics.setInfo(collider, { kind: 'terrain', material: 'grass' });
  return { mesh, collider };
}

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// ---------------------------------------------------------------------------------------------
// Penanda POI & papan informasi

/** Ikon bulat melayang di atas zona (terlihat dari jauh, memudar saat dekat). Ikon vektor dari ui/icons. */
export function poiMarker(icon: string, color: string): Billboard {
  return new Billboard(() => icon, {
    width: 3.2,
    height: 3.2,
    draw: (g, w, h) => {
      g.fillStyle = 'rgba(43,45,66,0.25)';
      g.beginPath();
      g.arc(w / 2, h / 2 + 6, w * 0.44, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = w * 0.05;
      g.strokeStyle = '#FFF6E6';
      g.stroke();
      if (isIconName(icon)) drawIcon(g, icon, w / 2, h / 2, w * 0.5, '#FFFFFF');
      else {
        g.font = `${Math.round(h * 0.5)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(icon, w / 2, h / 2 + h * 0.03);
      }
    },
  });
}

/** Papan judul + teks (CanvasTexture, ikut bahasa aktif). */
export function infoBoard(
  getTitle: () => string,
  getBody: () => string,
  opts: { width?: number; height?: number; accent?: string; sprite?: boolean } = {},
): Billboard {
  const width = opts.width ?? 8;
  const height = opts.height ?? 4.2;
  return new Billboard(() => `${getTitle()}\n${getBody()}`, {
    width,
    height,
    sprite: opts.sprite ?? false,
    draw: (g, w, h) => {
      g.fillStyle = 'rgba(43,45,66,0.9)';
      roundRect(g, 4, 4, w - 8, h - 8, 48);
      g.fill();
      g.fillStyle = '#FFF6E6';
      roundRect(g, 16, 16, w - 32, h - 32, 40);
      g.fill();
      g.fillStyle = opts.accent ?? PALETTE.sun;
      roundRect(g, 16, 16, w - 32, h * 0.27, 40);
      g.fill();
      g.fillRect(16, 16 + h * 0.15, w - 32, h * 0.12);
      g.fillStyle = PALETTE.ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `700 ${Math.round(h * 0.12)}px Fredoka, "Nunito Sans", system-ui, sans-serif`;
      g.fillText(getTitle(), w / 2, 16 + h * 0.135, w - 80);
      g.font = `600 ${Math.round(h * 0.075)}px "Nunito Sans", system-ui, sans-serif`;
      g.textAlign = 'left';
      wrapText(g, getBody(), 56, 16 + h * 0.36, w - 112, h * 0.1, 6);
    },
  });
}

export function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): void {
  const paras = text.split('\n');
  let line = 0;
  for (const para of paras) {
    const words = para.split(/\s+/);
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (g.measureText(test).width > maxW && cur) {
        if (line >= maxLines - 1) {
          g.fillText(`${cur}…`, x, y + line * lineH);
          return;
        }
        g.fillText(cur, x, y + line * lineH);
        line++;
        cur = w;
      } else cur = test;
    }
    if (cur) {
      g.fillText(cur, x, y + line * lineH);
      line++;
    }
    if (line >= maxLines) return;
  }
}

export { Group };
