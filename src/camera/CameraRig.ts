/**
 * Kamera (docs/03 bagian 10): pengejar (bawaan) dan kokpit (versi awal), guncangan berbasis trauma.
 * Semua "atas" memakai atas lokal planet → aman di kutub dan saat loop.
 */
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { CAMERA } from '../config/camera';
import { PLANET_RADIUS } from '../config/world';
import { WORLD_ONLY_FILTER, type PhysicsWorld } from '../physics/PhysicsWorld';
import { clamp, damp, dampFactor, smoothDamp, smoothstep } from '../utils/math';
import { wobble } from '../utils/noise';
import { rotateTowards } from '../utils/quat';

export type CameraMode = 'chase' | 'cockpit';

export interface CameraTarget {
  position: Vector3;
  quaternion: Quaternion;
  velocity: Vector3;
  speed: number;
  grounded: boolean;
  boosting: boolean;
  /** Posisi mata kokpit (dunia). */
  cockpitEye: Vector3;
  /** "Atas" lokal (menjauhi Bumi, atau Bulan saat di dekatnya). Bila tidak ada → dari posisi. */
  up?: Vector3;
}

export interface CameraOptions {
  portrait: boolean;
  reducedMotion: boolean;
  shake: boolean;
  fovBoost: boolean;
}

const _f = new Vector3();
const _up = new Vector3();
const _ub = new Vector3();
const _right = new Vector3();
const _dir = new Vector3();
const _desired = new Vector3();
const _look = new Vector3();
const _orig = new Vector3();
const _h = new Vector3();
const _view = new Vector3();
const _camUp = new Vector3();
const _tmp = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();

export class CameraRig {
  /** Pengali jarak kamera pengejar (zoom roda mouse / cubit; juga dipakai tes close-up). */
  distanceScale = 1;
  readonly camera: PerspectiveCamera;
  mode: CameraMode = 'chase';
  /** 0..1, bertambah saat tabrakan, berkurang perlahan. */
  trauma = 0;
  private readonly frameDir = new Vector3(0, 0, -1);
  private readonly frameUp = new Vector3(0, 1, 0);
  private readonly smoothPos = new Vector3();
  private readonly posVel = new Float32Array(3);
  private orbitYaw = 0;
  private orbitPitch = 0;
  private lastLook = -Infinity;
  private fov: number = CAMERA.FOV;
  private time = 0;
  private initialized = false;
  private lastNear: number = CAMERA.NEAR;
  private autoPitch: number = CAMERA.VIEW_PITCH_MIN;
  private readonly lastH = new Vector3(0, 0, -1);
  // Transisi antar mode
  private blend = 1;
  private readonly fromPos = new Vector3();
  private readonly fromQuat = new Quaternion();

  constructor(
    aspect: number,
    private readonly physics: PhysicsWorld,
  ) {
    this.camera = new PerspectiveCamera(CAMERA.FOV, aspect, CAMERA.NEAR, CAMERA.FAR);
    this.camera.name = 'main-camera';
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    this.blend = 0;
    this.mode = mode;
    this.orbitYaw = this.orbitPitch = 0;
  }

  addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /** Geser kamera (piksel). */
  look(dx: number, dy: number, sensitivity: number, now: number): void {
    if (dx === 0 && dy === 0) return;
    this.orbitYaw -= dx * sensitivity;
    this.orbitPitch = clamp(this.orbitPitch + dy * sensitivity, CAMERA.ORBIT_PITCH_MIN, CAMERA.ORBIT_PITCH_MAX);
    this.lastLook = now;
  }

  /** Langsung tempatkan kamera di belakang target (tanpa pegas). */
  snap(t: CameraTarget): void {
    _f.set(0, 0, -1).applyQuaternion(t.quaternion);
    this.frameDir.copy(_f);
    if (t.up) _up.copy(t.up);
    else _up.copy(t.position).normalize();
    this.frameUp.copy(_up);
    this.initialized = false;
  }

  update(dt: number, t: CameraTarget, opts: CameraOptions, now: number): void {
    this.time += dt;
    const cam = this.camera;
    // Kembali otomatis ke belakang pesawat setelah 2 detik tanpa geser.
    if (now - this.lastLook > CAMERA.ORBIT_RETURN_DELAY) {
      const k = dampFactor(CAMERA.ORBIT_RETURN_RATE, dt);
      this.orbitYaw += -this.orbitYaw * k;
      this.orbitPitch += -this.orbitPitch * k;
    }

    if (t.up) _up.copy(t.up);
    else _up.copy(t.position).normalize();
    _f.set(0, 0, -1).applyQuaternion(t.quaternion);
    _ub.set(0, 1, 0).applyQuaternion(t.quaternion);

    if (this.mode === 'cockpit') {
      cam.position.copy(t.cockpitEye);
      // Arah pandang = arah pesawat + geser kepala.
      _q.copy(t.quaternion);
      cam.quaternion.copy(_q);
      cam.rotateY(this.orbitYaw);
      // Sedikit menunduk sesuai turunnya horizon (planet kecil), supaya Bumi tetap terlihat di bawah sayap.
      const rr = t.position.length();
      const dipK = Math.acos(clamp(PLANET_RADIUS / Math.max(PLANET_RADIUS, rr), -1, 1));
      cam.rotateX(-this.orbitPitch * 0.6 - Math.min(0.5, dipK * 0.7));
      this.fov = damp(this.fov, CAMERA.COCKPIT_FOV + (opts.portrait ? CAMERA.FOV_PORTRAIT_EXTRA : 0), CAMERA.FOV_RATE, dt);
      cam.near = 0.04;
    } else {
      cam.near = CAMERA.NEAR;
      // Rangka kamera mengejar arah pesawat (pegas rotasi).
      const rate = t.grounded ? CAMERA.FOLLOW_RATE_GROUND : CAMERA.FOLLOW_RATE;
      // Saat di darat/pelan, pakai arah hidung yang diproyeksikan ke bidang tangen supaya kamera tenang.
      _dir.copy(_f);
      if (t.grounded || t.speed < 6) _dir.addScaledVector(_up, -_dir.dot(_up) * 0.85).normalize();
      // Sedikit condong ke arah kecepatan (look-ahead).
      if (t.speed > 4) _dir.addScaledVector(_tmp.copy(t.velocity).divideScalar(t.speed), 0.35).normalize();
      if (!this.initialized) {
        this.frameDir.copy(_dir);
        this.frameUp.copy(_up);
      } else {
        rotateTowards(this.frameDir, _dir, dampFactor(rate, dt), this.frameDir);
        this.frameDir.normalize();
      }
      // Atas kamera: atas lokal planet dicampur 30% dengan atas pesawat (ikut miring).
      _camUp.copy(_up).lerp(_ub, CAMERA.ROLL_FOLLOW).normalize();
      this.frameUp.lerp(_camUp, dampFactor(6, dt)).normalize();

      // Jarak: menjauh sedikit saat cepat/boost, saat tinggi, dan saat portrait.
      const r = t.position.length();
      const alt = Math.max(0, r - PLANET_RADIUS);
      let dist = t.grounded ? CAMERA.CHASE_DISTANCE_GROUND : CAMERA.CHASE_DISTANCE;
      dist += Math.max(0, t.speed - 30) * CAMERA.CHASE_SPEED_PULLBACK;
      dist *= 1 + Math.min(CAMERA.ALT_DISTANCE_MAX, alt / CAMERA.ALT_DISTANCE_SCALE);
      if (opts.portrait) dist *= CAMERA.CHASE_DISTANCE_PORTRAIT_MULT;
      if (this.distanceScale !== 1) dist *= this.distanceScale;

      // Arah mendatar (bidang tangen) dari rangka kamera + sudut angguk pesawat.
      _h.copy(this.frameDir).addScaledVector(_up, -this.frameDir.dot(_up));
      if (_h.lengthSq() < 1e-4) _h.copy(this.lastH).addScaledVector(_up, -this.lastH.dot(_up));
      _h.normalize();
      this.lastH.copy(_h);
      const planePitch = Math.asin(clamp(this.frameDir.dot(_up), -1, 1));

      // Kamera "sadar horizon": di planet kecil horizon turun cepat seiring ketinggian (dip = acos(R/r)).
      // Arah pandang menunduk dip + margin, jadi Bumi selalu terlihat dan horizon di sepertiga atas layar.
      const dip = Math.acos(clamp(PLANET_RADIUS / Math.max(PLANET_RADIUS, r), -1, 1));
      const autoTarget = clamp(dip + CAMERA.HORIZON_MARGIN, CAMERA.VIEW_PITCH_MIN, CAMERA.VIEW_PITCH_MAX);
      this.autoPitch = this.initialized ? damp(this.autoPitch, autoTarget, 2.5, dt) : autoTarget;
      const viewDown = clamp(this.autoPitch + this.orbitPitch - planePitch * CAMERA.PITCH_FOLLOW, -0.45, 1.35);

      _right.crossVectors(_h, _up).normalize();
      _view.copy(_h).applyAxisAngle(_up, this.orbitYaw);
      _right.applyAxisAngle(_up, this.orbitYaw);
      _view.applyAxisAngle(_right, -viewDown);
      // Saat loop (hidung hampir tegak), ikuti arah pesawat penuh supaya kamera tidak berbalik mendadak.
      const loopK = smoothstep(0.95, 1.35, Math.abs(planePitch));
      if (loopK > 0) _view.lerp(this.frameDir, loopK).normalize();

      _look.copy(t.position).addScaledVector(_up, CAMERA.LOOK_HEIGHT).addScaledVector(_h, CAMERA.LOOK_AHEAD);
      _desired.copy(_look).addScaledVector(_view, -dist);

      // Anti tembus: raycast dari pesawat ke kamera (medan & bangunan).
      _tmp.copy(_desired).sub(t.position);
      const len = _tmp.length();
      _tmp.divideScalar(len || 1);
      const origin = _orig.copy(t.position).addScaledVector(_up, 0.8);
      const hit = this.physics.castRay(origin, _tmp, len, WORLD_ONLY_FILTER);
      if (hit) _desired.copy(origin).addScaledVector(_tmp, Math.max(1.2, hit.distance - CAMERA.COLLISION_PAD));

      // Pegas posisi kecil (rasa kecepatan) — dibatasi agar tidak tertinggal jauh.
      if (!this.initialized) {
        this.smoothPos.copy(_desired);
        this.posVel.fill(0);
        this.initialized = true;
      } else {
        this.smoothPos.x = smoothDamp(this.smoothPos.x, _desired.x, this.posVel, 0, CAMERA.POS_SMOOTH_TIME, dt);
        this.smoothPos.y = smoothDamp(this.smoothPos.y, _desired.y, this.posVel, 1, CAMERA.POS_SMOOTH_TIME, dt);
        this.smoothPos.z = smoothDamp(this.smoothPos.z, _desired.z, this.posVel, 2, CAMERA.POS_SMOOTH_TIME, dt);
      }
      cam.position.copy(this.smoothPos);
      this.keepAboveSurface(cam.position);

      // Arah pandang: titik sedikit di atas/depan pesawat.
      _look.copy(t.position).addScaledVector(_up, CAMERA.LOOK_HEIGHT).addScaledVector(_h, CAMERA.LOOK_AHEAD);
      _m.lookAt(cam.position, _look, this.frameUp);
      cam.quaternion.setFromRotationMatrix(_m);

      // FOV melebar saat boost (bisa dimatikan; mati juga saat "kurangi gerakan").
      let fovTarget = CAMERA.FOV + (opts.portrait ? CAMERA.FOV_PORTRAIT_EXTRA : 0);
      if (opts.fovBoost && !opts.reducedMotion && t.boosting) fovTarget += CAMERA.FOV_BOOST - CAMERA.FOV;
      this.fov = damp(this.fov, fovTarget, CAMERA.FOV_RATE, dt);
    }

    // Transisi mode yang halus.
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 0.35);
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      cam.position.lerpVectors(this.fromPos, cam.position, k);
      cam.quaternion.slerpQuaternions(this.fromQuat, cam.quaternion, k);
    }

    // Guncangan (trauma²).
    this.trauma = Math.max(0, this.trauma - CAMERA.TRAUMA_DECAY * dt);
    if (opts.shake && !opts.reducedMotion && this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const tt = this.time * CAMERA.SHAKE_FREQ;
      cam.rotateX(wobble(tt, 1.3) * CAMERA.SHAKE_MAX_ANGLE * s);
      cam.rotateY(wobble(tt, 4.1) * CAMERA.SHAKE_MAX_ANGLE * s);
      cam.rotateZ(wobble(tt, 7.7) * CAMERA.SHAKE_MAX_ANGLE * s * 0.7);
    }

    if (Math.abs(cam.fov - this.fov) > 0.01 || cam.near !== this.lastNear) {
      cam.fov = this.fov;
      this.lastNear = cam.near;
      cam.updateProjectionMatrix();
    }
  }

  /** Jaga kamera di atas tanah dan air. */
  private keepAboveSurface(p: Vector3): void {
    _tmp.copy(p).normalize();
    const r = p.length();
    if (r < PLANET_RADIUS + CAMERA.WATER_CLEARANCE) p.copy(_tmp).multiplyScalar(PLANET_RADIUS + CAMERA.WATER_CLEARANCE);
    const down = _right.copy(_tmp).negate();
    const origin = _desired.copy(p).addScaledVector(_tmp, 4);
    const hit = this.physics.castRay(origin, down, 4 + CAMERA.GROUND_CLEARANCE, WORLD_ONLY_FILTER);
    if (hit && hit.distance < 4 + CAMERA.GROUND_CLEARANCE) {
      p.copy(hit.point).addScaledVector(_tmp, CAMERA.GROUND_CLEARANCE);
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
