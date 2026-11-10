/**
 * Mengelola semua zona: membangun malas (maks. satu per frame supaya tidak tersendat), update hanya yang
 * dekat, deteksi masuk/keluar dengan histeresis, judul besar, stempel paspor, komentar Piko, data radar,
 * dan penanda POI yang terlihat dari jauh.
 */
import { ZONE_ICONS } from '../../ui/icons';
import type { Scene } from 'three';
import { Vector3 } from 'three';
import { PLANET_RADIUS } from '../../config/world';
import { L, content } from '../../content';
import { currentZone, radar, zoneBanner, type RadarBlip } from '../../core/AppState';
import { bus } from '../../core/EventBus';
import { addStamp, progress } from '../../game/Progress';
import { tr, type I18nKey } from '../../i18n';
import { poiMarker, type ZoneDeps } from './ZoneKit';
import type { Zone, ZoneAction, ZoneTick } from './Zone';

const EXIT_MARGIN = 1.25;

/**
 * Titik (dengan benda setinggi `height` di atasnya) masih di atas horizon kamera? Planet kecil →
 * zona di balik lengkung bumi tidak perlu digambar (frustum culling tidak tahu planet menutupinya).
 */
export function horizonVisible(cam: Vector3, point: Vector3, height: number): boolean {
  const cr = cam.length();
  const pr = point.length();
  const cos = cam.dot(point) / (cr * pr);
  const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
  const hc = Math.acos(Math.min(1, PLANET_RADIUS / Math.max(cr, PLANET_RADIUS + 0.5)));
  const hp = Math.acos(Math.min(1, PLANET_RADIUS / (PLANET_RADIUS + Math.max(1, height))));
  return ang < hc + hp + 0.06;
}
const _fwd = new Vector3();
const _to = new Vector3();
const _up = new Vector3();
const _right = new Vector3();

export class ZoneManager {
  readonly zones: Zone[] = [];
  private current: Zone | null = null;
  private radarTimer = 0;
  private bannerN = 0;
  /** Jarak maksimum penanda POI (tier Low lebih pendek). */
  markerRange = 1400;
  /** Jumlah penanda POI terdekat yang ditampilkan (tier Low lebih sedikit). */
  maxMarkers = 17;
  private markerOrder: Zone[] = [];
  private markerTimer = 0;

  constructor(
    private readonly scene: Scene,
    private readonly deps: ZoneDeps,
  ) {}

  add(zone: Zone): void {
    zone.init(this.deps);
    this.zones.push(zone);
    this.scene.add(zone.group);
    const m = poiMarker(ZONE_ICONS[zone.id] ?? zone.icon, zone.color);
    m.object.position.copy(zone.poi);
    m.object.renderOrder = 6;
    zone.marker = m;
    this.scene.add(m.object);
  }

  get(id: string): Zone | undefined {
    return this.zones.find((z) => z.id === id);
  }

  zoneName(id: string): string {
    const z = content.get().zones.zones.find((x) => x.id === id);
    return z ? L(z.name) : id;
  }

  update(t: ZoneTick, planeQuatForward: Vector3): void {
    let built = false;
    this.markerTimer -= t.dt;
    if (this.markerTimer <= 0) {
      this.markerTimer = 0.5;
      this.markerOrder = [...this.zones].sort((a, b) => t.camPos.distanceToSquared(a.poi) - t.camPos.distanceToSquared(b.poi)).slice(0, this.maxMarkers);
    }
    for (const z of this.zones) {
      const d = z.distanceTo(t.planePos);
      if (!z.built && !built && d < z.buildRadius) {
        z.ensureBuilt(this.deps);
        built = true;
      }
      if (z.built && d < z.updateRadius) z.update(t);
      z.group.visible = z.built && t.camPos.distanceTo(z.center) < z.renderRadius && (z.renderRadius === Infinity || horizonVisible(t.camPos, z.center, z.height));
      // Penanda: tampil dari jauh, mengecil-membesar mengikuti jarak, hilang saat dekat.
      if (z.marker) {
        const md = t.camPos.distanceTo(z.poi);
        const vis = md > z.triggerRadius * 1.4 && md < this.markerRange && this.markerOrder.includes(z);
        z.marker.object.visible = vis;
        if (vis) z.marker.object.scale.setScalar(Math.min(14, 2.6 + md * 0.018));
      }
      if (!z.inside && d < z.triggerRadius) this.enter(z);
      else if (z.inside && d > z.triggerRadius * EXIT_MARGIN) this.exit(z);
    }
    this.radarTimer += t.dt;
    if (this.radarTimer > 0.25) {
      this.radarTimer = 0;
      this.pushRadar(t.planePos, planeQuatForward);
    }
  }

  private enter(z: Zone): void {
    z.inside = true;
    if (this.current && this.current !== z) this.current.inside = this.current.distanceTo(z.center) < 0;
    this.current = z;
    const first = addStamp(z.id);
    currentZone.set(z.id);
    z.onEnter();
    bus.emit('zone:enter', { id: z.id, first });
    if (first) bus.emit('stamp', { id: z.id, kind: 'zone' });
    this.bannerN++;
    zoneBanner.set({ id: z.id, title: this.zoneName(z.id), subtitle: first ? tr('zones.firstVisit') : tr('zones.welcomeBack'), n: this.bannerN });
    const key = `zones.piko.${z.id}` as I18nKey;
    const line = tr(key);
    // Menara Kontrol membacakan bio lewat radio ATC (docs/05 bagian 5).
    if (line !== key) bus.emit('piko:say', { text: line, mood: 'wow', priority: 2, radio: z.id === 'control-tower' });
  }

  private exit(z: Zone): void {
    z.inside = false;
    z.onExit();
    bus.emit('zone:exit', { id: z.id });
    if (this.current === z) {
      this.current = null;
      currentZone.set(null);
    }
  }

  action(t: ZoneTick): ZoneAction | null {
    return this.current?.action(t) ?? null;
  }

  /** Arah & jarak zona untuk radar dan kompas. */
  private pushRadar(planePos: Vector3, forward: Vector3): void {
    _up.copy(planePos).normalize();
    _fwd.copy(forward).addScaledVector(_up, -forward.dot(_up));
    if (_fwd.lengthSq() < 1e-8) return;
    _fwd.normalize();
    _right.crossVectors(_fwd, _up);
    const stamps = progress.get().stamps;
    const blips: RadarBlip[] = [];
    for (const z of this.zones) {
      if (z.id === 'orbit' || z.id === 'moon') continue;
      _to.copy(z.poi).normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, _to.dot(_up))));
      _to.addScaledVector(_up, -_to.dot(_up));
      const bearing = Math.atan2(_to.dot(_right), _to.dot(_fwd));
      blips.push({ id: z.id, icon: z.icon, color: z.color, bearing, distance: ang * PLANET_RADIUS, visited: !!stamps[z.id] });
    }
    blips.sort((a, b) => a.distance - b.distance);
    radar.set(blips);
  }

  dispose(): void {
    for (const z of this.zones) {
      this.scene.remove(z.group);
      if (z.marker) this.scene.remove(z.marker.object);
      z.dispose();
    }
  }
}
