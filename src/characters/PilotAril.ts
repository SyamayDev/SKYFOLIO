/**
 * Avatar Aril (pilot), mengikuti gambar referensi Aril (docs/references/image.png): chibi berhelm kulit
 * toska dengan earcup, kacamata terbang besar di dahi, jaket kulit cokelat bermanset kuning-merah,
 * plus syal yang berkibar mengikuti kecepatan (rantai pegas sederhana, docs/04 bagian 3.2).
 */
import { Group, type Material } from 'three';
import { EXTRA, PALETTE } from '../config/palette';
import { Kit, rbox } from '../utils/modeling/Kit';
import { clamp, damp } from '../utils/math';
import { wobble } from '../utils/noise';
import { aviatorHelmet, buildChibi, mesh, type ChibiParts } from './Chibi';

const SCARF_SEGMENTS = 5;
const SEG_LEN = 0.13;

export interface CharacterContext {
  dt: number;
  time: number;
  /** Kecepatan udara (unit/dtk). */
  airspeed: number;
  /** Input kemudi yang dihaluskan. */
  roll: number;
  pitch: number;
  grounded: boolean;
  /** Lama diam di darat (detik). */
  idleTime: number;
  boosting: boolean;
}

export class PilotAril {
  readonly root: Group;
  readonly parts: ChibiParts;
  private readonly scarf: Group[] = [];
  private readonly scarfAngles = new Float32Array(SCARF_SEGMENTS * 2);
  private readonly scarfVel = new Float32Array(SCARF_SEGMENTS * 2);
  private wave = 0;
  private lean = 0;

  constructor(mat: Material) {
    const r = 0.25;
    this.parts = buildChibi({
      headRadius: r,
      uniform: '#9A5B34',
      uniformTrim: '#7A4A2E',
      hair: EXTRA.hair,
      material: mat,
      iris: '#6B3E22',
      collar: '#5E3A26',
      cuffs: [PALETTE.sun, '#E5484D'],
    });
    this.root = this.parts.root;
    this.root.name = 'pilot-aril';
    this.parts.head.add(aviatorHelmet(r, mat));

    // Syal (berry) — rantai segmen, dimulai dari leher bagian belakang.
    const anchor = new Group();
    anchor.position.set(r * 0.25, r * 1.32, r * 0.35);
    this.parts.root.add(anchor);
    let parent: Group = anchor;
    for (let i = 0; i < SCARF_SEGMENTS; i++) {
      const seg = new Group();
      if (i > 0) seg.position.set(0, 0, SEG_LEN);
      const w = 0.12 - i * 0.012;
      seg.add(mesh(new Kit().add(rbox(w, 0.035, SEG_LEN + 0.02, 0.015), i % 2 ? '#E8484E' : PALETTE.berry, { pos: [0, 0, SEG_LEN / 2] }).build(), mat, 'scarf'));
      parent.add(seg);
      this.scarf.push(seg);
      parent = seg;
    }
    // Lengan memegang tongkat kemudi.
    this.parts.armL.rotation.x = -0.9;
    this.parts.armR.rotation.x = -0.9;
  }

  update(c: CharacterContext): void {
    const p = this.parts;
    // Badan condong ke arah belokan, kepala sedikit berlawanan (menjaga horizon).
    this.lean = damp(this.lean, -c.roll * 0.28, 6, c.dt);
    p.torso.rotation.z = this.lean;
    p.head.rotation.z = -this.lean * 0.6 + wobble(c.time * 0.6, 3) * 0.05;
    p.head.rotation.y = wobble(c.time * 0.3, 1) * 0.35;
    p.head.rotation.x = c.pitch * 0.12;

    // Melambai saat diam di darat.
    const waving = c.grounded && c.idleTime > 1.5 && c.airspeed < 1;
    this.wave = damp(this.wave, waving ? 1 : 0, 4, c.dt);
    p.armR.rotation.x = -0.9 + this.wave * -1.6;
    p.armR.rotation.z = this.wave * (0.5 + Math.sin(c.time * 9) * 0.45);
    p.armL.rotation.x = -0.9 + c.pitch * 0.15;
    p.armL.rotation.z = c.roll * 0.15;
    if (!waving) p.armR.rotation.x += c.pitch * 0.15;

    // Syal: tiap segmen mengejar sudut target (angin) dengan pegas teredam + kibaran noise.
    const wind = clamp(c.airspeed / 40, 0, 1.6);
    const dt = Math.min(c.dt, 1 / 30);
    for (let i = 0; i < SCARF_SEGMENTS; i++) {
      // Target: menggantung ke bawah saat diam, terbentang ke belakang saat cepat.
      const hang = (1 - Math.min(1, wind)) * 1.25;
      const flutter = wind * (0.25 + i * 0.08);
      const targetX = hang * (i === 0 ? 1 : 0.2) + Math.sin(c.time * (14 + i * 3) + i * 0.9) * flutter * 0.6;
      const targetY = Math.sin(c.time * (11 + i * 2.3) + i * 1.7) * flutter;
      const k = 70;
      const d = 9;
      for (let a = 0; a < 2; a++) {
        const idx = i * 2 + a;
        const tgt = a === 0 ? targetX : targetY;
        const acc = (tgt - this.scarfAngles[idx]!) * k - this.scarfVel[idx]! * d;
        this.scarfVel[idx] = this.scarfVel[idx]! + acc * dt;
        this.scarfAngles[idx] = this.scarfAngles[idx]! + this.scarfVel[idx]! * dt;
      }
      const seg = this.scarf[i]!;
      seg.rotation.x = this.scarfAngles[i * 2]!;
      seg.rotation.y = this.scarfAngles[i * 2 + 1]!;
    }
  }
}

