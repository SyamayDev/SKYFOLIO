/**
 * Efek suara sintetis sementara (docs/05 bagian 3). Setiap bunyi diberi variasi pitch acak ±6%.
 * Sampel CC0 yang lebih kaya menyusul di Fase 2.
 */
import { AUDIO } from '../config/audio';
import type { SurfaceMaterial } from '../physics/PhysicsWorld';
import { clamp } from '../utils/math';

interface ImpactRecipe {
  thump: number;
  noiseFreq: number;
  noiseType: BiquadFilterType;
  decay: number;
  bell?: [number, number];
  glide?: [number, number];
}

const IMPACT: Record<SurfaceMaterial, ImpactRecipe> = {
  wood: { thump: 230, noiseFreq: 1100, noiseType: 'bandpass', decay: 0.12 },
  metal: { thump: 180, noiseFreq: 2500, noiseType: 'bandpass', decay: 0.45, bell: [520, 1310] },
  fabric: { thump: 90, noiseFreq: 420, noiseType: 'lowpass', decay: 0.22 },
  rubber: { thump: 0, noiseFreq: 600, noiseType: 'lowpass', decay: 0.3, glide: [260, 620] },
  rock: { thump: 85, noiseFreq: 700, noiseType: 'lowpass', decay: 0.18 },
  grass: { thump: 70, noiseFreq: 520, noiseType: 'lowpass', decay: 0.22 },
  sand: { thump: 60, noiseFreq: 900, noiseType: 'lowpass', decay: 0.25 },
  snow: { thump: 55, noiseFreq: 700, noiseType: 'lowpass', decay: 0.28 },
  asphalt: { thump: 120, noiseFreq: 1400, noiseType: 'bandpass', decay: 0.14 },
  water: { thump: 0, noiseFreq: 750, noiseType: 'bandpass', decay: 0.6, glide: [420, 120] },
};

export class Sfx {
  private voices = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly bus: AudioNode,
    private readonly uiBus: AudioNode,
    private readonly noise: AudioBuffer,
  ) {}

  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * AUDIO.PITCH_JITTER;
  }

  private canPlay(): boolean {
    return this.voices < AUDIO.MAX_VOICES && this.ctx.state === 'running';
  }

  private track(node: AudioScheduledSourceNode, end: number): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
      node.disconnect();
    };
    node.stop(end);
  }

  private env(gain: number, attack: number, decay: number, dest: AudioNode): GainNode {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  private noiseBurst(freq: number, type: BiquadFilterType, gain: number, decay: number, dest = this.bus, q = 1): void {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = this.jitter();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq * this.jitter();
    f.Q.value = q;
    src.connect(f).connect(this.env(gain, 0.004, decay, dest));
    src.start(t, Math.random() * 1.5);
    this.track(src, t + decay + 0.05);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    gain: number,
    attack: number,
    decay: number,
    dest = this.bus,
    delay = 0,
  ): void {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    const j = this.jitter();
    o.frequency.setValueAtTime(f0 * j, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * j), t + attack + decay);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(dest);
    o.start(t);
    this.track(o, t + attack + decay + 0.05);
  }

  /** Bunyi tumbukan sesuai material, kekuatan 0..1. */
  impact(material: SurfaceMaterial, strength: number): void {
    if (!this.canPlay()) return;
    const s = clamp(strength, 0.05, 1);
    const r = IMPACT[material] ?? IMPACT.grass;
    this.noiseBurst(r.noiseFreq, r.noiseType, 0.5 * s, r.decay * (0.7 + s * 0.6));
    if (r.thump > 0) this.tone('sine', r.thump * 1.6, r.thump * 0.6, 0.6 * s, 0.004, r.decay + 0.05);
    if (r.bell) {
      this.tone('sine', r.bell[0], r.bell[0] * 0.98, 0.18 * s, 0.003, r.decay * 1.5);
      this.tone('triangle', r.bell[1], r.bell[1], 0.08 * s, 0.003, r.decay);
    }
    if (r.glide) this.tone('sine', r.glide[0], r.glide[1], 0.35 * s, 0.01, r.decay * 0.6);
  }

  /** Klakson kecil yang lucu: "mip-mip". */
  horn(): void {
    if (!this.canPlay()) return;
    for (const d of [0, 0.2]) {
      this.tone('square', 523, 523, 0.07, 0.01, 0.14, this.bus, d);
      this.tone('square', 659, 659, 0.05, 0.01, 0.14, this.bus, d);
    }
  }

  /** "Ding" cincin; nada naik untuk cincin berurutan. */
  ding(step: number): void {
    if (!this.canPlay()) return;
    const base = 784 * Math.pow(2, (step * 2) / 12);
    this.tone('sine', base, base, 0.25, 0.005, 0.9);
    this.tone('sine', base * 2, base * 2, 0.08, 0.005, 0.5);
    this.tone('triangle', base * 1.5, base * 1.5, 0.05, 0.02, 0.6, this.bus, 0.06);
  }

  /** Pegas lompat "boing". */
  spring(): void {
    if (!this.canPlay()) return;
    this.tone('sine', 180, 720, 0.3, 0.01, 0.28);
    this.tone('triangle', 90, 300, 0.12, 0.01, 0.25);
  }

  /** "Plop" saat huruf kembali tersusun. */
  plop(): void {
    if (!this.canPlay()) return;
    this.tone('sine', 900, 260, 0.2, 0.004, 0.12);
  }

  /** "Whoosh" barrel roll. */
  whoosh(): void {
    if (!this.canPlay()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.3);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.65);
    src.connect(f).connect(this.env(0.5, 0.15, 0.5, this.bus));
    src.start(t);
    this.track(src, t + 0.75);
  }

  /** Decit ban saat roda menyentuh landasan. */
  tire(strength: number): void {
    if (!this.canPlay()) return;
    this.noiseBurst(1900, 'bandpass', 0.22 * clamp(strength, 0.2, 1), 0.22, this.bus, 6);
  }

  /** Cipratan "byur". */
  splash(strength: number): void {
    this.impact('water', strength);
    if (!this.canPlay()) return;
    this.noiseBurst(2400, 'highpass', 0.18 * clamp(strength, 0.2, 1), 0.5);
  }

  /** Gemerisik daun (menyerempet pohon). */
  rustle(strength: number): void {
    if (!this.canPlay()) return;
    this.noiseBurst(3200, 'bandpass', 0.2 * clamp(strength, 0.2, 1), 0.3, this.bus, 0.8);
  }

  /** Stall buffet / peringatan pendek. */
  stallWarn(): void {
    if (!this.canPlay()) return;
    this.tone('square', 330, 330, 0.05, 0.01, 0.12);
    this.tone('square', 262, 262, 0.05, 0.01, 0.12, this.bus, 0.15);
  }

  /** Klik UI dengan variasi pitch. */
  click(): void {
    if (!this.canPlay()) return;
    this.tone('sine', 1250, 900, 0.08, 0.002, 0.05, this.uiBus);
  }

  /** Starter mesin: tersendat lalu hidup. */
  starter(): void {
    if (!this.canPlay()) return;
    for (let i = 0; i < 4; i++) this.noiseBurst(300, 'lowpass', 0.25, 0.09, this.bus);
    for (let i = 0; i < 4; i++) this.tone('sawtooth', 50 + i * 8, 40, 0.12, 0.01, 0.12, this.bus, i * 0.16);
  }
}
