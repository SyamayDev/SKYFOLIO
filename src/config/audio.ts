/** Angka tuning audio Fase 0 (bunyi sintetis sementara; musik dan sampel datang di Fase 2). */

export type AudioBus = 'master' | 'music' | 'engine' | 'wind' | 'sfx' | 'ambient' | 'voice' | 'ui';
export const AUDIO_BUSES: AudioBus[] = ['master', 'music', 'engine', 'wind', 'sfx', 'ambient', 'voice', 'ui'];

export const AUDIO = {
  /** Variasi pitch acak untuk setiap SFX (±6%, docs/05). */
  PITCH_JITTER: 0.06,
  ENGINE_RPM_IDLE: 650,
  ENGINE_RPM_MAX: 2500,
  ENGINE_CYLINDERS: 7,
  ENGINE_BASE_GAIN: 0.22,
  WIND_MAX_GAIN: 0.32,
  WIND_SPEED_REF: 70,
  MAX_VOICES: 24,
};

/**
 * Tangga nada (cent dari nada dasar) — disiapkan untuk mesin musik Fase 2.
 * Perkiraan awal, bukan ukuran baku (docs/05 bagian 4.2).
 */
export const SCALES_CENTS = {
  salendro: [0, 240, 480, 720, 960],
  pelog: [0, 120, 270, 540, 670, 785, 950],
  majorPentatonic: [0, 200, 400, 700, 900],
};
