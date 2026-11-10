/**
 * Mesin musik prosedural "Syamay FM" (docs/05 bagian 4).
 * - Penjadwal lookahead (setInterval 25 ms, jadwal 150 ms ke depan) di atas jam AudioContext → tanpa klik.
 * - Tema = frasa original + variasi generatif (ornamen, geseran ritme, tanya-jawab, ganti instrumen).
 * - Lapisan: dasar (pad + goong + bass), ritme (kendang + drum), melodi, ornamen — naik turun mengikuti intensitas.
 * - Ganti tema hanya di batas birama dengan crossfade 1 birama. Stinger untuk stempel, achievement, dll.
 * - Radio easter egg (Funkot/Timur/Gurun/Energi FM): gaya berbeda, melodi digenerasi aturan (original).
 */
import { mulberry32, type Rng } from '../../utils/rng';
import { InstrumentBank, playBuffer, suling, synth, type DrumHit } from './instruments';
import { THEMES, degreeFreq, parsePhrase, type Note, type ScaleName, type Theme, type ThemeId } from './themes';

export type StationId = 'syamay' | 'funkot' | 'timur' | 'gurun' | 'energi';
export const STATIONS: StationId[] = ['syamay', 'funkot', 'timur', 'gurun', 'energi'];
/** Nilai stasiun dari Pengaturan (termasuk format lama "syamay-fm") → id stasiun yang valid. */
export function toStation(v: string | null | undefined): StationId {
  const id = (v ?? '').toLowerCase().replace(/-fm$/, '');
  return (STATIONS as string[]).includes(id) ? (id as StationId) : 'syamay';
}
export type Layer = 'base' | 'rhythm' | 'melody' | 'ornament';
export const LAYERS: Layer[] = ['base', 'rhythm', 'melody', 'ornament'];
export type StingerId = 'stamp' | 'achievement' | 'landing' | 'zone' | 'moon';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const POP_CHORDS = [
  [0, 4, 7],
  [-3, 0, 4],
  [5, 9, 12],
  [7, 11, 14],
];
const POP_BASS = [0, -3, -7, -5];
const B_ORDER = [2, 0, 3, 0];
const DRUM_CHAR: Record<string, DrumHit> = { D: 'dung', T: 'tak', K: 'ket', P: 'pak' };

const semi = (root: number, s: number): number => root * Math.pow(2, s / 12);

/** Motif original berbasis aturan: gerak melangkah, lompatan sesekali, berakhir di nada dasar. */
export function genMotif(rng: Rng, eighths: number, restiness: number): Note[] {
  const notes: Note[] = [];
  let deg = rng() < 0.5 ? 0 : 2;
  let i = 0;
  while (i < eighths) {
    const last = i >= eighths - 4;
    if (!last && rng() < restiness) {
      i++;
      continue;
    }
    const len = last ? 4 : rng() < 0.7 ? 1 : 2;
    if (last) deg = rng() < 0.7 ? 0 : 5;
    else {
      const leap = rng() < 0.2;
      deg += leap ? (rng() < 0.5 ? -3 : 3) : Math.round((rng() - 0.5) * 3);
      deg = Math.max(-2, Math.min(8, deg));
    }
    notes.push({ step: i * 2, len: len * 2, degree: deg, octave: 0 });
    i += len;
  }
  return notes;
}

abstract class Player {
  readonly out: GainNode;
  readonly send: GainNode;
  readonly layers = new Map<Layer, GainNode>();
  step = 0;
  nextTime = 0;
  stopped = false;
  protected readonly rng: Rng;

  constructor(
    protected readonly eng: MusicEngine,
    readonly bpm: number,
    reverb: number,
    startAt: number,
    seed: number,
  ) {
    const ctx = eng.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(eng.out);
    this.send = ctx.createGain();
    this.send.gain.value = reverb;
    this.out.connect(this.send).connect(eng.reverbIn);
    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.layers.set(l, g);
    }
    this.nextTime = startAt;
    this.rng = mulberry32(seed);
  }

  get stepDur(): number {
    return 60 / this.bpm / 4;
  }

  fadeTo(v: number, seconds: number): void {
    const t = Math.max(this.eng.ctx.currentTime, this.nextTime - 0.01);
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(Math.max(0.0001, v), t, seconds / 3);
  }

  layerGain(l: Layer, v: number): void {
    const g = this.layers.get(l)!;
    g.gain.setTargetAtTime(this.eng.solo && this.eng.solo !== l ? 0 : this.eng.muted.has(l) ? 0 : v, this.eng.ctx.currentTime, 0.4);
  }

  schedule(until: number): void {
    while (!this.stopped && this.nextTime < until) {
      this.play(this.step, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  dispose(): void {
    this.stopped = true;
    setTimeout(() => this.out.disconnect(), 200);
  }

  abstract play(step: number, t: number): void;
  abstract applyIntensity(x: number): void;
}

/** Pemutar tema Syamay FM. */
class ThemePlayer extends Player {
  private readonly phrases: Note[][];
  private readonly phraseSteps: number;
  private cycle = 0;
  private varied: Note[] = [];
  private answer: Note[] = [];

  constructor(
    eng: MusicEngine,
    readonly theme: Theme,
    startAt: number,
  ) {
    super(eng, theme.bpm, theme.reverb, startAt, theme.bpm * 7 + theme.root);
    const a = parsePhrase(theme.phrases[0]);
    const b = parsePhrase(theme.phrases[1]);
    this.phrases = [a.notes, b.notes];
    this.phraseSteps = a.steps;
  }

  /** Variasi generatif untuk satu putaran frasa (deterministik per putaran). */
  private vary(src: Note[], idx: number): void {
    const rng = mulberry32(this.cycle * 97 + idx * 13 + 5);
    const pass = idx % 2;
    this.varied = src.map((n) => ({ ...n }));
    if (pass === 1) {
      // Geseran ritme: not panjang kadang mundur 1/16 (sinkop).
      for (const n of this.varied) if (n.len >= 4 && rng() < 0.2) {
        n.step += 1;
        n.len -= 1;
      }
    }
    // Tanya-jawab: di ruang kosong akhir birama, kacapi menjawab dengan potongan motif dibalik & turun oktaf.
    this.answer = [];
    for (let bar = 0; bar < 4; bar++) {
      const s0 = bar * 16;
      const inBar = this.varied.filter((n) => n.step >= s0 && n.step < s0 + 16);
      const end = inBar.reduce((m, n) => Math.max(m, n.step + n.len), s0);
      if (s0 + 16 - end >= 6 && inBar.length >= 2 && rng() < 0.75) {
        const tail = inBar.slice(-3).reverse();
        tail.forEach((n, k) => this.answer.push({ step: end + 1 + k * 2, len: 2, degree: n.degree, octave: n.octave - 1 }));
      }
    }
  }

  applyIntensity(x: number): void {
    const t = this.theme;
    const i = Math.max(t.floor, x);
    const sm = (a: number, b: number): number => Math.min(1, Math.max(0, (i - a) / (b - a)));
    this.layerGain('base', 0.9);
    this.layerGain('rhythm', t.kick === 'none' && t.kendang.replace(/\./g, '') === '' ? 0 : sm(0.1, 0.3));
    this.layerGain('melody', sm(0.2, 0.4));
    this.layerGain('ornament', t.busy ? Math.max(0.6, sm(0.55, 0.8)) : sm(0.55, 0.8));
  }

  play(step: number, t: number): void {
    const th = this.theme;
    const ctx = this.eng.ctx;
    const bank = this.eng.bank;
    const L = this.layers;
    const cycleSteps = this.phraseSteps * 4;
    const inCycle = step % cycleSteps;
    if (inCycle === 0 && step > 0) this.cycle++;
    const phraseIdx = Math.floor(inCycle / this.phraseSteps); // 0..3 → A A' B B'
    const ps = inCycle % this.phraseSteps;
    if (ps === 0) this.vary(this.phrases[phraseIdx < 2 ? 0 : 1]!, phraseIdx);
    const bar = Math.floor(ps / 16);
    const sb = step % 16;
    const chordIdx = phraseIdx < 2 ? bar : B_ORDER[bar]!;
    const dur = this.stepDur;

    // --- Dasar: pad/drone tiap birama, goong di awal frasa, bass.
    if (sb === 0) {
      if (th.harmony === 'pop') {
        for (const s of POP_CHORDS[chordIdx]!) synth(ctx, L.get('base')!, t, semi(th.root / 2, s), dur * 15, 0.045, { detune: [-8, 7], cutoff: 900, attack: 0.25, release: 0.6 });
      } else {
        for (const d of [0, 3]) synth(ctx, L.get('base')!, t, degreeFreq(th.root / 2, th.scale, d), dur * 15, 0.04, { type: 'triangle', detune: [-5, 5], cutoff: 1200, attack: 0.4, release: 0.9 });
      }
      if (ps === 0) playBuffer(ctx, bank.gong, L.get('base')!, t, 0.55);
    }
    const bassSteps = th.harmony === 'pop' ? [0, 6, 8, 14] : [0];
    if (bassSteps.includes(sb)) {
      const f = th.harmony === 'pop' ? semi(th.root / 4, POP_BASS[chordIdx]!) : th.root / 4;
      synth(ctx, L.get('base')!, t, f, dur * (th.harmony === 'pop' ? 1.6 : 15), 0.2, { type: 'sine', detune: [0], cutoff: 400, attack: 0.008, release: 0.12 });
    }

    // --- Ritme: kendang + drum modern.
    const k = th.kendang[sb];
    if (k && k !== '.') playBuffer(ctx, bank.drums.get(DRUM_CHAR[k]!)!, L.get('rhythm')!, t, k === 'D' ? 0.55 : 0.4, 1 + (this.rng() - 0.5) * 0.04, k === 'T' ? 0.25 : k === 'K' ? -0.25 : 0);
    if ((th.kick === 'four' && sb % 4 === 0) || (th.kick === 'half' && sb % 8 === 0)) playBuffer(ctx, bank.drums.get('kick')!, L.get('rhythm')!, t, 0.5);
    if (th.clap && (sb === 4 || sb === 12)) playBuffer(ctx, bank.drums.get('clap')!, L.get('rhythm')!, t, 0.22);
    if (th.hats && sb % 2 === 0) playBuffer(ctx, bank.drums.get('hat')!, L.get('rhythm')!, t, sb % 4 === 2 ? 0.16 : 0.08, 1, 0.3);

    // --- Melodi: instrumen utama berganti tiap putaran (suling ↔ kacapi) supaya tidak monoton.
    const lead = this.cycle % 2 === 1 && th.lead === 'suling' ? 'kacapi' : th.lead;
    for (const n of this.varied) {
      if (n.step !== ps) continue;
      const f = degreeFreq(th.root, th.scale, n.degree, n.octave);
      this.leadNote(lead, f, t, n.len * dur, L.get('melody')!);
      // Ornamen: not hiasan (tetangga atas) sebelum not panjang, kadang-kadang.
      if (n.len >= 4 && this.rng() < 0.22 && lead !== 'suling') {
        const g = degreeFreq(th.root, th.scale, n.degree + 1, n.octave);
        const kb = bank.kacapiFor(g);
        playBuffer(ctx, kb.b, L.get('ornament')!, t - dur * 0.5, 0.12, kb.rate);
      }
    }
    for (const n of this.answer) {
      if (n.step !== ps) continue;
      const f = degreeFreq(th.root, th.scale, n.degree, n.octave);
      const kb = bank.kacapiFor(f);
      playBuffer(ctx, kb.b, L.get('melody')!, t, 0.3, kb.rate, -0.3);
    }

    // --- Ornamen: angklung di ketukan lemah + arpeggio kacapi.
    if (sb % 4 === 2) {
      const deg = [0, 2, 4][Math.floor(this.rng() * 3)]!;
      const ab = bank.angklungFor(degreeFreq(th.root, th.scale, deg));
      playBuffer(ctx, ab.b, L.get('ornament')!, t, 0.18, ab.rate, 0.35);
    }
    if (sb % 2 === 1 && (th.busy || this.cycle % 2 === 0)) {
      const deg = [0, 2, 4, 5][(sb >> 1) % 4]!;
      const kb = bank.kacapiFor(degreeFreq(th.root / 2, th.scale, deg));
      playBuffer(ctx, kb.b, L.get('ornament')!, t, 0.1, kb.rate, -0.35);
    }
  }

  private leadNote(lead: Theme['lead'], f: number, t: number, len: number, dest: AudioNode): void {
    const ctx = this.eng.ctx;
    if (lead === 'suling') suling(ctx, this.eng.noise, dest, t, f, len * 0.95, 0.16);
    else if (lead === 'kacapi') {
      const kb = this.eng.bank.kacapiFor(f);
      playBuffer(ctx, kb.b, dest, t, 0.38, kb.rate);
    } else synth(ctx, dest, t, f, Math.min(len, this.stepDur * 2), 0.09, { type: 'square', detune: [-6, 6], cutoff: 2400, attack: 0.005, release: 0.18 });
  }
}

/** Stasiun radio easter egg. */
class StationPlayer extends Player {
  private melody: Note[] = [];
  private readonly root: number;
  private readonly scale: ScaleName;
  private pump: GainNode | null = null;

  constructor(
    eng: MusicEngine,
    readonly station: Exclude<StationId, 'syamay'>,
    startAt: number,
  ) {
    const cfg = { funkot: [176, 0.08], timur: [98, 0.15], gurun: [104, 0.3], energi: [128, 0.2] } as const;
    super(eng, cfg[station][0], cfg[station][1], startAt, station.length * 1013);
    this.root = { funkot: 220, timur: 246.94, gurun: 220, energi: 261.63 }[station];
    this.scale = ({ funkot: 'minorPent', timur: 'majorPent', gurun: 'hijaz', energi: 'majorPent' } as const)[station];
    if (station === 'energi') {
      // Sidechain: pad "memompa" mengikuti kick.
      this.pump = eng.ctx.createGain();
      this.pump.connect(this.layers.get('base')!);
    }
  }

  applyIntensity(): void {
    for (const l of LAYERS) this.layerGain(l, l === 'ornament' ? 0.7 : 0.95);
  }

  play(step: number, t: number): void {
    const ctx = this.eng.ctx;
    const bank = this.eng.bank;
    const L = this.layers;
    const sb = step % 16;
    const bar = Math.floor(step / 16);
    const dur = this.stepDur;
    if (step % 128 === 0) this.melody = genMotif(this.rng, 32, this.station === 'timur' ? 0.35 : this.station === 'gurun' ? 0.15 : 0.25);
    const ps = step % 64;
    const drum = (h: DrumHit, g: number, pan = 0): void => playBuffer(ctx, bank.drums.get(h)!, L.get('rhythm')!, t, g, 1, pan);
    const deg = (d: number, oct = 0): number => degreeFreq(this.root, this.scale, d, oct);

    if (this.station === 'funkot') {
      if (sb % 4 === 0) drum('kick', 0.6);
      if (sb % 4 === 2) synth(ctx, L.get('base')!, t, this.root / 4, dur * 1.5, 0.22, { type: 'sine', glideFrom: this.root / 2, cutoff: 500, release: 0.08 });
      drum('hat', sb % 2 ? 0.07 : 0.12, 0.3);
      if (sb === 4 || sb === 12) drum('snare', 0.3);
      if (bar % 8 === 7 && sb >= 8) drum('snare', 0.12 + (sb - 8) * 0.03);
      if (sb % 2 === 0) {
        const n = this.melody.find((m) => m.step === ps % 64);
        if (n) synth(ctx, L.get('melody')!, t, deg(n.degree, 1), dur * 1.6, 0.07, { type: 'square', detune: [-10, 10], cutoff: 3000, release: 0.1 });
      }
    } else if (this.station === 'timur') {
      if (sb === 8) {
        drum('kick', 0.5);
        drum('tak', 0.3);
      }
      if (sb % 4 === 2) for (const d of [0, 2, 4]) {
        const kb = bank.kacapiFor(deg(d + ((bar % 4) === 2 ? 3 : 0)));
        playBuffer(ctx, kb.b, L.get('ornament')!, t, 0.12, kb.rate, 0.2);
      }
      if ([0, 3, 6, 10, 12].includes(sb)) synth(ctx, L.get('base')!, t, deg([0, 0, 4, 2, 0][[0, 3, 6, 10, 12].indexOf(sb)]!, -2), dur * 2, 0.2, { type: 'sine', cutoff: 500, release: 0.1 });
      drum('hat', sb % 4 === 2 ? 0.1 : 0.04, -0.2);
      const n = this.melody.find((m) => m.step === ps % 64);
      if (n) {
        const kb = bank.kacapiFor(deg(n.degree));
        playBuffer(ctx, kb.b, L.get('melody')!, t, 0.35, kb.rate);
      }
    } else if (this.station === 'gurun') {
      const pat = 'D..T.TD.D.T.T...';
      const c = pat[sb];
      if (c === 'D') drum('doum', 0.55);
      else if (c === 'T') drum('tek', 0.35, 0.2);
      if (sb % 2 === 1) drum('hat', 0.05, -0.3);
      if (sb === 0) for (const d of [0, 4]) synth(ctx, L.get('base')!, t, deg(d, -1), dur * 15, 0.035, { type: 'sawtooth', detune: [-7, 7], cutoff: 700, attack: 0.5, release: 0.8 });
      const n = this.melody.find((m) => m.step === ps % 64);
      if (n) {
        const ob = bank.oudFor(deg(n.degree));
        playBuffer(ctx, ob.b, L.get('melody')!, t, 0.4, ob.rate);
        // Trill khas: not tetangga cepat pada not panjang.
        if (n.len >= 4 && this.rng() < 0.4) {
          const tb = bank.oudFor(deg(n.degree + 1));
          playBuffer(ctx, tb.b, L.get('ornament')!, t + dur, 0.2, tb.rate);
          playBuffer(ctx, ob.b, L.get('ornament')!, t + dur * 2, 0.2, ob.rate);
        }
      }
    } else {
      // Energi FM: 16 birama = groove (0–7), build (8–11), drop (12–15).
      const sec = bar % 16;
      const build = sec >= 8 && sec < 12;
      const drop = sec >= 12;
      if (sb % 4 === 0 && !build) drum('kick', 0.6);
      if (sb % 4 === 2) drum('hat', 0.12, 0.3);
      if (!build && (sb === 4 || sb === 12)) drum('clap', 0.25);
      if (build) {
        const every = sec < 10 ? 4 : sec < 11 ? 2 : 1;
        if (sb % every === 0) drum('snare', 0.1 + (sec - 8 + sb / 16) * 0.06);
      }
      if (this.pump && sb % 4 === 0) {
        this.pump.gain.setValueAtTime(0.25, t);
        this.pump.gain.linearRampToValueAtTime(1, t + dur * 3);
      }
      if (sb === 0) {
        const ch = POP_CHORDS[bar % 4]!;
        for (const s of ch) synth(ctx, this.pump ?? L.get('base')!, t, semi(this.root, s), dur * 15, drop ? 0.05 : 0.03, { type: 'sawtooth', detune: [-14, 0, 14], cutoff: drop ? 3200 : 1100, attack: 0.02, release: 0.3 });
        synth(ctx, L.get('base')!, t, semi(this.root / 4, POP_BASS[bar % 4]!), dur * 15, 0.16, { type: 'sine', cutoff: 300 });
      }
      const n = this.melody.find((m) => m.step === ps % 64);
      if (n && !build) synth(ctx, L.get('melody')!, t, deg(n.degree, 1), dur * 1.2, drop ? 0.09 : 0.06, { type: 'triangle', detune: [-5, 5], cutoff: 4000, release: 0.25 });
    }
  }
}

export class MusicEngine {
  readonly out: GainNode;
  readonly reverbIn: GainNode;
  readonly bank: InstrumentBank;
  private current: Player | null = null;
  private fading: Player[] = [];
  private pending: { kind: 'theme'; id: ThemeId } | { kind: 'station'; id: Exclude<StationId, 'syamay'> } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private intensity = 0.4;
  private themeId: ThemeId = 'preflight';
  station: StationId = 'syamay';
  /** Debug: lapisan yang dibisukan / disolo. */
  readonly muted = new Set<Layer>();
  solo: Layer | null = null;

  constructor(
    readonly ctx: AudioContext,
    dest: AudioNode,
    readonly noise: AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.85;
    this.out.connect(dest);
    this.bank = new InstrumentBank(ctx);
    const conv = ctx.createConvolver();
    conv.buffer = this.bank.impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(conv).connect(wet).connect(dest);
  }

  get theme(): ThemeId {
    return this.themeId;
  }

  start(): void {
    if (this.timer) return;
    if (!this.current) this.current = this.makePlayer(this.station === 'syamay' ? { kind: 'theme', id: this.themeId } : { kind: 'station', id: this.station }, this.ctx.currentTime + 0.1, 1.2);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.current?.fadeTo(0, 0.6);
    const c = this.current;
    setTimeout(() => c?.dispose(), 900);
    this.current = null;
  }

  private makePlayer(p: NonNullable<typeof this.pending>, at: number, fade: number): Player {
    const pl = p.kind === 'theme' ? new ThemePlayer(this, THEMES[p.id], at) : new StationPlayer(this, p.id, at);
    pl.applyIntensity(this.intensity);
    pl.fadeTo(1, fade);
    return pl;
  }

  setTheme(id: ThemeId): void {
    if (id === this.themeId && !this.pending) return;
    this.themeId = id;
    if (this.station === 'syamay') this.pending = { kind: 'theme', id };
  }

  setStation(id: StationId): void {
    if (id === this.station) return;
    this.station = id;
    this.pending = id === 'syamay' ? { kind: 'theme', id: this.themeId } : { kind: 'station', id };
  }

  setIntensity(x: number): void {
    const v = Math.max(0, Math.min(1, x));
    if (Math.abs(v - this.intensity) < 0.03) return;
    this.intensity = v;
    this.current?.applyIntensity(v);
  }

  /** Terapkan ulang mute/solo lapisan (debug). */
  refreshLayers(): void {
    this.current?.applyIntensity(this.intensity);
  }

  /** Motif pendek 1–2 detik di atas musik. */
  stinger(id: StingerId): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const root = 587.33;
    const b = this.bank;
    const dest = this.out;
    const ang = (d: number, dt: number, g = 0.3): void => {
      const a = b.angklungFor(degreeFreq(root, 'majorPent', d));
      playBuffer(ctx, a.b, dest, t + dt, g, a.rate);
    };
    if (id === 'stamp') {
      ang(0, 0);
      ang(4, 0.12);
    } else if (id === 'zone') {
      ang(0, 0, 0.18);
      ang(2, 0.05, 0.18);
      ang(4, 0.1, 0.18);
    } else if (id === 'achievement') {
      [0, 1, 2, 3, 4, 5].forEach((d, i) => {
        const k = b.kacapiFor(degreeFreq(root, 'majorPent', d));
        playBuffer(ctx, k.b, dest, t + i * 0.07, 0.35, k.rate);
      });
      playBuffer(ctx, b.gong, dest, t + 0.45, 0.4);
    } else if (id === 'landing') {
      [2, 3, 4, 5].forEach((d, i) => suling(ctx, this.noise, dest, t + i * 0.11, degreeFreq(root, 'majorPent', d), i === 3 ? 0.6 : 0.1, 0.14, i === 0));
    } else {
      suling(ctx, this.noise, this.reverbIn, t, degreeFreq(root, 'degung', 0), 1.6, 0.12);
    }
  }

  private tick(): void {
    if (this.ctx.state !== 'running' || !this.current) return;
    const until = this.ctx.currentTime + LOOKAHEAD;
    const cur = this.current;
    // Ganti tema/stasiun di batas birama berikutnya, crossfade 1 birama.
    if (this.pending && cur.step % 16 === 0 && cur.nextTime < until) {
      const bar = cur.stepDur * 16;
      const next = this.makePlayer(this.pending, cur.nextTime, bar);
      cur.fadeTo(0, bar);
      this.fading.push(cur);
      const old = cur;
      setTimeout(() => {
        old.dispose();
        this.fading = this.fading.filter((p) => p !== old);
      }, (bar + 0.6) * 1000);
      this.current = next;
      this.pending = null;
    }
    this.current.schedule(until);
    for (const p of this.fading) p.schedule(until);
  }

  dispose(): void {
    this.stop();
    for (const p of this.fading) p.dispose();
    this.out.disconnect();
  }
}
