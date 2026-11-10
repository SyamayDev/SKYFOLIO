/**
 * Kelas dasar zona (docs/02 bagian 3): pemicu masuk/keluar, penanda POI, judul, stempel paspor,
 * komentar Piko, aksi kontekstual, dan hook update lokal. Isi berat dibangun malas saat pesawat mendekat
 * (muat bertahap, docs/11) dan zona jauh tidak di-update.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Group, Vector3 } from 'three';
import type { I18nKey } from '../../i18n';
import type { Billboard } from '../Billboard';
import { detailCuller } from '../DetailCuller';
import type { ZoneDeps } from './ZoneKit';

export interface ZoneTick {
  dt: number;
  time: number;
  planePos: Vector3;
  planeVel: Vector3;
  /** Tinggi pesawat di atas tanah. */
  agl: number;
  grounded: boolean;
  night: boolean;
  wind: Vector3;
  camPos: Vector3;
  /** Arah matahari (satuan, dari pusat planet). */
  sunDir: Vector3;
}

export interface ZoneAction {
  label: I18nKey;
  run(): void;
}

export abstract class Zone {
  readonly group = new Group();
  /** Titik pusat zona di dunia (permukaan). */
  readonly center = new Vector3();
  /** Titik penanda POI / tujuan autopilot. */
  readonly poi = new Vector3();
  triggerRadius = 22;
  /** Jarak mulai membangun isi zona. */
  buildRadius = 320;
  /** Jarak zona masih di-update. */
  updateRadius = 240;
  /** Jarak kamera zona masih digambar (di luar itu disembunyikan → hemat draw call). */
  renderRadius = 460;
  /** Benda kecil zona hanya digambar dekat kamera (lihat DetailCuller). */
  cullDetail = true;
  /** Tinggi benda tertinggi zona (untuk culling horizon). */
  height = 25;
  icon = '📍';
  color = '#3AA0FF';
  built = false;
  inside = false;
  marker: Billboard | null = null;
  protected deps!: ZoneDeps;
  protected readonly bodies: RAPIER.RigidBody[] = [];
  protected readonly colliders: RAPIER.Collider[] = [];
  protected readonly boards: Billboard[] = [];

  constructor(readonly id: string) {
    this.group.name = `zone-${id}`;
  }

  /** Hitung posisi (murah) — dipanggil sekali saat start. */
  abstract locate(deps: ZoneDeps): void;
  /** Bangun isi (berat) — dipanggil sekali saat pesawat mendekat. */
  protected abstract build(): void;

  ensureBuilt(deps: ZoneDeps): void {
    if (this.built) return;
    this.deps = deps;
    this.build();
    this.built = true;
    if (this.cullDetail) detailCuller.add(this.group);
  }

  init(deps: ZoneDeps): void {
    this.deps = deps;
    this.locate(deps);
  }

  /** Jarak pesawat ke zona untuk pemicu (zona khusus seperti orbit/arus menimpanya). */
  distanceTo(p: Vector3): number {
    return p.distanceTo(this.center);
  }

  update(_t: ZoneTick): void {}
  onEnter(): void {}
  onExit(): void {}
  /** Aksi kontekstual tombol Aksi/E saat berada di zona. */
  action(_t: ZoneTick): ZoneAction | null {
    return null;
  }

  dispose(): void {
    for (const b of this.boards) b.dispose();
    for (const b of this.bodies) this.deps?.physics.world.removeRigidBody(b);
    for (const c of this.colliders) this.deps?.physics.removeCollider(c);
    this.group.traverse((o) => {
      const m = o as unknown as { isMesh?: boolean; geometry?: { dispose(): void } };
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    this.marker?.dispose();
  }
}
