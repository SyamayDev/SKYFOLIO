/**
 * Zona Bandara Asal Medan sebagai bagian sistem zona (stempel, judul, radar). Isi utama bandara sudah dibuat
 * HomeAirport.ts; di sini ditambah truk BBM yang bisa ditabrak (rigid body) dan papan counter global km
 * (angka dari /api/counters di Fase 4; "offline" bila tidak tersedia).
 */
import { Group } from 'three';
import { PALETTE } from '../../config/palette';
import { AIRPORT } from '../../config/world';
import { bus } from '../../core/EventBus';
import { tr } from '../../i18n';
import { Kit, box, cyl, rbox } from '../../utils/modeling/Kit';
import type { Billboard } from '../Billboard';
import { Zone, type ZoneAction } from './Zone';
import { SurfaceFrame, addProp, infoBoard, makeMesh, type ZoneDeps } from './ZoneKit';

export class HomeAirportZone extends Zone {
  private frame!: SurfaceFrame;
  private kmBoard: Billboard | null = null;
  /** Total km semua pengunjung (null = offline). */
  totalKm: number | null = null;

  constructor() {
    super('home-airport');
    this.icon = '🛫';
    this.color = '#FFC93C';
    this.triggerRadius = 34;
  }

  locate(deps: ZoneDeps): void {
    this.frame = new SurfaceFrame(AIRPORT.lat, AIRPORT.lon, AIRPORT.headingDeg, deps.planet);
    this.center.copy(this.frame.origin);
    this.poi.copy(this.frame.point(0, 26, 0));
  }

  protected build(): void {
    const f = this.frame;
    // Truk BBM di apron (sisi kanan landasan, dekat hangar).
    const truck = new Group();
    const k = new Kit();
    k.add(rbox(1.8, 1.4, 1.6, 0.2), '#E5484D', { pos: [0, 0.9, -1.6] });
    k.add(rbox(1.5, 0.6, 0.1, 0.1), '#9FD8F5', { pos: [0, 1.25, -2.42] });
    k.add(cyl(0.8, 0.8, 3.2, 12), '#E9EDF2', { pos: [0, 1.1, 0.6], rot: [Math.PI / 2, 0, 0] });
    k.add(box(1.7, 0.15, 3.4), PALETTE.sun, { pos: [0, 1.1, 0.6] });
    for (const [x, z] of [
      [-0.85, -1.6],
      [0.85, -1.6],
      [-0.85, 1.4],
      [0.85, 1.4],
    ] as [number, number][]) {
      k.add(cyl(0.38, 0.38, 0.3, 10), '#3A3D4A', { pos: [x, 0.38, z], rot: [0, 0, Math.PI / 2] });
    }
    truck.add(makeMesh(k, this.deps.material, 'fuel-truck'));
    // Apron di koordinat lokal bandara: along −12, side 11 → rangka zona (x = side, z = −along).
    f.place(truck, 11.5, 14, 0.05, 90, AIRPORT.elevation);
    this.group.add(truck);
    addProp(this.deps, truck, { mass: 3, material: 'metal', shapes: [{ half: [0.9, 0.8, 2.3], offset: [0, 1, -0.3] }], friction: 0.9 });

    // Papan counter global km.
    this.kmBoard = infoBoard(
      () => tr('zones.airport.kmTitle'),
      () => (this.totalKm == null ? tr('zones.airport.kmOffline') : tr('zones.airport.km', { n: Math.round(this.totalKm).toLocaleString() })),
      { width: 7, height: 3.4, accent: PALETTE.sun },
    );
    this.boards.push(this.kmBoard);
    const bg = new Group();
    this.kmBoard.object.position.set(0, 3.4, 0);
    bg.add(this.kmBoard.object);
    const pk = new Kit();
    for (const s of [-1, 1]) pk.add(cyl(0.12, 0.12, 3.4, 6), '#8A6A4A', { pos: [s * 3.1, 1.7, -0.05] });
    bg.add(makeMesh(pk, this.deps.material, 'km-board'));
    f.place(bg, 6.6, -2, 0, -90, AIRPORT.elevation);
    this.group.add(bg);
  }

  setTotalKm(km: number | null): void {
    this.totalKm = km;
    this.kmBoard?.redraw();
  }

  override action(): ZoneAction {
    return { label: 'actions.viewAbout', run: () => bus.emit('panel:open', { kind: 'zone', id: this.id }) };
  }
}
