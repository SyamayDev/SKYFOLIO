/**
 * Arsitektur audio (docs/05 bagian 1), versi Fase 0:
 * satu AudioContext, bus per kanal dengan slider di Pengaturan, dibuka saat ketukan pertama
 * (tombol "Naik Pesawat") supaya iOS mengizinkan. Musik dan sampel CC0 menyusul di Fase 2.
 */
import { AUDIO_BUSES, type AudioBus } from '../config/audio';
import { settings, type Settings } from '../core/Settings';
import { EngineSynth } from './EngineSynth';
import { Sfx } from './Sfx';

export class AudioManager {
  ctx: AudioContext | null = null;
  private readonly buses = new Map<AudioBus, GainNode>();
  engine: EngineSynth | null = null;
  sfx: Sfx | null = null;
  private noise: AudioBuffer | null = null;
  private unsub: (() => void) | null = null;
  private hiddenHandler = (): void => this.onVisibility();
  muted = false;

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
    // Kompresor ringan supaya tabrakan besar tidak pecah.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    this.buses.set('master', master);
    for (const b of AUDIO_BUSES) {
      if (b === 'master') continue;
      const g = ctx.createGain();
      g.connect(master);
      this.buses.set(b, g);
    }
    this.noise = makeNoise(ctx, 2);
    this.engine = new EngineSynth(ctx, this.bus('engine'), this.bus('wind'), this.bus('sfx'), this.noise);
    this.sfx = new Sfx(ctx, this.bus('sfx'), this.bus('ui'), this.noise);
    this.unsub = settings.subscribe((s) => this.applyVolumes(s));
    document.addEventListener('visibilitychange', this.hiddenHandler);
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  }

  bus(name: AudioBus): GainNode {
    const b = this.buses.get(name);
    if (!b) throw new Error(`Bus audio ${name} belum ada`);
    return b;
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
