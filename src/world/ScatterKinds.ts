/**
 * Jenis props yang disebar di permukaan planet (docs/02 bagian 2.4) beserta geometri low-poly-nya.
 * Semua geometri berwarna titik, ukuran skala 1 ≈ ukuran tipikal. Bagian berwarna putih murni (#FFFFFF)
 * adalah "penanda" yang diganti warna varian di shader (kepala bunga, atap rumah).
 */
import { BufferGeometry, ConeGeometry, Float32BufferAttribute, OctahedronGeometry } from 'three';
import { EXTRA, PALETTE } from '../config/palette';
import { Kit, box, cyl, ico } from '../utils/modeling/Kit';

/** Kerucut tanpa alas (alas tak terlihat dari atas → hemat segitiga). */
const ocone = (r: number, h: number, seg: number): BufferGeometry => new ConeGeometry(r, h, seg, 1, true);

export const PropKind = {
  Broadleaf: 0,
  Palm: 1,
  Pine: 2,
  TallPine: 3,
  SnowPine: 4,
  Acacia: 5,
  Bush: 6,
  Shrub: 7,
  Rock: 8,
  Grass: 9,
  Flower: 10,
  Cactus: 11,
  House: 12,
} as const;
export type PropKind = (typeof PropKind)[keyof typeof PropKind];
export const PROP_KIND_COUNT = 13;

export interface KindConfig {
  name: string;
  /** Radius tampil dari kamera (unit) di tier High. */
  radius: number;
  /** Kapasitas instans di tier High. */
  capacity: number;
  /** Amplitudo goyangan angin (per tinggi²). 0 = kaku. */
  sway: number;
  /** Mengecil saat pesawat lewat sangat dekat (pandangan tidak tertutup). */
  shrinkNearPlane: boolean;
  castShadow: boolean;
  /** Pohon: bisa diserempet (sensor) dan punya batang padat. */
  tree: boolean;
  /** Tinggi puncak (unit, skala 1) untuk deteksi serempet. */
  top: number;
  /** Palet warna varian untuk bagian penanda putih. */
  variants?: string[];
}

export const KINDS: KindConfig[] = [
  { name: 'broadleaf', radius: 165, capacity: 9000, sway: 0.014, shrinkNearPlane: true, castShadow: true, tree: true, top: 2.9 },
  { name: 'palm', radius: 165, capacity: 3500, sway: 0.02, shrinkNearPlane: true, castShadow: true, tree: true, top: 3.1 },
  { name: 'pine', radius: 165, capacity: 6000, sway: 0.01, shrinkNearPlane: true, castShadow: true, tree: true, top: 3.0 },
  { name: 'tallpine', radius: 165, capacity: 6000, sway: 0.008, shrinkNearPlane: true, castShadow: true, tree: true, top: 4.2 },
  { name: 'snowpine', radius: 165, capacity: 3000, sway: 0.006, shrinkNearPlane: true, castShadow: true, tree: true, top: 3.6 },
  { name: 'acacia', radius: 165, capacity: 2500, sway: 0.008, shrinkNearPlane: true, castShadow: true, tree: true, top: 2.6 },
  { name: 'bush', radius: 115, capacity: 8000, sway: 0.03, shrinkNearPlane: false, castShadow: false, tree: false, top: 0.9 },
  { name: 'shrub', radius: 110, capacity: 3000, sway: 0.03, shrinkNearPlane: false, castShadow: false, tree: false, top: 0.7 },
  { name: 'rock', radius: 135, capacity: 5000, sway: 0, shrinkNearPlane: false, castShadow: true, tree: false, top: 0.8 },
  { name: 'grass', radius: 52, capacity: 16000, sway: 0.5, shrinkNearPlane: false, castShadow: false, tree: false, top: 0.45 },
  {
    name: 'flower',
    radius: 44,
    capacity: 6000,
    sway: 0.45,
    shrinkNearPlane: false,
    castShadow: false,
    tree: false,
    top: 0.4,
    variants: ['#FF5A5F', '#FFC93C', '#FFFFFF', '#FF9AC8', '#B48CFF', '#FF9248', '#7FD3FF', '#FFE08A'],
  },
  { name: 'cactus', radius: 120, capacity: 1500, sway: 0, shrinkNearPlane: false, castShadow: true, tree: false, top: 2.2 },
  {
    name: 'house',
    radius: 165,
    capacity: 2500,
    sway: 0,
    shrinkNearPlane: false,
    castShadow: true,
    tree: false,
    top: 1.6,
    variants: ['#E2574C', '#D9774A', '#3AA0FF', '#8E5A3C', '#2FA35A', '#F2B66D', '#6C7BD9', '#C44569'],
  },
];

const MARK = '#FFFFFF';

/** Bilah rumput tipis (prisma segitiga meruncing). */
function blade(h: number, w: number): BufferGeometry {
  const g = new BufferGeometry();
  const v = [
    -w, 0, 0, w, 0, 0, 0, h, 0.02,
    w, 0, 0, 0, 0, w * 0.9, 0, h, 0.02,
    0, 0, w * 0.9, -w, 0, 0, 0, h, 0.02,
  ];
  g.setAttribute('position', new Float32BufferAttribute(v, 3));
  return g;
}

export function kindGeometry(kind: PropKind): BufferGeometry {
  const k = new Kit();
  const trunk = EXTRA.trunk;
  switch (kind) {
    case PropKind.Broadleaf:
      k.add(cyl(0.11, 0.17, 1.5, 5, true), trunk, { pos: [0, 0.55, 0] });
      k.add(ico(0.92, 0), PALETTE.grassTropic, { pos: [0, 1.85, 0], scale: [1, 0.86, 1], jitter: 0.07 });
      k.add(ico(0.62, 0), EXTRA.leafDark, { pos: [0.5, 1.45, 0.18], jitter: 0.07 });
      k.add(ico(0.55, 0), '#74D46A', { pos: [-0.38, 2.25, -0.2], jitter: 0.07 });
      break;
    case PropKind.Palm: {
      let x = 0;
      for (let i = 0; i < 2; i++) {
        k.add(cyl(0.09, 0.12, 1.55, 5, true), i % 2 ? trunk : '#B07C52', { pos: [x, i * 1.45 + 0.45, 0], rot: [0, 0, -0.08 - i * 0.07] });
        x += 0.1 + i * 0.1;
      }
      const top: [number, number, number] = [x, 2.75, 0];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        k.add(ocone(0.24, 1.55, 3), i % 2 ? EXTRA.palmLeaf : '#3DB45E', {
          pos: [top[0] + Math.cos(a) * 0.62, top[1] - 0.14, Math.sin(a) * 0.62],
          rot: [Math.sin(a) * 1.95, 0, -Math.cos(a) * 1.95],
          scale: [1, 1, 0.3],
          jitter: 0.06,
        });
      }
      k.add(new OctahedronGeometry(0.2, 0), '#8B5A2B', { pos: [top[0] + 0.05, top[1] - 0.25, 0.04] });
      break;
    }
    case PropKind.Pine:
      k.add(cyl(0.09, 0.13, 1.0, 5, true), trunk, { pos: [0, 0.3, 0] });
      k.add(ocone(0.95, 1.35, 6), EXTRA.pine, { pos: [0, 1.25, 0], jitter: 0.05 });
      k.add(ocone(0.72, 1.15, 6), '#37A065', { pos: [0, 1.95, 0], jitter: 0.05 });
      k.add(ocone(0.46, 0.9, 6), EXTRA.pine, { pos: [0, 2.6, 0], jitter: 0.05 });
      break;
    case PropKind.TallPine:
      k.add(cyl(0.1, 0.15, 1.6, 5, true), trunk, { pos: [0, 0.5, 0] });
      for (let i = 0; i < 4; i++) {
        k.add(ocone(0.82 - i * 0.15, 1.2, 6), i % 2 ? '#2B7F55' : PALETTE.grassBoreal, { pos: [0, 1.4 + i * 0.72, 0], jitter: 0.05 });
      }
      break;
    case PropKind.SnowPine:
      k.add(cyl(0.1, 0.14, 1.3, 5, true), trunk, { pos: [0, 0.4, 0] });
      for (let i = 0; i < 3; i++) {
        const r = 0.85 - i * 0.2;
        const y = 1.3 + i * 0.75;
        k.add(ocone(r, 1.15, 6), i % 2 ? '#2B7F55' : '#2F7650', { pos: [0, y, 0], jitter: 0.05 });
        k.add(ocone(r * 0.62, 0.55, 6), PALETTE.snow, { pos: [0, y + 0.33, 0], jitter: 0.03 });
      }
      break;
    case PropKind.Acacia:
      k.add(cyl(0.08, 0.13, 1.5, 5, true), '#8A6A4A', { pos: [0, 0.65, 0], rot: [0, 0, 0.12] });
      k.add(cyl(0.05, 0.07, 0.9, 4, true), '#8A6A4A', { pos: [-0.28, 1.5, 0], rot: [0, 0, 0.7] });
      k.add(ico(1.0, 0), '#6FAE45', { pos: [0.1, 1.85, 0], scale: [1.55, 0.36, 1.25], jitter: 0.06 });
      k.add(ico(0.6, 0), '#83BE52', { pos: [-0.7, 1.75, 0.1], scale: [1.3, 0.4, 1.1], jitter: 0.06 });
      break;
    case PropKind.Bush:
      k.add(ico(0.55, 0), PALETTE.grassTropic, { pos: [0, 0.3, 0], scale: [1, 0.78, 1], jitter: 0.08 });
      k.add(ico(0.42, 0), EXTRA.leafDark, { pos: [0.42, 0.22, 0.15], jitter: 0.08 });
      break;
    case PropKind.Shrub:
      k.add(ico(0.45, 0), '#9AA55A', { pos: [0, 0.25, 0], scale: [1.1, 0.7, 1], jitter: 0.1 });
      k.add(ico(0.32, 0), '#B4A05E', { pos: [0.33, 0.18, 0.12], jitter: 0.1 });
      break;
    case PropKind.Rock:
      k.add(ico(0.62, 0), PALETTE.rock, { pos: [0, 0.18, 0], scale: [1.25, 0.72, 1], jitter: 0.09 });
      k.add(ico(0.32, 0), '#B0A59B', { pos: [0.62, 0.05, 0.25], scale: [1, 0.8, 1], jitter: 0.08 });
      break;
    case PropKind.Grass:
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + i * 0.4;
        const r = i === 0 ? 0 : 0.12;
        k.add(blade(0.32 + (i % 3) * 0.08, 0.035), i % 2 ? '#6FD06A' : '#4FB95E', {
          pos: [Math.cos(a) * r, 0, Math.sin(a) * r],
          rot: [Math.cos(a) * 0.25, a, Math.sin(a) * 0.25],
        });
      }
      break;
    case PropKind.Flower:
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * 0.12;
        const z = Math.sin(a) * 0.12;
        const h = 0.24 + i * 0.06;
        k.add(cyl(0.012, 0.016, h, 3, true), '#4FA65A', { pos: [x, h / 2, z] });
        k.add(new OctahedronGeometry(0.075, 0), MARK, { pos: [x, h + 0.02, z], scale: [1, 0.55, 1] });
      }
      break;
    case PropKind.Cactus:
      k.add(cyl(0.2, 0.23, 2.0, 6), '#4FA65A', { pos: [0, 0.8, 0], jitter: 0.05 });
      k.add(ico(0.2, 0), '#4FA65A', { pos: [0, 1.82, 0] });
      k.add(cyl(0.12, 0.12, 0.65, 5), '#5DB868', { pos: [0.4, 1.15, 0] });
      k.add(cyl(0.12, 0.12, 0.38, 5), '#5DB868', { pos: [0.26, 0.85, 0], rot: [0, 0, Math.PI / 2] });
      k.add(cyl(0.11, 0.11, 0.5, 5), '#5DB868', { pos: [-0.36, 1.0, 0] });
      k.add(cyl(0.11, 0.11, 0.28, 5), '#5DB868', { pos: [-0.24, 0.76, 0], rot: [0, 0, Math.PI / 2] });
      break;
    case PropKind.House:
    default: {
      // Rumah desa mungil: dinding krem, atap pelana (warna varian), pintu, jendela, cerobong.
      k.add(box(1.0, 0.75, 0.8), PALETTE.cream, { pos: [0, 0.3, 0], jitter: 0.03 });
      // Prisma segitiga (silinder 3 sisi) diputar supaya satu rusuk menghadap ke atas → atap pelana.
      k.add(cyl(0.62, 0.62, 1.12, 3), MARK, { pos: [0, 0.86, 0], rot: [-Math.PI / 2, 0, Math.PI / 2] });
      k.add(box(0.22, 0.36, 0.04), '#7A4A2E', { pos: [0.18, 0.12, 0.42] });
      k.add(box(0.2, 0.18, 0.04), '#5E7FB8', { pos: [-0.24, 0.42, 0.42] });
      k.add(box(0.2, 0.18, 0.04), '#5E7FB8', { pos: [-0.24, 0.42, -0.42] });
      k.add(box(0.14, 0.38, 0.14), '#B5654A', { pos: [0.3, 1.1, -0.15] });
      break;
    }
  }
  return k.build();
}
