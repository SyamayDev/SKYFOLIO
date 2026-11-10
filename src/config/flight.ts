/**
 * Semua angka tuning fisika terbang (docs/03). Objek ini sengaja bisa diubah (bukan `as const`)
 * supaya panel debug (#debug) bisa menyetelnya langsung saat terbang.
 *
 * Catatan penyetelan (lihat docs/decisions.md):
 * - Nilai awal docs/03 bagian 4.6 menghasilkan gaya angkat ±10× berat di kecepatan jelajah, sehingga
 *   pesawat tidak bisa terbang lurus. Luas sayap S diturunkan ke 0,1 dan T_MAX/C_D0 dihitung ulang supaya:
 *   jelajah seimbang di ±36 unit/dtk, boost ±70, stall alami di ±14, dan lepas landas alami di ±20.
 * - Rumus belokan terkoordinasi memakai TURN_G (bukan G0) supaya radius belok bank 45° = 25–45 unit
 *   (syarat uji docs/03). Dengan G0 = 14 radiusnya ±93 unit.
 * - Ada bonus dorongan statis baling-baling (dorongan lebih besar saat pelan, seperti baling-baling asli)
 *   supaya lepas landas cukup dalam ±30 unit landasan.
 */

export type AssistLevel = 'full' | 'normal' | 'off';

export const FLIGHT = {
  // --- Gravitasi
  G0: 14,
  G0_MOON: 3,
  MOON_SOI: 350,

  // --- Badan
  MASS: 1,
  INERTIA_PITCH: 0.55,
  INERTIA_YAW: 0.75,
  INERTIA_ROLL: 0.45,
  CENTER_OF_MASS_Z: -0.3,
  LINEAR_DAMPING: 0.02,
  ANGULAR_DAMPING: 1.5,
  FRICTION: 0.6,
  RESTITUTION: 0.25,

  // --- Gaya
  T_MAX: 6.7,
  BOOST_MULT: 1.9,
  PROP_STATIC_BONUS: 0.6,
  PROP_FADE_SPEED: 30,
  S: 0.1,
  C_L0: 0.2,
  C_LA: 3.2,
  C_L_MAX: 1.4,
  C_D0: 0.04,
  K_I: 0.06,
  AIRBRAKE_CD: 0.09,
  GEAR_CD: 0.004,

  // --- Stall
  ALPHA_STALL_DEG: 16,
  STALL_SPEED: 14,
  STALL_EXIT_MARGIN: 3,
  STALL_LIFT_MULT: 0.45,
  STALL_NOSE_DOWN_RATE: 0.9,

  // --- Kecepatan dan throttle
  CRUISE_SPEED: 36,
  BOOST_SPEED: 70,
  TAKEOFF_SPEED: 22,
  CRUISE_THROTTLE: 0.6,
  AUTO_THROTTLE_GAIN: 3,
  AUTO_THROTTLE_INTEGRAL: 1.2,
  IDLE_THROTTLE: 0.12,
  THROTTLE_SPOOL_RATE: 3,

  // --- Ground effect
  GROUND_EFFECT_HEIGHT: 3,
  GROUND_EFFECT_GAIN: 0.4,

  // --- Kontrol rotasi (pengendali laju sudut)
  K_RATE: 6,
  PITCH_RATE_MAX_DEG: 95,
  ROLL_RATE_MAX_DEG: 170,
  YAW_RATE_MAX_DEG: 40,
  AUTHORITY_MIN: 0.3,
  AUTHORITY_MAX: 1.2,
  WEATHERVANE: 1.1,

  // --- Bantuan arcade (per level)
  ALIGN_FULL: 7,
  ALIGN_NORMAL: 5,
  AUTO_LEVEL_FULL: 3.2,
  AUTO_LEVEL_NORMAL: 2,
  AUTO_LEVEL_PITCH_FULL: 1.2,
  PITCH_HOLD_GAIN: 1.5,
  TURN_G: 37,
  TURN_RATE_MAX_DEG: 80,
  /** Batas angguk aman (Normal/Penuh): maks. sudut naik bergantung kecepatan, bebas di atas ENVELOPE_FREE_SPEED. */
  ENVELOPE_MIN_DEG: 10,
  ENVELOPE_MAX_DEG: 72,
  ENVELOPE_FREE_SPEED: 48,
  GROUND_AVOID_LOOKAHEAD: 1.2,
  GROUND_AVOID_RATE: 1.4,

  // --- Penghalusan input (detik)
  INPUT_TAU_KEYBOARD: 0.08,
  INPUT_TAU_STICK: 0.05,

  // --- Manuver
  BARREL_ROLL_DURATION: 0.7,
  BARREL_ROLL_COOLDOWN: 1,
  BARREL_ROLL_LIFT: 2.5,
};

export const GROUND = {
  REST_LENGTH_MAIN: 0.6,
  REST_LENGTH_TAIL: 0.35,
  WHEEL_RADIUS_MAIN: 0.32,
  WHEEL_RADIUS_TAIL: 0.14,
  K_SPRING: 60,
  C_DAMP: 7,
  MAX_SUSPENSION_FORCE: 60,
  SIDE_GRIP: 10,
  ROLL_RESIST: 0.22,
  BRAKE: 16,
  /** 0 = gesekan di titik kontak (realistis, mudah terjungkal), 1 = di ketinggian pusat massa. */
  FRICTION_LIFT: 0.85,
  STEER_RATE_DEG: 75,
  STEER_FADE_SPEED: 26,
  HEADING_HOLD_GAIN: 2.2,
  GROUND_PITCH_K: 0.9,
  JUMP_IMPULSE: 7.5,
  JUMP_PITCH_IMPULSE: 0.35,
  JUMP_COOLDOWN: 0.8,
  SMOOTH_LANDING_VSPEED: 3,
  SMOOTH_LANDING_BANK_DEG: 14,
  HARD_LANDING_VSPEED: 6,
  /** Pesawat dianggap "di darat" bila roda menyentuh selama minimal ini (detik). */
  AIRBORNE_DEBOUNCE: 0.15,
};

export const WATER = {
  BUOYANCY: 3.2,
  BUOYANCY_DEPTH: 1.2,
  LINEAR_DRAG: 2.4,
  ANGULAR_DRAG: 3,
  UPRIGHT: 4,
  THRUST_MULT: 0.4,
  SPLASH_SPEED: 4,
};

export const CRASH = {
  /** Batas kecepatan tumbukan normal untuk tier 1/2/3 (docs/03 bagian 6). */
  TIER_SPEEDS: [6, 12, 25] as [number, number, number],
  MIN_SPEED: 1.5,
  AUTO_RIGHT_DELAY: 1.5,
  AUTO_RIGHT_RATE: 3.2,
  AUTO_RIGHT_LIFT: 2.2,
  AUTO_RIGHT_DURATION: 1.6,
  PROP_BENT_DURATION: 1.5,
  COOLDOWN: 0.18,
};

export const RESPAWN = {
  FADE: 0.4,
  SAFE_SAVE_INTERVAL: 2,
  /** Spawn: jarak dari tengah landasan (negatif = ujung barat laut). */
  SPAWN_ALONG: -16.5,
};

export const AIR = {
  DENSITY_SCALE: 90,
};

/** Autopilot (docs/03 bagian 12). */
export const AUTOPILOT = {
  APPROACH_AGL: 20,
  CLEARANCE: 9,
  ORBIT_RADIUS: 18,
  /** Sudut miring yang diminta per radian salah arah, dan batas miringnya (radian). */
  BANK_GAIN: 1.1,
  MAX_BANK: 0.6,
  /** Penguat roll terhadap selisih sudut miring. */
  ROLL_GAIN: 2.2,
  /** Tambahan pitch per radian miring (menjaga ketinggian saat belok). */
  TURN_PITCH: 0.35,
  /** Ketinggian jelajah di atas permukaan saat tujuan masih jauh (> CRUISE_DIST unit). */
  CRUISE_AGL: 34,
  CRUISE_DIST: 160,
  ALT_GAIN: 0.07,
  VS_DAMP: 0.06,
  /** Di bawah ketinggian ini (di atas tanah) autopilot tidak berbelok. */
  TURN_MIN_AGL: 6,
  /** Rentang ketinggian untuk membuka batas belok dari 0 ke penuh. */
  TURN_BLEND_AGL: 10,
  /** Input pemain di atas ini membatalkan autopilot. */
  OVERRIDE_DEADZONE: 0.3,
};
