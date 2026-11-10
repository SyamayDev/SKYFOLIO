/**
 * Suara dunia (docs/05 bagian 2–3): lapisan kontinu yang disintesis (roket, gemuruh masuk atmosfer,
 * hujan di kanopi/desis hujan), suasana alam (ombak, burung siang, jangkrik malam), dan sumber spasial
 * per zona (tepuk tangan Panggung MC, desis kuali Dapur Aril, gemuruh lava, lonceng angin Danau Toba).
 * Semua dibuat di sini tanpa file audio (anggaran ≤ 1,5 MB tetap utuh).
 */
import type { Vector3 } from 'three';
import { bus } from '../core/EventBus';
import type { QualityTier } from '../config/quality';
import { panel } from '../core/AppState';
import type { AudioManager } from './AudioManager';

export interface WorldAudioState {
  rocket: number;
  heat: number;
  rain: number;
  canopyClosed: boolean;
  /** Ketinggian di atas permukaan. */
  agl: number;
  overWater: boolean;
  night: boolean;
  space: number;
  camPos: Vector3;
}

interface Loop {
  gain: GainNode;
  level: number;
}

interface Emitter {
  pos: Vector3;
  maxDist: number;
  make: (dest: AudioNode) => () => void;
  panner: PannerNode | null;
  stop: (() => void) | null;
}

export class WorldAudio {
  private readonly ctx: AudioContext;
  private readonly noise: AudioBuffer;
  private readonly loops = new Map<string, Loop>();
  private readonly emitters: Emitter[] = [];
  private nextChirp = 0;
  private nextTick = 0;
  private nextCricket = 0;
  private readonly offs: (() => void)[] = [];

  constructor(
    private readonly audio: AudioManager,
    private readonly tier: QualityTier,
  ) {
    this.ctx = audio.ctx!;
    this.noise = audio.noise!;
    const sfx = audio.bus('sfx');
    const amb = audio.bus('ambient');
    this.loopNoise('rocket', sfx, 'bandpass', 520, 0.7, 0.9, [55, 0.25]);
    this.loopNoise('reentry', sfx, 'lowpass', 260, 0.8, 0.6, [38, 0.3]);
    this.loopNoise('rainHiss', amb, 'highpass', 1600, 0.5, 1);
    this.loopNoise('surf', amb, 'lowpass', 650, 0.7, 0.45);
    this.wire();
  }

  /** Noise berulang lewat filter (+ dengung sinus opsional) dengan gain yang bisa diatur. */
  private loopNoise(id: string, dest: AudioNode, type: BiquadFilterType, freq: number, q: number, rate: number, hum?: [number, number]): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(g);
    src.start(0, Math.random() * 1.5);
    if (hum) {
      const o = ctx.createOscillator();
      o.frequency.value = hum[0];
      const hg = ctx.createGain();
      hg.gain.value = hum[1];
      o.connect(hg).connect(g);
      o.start();
    }
    this.loops.set(id, { gain: g, level: 0 });
  }

  private setLoop(id: string, v: number, tc = 0.25): void {
    const l = this.loops.get(id);
    if (!l || Math.abs(l.level - v) < 0.003) return;
    l.level = v;
    l.gain.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  private wire(): void {
    const sfx = this.audio.sfx;
    this.offs.push(
      bus.on('canopy', (e) => sfx?.canopy(e.closed)),
      bus.on('wiper', () => sfx?.wiper()),
      bus.on('rocket', (e) => {
        if (e.deployed) sfx?.rocketDeploy();
      }),
      bus.on('weather:thunder', (e) => {
        setTimeout(() => sfx?.thunder(e.strength), e.delay * 1000);
      }),
      bus.on('stamp', () => sfx?.stamp()),
      bus.on('moon:landed', (e) => {
        if (e.smooth) sfx?.chime();
      }),
    );
    let wasOpen = false;
    this.offs.push(
      panel.subscribe((p) => {
        const open = !!p;
        if (open !== wasOpen) sfx?.panel(open);
        wasOpen = open;
      }),
    );
  }

  /** Sumber suara spasial di posisi dunia (dimulai hanya saat pendengar mendekat). */
  addEmitter(pos: Vector3, maxDist: number, kind: 'crowd' | 'sizzle' | 'lava' | 'chimes'): void {
    const make = (dest: AudioNode): (() => void) => {
      switch (kind) {
        case 'crowd':
          return this.pulsedNoise(dest, 'bandpass', 1500, 0.6, 0.35, 9, 0.5);
        case 'sizzle':
          return this.pulsedNoise(dest, 'highpass', 3500, 0.3, 0.25, 40, 0.8);
        case 'lava':
          return this.pulsedNoise(dest, 'lowpass', 140, 0.9, 0.6, 1.2, 0.3);
        default:
          return this.chimes(dest);
      }
    };
    this.emitters.push({ pos, maxDist, make, panner: null, stop: null });
  }

  /** Noise yang diamplitudo-modulasi acak (tepuk tangan, desis, gemuruh). */
  private pulsedNoise(dest: AudioNode, type: BiquadFilterType, freq: number, q: number, level: number, rate: number, depth: number): () => void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = rate;
    const lg = ctx.createGain();
    lg.gain.value = level * depth;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(dest);
    src.start(0, Math.random());
    lfo.start();
    return () => {
      src.stop();
      lfo.stop();
      g.disconnect();
    };
  }

  private chimes(dest: AudioNode): () => void {
    const ctx = this.ctx;
    const notes = [880, 990, 1175, 1320, 1480];
    const timer = setInterval(() => {
      if (ctx.state !== 'running' || Math.random() < 0.4) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.value = notes[Math.floor(Math.random() * notes.length)]!;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 2.3);
    }, 700);
    return () => clearInterval(timer);
  }

  /** Kicau burung: sapuan nada tinggi pendek yang diulang 2–4 kali. */
  private chirp(level: number): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const base = 2400 + Math.random() * 2200;
    const n = 2 + Math.floor(Math.random() * 3);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.audio.bus('ambient'));
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), s + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(level, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 0.1);
    }
    setTimeout(() => pan.disconnect(), 1500);
  }

  /** Jangkrik: denyut sinus 4,4 kHz. */
  private cricket(level: number): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = 4200 + Math.random() * 500;
    const am = ctx.createOscillator();
    am.type = 'square';
    am.frequency.value = 28 + Math.random() * 8;
    const ag = ctx.createGain();
    ag.gain.value = level * 0.5;
    const g = ctx.createGain();
    g.gain.value = level * 0.5;
    am.connect(ag).connect(g.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.03);
    env.gain.setValueAtTime(1, t + 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(env).connect(this.audio.bus('ambient'));
    o.start(t);
    am.start(t);
    o.stop(t + 0.5);
    am.stop(t + 0.5);
  }

  /** Ketukan tetes hujan di kanopi tertutup. */
  private tick(level: number): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500 + Math.random() * 2500;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(f).connect(g).connect(this.audio.bus('sfx'));
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.04);
  }

  update(dt: number, s: WorldAudioState): void {
    if (this.ctx.state !== 'running') return;
    this.setLoop('rocket', s.rocket * 0.5, 0.08);
    this.setLoop('reentry', s.heat * 0.75, 0.2);
    this.setLoop('rainHiss', s.canopyClosed ? s.rain * 0.06 : s.rain * 0.22);
    const low = Math.max(0, 1 - s.agl / 35) * (1 - s.space);
    this.setLoop('surf', s.overWater ? low * 0.35 : low * 0.08, 0.8);
    const now = this.ctx.currentTime;
    if (s.rain > 0.05 && s.canopyClosed && now > this.nextTick) {
      this.tick(0.05 + s.rain * 0.08);
      this.nextTick = now + (0.03 + Math.random() * 0.12) / Math.max(0.2, s.rain);
    }
    const nature = low * (1 - s.rain) * (s.overWater ? 0.3 : 1);
    if (!s.night && nature > 0.2 && now > this.nextChirp) {
      this.chirp(0.035 * nature);
      this.nextChirp = now + 1.2 + Math.random() * 4;
    }
    if (s.night && nature > 0.2 && now > this.nextCricket) {
      this.cricket(0.03 * nature);
      this.nextCricket = now + 0.6 + Math.random() * 1.2;
    }
    // Emitter spasial: hidupkan saat dekat, matikan saat jauh (hemat CPU).
    for (const e of this.emitters) {
      const d = e.pos.distanceTo(s.camPos);
      if (d < e.maxDist && !e.stop) {
        const p = this.ctx.createPanner();
        p.panningModel = this.tier === 'low' ? 'equalpower' : 'HRTF';
        p.distanceModel = 'inverse';
        p.refDistance = 10;
        p.maxDistance = e.maxDist;
        p.rolloffFactor = 1.3;
        if (p.positionX) {
          p.positionX.value = e.pos.x;
          p.positionY.value = e.pos.y;
          p.positionZ.value = e.pos.z;
        } else p.setPosition(e.pos.x, e.pos.y, e.pos.z);
        p.connect(this.audio.bus('ambient'));
        e.panner = p;
        e.stop = e.make(p);
      } else if (d > e.maxDist * 1.25 && e.stop) {
        e.stop();
        e.panner?.disconnect();
        e.stop = null;
        e.panner = null;
      }
    }
    void dt;
  }

  dispose(): void {
    for (const o of this.offs) o();
    for (const e of this.emitters) e.stop?.();
  }
}
