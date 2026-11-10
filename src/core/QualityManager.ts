/**
 * Tier kualitas (docs/04 bagian 9).
 * Auto: tebakan awal dari perangkat, lalu diatur dinamis berdasarkan fps rata-rata.
 * Tidak memakai detect-gpu supaya tidak bergantung CDN eksternal (lihat docs/decisions.md).
 */
import { QUALITY, QUALITY_AUTO, QUALITY_TIERS, type QualityPreset, type QualityTier } from '../config/quality';
import { bus } from './EventBus';
import { settings } from './Settings';

export function isMobileDevice(): boolean {
  try {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const ua = navigator.userAgent;
    return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  } catch {
    return false;
  }
}

export function guessTier(): QualityTier {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobileDevice()) return mem >= 6 && cores >= 8 ? 'medium' : 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return cores >= 4 ? 'high' : 'medium';
}

export class QualityManager {
  tier: QualityTier;
  private auto: boolean;
  private readonly target: number;
  private sampleTime = 0;
  private warmup: number = QUALITY_AUTO.WARMUP;
  private goodTime = 0;
  private cooldown = 0;

  constructor() {
    const q = settings.get().graphics.quality;
    this.auto = q === 'auto';
    this.tier = q === 'auto' ? guessTier() : q;
    this.target = isMobileDevice() ? QUALITY_AUTO.TARGET_FPS_MOBILE : QUALITY_AUTO.TARGET_FPS_DESKTOP;
    settings.subscribe((s) => {
      const nq = s.graphics.quality;
      const wasAuto = this.auto;
      this.auto = nq === 'auto';
      if (nq !== 'auto' && nq !== this.tier) this.setTier(nq);
      if (this.auto && !wasAuto) {
        this.warmup = 2;
        this.ringPos = 0;
      }
    });
  }

  get preset(): QualityPreset {
    return QUALITY[this.tier];
  }

  setTier(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.ringPos = 0;
    this.frames = 0;
    this.sampleTime = 0;
    this.goodTime = 0;
    this.cooldown = 3;
    bus.emit('quality:changed', { tier });
  }

  /** Dipanggil tiap frame dengan delta mentah. */
  update(rawDt: number): void {
    if (!this.auto || rawDt <= 0) return;
    if (this.warmup > 0) {
      this.warmup -= rawDt;
      return;
    }
    if (this.cooldown > 0) {
      this.cooldown -= rawDt;
      return;
    }
    // Rata-rata per 0,5 detik, disimpan di ring buffer (tanpa alokasi per frame).
    this.sampleTime += rawDt;
    this.frames++;
    if (this.sampleTime < 0.5) return;
    const fps = this.frames / this.sampleTime;
    this.frames = 0;
    this.sampleTime = 0;
    this.ring[this.ringPos % this.ring.length] = fps;
    this.ringPos++;
    const downN = Math.round(QUALITY_AUTO.DOWN_WINDOW / 0.5);
    if (this.ringPos < downN) return;
    let sum = 0;
    for (let i = 1; i <= downN; i++) sum += this.ring[(this.ringPos - i) % this.ring.length]!;
    const avg = sum / downN;
    const idx = QUALITY_TIERS.indexOf(this.tier);
    if (avg < this.target - QUALITY_AUTO.DOWN_MARGIN && idx > 0) {
      this.setTier(QUALITY_TIERS[idx - 1]!);
      return;
    }
    if (avg > this.target + QUALITY_AUTO.UP_MARGIN) this.goodTime += 0.5;
    else this.goodTime = 0;
    if (this.goodTime >= QUALITY_AUTO.UP_WINDOW && idx < QUALITY_TIERS.length - 1) {
      this.setTier(QUALITY_TIERS[idx + 1]!);
    }
  }

  private frames = 0;
  private readonly ring = new Float32Array(32);
  private ringPos = 0;
}
