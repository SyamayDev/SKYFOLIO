/**
 * Kepulauan Proyek (docs/02 bagian 3.5, docs/08 bagian 5): satu pulau per file di content/projects/.
 * Penempatan otomatis deterministik (islandPlacement.ts). Setiap pulau: landasan pendek, mercusuar dengan
 * spanduk nama proyek, papan ringkas, dan diorama preset. Mendarat di pulau membuka panel proyek penuh.
 * Konten berubah saat dev (hot reload) → pulau ditambah/dihapus tanpa memuat ulang halaman.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { BufferGeometry, ConeGeometry, Float32BufferAttribute, Group, Mesh, Quaternion, Vector3 } from 'three';
import { PALETTE } from '../../config/palette';
import { PLANET_RADIUS } from '../../config/world';
import { L, content } from '../../content';
import type { Project } from '../../content/schema';
import { bus } from '../../core/EventBus';
import { addStamp } from '../../game/Progress';
import { tr } from '../../i18n';
import { hashString } from '../../utils/rng';
import { latLonToVec3 } from '../../utils/geo';
import { Kit, box, cone, cyl, sphere } from '../../utils/modeling/Kit';
import { createUnlitMaterial, createUnlitVertexColorMaterial as createUnlitVertexColor } from '../../utils/modeling/materials';
import { quatFromUpForward } from '../../utils/quat';
import { Billboard } from '../Billboard';
import type { SpawnPoint } from '../../vehicle/Plane';
import { buildDiorama, type Diorama } from './Dioramas';
import { placeIslands, type PlacedIsland } from './islandPlacement';
import { Zone, type ZoneAction, type ZoneTick } from './Zone';
import { horizonVisible } from './ZoneManager';
import { detailCuller } from '../DetailCuller';
import { SurfaceFrame, addStatic, buildIsland, infoBoard, makeMesh, type ZoneDeps } from './ZoneKit';

const ISLAND_HEIGHT = 2.2;
const _v = new Vector3();
const _q = new Quaternion();

class ProjectIsland {
  readonly group = new Group();
  readonly frame: SurfaceFrame;
  built = false;
  private diorama: Diorama | null = null;
  private collider: RAPIER.Collider | null = null;
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly boards: Billboard[] = [];
  private beam: Mesh | null = null;
  private landTimer = 0;
  private landedOnce = false;
  near = false;

  dioramaAction(t: ZoneTick): ZoneAction | null {
    return this.diorama?.action?.(t) ?? null;
  }

  constructor(
    readonly project: Project,
    readonly place: PlacedIsland,
    private readonly deps: ZoneDeps,
  ) {
    this.frame = new SurfaceFrame(place.lat, place.lon, 90, deps.planet, 0);
    this.group.name = `island-${project.id}`;
  }

  get center(): Vector3 {
    return this.frame.origin;
  }

  build(): void {
    if (this.built) return;
    this.built = true;
    const R = this.place.radius;
    const f = this.frame;
    const mat = this.deps.material;
    const isl = buildIsland(f, this.deps, { radius: R, height: ISLAND_HEIGHT, seed: hashString(this.project.id) % 100000, plateau: 0.58 });
    this.group.add(isl.mesh);
    this.collider = isl.collider;
    const top = ISLAND_HEIGHT;

    // Landasan pendek melengkung mengikuti bola (sepanjang sumbu z lokal).
    const len = R * 1.35;
    const w = 3.4;
    const pos: number[] = [];
    const idx: number[] = [];
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const z = -len / 2 + (len * i) / segs;
      for (const x of [-w / 2, w / 2]) {
        f.dirAt(x, z, _v).multiplyScalar(PLANET_RADIUS + top + 0.06);
        pos.push(_v.x, _v.y, _v.z);
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new Float32BufferAttribute(pos, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const strip = new Mesh(rg, createUnlitMaterial('#5B6170'));
    strip.receiveShadow = true;
    this.group.add(strip);
    // Marka tengah putih (digabung jadi satu mesh).
    const mk = new Kit();
    const holder = new Group();
    for (let z = -len / 2 + 1.5; z < len / 2 - 1; z += 2.4) {
      f.place(holder, 0, z, 0.1, 0, top);
      holder.updateMatrix();
      mk.addMatrix(box(0.25, 0.05, 1.1), '#FFFFFF', holder.matrix);
    }
    const dashes = new Mesh(mk.build(), createUnlitVertexColor());
    this.group.add(dashes);

    // Mercusuar bergaris + spanduk nama proyek.
    const lh = new Group();
    const k = new Kit();
    for (let i = 0; i < 5; i++) k.add(cyl(0.95 - i * 0.07, 1.02 - i * 0.07, 1.6, 10), i % 2 ? '#FFFFFF' : '#E5484D', { pos: [0, 0.8 + i * 1.6, 0] });
    k.add(cyl(1.0, 1.0, 1.2, 10), '#9FD8F5', { pos: [0, 8.6, 0] });
    k.add(cone(1.1, 1.2, 10), '#2B2D42', { pos: [0, 9.8, 0] });
    lh.add(makeMesh(k, mat, 'lighthouse'));
    const beam = new Mesh(new ConeGeometry(1.6, 14, 10, 1, true).translate(0, -7, 0).rotateZ(Math.PI / 2), createUnlitMaterial('#FFF1C4', { transparent: true, opacity: 0.22 }));
    beam.position.set(0, 8.6, 0);
    this.beam = beam;
    lh.add(beam);
    const banner = new Billboard(() => this.project.title, {
      width: 6,
      height: 1.4,
      bg: PALETTE.sun,
      fontSize: 92,
    });
    this.boards.push(banner);
    banner.object.position.set(0, 12, 0);
    lh.add(banner.object);
    f.place(lh, -R * 0.55, R * 0.3, 0, 0, top);
    this.group.add(lh);
    this.bodies.push(addStatic(this.deps.physics, lh, [{ half: [1, 5, 1], offset: [0, 5, 0] }], 'rock'));

    // Papan ringkas proyek.
    const p = this.project;
    const board = infoBoard(
      () => p.title,
      () => `${L(p.summary)}${p.tech.length ? `\n${p.tech.slice(0, 5).join(' · ')}` : ''}\n${tr('zones.island.landHint')}`,
      { width: 8, height: 4.4, accent: p.featured ? PALETTE.sun : '#9FD8F5' },
    );
    this.boards.push(board);
    const bg = new Group();
    board.object.position.set(0, 3.6, 0);
    bg.add(board.object);
    const pk = new Kit();
    for (const s of [-1, 1]) pk.add(cyl(0.12, 0.12, 3.6, 6), '#8A6A4A', { pos: [s * 3.4, 1.8, -0.05] });
    bg.add(makeMesh(pk, mat, 'board-posts'));
    f.place(bg, R * 0.5, -R * 0.42, 0, -35, top);
    this.group.add(bg);
    this.bodies.push(addStatic(this.deps.physics, bg, [{ half: [4, 2.2, 0.15], offset: [0, 3.6, 0] }], 'wood'));
    if (p.featured) {
      const star = new Billboard(() => `★ ${tr('zones.island.featured')} #${p.featuredRank ?? ''}`, { width: 4.4, height: 0.9, bg: '#2B2D42', color: '#FFC93C', fontSize: 64 });
      this.boards.push(star);
      star.object.position.set(0, 6.3, 0);
      bg.add(star.object);
    }

    // Diorama preset.
    this.diorama = buildDiorama(p.island.diorama, {
      frame: f,
      deps: this.deps,
      base: top,
      group: this.group,
      boards: this.boards,
      at: [R * 0.42, R * 0.12],
    });
    // Dari jauh cukup bentuk pulaunya; landasan, mercusuar, papan, dan diorama muncul saat mendekat.
    detailCuller.add(this.group, 170, 12);
  }

  update(t: ZoneTick): void {
    if (!this.built) return;
    const d = t.planePos.distanceTo(this.center);
    this.near = d < this.place.radius + 10;
    this.diorama?.update(t, d < this.place.radius + 18);
    if (this.beam) {
      this.beam.rotation.y += t.dt * 0.9;
      this.beam.visible = t.night;
    }
    for (const pr of this.diorama?.props ?? []) pr.manageSleep(t.planePos);
    // Mendarat: roda menyentuh pulau, pelan.
    if (t.grounded && d < this.place.radius && t.planeVel.length() < 11) {
      this.landTimer += t.dt;
      if (this.landTimer > 0.5 && !this.landedOnce) {
        this.landedOnce = true;
        const first = addStamp(`project:${this.project.id}`);
        if (first) bus.emit('stamp', { id: `project:${this.project.id}`, kind: 'project' });
        bus.emit('project:land', { id: this.project.id });
        bus.emit('panel:open', { kind: 'project', id: this.project.id });
      }
    } else {
      this.landTimer = 0;
      if (!t.grounded && d > this.place.radius + 30) this.landedOnce = false;
    }
  }

  spawnPoint(): SpawnPoint {
    const f = this.frame;
    const z = this.place.radius * 0.62;
    const pos = f.point(0, ISLAND_HEIGHT + 1.3, z);
    const fwd = f.fwd.clone();
    const up = pos.clone().normalize();
    return { position: pos, rotation: quatFromUpForward(up, fwd, new Quaternion()) };
  }

  dispose(): void {
    for (const b of this.boards) b.dispose();
    for (const b of this.bodies) this.deps.physics.world.removeRigidBody(b);
    for (const pr of this.diorama?.props ?? []) {
      this.deps.physics.removeSynced(pr.synced);
      this.deps.gravity.remove(pr.body);
      this.deps.physics.world.removeRigidBody(pr.body);
    }
    if (this.collider) this.deps.physics.removeCollider(this.collider);
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
  }
}

export class ProjectArchipelago extends Zone {
  private readonly islands = new Map<string, ProjectIsland>();
  private zoneGeo = { lat: -12, lon: 87, radiusDeg: 14 };
  private unsub: (() => void) | null = null;
  placements: PlacedIsland[] = [];

  constructor() {
    super('project-archipelago');
    this.icon = '🏝️';
    this.color = '#3DCB7A';
  }

  locate(deps: ZoneDeps): void {
    const z = content.get().zones.zones.find((x) => x.id === this.id);
    this.zoneGeo = { lat: z?.lat ?? -12, lon: z?.lon ?? 87, radiusDeg: z?.radiusDeg ?? 14 };
    latLonToVec3(this.zoneGeo.lat, this.zoneGeo.lon, PLANET_RADIUS, this.center);
    this.triggerRadius = this.zoneGeo.radiusDeg * (Math.PI / 180) * PLANET_RADIUS;
    this.buildRadius = this.triggerRadius + 300;
    this.renderRadius = Infinity;
    this.updateRadius = this.triggerRadius + 220;
    this.layout(deps);
    const first = this.placements[0];
    if (first) latLonToVec3(first.lat, first.lon, PLANET_RADIUS + 34, this.poi);
    else this.poi.copy(this.center).setLength(PLANET_RADIUS + 34);
  }

  private layout(deps: ZoneDeps): void {
    const projects = content.get().projects;
    const isFree = (lat: number, lon: number, r: number): boolean => {
      // Tidak menimpa daratan asli (cek pusat + 8 titik tepi).
      const c = latLonToVec3(lat, lon, 1);
      if (deps.planet.heightAt(c, -1) > -1) return false;
      const deg = ((r + 4) / PLANET_RADIUS) * (180 / Math.PI);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        if (deps.planet.heightAt(latLonToVec3(lat + Math.cos(a) * deg, lon + Math.sin(a) * deg, 1), -1) > -1) return false;
      }
      return true;
    };
    this.placements = placeIslands(
      projects.map((p) => ({ id: p.id, featured: p.featured, featuredRank: p.featuredRank, lat: p.island.lat, lon: p.island.lon, size: p.island.size })),
      this.zoneGeo,
      isFree,
    );
  }

  protected build(): void {
    this.sync();
    this.unsub = content.subscribe(() => {
      this.layout(this.deps);
      this.sync();
    });
  }

  /** Samakan pulau dengan daftar proyek (tambah/hapus/ganti). */
  private sync(): void {
    const projects = content.get().projects;
    const keep = new Set<string>();
    for (const pl of this.placements) {
      const p = projects.find((x) => x.id === pl.id);
      if (!p) continue;
      const key = `${p.id}|${pl.lat}|${pl.lon}|${p.island.diorama}|${p.title}|${L(p.summary)}`;
      keep.add(key);
      if (this.islands.has(key)) continue;
      const isl = new ProjectIsland(p, pl, this.deps);
      this.islands.set(key, isl);
      this.group.add(isl.group);
    }
    for (const [key, isl] of this.islands) {
      if (!keep.has(key)) {
        this.group.remove(isl.group);
        isl.dispose();
        this.islands.delete(key);
      }
    }
  }

  override update(t: ZoneTick): void {
    let built = false;
    for (const isl of this.islands.values()) {
      const d = t.planePos.distanceTo(isl.center);
      if (!isl.built && !built && d < 260) {
        isl.build();
        built = true;
      }
      if (isl.built && d < 200) isl.update(t);
      isl.group.visible = isl.built && t.camPos.distanceTo(isl.center) < 400 && horizonVisible(t.camPos, isl.center, 16);
    }
  }

  /** Posisi pulau proyek (tujuan autopilot / Piko). */
  islandPosition(projectId: string, out = new Vector3()): Vector3 | null {
    const pl = this.placements.find((p) => p.id === projectId);
    if (!pl) return null;
    return latLonToVec3(pl.lat, pl.lon, PLANET_RADIUS + ISLAND_HEIGHT, out);
  }

  nearestIsland(pos: Vector3): ProjectIsland | null {
    let best: ProjectIsland | null = null;
    let bd = Infinity;
    for (const isl of this.islands.values()) {
      const d = pos.distanceTo(isl.center);
      if (d < bd) {
        bd = d;
        best = isl;
      }
    }
    return best;
  }

  /** Titik respawn di landasan pulau terdekat (bila dekat). */
  spawnNear(pos: Vector3): SpawnPoint | null {
    const isl = this.nearestIsland(pos);
    if (!isl || pos.distanceTo(isl.center) > 60) return null;
    isl.build();
    return isl.spawnPoint();
  }

  override action(t: ZoneTick): ZoneAction | null {
    const isl = this.nearestIsland(t.planePos);
    if (!isl || t.planePos.distanceTo(isl.center) > isl.place.radius + 25) {
      return { label: 'actions.viewProjects', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
    }
    // Mini-game diorama (mis. Misi Laundry Beres) saat terbang dekat pulaunya.
    const special = isl.dioramaAction(t);
    if (special) return special;
    return { label: 'actions.viewProject', run: () => bus.emit('panel:open', { kind: 'project', id: isl.project.id }) };
  }

  override dispose(): void {
    this.unsub?.();
    for (const isl of this.islands.values()) isl.dispose();
    this.islands.clear();
    super.dispose();
  }
}

void sphere;
void _q;
