/** Angka tuning kamera (docs/03 bagian 10). Bisa diubah dari panel debug. */
export const CAMERA = {
  NEAR: 0.1,
  FAR: 7000,
  FOV: 60,
  FOV_BOOST: 72,
  FOV_PORTRAIT_EXTRA: 14,
  FOV_RATE: 3,

  CHASE_DISTANCE: 9.5,
  CHASE_HEIGHT: 2.7,
  CHASE_DISTANCE_PORTRAIT_MULT: 1.3,
  CHASE_DISTANCE_GROUND: 8,
  CHASE_SPEED_PULLBACK: 0.06,
  LOOK_AHEAD: 5,
  LOOK_HEIGHT: 1.1,
  /** Kamera ikut miring sebagian dari roll pesawat. */
  ROLL_FOLLOW: 0.3,
  /** Kecepatan rangka kamera mengejar arah pesawat (1/dtk). */
  FOLLOW_RATE: 5.5,
  FOLLOW_RATE_GROUND: 7,
  /** Kelambatan posisi kecil supaya ada rasa kecepatan saat boost. */
  POS_SMOOTH_TIME: 0.06,

  GROUND_CLEARANCE: 1.5,
  WATER_CLEARANCE: 0.8,
  COLLISION_PAD: 0.45,

  ORBIT_RETURN_DELAY: 2,
  ORBIT_RETURN_RATE: 2.2,
  ORBIT_SENS_MOUSE: 0.006,
  ORBIT_SENS_TOUCH: 0.009,
  ORBIT_PITCH_MIN: -0.5,
  ORBIT_PITCH_MAX: 1.25,

  TRAUMA_DECAY: 1.0,
  SHAKE_MAX_ANGLE: 0.07,
  SHAKE_MAX_OFFSET: 0.35,
  SHAKE_FREQ: 23,

  SPEED_LINES_SPEED: 55,

  COCKPIT_FOV: 72,
};
