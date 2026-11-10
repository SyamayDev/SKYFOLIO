/**
 * Pembangun karakter chibi low-poly bersama (docs/04 bagian 3.2): kepala besar, wajah sederhana.
 * Bagian bergerak (kepala, lengan) adalah Group terpisah dengan pivot di sendi.
 */
import { Group, Mesh, type Material } from 'three';
import { EXTRA, PALETTE } from '../config/palette';
import { Kit, box, rbox, sphere } from '../utils/modeling/Kit';

export interface ChibiParts {
  root: Group;
  torso: Group;
  head: Group;
  armL: Group;
  armR: Group;
  eyes: Mesh[];
  mouth: Mesh;
}

export interface ChibiStyle {
  headRadius: number;
  uniform: string;
  uniformTrim: string;
  hair: string;
  material: Material;
}

export function mesh(geo: ReturnType<Kit['build']>, mat: Material, name: string): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  return m;
}

export function buildChibi(style: ChibiStyle): ChibiParts {
  const { headRadius: r, material: mat } = style;
  const root = new Group();

  // Badan (terlihat di atas bibir kokpit).
  const torso = new Group();
  const tk = new Kit();
  tk.add(rbox(r * 1.5, r * 1.35, r * 1.1, r * 0.35), style.uniform, { pos: [0, r * 0.62, 0] });
  tk.add(rbox(r * 1.56, r * 0.2, r * 1.14, r * 0.08), style.uniformTrim, { pos: [0, r * 0.55, 0] });
  // Kerah
  tk.add(rbox(r * 0.9, r * 0.22, r * 0.5, r * 0.08), '#FFFFFF', { pos: [0, r * 1.28, -r * 0.18] });
  torso.add(mesh(tk.build(), mat, 'torso'));
  root.add(torso);

  // Kepala (pivot di leher).
  const head = new Group();
  head.position.set(0, r * 1.38, 0);
  const hk = new Kit();
  hk.add(sphere(r, 12, 9), EXTRA.skin, { pos: [0, r * 0.92, 0], jitter: 0.015 });
  // Rambut (topi rambut di belakang/atas).
  hk.add(sphere(r * 1.03, 10, 7), style.hair, { pos: [0, r * 1.02, r * 0.1], scale: [1, 0.9, 0.95] });
  // Telinga
  for (const s of [-1, 1]) hk.add(sphere(r * 0.18, 6, 4), EXTRA.skinShade, { pos: [s * r * 0.98, r * 0.88, r * 0.05] });
  head.add(mesh(hk.build(), mat, 'head'));
  // Mata (terpisah supaya ekspresi bisa diubah).
  const eyes: Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = mesh(new Kit().add(sphere(r * 0.11, 6, 5), PALETTE.ink).build(), mat, 'eye');
    e.position.set(s * r * 0.36, r * 0.98, -r * 0.88);
    e.scale.set(1, 1.25, 0.6);
    head.add(e);
    eyes.push(e);
  }
  const mouth = mesh(new Kit().add(rbox(r * 0.32, r * 0.08, r * 0.08, r * 0.03), '#B3434B').build(), mat, 'mouth');
  mouth.position.set(0, r * 0.62, -r * 0.93);
  head.add(mouth);
  root.add(head);

  // Lengan (pivot di bahu).
  const arm = (side: number): Group => {
    const g = new Group();
    g.position.set(side * r * 0.82, r * 1.05, 0);
    const ak = new Kit();
    ak.add(rbox(r * 0.36, r * 0.9, r * 0.36, r * 0.15), style.uniform, { pos: [0, -r * 0.4, 0] });
    ak.add(sphere(r * 0.2, 6, 5), EXTRA.skin, { pos: [0, -r * 0.92, 0] });
    g.add(mesh(ak.build(), mat, 'arm'));
    root.add(g);
    return g;
  };
  const armL = arm(-1);
  const armR = arm(1);
  return { root, torso, head, armL, armR, eyes, mouth };
}

/** Topi pilot dengan lencana sayap. */
export function pilotHat(r: number, color: string, mat: Material, oversized = 1): Group {
  const g = new Group();
  const k = new Kit();
  const s = oversized;
  k.add(sphere(r * 1.0 * s, 12, 6).scale(1, 0.62, 1), color, { pos: [0, 0, 0] });
  k.add(rbox(r * 1.5 * s, r * 0.12, r * 0.75 * s, r * 0.06), PALETTE.ink, { pos: [0, -r * 0.02, -r * 0.62 * s] });
  k.add(rbox(r * 2.05 * s, r * 0.1, r * 2.0 * s, r * 0.05), color, { pos: [0, -r * 0.12, 0], scale: [1, 1, 1] });
  // Lencana sayap
  k.add(box(r * 0.5, r * 0.12, r * 0.06), PALETTE.sun, { pos: [0, r * 0.25 * s, -r * 0.92 * s] });
  k.add(sphere(r * 0.1, 6, 4), PALETTE.sun, { pos: [0, r * 0.25 * s, -r * 0.95 * s] });
  g.add(mesh(k.build(), mat, 'hat'));
  return g;
}
