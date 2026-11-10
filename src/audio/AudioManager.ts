/**
 * Arsitektur audio (docs/05 bagian 1): satu AudioContext, bus per kanal dengan slider di Pengaturan,
 * dibuka saat ketukan pertama (tombol "Naik Pesawat") supaya iOS mengizinkan.
 *
 * Rantai:  engine/wind/sfx/ambient → [filter keadaan] → master → kompresor → speaker
 *          music → [ducking] → master        voice/ui → master
 * Filter keadaan: lowpass sebentar saat di awan/air, kuat di angkasa (hanya kokpit, musik, Piko yang jelas).
 */
import { AUDIO_BUSES, type AudioBus } from '../config/audio';
import { settings, type Settings } from '../core/Settings';
import { EngineSynth } from './EngineSynth';
import { Sfx } from './Sfx';

export interface AudioEnvironment {
  /** 0..1 di dalam awan/kabut. */
  cloud: number;
  inWater: boolean;
  /** 0..1 di angkasa (hampa). */
  space: number;
  /** Kanopi tertutup (suara luar sedikit teredam). */
  canopyClosed: boolean;
}

const WORLD_BUSES: AudioBus[] = ['engine', 'wind', 'sfx', 'ambient'];

export class AudioManager {
  ctx: AudioContext | null = null;
  private readonly buses = new Map<AudioBus, GainNode>();
  engine: EngineSynth | null = null;
  sfx: Sfx | null = null;
  noise: AudioBuffer | null = null;
  private worldFilter: BiquadFilterNode | null = null;
  private musicDuck: GainNode | null = null;
  private ambientDuck: GainNode | null = null;
  private duckUntil = 0;
  private unsub: (() => void) | null = null;
  private hiddenHandler = (): void => this.onVisibility();
  private readonly unlockListeners: (() => void)[] = [];
  muted = false;

  /** Dipanggil saat AudioContext siap (musik, suara Piko, ambient mendaftar di sini). */
  onReady(fn: () => void): void {
    if (this.ctx) fn();
    else this.unlockListeners.push(fn);
  }

  /** Harus dipanggil dari gestur pengguna. Aman dipanggil berkali-kali. */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined);
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const master = ctx.createGain();
    // Kompresor ringan supaya tabrakan besar & guntur tidak pecah.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    this.buses.set('master', master);
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 20000;
    wf.Q.value = 0.5;
    wf.connect(master);
    this.worldFilter = wf;
    this.musicDuck = ctx.createGain();
    this.musicDuck.connect(master);
    this.ambientDuck = ctx.createGain();
    this.ambientDuck.connect(wf);
    for (const b of AUDIO_BUSES) {
      if (b === 'master') continue;
      const g = ctx.createGain();
      if (b === 'music') g.connect(this.musicDuck);
      else if (b === 'ambient') g.connect(this.ambientDuck);
      else if (WORLD_BUSES.includes(b)) g.connect(wf);
      else g.connect(master);
      this.buses.set(b, g);
    }
    this.noise = makeNoise(ctx, 2);
    this.engine = new EngineSynth(ctx, this.bus('engine'), this.bus('wind'), this.bus('sfx'), this.noise);
    this.sfx = new Sfx(ctx, this.bus('sfx'), this.bus('ui'), this.noise);
    this.unsub = settings.subscribe((s) => this.applyVolumes(s));
    document.addEventListener('visibilitychange', this.hiddenHandler);
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    for (const fn of this.unlockListeners.splice(0)) fn();
  }

  bus(name: AudioBus): GainNode {
    const b = this.buses.get(name);
    if (!b) throw new Error(`Bus audio ${name} belum ada`);
    return b;
  }

  /** Ducking (musik −6 dB, ambient −3 dB) untuk momen penting, mis. pesan Bulan. */
  duck(ms: number): void {
    if (!this.ctx || !this.musicDuck || !this.ambientDuck) return;
    const t = this.ctx.currentTime;
    this.duckUntil = Math.max(this.duckUntil, t + ms / 1000);
    this.musicDuck.gain.setTargetAtTime(0.5, t, 0.12);
    this.ambientDuck.gain.setTargetAtTime(0.71, t, 0.12);
  }

  /** Dipanggil tiap frame: filter keadaan & pemulihan ducking. */
  update(env: AudioEnvironment): void {
    const ctx = this.ctx;
    if (!ctx || !this.worldFilter) return;
    const t = ctx.currentTime;
    let cutoff = 20000;
    if (env.canopyClosed) cutoff = 9000;
    if (env.cloud > 0.05) cutoff = Math.min(cutoff, 20000 - env.cloud * 18200);
    if (env.inWater) cutoff = Math.min(cutoff, 900);
    if (env.space > 0) cutoff = Math.min(cutoff, 20000 * Math.pow(350 / 20000, env.space));
    this.worldFilter.frequency.setTargetAtTime(cutoff, t, 0.15);
    if (this.duckUntil && t > this.duckUntil) {
      this.duckUntil = 0;
      this.musicDuck?.gain.setTargetAtTime(1, t, 0.4);
      this.ambientDuck?.gain.setTargetAtTime(1, t, 0.4);
    }
  }

  /** Posisi & arah pendengar (kamera) untuk suara spasial. */
  setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void {
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      const t = this.ctx!.currentTime;
      l.positionX.setTargetAtTime(px, t, 0.02);
      l.positionY.setTargetAtTime(py, t, 0.02);
      l.positionZ.setTargetAtTime(pz, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.setTargetAtTime(ux, t, 0.02);
      l.upY.setTargetAtTime(uy, t, 0.02);
      l.upZ.setTargetAtTime(uz, t, 0.02);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  private applyVolumes(s: Settings): void {
    if (!this.ctx) return;
    const a = s.audio;
    const t = this.ctx.currentTime;
    const set = (b: AudioBus, v: number): void => {
      this.buses.get(b)?.gain.setTargetAtTime(v, t, 0.05);
    };
    set('master', this.muted ? 0 : a.master);
    set('music', a.music);
    set('engine', a.engine);
    set('wind', a.wind);
    set('sfx', a.sfx);
    set('ambient', a.ambient);
    set('voice', a.voice);
    set('ui', a.ui);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.applyVolumes(settings.get());
  }

  private onVisibility(): void {
    if (!this.ctx) return;
    if (document.hidden && settings.get().audio.muteWhenTabHidden) void this.ctx.suspend().catch(() => undefined);
    else if (!document.hidden) void this.ctx.resume().catch(() => undefined);
  }

  dispose(): void {
    this.unsub?.();
    document.removeEventListener('visibilitychange', this.hiddenHandler);
    this.engine?.dispose();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
