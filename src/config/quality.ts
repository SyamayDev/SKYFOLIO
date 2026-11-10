/** Tier kualitas grafis (docs/04 bagian 9, docs/11). */

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export type QualitySetting = QualityTier | 'auto';

export const QUALITY_TIERS: QualityTier[] = ['low', 'medium', 'high', 'ultra'];

export interface QualityPreset {
  pixelRatio: number;
  /** 0 = mati (pakai bayangan gumpal/blob). */
  shadowMapSize: number;
  shadowRange: number;
  buildings: number;
  particles: number;
  oceanDetail: number;
  /** Jarak (unit) chunk planet masih dirender detail penuh. */
  drawDistance: number;
}

export const QUALITY: Record<QualityTier, QualityPreset> = {
  low: {
    pixelRatio: 1,
    shadowMapSize: 0,
    shadowRange: 0,
    buildings: 0.5,
    particles: 120,
    oceanDetail: 4,
    drawDistance: 900,
  },
  medium: {
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    shadowRange: 22,
    buildings: 0.8,
    particles: 200,
    oceanDetail: 5,
    drawDistance: 1400,
  },
  high: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    shadowRange: 34,
    buildings: 1,
    particles: 320,
    oceanDetail: 5,
    drawDistance: 2400,
  },
  ultra: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    shadowRange: 50,
    buildings: 1,
    particles: 420,
    oceanDetail: 6,
    drawDistance: 3500,
  },
};

export const QUALITY_AUTO = {
  /** Rata-rata fps diukur dalam jendela ini (detik). */
  DOWN_WINDOW: 3,
  UP_WINDOW: 10,
  DOWN_MARGIN: 5,
  UP_MARGIN: 15,
  /** Abaikan beberapa detik pertama (kompilasi shader). */
  WARMUP: 4,
  TARGET_FPS_DESKTOP: 60,
  TARGET_FPS_MOBILE: 30,
};
