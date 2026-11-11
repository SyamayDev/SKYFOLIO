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

/** Skenario terbang otomatis `?autotest=1` (docs/11 bagian 3): rute + batas waktu per kaki (detik). */
export const AUTOTEST = {
  START_DELAY: 1.5,
  LEGS: [
    { dest: 'featured:1', cap: 45 },
    { dest: 'zone:skill-peaks', cap: 45 },
    { dest: 'space', cap: 50 },
    { dest: 'home', cap: 60 },
  ],
  /** Kaki dianggap selesai paling cepat setelah ini (autopilot butuh waktu mengunci tujuan). */
  MIN_LEG: 4,
  /** Kapasitas rekaman waktu frame (±4 menit di 120 fps), dialokasikan sekali. */
  MAX_FRAMES: 32768,
  /**
   * Anggaran docs/11 bagian 1: rata-rata sepanjang rute (`drawCalls`, `triangles`) dan puncak sesaat
   * (`peakDrawCalls`). High/Ultra: puncak pun ≤ 250 (aturan CLAUDE.md). Low/Medium: puncak sesaat terjadi saat
   * masuk atmosfer dari orbit (separuh planet + efek roket terlihat).
   */
  BUDGET: {
    low: { drawCalls: 120, peakDrawCalls: 180, triangles: 300_000 },
    medium: { drawCalls: 180, peakDrawCalls: 220, triangles: 600_000 },
    high: { drawCalls: 250, peakDrawCalls: 250, triangles: 1_000_000 },
    ultra: { drawCalls: 250, peakDrawCalls: 250, triangles: 1_000_000 },
  },
} as const;

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
