/**
 * Piko (co-pilot) versi awal: anak kecil low-poly, topi pilot kebesaran yang sering melorot,
 * headset kebesaran, pipi merona. Reaksi: tangan ke atas saat boost, topi terbang saat tabrakan,
 * bintang kartun di sekitar kepala, menengok kiri-kanan saat diam.
 */
import { Group, type Material } from 'three';
import { PALETTE } from '../config/palette';
import { Kit, cyl, rbox, sphere, torus } from '../utils/modeling/Kit';
import { damp } from '../utils/math';
import { wobble } from '../utils/noise';
import { buildChibi, mesh, pilotHat, type ChibiParts } from './Chibi';
import type { CharacterContext } from './PilotAril';

export type PikoEmote = 'wave' | 'cheer' | 'think' | 'sleepy' | 'wow';

export class CopilotPiko {
  readonly root: Group;
  readonly parts: ChibiParts;
  readonly hat: Group;
  private readonly stars = new Group();
  private cheer = 0;
  private hatFly = 0;
  private hatSpin = 0;
  private starTime = 0;
  private surprise = 0;
  private emoteType: PikoEmote = 'wave';
  private emoteT = 0;
  private talkT = 0;
  /** 0..1 amplitudo bicara (Fase 3: dari audio suara). */
  talk = 0;

  constructor(mat: Material) {
    const r = 0.21;
    this.parts = buildChibi({
      headRadius: r,
      uniform: PALETTE.sky,
      uniformTrim: PALETTE.cream,
      hair: '#4A3426',
      material: mat,
      iris: '#5A3A22',
      cuffs: [PALETTE.cream, PALETTE.sun],
    });
    this.root = this.parts.root;
    this.root.name = 'copilot-piko';
    this.root.scale.setScalar(0.92);
    // Pipi merona.
    const ck = new Kit();
    // Headset kebesaran: bando + dua cup + mikrofon.
    ck.add(torus(r * 1.08, r * 0.07, 4, 16, Math.PI), PALETTE.ink, { pos: [0, r * 0.98, 0.0], rot: [0, Math.PI / 2, 0] });
    for (const s of [-1, 1]) ck.add(cyl(r * 0.32, r * 0.32, r * 0.25, 10), PALETTE.ink, { pos: [s * r * 1.05, r * 0.9, 0], rot: [0, 0, Math.PI / 2] });
    ck.add(cyl(r * 0.03, r * 0.03, r * 0.8, 4), PALETTE.ink, { pos: [r * 0.75, r * 0.55, -r * 0.55], rot: [0.9, 0.4, 0] });
    ck.add(sphere(r * 0.09, 5, 4), PALETTE.berry, { pos: [r * 0.45, r * 0.42, -r * 0.88] });
    this.parts.head.add(mesh(ck.build(), mat, 'piko-details'));
    // Topi kebesaran (bisa terbang).
    this.hat = pilotHat(r, PALETTE.sky, mat, 1.22);
    this.hat.position.set(0, r * 1.55, -0.02);
    this.hat.rotation.x = 0.18; // sedikit melorot ke depan
    this.parts.head.add(this.hat);
    // Bintang kartun (disembunyikan sampai tabrakan).
    const sk = new Kit();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      sk.add(rbox(0.09, 0.09, 0.03, 0.01), PALETTE.sun, { pos: [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], rot: [0, 0, Math.PI / 4] });
      sk.add(rbox(0.09, 0.09, 0.03, 0.01), PALETTE.sun, { pos: [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32] });
    }
    this.stars.add(mesh(sk.build(), mat, 'stars'));
    this.stars.position.set(0, r * 2.3, 0);
    this.stars.visible = false;
    this.parts.head.add(this.stars);
    this.parts.armL.rotation.x = -0.4;
    this.parts.armR.rotation.x = -0.4;
  }

  /** Animasi reaksi (dari aksi AI `emote` atau obrolan otomatis). */
  emote(type: PikoEmote): void {
    this.emoteType = type;
    this.emoteT = type === 'wave' ? 2.2 : type === 'sleepy' ? 3 : 1.8;
    if (type === 'wow') this.surprise = 1;
  }

  /** Mulut bergerak sebentar saat gelembung ucapan muncul (tanpa suara). */
  speak(seconds: number): void {
    this.talkT = Math.min(4, seconds);
  }

  /** Reaksi tabrakan: topi terbang lalu ditangkap, bintang berputar. */
  bonk(strength: number): void {
    this.surprise = 1;
    if (strength >= 2) {
      this.hatFly = 1;
      this.starTime = 2.2 + strength * 0.4;
    }
  }

  update(c: CharacterContext): void {
    const p = this.parts;
    // Sorak "wuuuu" saat boost: kedua tangan ke atas.
    this.cheer = damp(this.cheer, c.boosting ? 1 : 0, 6, c.dt);
    const bob = Math.sin(c.time * 12) * 0.15 * this.cheer;
    p.armL.rotation.x = -0.4 - this.cheer * 2.4 + bob;
    p.armR.rotation.x = -0.4 - this.cheer * 2.4 - bob;
    p.armL.rotation.z = -this.cheer * 0.35;
    p.armR.rotation.z = this.cheer * 0.35;

    // Emote: melambai, sorak, berpikir, mengantuk, kagum.
    if (this.emoteT > 0) {
      this.emoteT = Math.max(0, this.emoteT - c.dt);
      const k = Math.min(1, this.emoteT * 2);
      const e = this.emoteType;
      if (e === 'wave') {
        p.armR.rotation.x = -2.6 * k;
        p.armR.rotation.z = (0.4 + Math.sin(c.time * 14) * 0.45) * k;
      } else if (e === 'cheer') {
        const j = Math.sin(c.time * 16) * 0.2;
        p.armL.rotation.x = -2.7 * k + j;
        p.armR.rotation.x = -2.7 * k - j;
      } else if (e === 'think') {
        p.armR.rotation.x = -1.9 * k;
        p.armR.rotation.z = -0.6 * k;
      }
    }
    if (this.talkT > 0) {
      this.talkT = Math.max(0, this.talkT - c.dt);
      this.talk = Math.max(0, Math.sin(c.time * 22)) * 0.6 * Math.min(1, this.talkT * 3);
    } else this.talk = 0;

    // Menengok kiri-kanan dengan rasa penasaran.
    p.head.rotation.y = wobble(c.time * 0.45, 7) * 0.7;
    p.head.rotation.z = -c.roll * 0.2 + wobble(c.time * 0.8, 2) * 0.06;
    if (this.emoteT > 0 && this.emoteType === 'think') p.head.rotation.z += 0.3;
    if (this.emoteT > 0 && this.emoteType === 'sleepy') p.head.rotation.x = 0.35 + Math.sin(c.time * 3) * 0.12;
    else p.head.rotation.x = 0;
    p.torso.rotation.z = -c.roll * 0.18;

    // Topi terbang ke atas, berputar, lalu kembali.
    if (this.hatFly > 0) {
      this.hatFly = Math.max(0, this.hatFly - c.dt / 1.3);
      const t = 1 - this.hatFly;
      const arc = Math.sin(t * Math.PI);
      this.hatSpin += c.dt * 14 * this.hatFly;
      this.hat.position.y = 0.21 * 1.55 + arc * 0.9;
      this.hat.rotation.y = this.hatSpin;
      this.hat.rotation.x = 0.18 + arc * 0.8;
    } else {
      this.hat.position.y = damp(this.hat.position.y, 0.21 * 1.55, 10, c.dt);
      this.hat.rotation.y = damp(this.hat.rotation.y, 0, 8, c.dt);
      this.hat.rotation.x = 0.18 + Math.sin(c.time * 0.7) * 0.03;
    }

    // Bintang di atas kepala.
    if (this.starTime > 0) {
      this.starTime -= c.dt;
      this.stars.visible = true;
      this.stars.rotation.y += c.dt * 5;
    } else this.stars.visible = false;

    // Ekspresi kaget (mata membesar) lalu kembali.
    this.surprise = Math.max(0, this.surprise - c.dt * 1.2);
    const eyeScale = 1 + this.surprise * 0.6;
    for (const e of p.eyes) e.scale.setScalar(eyeScale);
    for (const b of p.brows) b.position.y = 0.21 * (1.24 + this.surprise * 0.12);
    p.mouth.scale.set(1 - this.surprise * 0.3, 1 + this.surprise * 1.2 + this.talk * 1.6, 1);
  }
}
