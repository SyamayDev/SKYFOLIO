/**
 * Pembangun karakter chibi low-poly bersama (docs/04 bagian 3.2): kepala besar, mata besar berkilau,
 * alis, senyum, pipi merona. Bagian bergerak (kepala, lengan, mata, alis, mulut) adalah Object3D terpisah
 * dengan pivot di sendi supaya bisa dianimasikan dan ekspresinya diganti.
 */
import type { Object3D} from 'three';
import { Group, Mesh, SphereGeometry, type BufferGeometry, type Material } from 'three';
import { EXTRA, PALETTE } from '../config/palette';
import { Kit, box, cyl, ico, rbox, sphere, torus } from '../utils/modeling/Kit';

export interface ChibiParts {
  root: Group;
  torso: Group;
  head: Group;
  armL: Group;
  armR: Group;
  eyes: Object3D[];
  brows: Object3D[];
  mouth: Object3D;
}

export interface ChibiStyle {
  headRadius: number;
  uniform: string;
  uniformTrim: string;
  hair: string;
  material: Material;
  iris?: string;
  /** Warna kerah (default putih). */
  collar?: string;
  /** Dua warna garis manset di pergelangan. */
  cuffs?: [string, string];
}

const NO_SHADOW = new Set(['eye', 'brow', 'mouth', 'piko-details', 'stars', 'goggles', 'scarf']);

export function mesh(geo: BufferGeometry, mat: Material, name: string): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.castShadow = !NO_SHADOW.has(name);
  return m;
}

function eye(r: number, iris: string, mat: Material): Object3D {
  const g = new Group();
  const k = new Kit();
  k.add(sphere(r * 0.2, 10, 8), '#FFFFFF', { scale: [0.82, 1.08, 0.45] });
  k.add(sphere(r * 0.135, 10, 8), iris, { pos: [0, -r * 0.01, -r * 0.05], scale: [0.85, 1.05, 0.4] });
  k.add(sphere(r * 0.075, 8, 6), PALETTE.ink, { pos: [0, -r * 0.01, -r * 0.085], scale: [0.85, 1.05, 0.4] });
  k.add(sphere(r * 0.04, 6, 4), '#FFFFFF', { pos: [-r * 0.045, r * 0.06, -r * 0.1], scale: [1, 1, 0.5] });
  g.add(mesh(k.build(), mat, 'eye'));
  return g;
}

export function buildChibi(style: ChibiStyle): ChibiParts {
  const { headRadius: r, material: mat } = style;
  const root = new Group();

  // Badan / jaket (terlihat di atas bibir kokpit).
  const torso = new Group();
  const tk = new Kit();
  tk.add(rbox(r * 1.5, r * 1.35, r * 1.1, r * 0.35), style.uniform, { pos: [0, r * 0.62, 0], jitter: 0.02 });
  tk.add(rbox(r * 1.56, r * 0.18, r * 1.14, r * 0.08), style.uniformTrim, { pos: [0, r * 0.5, 0] });
  // Kerah melingkar + ritsleting.
  tk.add(torus(r * 0.42, r * 0.13, 6, 14), style.collar ?? '#FFFFFF', { pos: [0, r * 1.28, 0], rot: [Math.PI / 2, 0, 0], scale: [1.15, 1, 1] });
  tk.add(box(r * 0.06, r * 0.7, r * 0.04), '#5A3A26', { pos: [0, r * 0.82, -r * 0.56] });
  torso.add(mesh(tk.build(), mat, 'torso'));
  root.add(torso);

  // Kepala (pivot di leher).
  const head = new Group();
  head.position.set(0, r * 1.38, 0);
  const hk = new Kit();
  hk.add(sphere(r, 16, 12), EXTRA.skin, { pos: [0, r * 0.92, 0], jitter: 0.01 });
  // Rambut: tudung belakang + jambul depan.
  hk.add(new SphereGeometry(r * 1.04, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), style.hair, {
    pos: [0, r * 0.95, r * 0.08],
    rot: [0.35, 0, 0],
  });
  for (const [x, y, z, s] of [
    [-0.32, 1.42, -0.8, 0.26],
    [0.05, 1.5, -0.84, 0.3],
    [0.38, 1.4, -0.78, 0.24],
  ] as [number, number, number, number][]) {
    hk.add(ico(r * s, 0), style.hair, { pos: [x * r, y * r, z * r], scale: [1.2, 0.7, 0.8], jitter: 0.05 });
  }
  // Telinga, hidung, pipi.
  for (const s of [-1, 1]) hk.add(sphere(r * 0.18, 6, 4), EXTRA.skinShade, { pos: [s * r * 0.98, r * 0.86, r * 0.05] });
  hk.add(sphere(r * 0.07, 6, 4), EXTRA.skinShade, { pos: [0, r * 0.76, -r * 0.98] });
  for (const s of [-1, 1]) {
    hk.add(sphere(r * 0.15, 8, 5), EXTRA.cheek, { pos: [s * r * 0.55, r * 0.66, -r * 0.8], scale: [1, 0.62, 0.42] });
  }
  head.add(mesh(hk.build(), mat, 'head'));

  // Mata besar (terpisah supaya ekspresi bisa diubah).
  const eyes: Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = eye(r, style.iris ?? '#7A4A2E', mat);
    e.position.set(s * r * 0.36, r * 0.96, -r * 0.9);
    e.rotation.y = -s * 0.28;
    head.add(e);
    eyes.push(e);
  }
  // Alis.
  const brows: Object3D[] = [];
  for (const s of [-1, 1]) {
    const b = mesh(new Kit().add(rbox(r * 0.28, r * 0.06, r * 0.05, r * 0.025), style.hair).build(), mat, 'brow');
    b.position.set(s * r * 0.36, r * 1.24, -r * 0.9);
    b.rotation.set(0, -s * 0.28, s * 0.1);
    head.add(b);
    brows.push(b);
  }
  // Senyum lebar: setengah bola merah tua + lidah.
  const mouth = new Group();
  const mk = new Kit();
  mk.add(new SphereGeometry(r * 0.17, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#A8323C', { scale: [1, 0.75, 0.45] });
  mk.add(sphere(r * 0.08, 6, 4), '#FF8A95', { pos: [0, -r * 0.08, -r * 0.02], scale: [1.3, 0.5, 0.6] });
  mouth.add(mesh(mk.build(), mat, 'mouth'));
  mouth.position.set(0, r * 0.62, -r * 0.92);
  mouth.rotation.x = -0.25;
  head.add(mouth);
  root.add(head);

  // Lengan (pivot di bahu) + manset bergaris + tangan.
  const arm = (side: number): Group => {
    const g = new Group();
    g.position.set(side * r * 0.82, r * 1.05, 0);
    const ak = new Kit();
    ak.add(rbox(r * 0.38, r * 0.92, r * 0.38, r * 0.16), style.uniform, { pos: [0, -r * 0.4, 0] });
    const [c1, c2] = style.cuffs ?? [style.uniformTrim, style.uniformTrim];
    ak.add(cyl(r * 0.21, r * 0.21, r * 0.07, 10), c1, { pos: [0, -r * 0.72, 0] });
    ak.add(cyl(r * 0.21, r * 0.21, r * 0.07, 10), c2, { pos: [0, -r * 0.8, 0] });
    ak.add(sphere(r * 0.2, 8, 6), EXTRA.skin, { pos: [0, -r * 0.95, 0] });
    g.add(mesh(ak.build(), mat, 'arm'));
    root.add(g);
    return g;
  };
  const armL = arm(-1);
  const armR = arm(1);
  return { root, torso, head, armL, armR, eyes, brows, mouth };
}

/** Topi pilot dengan lencana sayap (Piko). */
export function pilotHat(r: number, color: string, mat: Material, oversized = 1): Group {
  const g = new Group();
  const k = new Kit();
  const s = oversized;
  k.add(sphere(r * 1.0 * s, 14, 8).scale(1, 0.62, 1), color, { pos: [0, 0, 0] });
  k.add(rbox(r * 1.5 * s, r * 0.12, r * 0.75 * s, r * 0.06), PALETTE.ink, { pos: [0, -r * 0.02, -r * 0.62 * s] });
  k.add(rbox(r * 2.05 * s, r * 0.1, r * 2.0 * s, r * 0.05), color, { pos: [0, -r * 0.12, 0] });
  k.add(box(r * 0.5, r * 0.12, r * 0.06), PALETTE.sun, { pos: [0, r * 0.25 * s, -r * 0.92 * s] });
  k.add(sphere(r * 0.1, 6, 4), PALETTE.sun, { pos: [0, r * 0.25 * s, -r * 0.95 * s] });
  g.add(mesh(k.build(), mat, 'hat'));
  return g;
}

/**
 * Helm kulit penerbang (gaya gambar referensi Aril): tudung toska yang menutup kepala atas, belakang,
 * dan telinga, earcup bundar, tepi helm, serta kacamata terbang besar di dahi.
 */
export function aviatorHelmet(r: number, mat: Material, colors = { leather: '#2F8FA6', edge: '#256F82', cup: '#F4E7CD', cupCenter: '#E5484D', goggle: '#C9954E', lens: '#CFEFFF', strap: '#7A4A2E' }): Group {
  const g = new Group();
  const k = new Kit();
  const cy = r * 0.92;
  const R = r * 1.08;
  // Mahkota (seluruh keliling) dan sisi-belakang (menutup telinga, wajah depan terbuka).
  k.add(new SphereGeometry(R, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), colors.leather, { pos: [0, cy, 0], jitter: 0.02 });
  k.add(new SphereGeometry(R, 14, 8, -0.2, Math.PI + 0.4, Math.PI * 0.3, Math.PI * 0.32), colors.leather, { pos: [0, cy, 0], jitter: 0.02 });
  // Jahitan tengah.
  k.add(torus(R * 1.002, r * 0.025, 4, 22, Math.PI), colors.edge, { pos: [0, cy, 0], rot: [0, Math.PI / 2, 0] });
  // Tepi helm di dahi.
  const ringR = R * Math.sin(Math.PI * 0.3);
  k.add(torus(ringR, r * 0.06, 5, 22, Math.PI * 1.05), colors.edge, {
    pos: [0, cy + R * Math.cos(Math.PI * 0.3), 0],
    rot: [Math.PI / 2, 0, -Math.PI * 0.025],
  });
  // Earcup.
  for (const s of [-1, 1]) {
    k.add(cyl(r * 0.3, r * 0.3, r * 0.14, 14), colors.cup, { pos: [s * r * 1.07, r * 0.86, r * 0.05], rot: [0, 0, Math.PI / 2] });
    k.add(cyl(r * 0.15, r * 0.15, r * 0.16, 12), colors.cupCenter, { pos: [s * r * 1.08, r * 0.86, r * 0.05], rot: [0, 0, Math.PI / 2] });
  }
  // Tali kacamata melingkar + dua lensa besar di dahi.
  k.add(torus(R * 1.02, r * 0.05, 4, 24), colors.strap, { pos: [0, cy + r * 0.42, r * 0.08], rot: [Math.PI / 2 - 0.42, 0, 0] });
  for (const s of [-1, 1]) {
    const pos: [number, number, number] = [s * r * 0.3, cy + r * 0.5, -r * 0.93];
    k.add(torus(r * 0.22, r * 0.075, 6, 14), colors.goggle, { pos, rot: [0.62, s * 0.22, 0] });
    k.add(cyl(r * 0.2, r * 0.2, r * 0.05, 14), colors.lens, { pos, rot: [Math.PI / 2 + 0.62, 0, s * 0.22] });
  }
  k.add(box(r * 0.16, r * 0.07, r * 0.07), colors.goggle, { pos: [0, cy + r * 0.52, -r * 1.0], rot: [0.62, 0, 0] });
  g.add(mesh(k.build(), mat, 'helmet'));
  return g;
}
