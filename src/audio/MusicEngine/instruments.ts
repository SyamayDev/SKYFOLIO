/**
 * Instrumen musik (docs/05 bagian 4.3), semuanya disintesis:
 * - Pukulan/petikan dirender sekali ke AudioBuffer (kacapi Karplus-Strong, angklung, kendang, goong, drum).
 * - Suling, pad, bass, dan lead dimainkan langsung dengan osilator (butuh vibrato & luncuran nada).
 */
export type DrumHit = 'dung' | 'tak' | 'pak' | 'ket' | 'kick' | 'clap' | 'hat' | 'snare' | 'doum' | 'tek' | 'tung';

const SR_DEFAULT = 44100;

function buffer(ctx: BaseAudioContext, seconds: number, fill: (d: Float32Array, sr: number) => void): AudioBuffer {
  const sr = ctx.sampleRate || SR_DEFAULT;
  const b = ctx.createBuffer(1, Math.max(1, Math.floor(sr * seconds)), sr);
  fill(b.getChannelData(0), sr);
  return b;
}

/** Karplus-Strong: petikan senar dengan redaman `damp` (0..1) dan kecerahan `bright`. */
function pluck(ctx: BaseAudioContext, freq: number, seconds: number, damp: number, bright: number, seed: number): AudioBuffer {
  return buffer(ctx, seconds, (d, sr) => {
    const n = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(n);
    let s = seed;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      ring[i] = (s / 4294967296) * 2 - 1;
    }
    // Penghalusan awal = senar dipetik jari, bukan dipukul.
    for (let k = 0; k < 2 - bright * 2; k++) for (let i = 1; i < n; i++) ring[i] = (ring[i]! + ring[i - 1]!) * 0.5;
    let idx = 0;
    const decay = 0.5 * (0.996 + damp * 0.0038);
    for (let i = 0; i < d.length; i++) {
      const a = ring[idx]!;
      const b = ring[(idx + 1) % n]!;
      const v = (a + b) * decay;
      ring[idx] = v;
      d[i] = a * 0.9;
      idx = (idx + 1) % n;
    }
    // Serangan petik sedikit lebih terang di awal.
    for (let i = 0; i < Math.min(d.length, 60); i++) d[i] = d[i]! * (i / 60);
  });
}

/** Angklung: parsial bambu dengan getaran goyang (tremolo) cepat. */
function angklung(ctx: BaseAudioContext, freq: number): AudioBuffer {
  return buffer(ctx, 0.9, (d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const trem = 0.55 + 0.45 * Math.sin(2 * Math.PI * 13 * t);
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 4.2);
      const v = Math.sin(2 * Math.PI * freq * t) + 0.45 * Math.sin(2 * Math.PI * freq * 2 * t) + 0.18 * Math.sin(2 * Math.PI * freq * 3.02 * t);
      d[i] = v * env * trem * 0.45;
    }
  });
}

/** Goong: sinus rendah dengan "beating" lambat dan peluruhan panjang. */
function goong(ctx: BaseAudioContext, freq: number): AudioBuffer {
  return buffer(ctx, 4.5, (d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.02) * Math.exp(-t * 0.85);
      const v =
        Math.sin(2 * Math.PI * freq * t) +
        0.8 * Math.sin(2 * Math.PI * freq * 1.012 * t) +
        0.35 * Math.sin(2 * Math.PI * freq * 2.01 * t) * Math.exp(-t * 1.5) +
        0.15 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t * 2.5);
      d[i] = v * env * 0.42;
    }
  });
}

/** Membran dengan envelope pitch (kendang, kick, darbuka). */
function membrane(ctx: BaseAudioContext, f0: number, f1: number, decay: number, noiseAmt: number, noiseDecay: number, gain: number): AudioBuffer {
  return buffer(ctx, decay * 5 + 0.05, (d, sr) => {
    let phase = 0;
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const f = f1 + (f0 - f1) * Math.exp(-t * 28);
      phase += (2 * Math.PI * f) / sr;
      s = (s * 1664525 + 1013904223) >>> 0;
      const n = (s / 4294967296) * 2 - 1;
      d[i] = (Math.sin(phase) * Math.exp(-t / decay) + n * noiseAmt * Math.exp(-t / noiseDecay)) * gain;
    }
  });
}

function noiseHit(ctx: BaseAudioContext, decay: number, hp: number, gain: number, claps = 1): AudioBuffer {
  return buffer(ctx, decay * 6 + 0.04, (d, sr) => {
    let s = 777;
    let prev = 0;
    const a = Math.exp((-2 * Math.PI * hp) / sr);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      s = (s * 1664525 + 1013904223) >>> 0;
      const n = (s / 4294967296) * 2 - 1;
      // High-pass satu kutub.
      const h = n - prev * a;
      prev = n;
      let env = Math.exp(-t / decay);
      if (claps > 1) {
        const k = Math.floor(t / 0.011);
        if (k < claps - 1) env = Math.exp(-(t - k * 0.011) / 0.006);
        else env = Math.exp(-(t - (claps - 1) * 0.011) / decay);
      }
      d[i] = h * env * gain;
    }
  });
}

export class InstrumentBank {
  readonly drums = new Map<DrumHit, AudioBuffer>();
  /** Kacapi di tiga nada dasar (ditranspose dengan playbackRate ke nada terdekat). */
  private readonly kacapi: { f: number; b: AudioBuffer }[] = [];
  private readonly oud: { f: number; b: AudioBuffer }[] = [];
  private readonly angk: { f: number; b: AudioBuffer }[] = [];
  readonly gong: AudioBuffer;
  readonly impulse: AudioBuffer;

  constructor(ctx: BaseAudioContext) {
    this.drums.set('dung', membrane(ctx, 150, 78, 0.18, 0.08, 0.02, 0.9));
    this.drums.set('tak', membrane(ctx, 520, 360, 0.05, 0.35, 0.015, 0.55));
    this.drums.set('ket', membrane(ctx, 700, 520, 0.07, 0.2, 0.01, 0.45));
    this.drums.set('pak', noiseHit(ctx, 0.035, 900, 0.55));
    this.drums.set('kick', membrane(ctx, 160, 46, 0.22, 0.04, 0.006, 1.0));
    this.drums.set('clap', noiseHit(ctx, 0.09, 1200, 0.5, 3));
    this.drums.set('hat', noiseHit(ctx, 0.022, 6000, 0.28));
    this.drums.set('snare', noiseHit(ctx, 0.1, 1800, 0.45));
    this.drums.set('doum', membrane(ctx, 120, 70, 0.25, 0.05, 0.02, 0.95));
    this.drums.set('tek', membrane(ctx, 900, 700, 0.03, 0.5, 0.012, 0.5));
    this.drums.set('tung', membrane(ctx, 110, 55, 0.3, 0.0, 0.01, 0.8));
    for (const [i, f] of [196, 392, 784].entries()) {
      this.kacapi.push({ f, b: pluck(ctx, f, 1.8, 0.5, 0.75, 11 + i) });
      this.oud.push({ f: f / 2, b: pluck(ctx, f / 2, 1.6, 0.2, 0.35, 41 + i) });
      this.angk.push({ f, b: angklung(ctx, f) });
    }
    this.gong = goong(ctx, 68);
    // Gema ruang: noise yang meluruh 3,2 detik (stereo semu lewat dua kanal berbeda).
    const sr = ctx.sampleRate || SR_DEFAULT;
    const len = Math.floor(sr * 3.2);
    this.impulse = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = this.impulse.getChannelData(c);
      let s = 99 + c * 17;
      for (let i = 0; i < len; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        d[i] = ((s / 4294967296) * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
  }

  private nearest(list: { f: number; b: AudioBuffer }[], freq: number): { b: AudioBuffer; rate: number } {
    let best = list[0]!;
    for (const x of list) if (Math.abs(Math.log(freq / x.f)) < Math.abs(Math.log(freq / best.f))) best = x;
    return { b: best.b, rate: freq / best.f };
  }

  kacapiFor(freq: number): { b: AudioBuffer; rate: number } {
    return this.nearest(this.kacapi, freq);
  }

  oudFor(freq: number): { b: AudioBuffer; rate: number } {
    return this.nearest(this.oud, freq);
  }

  angklungFor(freq: number): { b: AudioBuffer; rate: number } {
    return this.nearest(this.angk, freq);
  }
}

/** Pemutar buffer sekali jalan. */
export function playBuffer(ctx: BaseAudioContext, b: AudioBuffer, dest: AudioNode, t: number, gain: number, rate = 1, pan = 0): void {
  const src = ctx.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  if (pan !== 0 && 'createStereoPanner' in ctx) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(dest);
  } else src.connect(g).connect(dest);
  src.start(t);
  src.onended = () => g.disconnect();
}

/**
 * Suling bambu: sinus + harmonik lembut + napas, luncuran nada dari bawah di awal not (ornamen khas)
 * dan vibrato yang masuk perlahan.
 */
export function suling(ctx: BaseAudioContext, noise: AudioBuffer, dest: AudioNode, t: number, freq: number, dur: number, gain: number, glide = true): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  const start = glide ? freq * Math.pow(2, -140 / 1200) : freq;
  o.frequency.setValueAtTime(start, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
  o2.frequency.setValueAtTime(start * 2, t);
  o2.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.07);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.4;
  const vg = ctx.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(freq * 0.007, t + Math.min(dur, 0.35));
  vib.connect(vg);
  vg.connect(o.frequency);
  const h = ctx.createGain();
  h.gain.value = 0.12;
  o2.connect(h);
  const env = ctx.createGain();
  const end = t + dur;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.045);
  env.gain.setTargetAtTime(gain * 0.82, t + 0.08, 0.2);
  env.gain.setTargetAtTime(0.0001, end, 0.07);
  o.connect(env);
  h.connect(env);
  // Napas: noise sempit di sekitar harmonik kedua.
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 2;
  bp.Q.value = 6;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain * 0.35, t);
  ng.gain.exponentialRampToValueAtTime(gain * 0.06, t + 0.12);
  n.connect(bp).connect(ng).connect(env);
  env.connect(dest);
  const stop = end + 0.4;
  for (const s of [o, o2, vib]) {
    s.start(t);
    s.stop(stop);
  }
  n.start(t, Math.random());
  n.stop(stop);
  o.onended = () => env.disconnect();
}

/** Synth sederhana (pad/bass/lead/supersaw) dengan envelope ADSR & filter lowpass. */
export function synth(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  freq: number,
  dur: number,
  gain: number,
  o: { type?: OscillatorType; detune?: number[]; cutoff?: number; attack?: number; release?: number; glideFrom?: number },
): void {
  const env = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = o.cutoff ?? 2000;
  f.Q.value = 0.7;
  const a = o.attack ?? 0.01;
  const r = o.release ?? 0.15;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + a);
  env.gain.setValueAtTime(gain, t + Math.max(a, dur));
  env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + r);
  f.connect(env).connect(dest);
  const det = o.detune ?? [0];
  let first: OscillatorNode | null = null;
  for (const d of det) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sawtooth';
    osc.detune.value = d;
    if (o.glideFrom) {
      osc.frequency.setValueAtTime(o.glideFrom, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    } else osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 1 / det.length;
    osc.connect(g).connect(f);
    osc.start(t);
    osc.stop(t + Math.max(a, dur) + r + 0.05);
    first ??= osc;
  }
  if (first) first.onended = () => env.disconnect();
}
