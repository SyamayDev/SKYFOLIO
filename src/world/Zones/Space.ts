/**
 * Orbit Sertifikat & Bulan (docs/02 bagian 3.12–3.13).
 * - Stasiun angkasa kecil di ketinggian ORBIT_RING dengan satelit per sertifikat (content/certificates.json);
 *   panel surya berkilau. Mendekati satelit menampilkan judul sertifikat.
 * - Bulan low-poly berkawah dengan landasan bercahaya dan bendera SKYFOLIO. Posisi mengikuti fase Bulan
 *   nyata (bulan sinodik 29,53059 hari sejak bulan baru 6 Jan 2000 18.14 UTC). Gravitasi & pendaratan
 *   mulus diurus sistem orbit (Fase 2).
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, Quaternion, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../../config/palette';
import { MOON_DISTANCE, MOON_RADIUS, ORBIT_RING, PLANET_RADIUS, SPACE_START } from '../../config/world';
import { L, content } from '../../content';
import { bus } from '../../core/EventBus';
import { GROUP, interactionGroups } from '../../physics/PhysicsWorld';
import { tr } from '../../i18n';
import { SimplexNoise } from '../../utils/noise';
import { mulberry32 } from '../../utils/rng';
import { Kit, box, cyl, rbox, sphere, torus } from '../../utils/modeling/Kit';
import { createUnlitMaterial, setFlatShading, toonGradient } from '../../utils/modeling/materials';
import { quatFromUpForward } from '../../utils/quat';
import { Billboard } from '../Billboard';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { makeMesh } from './ZoneKit';
import { MeshToonNodeMaterial } from 'three/webgpu';

export { moonDirection, moonPhase } from '../MoonPhase';
import { moonDirection, moonPhase } from '../MoonPhase';

const _v = new Vector3();
const _q = new Quaternion();

export class OrbitZone extends Zone {
  readonly station = new Group();
  private readonly sats: { obj: Group; title: string; angle: number }[] = [];
  private tag: Billboard | null = null;
  private angle = 0;

  constructor() {
    super('orbit');
    this.icon = '🛰️';
    this.color = '#6C7BD9';
    this.triggerRadius = 0;
    this.buildRadius = 700;
    this.updateRadius = Infinity;
    this.renderRadius = 900;
    this.cullDetail = false;
  }

  locate(): void {
    this.center.set(0, 0, ORBIT_RING);
    this.poi.copy(this.center);
  }

  /** Di "orbit" = di atas batas angkasa. */
  override distanceTo(p: Vector3): number {
    return p.length() > SPACE_START ? 0 : 1e9;
  }

  protected build(): void {
    const mat = this.deps.material;
    const k = new Kit();
    k.add(cyl(2.2, 2.2, 7, 12), '#E9EDF2', { rot: [0, 0, Math.PI / 2] });
    k.add(sphere(2.6, 12, 8), '#C9CED6', {});
    k.add(torus(6, 0.5, 6, 32), '#9AA3AE', { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 4; i++) k.add(box(0.3, 0.3, 6), '#9AA3AE', { rot: [0, (i * Math.PI) / 2, 0], pos: [0, 0, 0] });
    for (const s of [-1, 1]) {
      k.add(box(10, 0.12, 3.4), '#2F5FB8', { pos: [s * 9.5, 0, 0] });
      k.add(box(0.3, 0.3, 0.3), PALETTE.sun, { pos: [s * 4.2, 0, 0] });
    }
    this.station.add(makeMesh(k, mat, 'space-station', false));
    const lamp = new Mesh(sphere(0.4, 8, 6), createUnlitMaterial('#FF5A5F'));
    lamp.position.set(0, 2.9, 0);
    this.station.add(lamp);
    this.group.add(this.station);
    const certs = content.get().certificates.items;
    certs.forEach((c, i) => {
      const s = new Group();
      const sk = new Kit();
      sk.add(rbox(1.4, 1.4, 1.4, 0.2), PALETTE.sun, {});
      for (const side of [-1, 1]) sk.add(box(2.4, 0.08, 1.1), '#2F5FB8', { pos: [side * 1.9, 0, 0] });
      sk.add(cyl(0.05, 0.05, 1.2, 4), PALETTE.ink, { pos: [0, 1.2, 0] });
      s.add(makeMesh(sk, mat, 'satellite', false));
      this.group.add(s);
      this.sats.push({ obj: s, title: L(c.title as never) || String(c.title), angle: (i / Math.max(1, certs.length)) * Math.PI * 2 });
    });
    this.tag = new Billboard(() => (certs.length ? tr('zones.orbit.title', { n: certs.length }) : tr('zones.orbit.soon')), {
      width: 12,
      height: 2,
      bg: 'rgba(11,22,64,0.85)',
      color: '#FFF6E6',
      fontSize: 70,
    });
    this.boards.push(this.tag);
    this.tag.object.position.set(0, 8, 0);
    this.station.add(this.tag.object);
  }

  override update(t: ZoneTick): void {
    // Stasiun mengorbit pelan di atas khatulistiwa sisi siang supaya mudah ditemukan.
    this.angle += t.dt * 0.004;
    const r = ORBIT_RING;
    _v.set(Math.sin(this.angle + 1.7), 0.12, Math.cos(this.angle + 1.7)).normalize().multiplyScalar(r);
    this.station.position.copy(_v);
    this.station.quaternion.copy(quatFromUpForward(_v.clone().normalize(), new Vector3(0, 1, 0), _q));
    this.station.rotateY(t.time * 0.05);
    this.center.copy(this.station.position);
    this.poi.copy(this.station.position);
    this.sats.forEach((s, i) => {
      const a = s.angle + t.time * 0.03;
      s.obj.position.copy(this.station.position).add(_v.set(Math.cos(a) * 26, Math.sin(a * 2 + i) * 4, Math.sin(a) * 26));
      s.obj.rotation.y += t.dt * 0.4;
    });
  }

  override action(): ZoneAction {
    return { label: 'actions.viewCertificates', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}

export class MoonZone extends Zone {
  readonly moon = new Group();
  readonly moonCenter = new Vector3(0, 0, MOON_DISTANCE);
  private body: RAPIER.RigidBody | null = null;
  readonly pad = new Vector3();
  readonly padNormal = new Vector3();
  private readonly flag = new Group();
  private material: MeshToonNodeMaterial | null = null;

  constructor() {
    super('moon');
    this.icon = '🌙';
    this.color = '#CDEBFF';
    this.triggerRadius = MOON_RADIUS + 50;
    this.buildRadius = Infinity;
    this.updateRadius = Infinity;
    this.renderRadius = Infinity;
    this.cullDetail = false;
  }

  locate(): void {
    this.center.copy(this.moonCenter);
    this.poi.copy(this.moonCenter);
  }

  protected build(): void {
    // Bola berkawah: displacement noise + cekungan kawah, flat shaded.
    const base = new IcosahedronGeometry(MOON_RADIUS, 5);
    base.deleteAttribute('normal');
    base.deleteAttribute('uv');
    const geo = mergeVertices(base);
    base.dispose();
    const pos = geo.getAttribute('position');
    const noise = new SimplexNoise(1969);
    const rng = mulberry32(1969);
    const craters: { d: Vector3; r: number }[] = [];
    for (let i = 0; i < 46; i++) craters.push({ d: new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), r: 0.06 + rng() * rng() * 0.32 });
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).normalize();
      let h = noise.fbm3(_v.x * 3, _v.y * 3, _v.z * 3, 4) * 1.6;
      let dark = 0;
      for (const c of craters) {
        const a = Math.acos(Math.max(-1, Math.min(1, _v.dot(c.d))));
        if (a < c.r * 1.25) {
          const x = a / c.r;
          h += x < 1 ? -(1 - x * x) * c.r * 9 : (1.25 - x) * c.r * 8;
          if (x < 1) dark = Math.max(dark, 1 - x);
        }
      }
      pos.setXYZ(i, _v.x * (MOON_RADIUS + h), _v.y * (MOON_RADIUS + h), _v.z * (MOON_RADIUS + h));
      const g = 0.78 - dark * 0.2 + noise.noise3(_v.x * 9, _v.y * 9, _v.z * 9) * 0.05;
      colors[i * 3] = g;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = g * 1.04;
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new MeshToonNodeMaterial({ vertexColors: true, gradientMap: toonGradient() });
    setFlatShading(m);
    this.material = m;
    const mesh = new Mesh(geo, m);
    mesh.name = 'moon';
    mesh.receiveShadow = true;
    this.moon.add(mesh);
    // Landasan bercahaya + bendera di sisi yang menghadap Bumi (−Z lokal).
    const padK = new Kit();
    padK.add(cyl(9, 9, 0.6, 24), '#5B6170', {});
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      padK.add(sphere(0.35, 6, 4), '#7CFFB0', { pos: [Math.cos(a) * 8.4, 0.4, Math.sin(a) * 8.4] });
    }
    padK.add(box(6, 0.1, 1), '#FFFFFF', { pos: [0, 0.32, 0] });
    padK.add(box(1, 0.1, 6), '#FFFFFF', { pos: [0, 0.32, 0] });
    const pad = makeMesh(padK, this.deps.material, 'moon-pad');
    const padGroup = new Group();
    padGroup.add(pad);
    const fk = new Kit();
    fk.add(cyl(0.12, 0.12, 6, 6), '#C9CED6', { pos: [10.5, 3, 0] });
    this.flag.add(makeMesh(fk, this.deps.material, 'flag-pole'));
    const cloth = new Billboard(() => 'SKYFOLIO', { width: 4.4, height: 2.4, sprite: false, bg: PALETTE.sun, fontSize: 90 });
    this.boards.push(cloth);
    cloth.object.position.set(12.8, 4.8, 0);
    this.flag.add(cloth.object);
    padGroup.add(this.flag);
    const padDir = new Vector3(0, 0, -1);
    padGroup.position.copy(padDir).multiplyScalar(MOON_RADIUS + 0.4);
    padGroup.quaternion.copy(quatFromUpForward(padDir, new Vector3(0, 1, 0), _q));
    this.moon.add(padGroup);
    this.group.add(this.moon);
    // Collider: bola padat (kinematik supaya bisa dipindah saat jauh).
    const R = this.deps.physics.R;
    this.body = this.deps.physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.moonCenter.x, this.moonCenter.y, this.moonCenter.z));
    const col = this.deps.physics.world.createCollider(
      R.ColliderDesc.ball(MOON_RADIUS - 0.4).setCollisionGroups(interactionGroups(GROUP.TERRAIN, 0xffff)).setFriction(0.9),
      this.body,
    );
    this.deps.physics.setInfo(col, { kind: 'terrain', material: 'rock' });
    const padCol = this.deps.physics.world.createCollider(
      R.ColliderDesc.cylinder(0.3, 9).setTranslation(0, 0, -(MOON_RADIUS + 0.4)).setRotation({ x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setCollisionGroups(interactionGroups(GROUP.TERRAIN, 0xffff)),
      this.body,
    );
    this.deps.physics.setInfo(padCol, { kind: 'terrain', material: 'metal' });
    this.bodies.push(this.body);
  }

  /** Pindahkan Bulan sesuai fase nyata — hanya saat pesawat jauh (supaya tidak bergeser saat didarati). */
  place(sunDir: Vector3, date: Date, planePos: Vector3, force = false): void {
    if (!force && planePos.distanceTo(this.moonCenter) < MOON_RADIUS + 500) return;
    moonDirection(sunDir, moonPhase(date), _v).multiplyScalar(MOON_DISTANCE);
    this.moonCenter.copy(_v);
    this.center.copy(_v);
    this.poi.copy(_v);
    this.moon.position.copy(_v);
    // Sisi landasan (−Z) menghadap Bumi → "Bumi terbit" terlihat dari landasan.
    const toEarth = _v.clone().negate().normalize();
    this.moon.quaternion.setFromUnitVectors(new Vector3(0, 0, -1), toEarth);
    this.body?.setNextKinematicTranslation({ x: _v.x, y: _v.y, z: _v.z });
    this.body?.setNextKinematicRotation({ x: this.moon.quaternion.x, y: this.moon.quaternion.y, z: this.moon.quaternion.z, w: this.moon.quaternion.w });
    this.pad.copy(toEarth).multiplyScalar(MOON_RADIUS + 0.7).add(this.moonCenter);
    this.padNormal.copy(toEarth);
  }

  override update(t: ZoneTick): void {
    this.flag.children[1]!.rotation.y = Math.sin(t.time * 0.5) * 0.08;
    if (this.marker) this.marker.object.visible = false;
  }

  override action(): ZoneAction {
    return { label: 'actions.viewMoon', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }

  override dispose(): void {
    this.material?.dispose();
    super.dispose();
  }
}

void PLANET_RADIUS;
