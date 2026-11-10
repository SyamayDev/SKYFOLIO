/**
 * Pohon instanced (docs/02 bagian 2.4): 6 jenis, posisi dari trees.bin (urut prioritas).
 * Goyangan angin di vertex shader TSL. Jumlah mengikuti tier kualitas.
 */
import type { BufferGeometry} from 'three';
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { MeshToonNodeMaterial } from 'three/webgpu';
import { cross, hash, instanceIndex, normalize, positionGeometry, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import { EXTRA, PALETTE } from '../config/palette';
import { hash01 } from '../utils/rng';
import { quatFromUpForward } from '../utils/quat';
import { Kit, cone, cyl, ico } from '../utils/modeling/Kit';
import { createToonMaterial } from '../utils/modeling/materials';
import { TREE_RECORD_BYTES, TREE_TYPE_COUNT, TreeType, decodeTreeScale } from './EarthFormat';

function treeGeometry(type: TreeType): BufferGeometry {
  const k = new Kit();
  const trunk = EXTRA.trunk;
  switch (type) {
    case TreeType.Round:
      k.add(cyl(0.13, 0.19, 1.6, 6), trunk, { pos: [0, 0.4, 0] });
      k.add(ico(0.95, 0), PALETTE.grassTropic, { pos: [0, 1.75, 0], scale: [1, 0.9, 1], jitter: 0.06 });
      k.add(ico(0.62, 0), EXTRA.leafDark, { pos: [0.45, 1.35, 0.2], jitter: 0.06 });
      k.add(ico(0.55, 0), PALETTE.grassTropic, { pos: [-0.4, 2.2, -0.15], jitter: 0.06 });
      break;
    case TreeType.Palm: {
      // Batang melengkung dari 3 segmen + 5 pelepah (±110 segitiga).
      let x = 0;
      for (let i = 0; i < 3; i++) {
        const y = -0.3 + i * 1.0;
        k.add(cyl(0.1, 0.13, 1.05, 5, true), i % 2 ? trunk : '#B07C52', { pos: [x, y + 0.5, 0], rot: [0, 0, -0.08 - i * 0.05] });
        x += 0.07 + i * 0.05;
      }
      const top: [number, number, number] = [x, 2.75, 0];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        k.add(cone(0.22, 1.5, 3), EXTRA.palmLeaf, {
          pos: [top[0] + Math.cos(a) * 0.62, top[1] - 0.12, Math.sin(a) * 0.62],
          rot: [Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9],
          scale: [1, 1, 0.35],
          jitter: 0.08,
        });
      }
      k.add(ico(0.2, 0), '#8B5A2B', { pos: [top[0], top[1] - 0.2, 0.08] });
      break;
    }
    case TreeType.Pine:
      k.add(cyl(0.1, 0.14, 1.2, 5), trunk, { pos: [0, 0.2, 0] });
      k.add(cone(0.95, 1.4, 6), EXTRA.pine, { pos: [0, 1.25, 0], jitter: 0.05 });
      k.add(cone(0.72, 1.2, 6), '#37A065', { pos: [0, 2.0, 0], jitter: 0.05 });
      k.add(cone(0.45, 0.9, 6), EXTRA.pine, { pos: [0, 2.65, 0], jitter: 0.05 });
      break;
    case TreeType.TallPine:
      k.add(cyl(0.11, 0.16, 1.6, 5), trunk, { pos: [0, 0.4, 0] });
      for (let i = 0; i < 4; i++) {
        k.add(cone(0.85 - i * 0.16, 1.25, 6), i % 2 ? '#2B7F55' : PALETTE.grassBoreal, {
          pos: [0, 1.35 + i * 0.75, 0],
          jitter: 0.05,
        });
      }
      break;
    case TreeType.Cactus:
      k.add(cyl(0.22, 0.25, 2.1, 6), '#4FA65A', { pos: [0, 0.75, 0], jitter: 0.05 });
      k.add(ico(0.22, 0), '#4FA65A', { pos: [0, 1.8, 0] });
      k.add(cyl(0.13, 0.13, 0.7, 5), '#5DB868', { pos: [0.42, 1.15, 0] });
      k.add(cyl(0.13, 0.13, 0.4, 5), '#5DB868', { pos: [0.27, 0.85, 0], rot: [0, 0, Math.PI / 2] });
      k.add(cyl(0.12, 0.12, 0.55, 5), '#5DB868', { pos: [-0.38, 1.0, 0] });
      k.add(cyl(0.12, 0.12, 0.3, 5), '#5DB868', { pos: [-0.25, 0.75, 0], rot: [0, 0, Math.PI / 2] });
      break;
    case TreeType.Bush:
    default:
      k.add(ico(0.6, 0), PALETTE.grassTropic, { pos: [0, 0.35, 0], scale: [1, 0.75, 1], jitter: 0.07 });
      k.add(ico(0.45, 0), EXTRA.leafDark, { pos: [0.45, 0.25, 0.15], jitter: 0.07 });
      k.add(ico(0.4, 0), '#7BD86A', { pos: [-0.35, 0.3, -0.2], jitter: 0.07 });
      break;
  }
  return k.build();
}

const CELL = 4;
const _rel = new Vector3();

interface TreeRecord {
  pos: Vector3;
  type: TreeType;
  scale: number;
}

export class Trees {
  readonly group = new Group();
  readonly material: MeshToonNodeMaterial;
  readonly meshes: InstancedMesh[] = [];
  /** Semua pohon (urut prioritas) — dipakai juga untuk deteksi tabrakan "sensor". */
  readonly records: TreeRecord[] = [];
  /** Jumlah prefiks per tipe untuk setiap total. */
  private readonly typeOrder: number[][] = [];
  readonly wind = uniform(1);

  constructor(data: ArrayBuffer, quantRadius: number, limit: number) {
    this.group.name = 'trees';
    const view = new DataView(data);
    const n = Math.floor(data.byteLength / TREE_RECORD_BYTES);
    const scale = quantRadius / 32767;
    for (let i = 0; i < n; i++) {
      const o = i * TREE_RECORD_BYTES;
      this.records.push({
        pos: new Vector3(view.getInt16(o, true) * scale, view.getInt16(o + 2, true) * scale, view.getInt16(o + 4, true) * scale),
        type: view.getUint8(o + 6) as TreeType,
        scale: decodeTreeScale(view.getUint8(o + 7)),
      });
    }

    const m = createToonMaterial();
    // Catatan: di three r187 instancing diterapkan ke positionLocal SEBELUM positionNode, jadi
    // positionLocal di sini sudah koordinat dunia. Tinggi diambil dari geometri asli (positionGeometry),
    // dan arah goyangan dihitung dari arah radial (atas lokal planet).
    const h = positionGeometry.y.max(0);
    const radial = normalize(positionLocal);
    const east = normalize(cross(vec3(0, 1, 0), radial).add(vec3(0.0001, 0, 0)));
    const north = cross(radial, east);
    const phase = hash(instanceIndex).mul(6.283);
    const sway = sin(time.mul(1.7).add(phase)).mul(h.mul(h)).mul(0.016).mul(this.wind);
    const sway2 = sin(time.mul(1.3).add(phase.mul(1.7))).mul(h.mul(h)).mul(0.01).mul(this.wind);
    m.positionNode = positionLocal.add(east.mul(sway)).add(north.mul(sway2));
    this.material = m;

    const perType: TreeRecord[][] = Array.from({ length: TREE_TYPE_COUNT }, () => []);
    for (const r of this.records) perType[r.type]!.push(r);
    const mat = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3();
    const fwd = new Vector3();
    const s = new Vector3();
    for (let t = 0; t < TREE_TYPE_COUNT; t++) {
      const list = perType[t]!;
      const geo = treeGeometry(t as TreeType);
      const mesh = new InstancedMesh(geo, m, Math.max(1, list.length));
      mesh.name = `trees-${t}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      list.forEach((r, i) => {
        up.copy(r.pos).normalize();
        const a = hash01(i * 31 + t * 7) * Math.PI * 2;
        fwd.set(Math.cos(a), Math.sin(a * 1.3), Math.sin(a));
        quatFromUpForward(up, fwd, q);
        const sc = r.scale;
        s.set(sc, sc * (0.9 + hash01(i * 13 + t) * 0.25), sc);
        mat.compose(r.pos.clone().addScaledVector(up, -0.12), q, s);
        mesh.setMatrixAt(i, mat);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    // Prefiks per tipe untuk setiap jumlah total (pohon terurut prioritas).
    const counts = new Array<number>(TREE_TYPE_COUNT).fill(0);
    this.typeOrder.push([...counts]);
    for (const r of this.records) {
      counts[r.type]!++;
      this.typeOrder.push([...counts]);
    }
    this.setLimit(limit);
  }

  // --- Pohon sebagai sensor (docs/02 bagian 2.4): menyerempet = guncangan + daun, tanpa berhenti.
  private grid = new Map<number, number[]>();
  private limit = 0;
  private lastBrush = -1;
  private lastBrushTime = -10;

  private static cellKey(ix: number, iy: number, iz: number): number {
    return ((ix + 512) << 20) | ((iy + 512) << 10) | (iz + 512);
  }

  private buildGrid(limit: number): void {
    this.grid.clear();
    for (let i = 0; i < Math.min(limit, this.records.length); i++) {
      const p = this.records[i]!.pos;
      const key = Trees.cellKey(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
      const list = this.grid.get(key);
      if (list) list.push(i);
      else this.grid.set(key, [i]);
    }
  }

  /** Mengembalikan indeks pohon yang diserempet di posisi ini, atau −1. */
  checkBrush(pos: Vector3, time: number): number {
    const cx = Math.floor(pos.x / CELL);
    const cy = Math.floor(pos.y / CELL);
    const cz = Math.floor(pos.z / CELL);
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let z = cz - 1; z <= cz + 1; z++) {
          const list = this.grid.get(Trees.cellKey(x, y, z));
          if (!list) continue;
          for (const i of list) {
            const r = this.records[i]!;
            _rel.copy(pos).sub(r.pos);
            const len = r.pos.length();
            const h = (_rel.x * r.pos.x + _rel.y * r.pos.y + _rel.z * r.pos.z) / len;
            const top = (r.type === TreeType.Bush ? 1 : r.type === TreeType.TallPine ? 4.2 : 3) * r.scale;
            if (h < -0.5 || h > top + 0.6) continue;
            const horiz = Math.sqrt(Math.max(0, _rel.lengthSq() - h * h));
            if (horiz < 1.0 * r.scale + 1.6) {
              if (i === this.lastBrush && time - this.lastBrushTime < 1.5) return -1;
              this.lastBrush = i;
              this.lastBrushTime = time;
              return i;
            }
          }
        }
    return -1;
  }

  /** Batasi jumlah pohon yang digambar (tier kualitas). */
  setLimit(total: number): void {
    if (total !== this.limit) {
      this.limit = total;
      this.buildGrid(total);
    }
    const idx = Math.min(total, this.records.length);
    const counts = this.typeOrder[idx] ?? this.typeOrder[this.typeOrder.length - 1]!;
    this.meshes.forEach((m, t) => {
      m.count = counts[t] ?? 0;
      m.visible = m.count > 0;
    });
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.dispose();
    }
    this.material.dispose();
  }
}
