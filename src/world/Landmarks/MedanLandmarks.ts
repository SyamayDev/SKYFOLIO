/**
 * Landmark Medan versi sederhana (Fase 0): bangunan low-poly "terinspirasi" Istana Maimun dan
 * Masjid Raya Al-Mashun. Bukan replika; diperbesar supaya terbaca dari udara. Collider kuboid sederhana.
 */
import { CylinderGeometry, Group, Mesh, type Material } from 'three';
import { EXTRA, PALETTE } from '../../config/palette';
import { Kit, box, cone, cyl, rbox, sphere } from '../../utils/modeling/Kit';

export interface StaticShape {
  half: [number, number, number];
  offset: [number, number, number];
}

export interface LandmarkModel {
  group: Group;
  shapes: StaticShape[];
}

/** Istana bergaya Melayu: bangunan kuning memanjang, atap hijau tua, kubah kecil di tengah. */
export function buildPalace(mat: Material): LandmarkModel {
  const k = new Kit();
  const yellow = '#F4C542';
  const roof = '#2F5D4A';
  const W = 10;
  const D = 3.2;
  // Lantai dasar + lantai atas
  k.add(box(W, 0.4, D + 0.6), '#E8DCC0', { pos: [0, 0.2, 0] });
  k.add(box(W, 1.5, D), yellow, { pos: [0, 1.15, 0], jitter: 0.02 });
  k.add(box(W - 1.2, 1.3, D - 0.4), yellow, { pos: [0, 2.55, 0], jitter: 0.02 });
  // Bagian tengah menonjol
  k.add(box(3, 3.4, D + 0.8), '#F7D35E', { pos: [0, 2.1, -0.2] });
  // Atap bertingkat
  k.add(box(W + 0.3, 0.15, D + 0.4), roof, { pos: [0, 1.95, 0] });
  k.add(cone(2.1, 1.0, 4), roof, { pos: [0, 4.3, -0.2], rot: [0, Math.PI / 4, 0], scale: [1.2, 1, 0.9] });
  for (const s of [-1, 1]) k.add(cone(1.6, 0.9, 4), roof, { pos: [s * 3.4, 3.65, 0], rot: [0, Math.PI / 4, 0], scale: [1.6, 1, 0.8] });
  // Kubah kecil hitam di atas bagian tengah dan sudut
  k.add(sphere(0.55, 10, 6), PALETTE.ink, { pos: [0, 4.95, -0.2], scale: [1, 1.15, 1] });
  k.add(cone(0.08, 0.5, 6), PALETTE.sun, { pos: [0, 5.75, -0.2] });
  for (const s of [-1, 1]) {
    k.add(cyl(0.3, 0.3, 1.0, 8), yellow, { pos: [s * 4.7, 3.6, -1.2] });
    k.add(sphere(0.35, 8, 5), PALETTE.ink, { pos: [s * 4.7, 4.2, -1.2] });
  }
  // Jendela melengkung (putih) di depan
  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) <= 1) continue;
    k.add(rbox(0.5, 0.8, 0.08, 0.2), '#FFFFFF', { pos: [i * 1.05, 1.2, -D / 2 - 0.02] });
    k.add(rbox(0.45, 0.7, 0.08, 0.18), '#FFFFFF', { pos: [i * 0.92, 2.6, -(D - 0.4) / 2 - 0.02] });
  }
  // Pintu utama + tangga
  k.add(rbox(1.2, 1.6, 0.1, 0.4), '#8B5A2B', { pos: [0, 1.2, -D / 2 - 0.62] });
  k.add(box(2.4, 0.2, 1.0), '#E8DCC0', { pos: [0, 0.1, -D / 2 - 1.0] });
  const group = new Group();
  const m = new Mesh(k.build(), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'palace';
  group.add(m);
  return {
    group,
    shapes: [
      { half: [W / 2, 1.6, D / 2], offset: [0, 1.6, 0] },
      { half: [1.5, 2.3, (D + 0.8) / 2], offset: [0, 2.3, -0.2] },
    ],
  };
}

/** Masjid bergaya Melayu-Timur Tengah: dasar segi delapan putih, kubah hitam besar, menara. */
export function buildMosque(mat: Material): LandmarkModel {
  const k = new Kit();
  const wall = '#FBF5EA';
  // Dasar segi delapan
  k.add(new CylinderGeometry(3.4, 3.6, 0.4, 8), '#D9CFBF', { pos: [0, 0.2, 0], rot: [0, Math.PI / 8, 0] });
  k.add(new CylinderGeometry(3.0, 3.0, 2.6, 8), wall, { pos: [0, 1.7, 0], rot: [0, Math.PI / 8, 0], jitter: 0.02 });
  k.add(new CylinderGeometry(3.15, 3.15, 0.2, 8), '#C9A44A', { pos: [0, 3.05, 0], rot: [0, Math.PI / 8, 0] });
  // Drum + kubah utama hitam
  k.add(new CylinderGeometry(1.6, 1.8, 1.0, 12), wall, { pos: [0, 3.6, 0] });
  k.add(sphere(1.85, 14, 8), '#23263A', { pos: [0, 4.4, 0], scale: [1, 1.05, 1] });
  k.add(cone(0.1, 0.9, 6), PALETTE.sun, { pos: [0, 6.6, 0] });
  k.add(sphere(0.14, 6, 4), PALETTE.sun, { pos: [0, 6.2, 0] });
  // Empat kubah kecil di serambi
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 2.6;
    const z = Math.sin(a) * 2.6;
    k.add(box(1.4, 2.0, 1.4), wall, { pos: [x, 1.4, z], rot: [0, -a, 0] });
    k.add(sphere(0.7, 10, 6), '#23263A', { pos: [x, 2.6, z] });
    // Lengkung pintu
    k.add(rbox(0.6, 1.0, 0.08, 0.25), '#6C8FD9', { pos: [Math.cos(a) * 3.32, 1.0, Math.sin(a) * 3.32], rot: [0, -a + Math.PI / 2, 0] });
  }
  // Menara
  k.add(cyl(0.38, 0.45, 6.5, 8), wall, { pos: [4.4, 3.25, 1.5] });
  k.add(cyl(0.55, 0.55, 0.25, 8), '#C9A44A', { pos: [4.4, 5.6, 1.5] });
  k.add(sphere(0.42, 8, 5), '#23263A', { pos: [4.4, 6.75, 1.5] });
  k.add(cone(0.06, 0.6, 5), PALETTE.sun, { pos: [4.4, 7.45, 1.5] });
  k.add(box(0.8, 0.2, 0.8), EXTRA.metal, { pos: [4.4, 0.1, 1.5] });
  const group = new Group();
  const m = new Mesh(k.build(), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'mosque';
  group.add(m);
  return {
    group,
    shapes: [
      { half: [3, 2.2, 3], offset: [0, 2.2, 0] },
      { half: [1.7, 1.7, 1.7], offset: [0, 4.6, 0] },
      { half: [0.45, 3.4, 0.45], offset: [4.4, 3.4, 1.5] },
    ],
  };
}
