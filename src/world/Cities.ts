/**
 * Kota sederhana (docs/02 bagian 2.5, versi awal): gedung low-poly instanced dari buildings.bin.
 * Jendela menyala dan lampu atap datang di Fase 2.
 */
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { PALETTE } from '../config/palette';
import { quatFromUpForward } from '../utils/quat';
import { Kit, box } from '../utils/modeling/Kit';
import { createToonMaterial } from '../utils/modeling/materials';
import { BUILDING_RECORD_BYTES } from './EarthFormat';

const CITY_COLORS = [PALETTE.city1, PALETTE.city2, PALETTE.city3, PALETTE.city4, PALETTE.city5];

export class Cities {
  readonly group = new Group();
  readonly mesh: InstancedMesh;
  private readonly total: number;

  constructor(data: ArrayBuffer, quantRadius: number, fraction: number) {
    this.group.name = 'cities';
    const view = new DataView(data);
    const n = Math.floor(data.byteLength / BUILDING_RECORD_BYTES);
    this.total = n;
    const scale = quantRadius / 32767;

    // Gedung satuan (48 segitiga): badan, atap, dua pita jendela bersilang.
    const k = new Kit();
    k.add(box(1, 1.15, 1), '#FFFFFF', { pos: [0, 0.425, 0] });
    k.add(box(1.06, 0.06, 1.06), '#E9E4DA', { pos: [0, 1.0, 0] });
    k.add(box(1.01, 0.42, 0.7), '#5E6B8A', { pos: [0, 0.52, 0] });
    k.add(box(0.7, 0.42, 1.01), '#5E6B8A', { pos: [0, 0.52, 0] });
    const geo = k.build();

    const mat = createToonMaterial();
    this.mesh = new InstancedMesh(geo, mat, Math.max(1, n));
    this.mesh.name = 'buildings';
    this.mesh.receiveShadow = true;
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const up = new Vector3();
    const fwd = new Vector3();
    const s = new Vector3();
    const c = new Color();
    for (let i = 0; i < n; i++) {
      const o = i * BUILDING_RECORD_BYTES;
      p.set(view.getInt16(o, true) * scale, view.getInt16(o + 2, true) * scale, view.getInt16(o + 4, true) * scale);
      const w = (view.getUint8(o + 6) / 255) * 2.5;
      const d = (view.getUint8(o + 7) / 255) * 2.5;
      const h = (view.getUint8(o + 8) / 255) * 8;
      const style = view.getUint8(o + 9);
      const colorIdx = style & 7;
      const rot = ((style >> 3) & 7) / 8;
      up.copy(p).normalize();
      const a = rot * Math.PI * 2;
      fwd.set(Math.cos(a), 0.3, Math.sin(a));
      quatFromUpForward(up, fwd, q);
      s.set(Math.max(0.5, w), Math.max(0.6, h), Math.max(0.5, d));
      m.compose(p.addScaledVector(up, -0.2), q, s);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, c.set(CITY_COLORS[colorIdx % CITY_COLORS.length]!));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.group.add(this.mesh);
    this.setFraction(fraction);
  }

  setFraction(f: number): void {
    this.mesh.count = Math.max(0, Math.floor(this.total * f));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
