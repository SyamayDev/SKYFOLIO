/**
 * Biplane PK-ARL: menyatukan rigid body, model terbang, mode darat/air, umpan balik tabrakan, dan visual.
 */
import type RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3, type Material } from 'three';
import { CRASH, FLIGHT, GROUND, RESPAWN, WATER, type AssistLevel } from '../config/flight';
import { FALL_THROUGH_RADIUS, OUT_OF_BOUNDS_RADIUS, PLANET_RADIUS } from '../config/world';
import { bus } from '../core/EventBus';
import type { Input } from '../core/Input';
import type { PhysicsWorld, SyncedBody, SurfaceMaterial, ContactInfo } from '../physics/PhysicsWorld';
import type { RadialGravity } from '../physics/RadialGravity';
import { damp } from '../utils/math';
import { CopilotPiko } from '../characters/CopilotPiko';
import { PilotAril, type CharacterContext } from '../characters/PilotAril';
import { FlightModel, type FlightEnv, type FlightInput } from './FlightModel';
import { GroundMode } from './GroundMode';
import { PlaneModel } from './PlaneModel';
import { createPlaneBody } from './PlaneBody';
import { Canopy } from './Canopy';
import { SpaceFlight } from './SpaceFlight';
import { WaterMode } from './WaterMode';

export interface SpawnPoint {
  position: Vector3;
  rotation: Quaternion;
}

const _up = new Vector3();
const _ub = new Vector3();
const _v = new Vector3();
const _axis = new Vector3();
const _q = new Quaternion();
const _wind = new Vector3();

export class Plane {
  readonly body: RAPIER.RigidBody;
  readonly synced: SyncedBody;
  readonly model: PlaneModel;
  readonly aril: PilotAril;
  readonly piko: CopilotPiko;
  readonly flight = new FlightModel();
  readonly ground: GroundMode;
  readonly water = new WaterMode();
  /** Lapisan langit, kit roket, orbit, masuk atmosfer (docs/03 bagian 8–10). */
  readonly space = new SpaceFlight();
  readonly canopy: Canopy;
  /** Pusat benda langit yang sedang menarik pesawat (Bumi/Bulan) dan radius permukaannya. */
  readonly gravityCenter = new Vector3();
  surfaceRadius = PLANET_RADIUS;
  onMoon = false;
  readonly input: FlightInput = { pitch: 0, roll: 0, yaw: 0, gas: 0, boost: false, brake: false };
  readonly env: FlightEnv = {
    grounded: true,
    inWater: false,
    heightAboveGround: 0,
    assist: 'normal',
    wind: new Vector3(),
  };
  /** Penyedia arah landasan (diisi Experience dari bandara). */
  headingHint: ((pos: Vector3, forward: Vector3, out: Vector3) => Vector3 | null) | null = null;
  private readonly hintVec = new Vector3();
  /** Mesin menyala (setelah naik pesawat). */
  engineRunning = false;
  /** Pesawat dibekukan (layar muat, jeda). */
  frozen = true;

  // Antrean aksi dari frame ke langkah fisika.
  private jumpQueued = false;
  private jumpCooldown = 0;
  private crashCooldown = 0;
  private upsideDownTime = 0;
  private stuckTime = 0;
  /** Sisa waktu proses tegak otomatis (detik). */
  private righting = 0;
  private airborneTime = 0;
  private maxAirHeight = 0;
  private groundedTime = 0;
  private lastVerticalSpeed = 0;
  private wasGrounded = true;
  private wasStalled = false;
  private wasBoosting = false;
  private safeTimer = 0;
  private readonly safePos = new Vector3();
  private readonly safeRot = new Quaternion();
  private hasSafe = false;
  /** Visual baling-baling bengkok (detik tersisa). */
  propBent = 0;
  /** Waktu diam di darat (animasi lambai Aril). */
  idleTime = 0;
  private time = 0;
  private propAngle = 0;
  private readonly charCtx: CharacterContext = {
    dt: 0,
    time: 0,
    airspeed: 0,
    roll: 0,
    pitch: 0,
    grounded: true,
    idleTime: 0,
    boosting: false,
  };

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly gravity: RadialGravity,
    material: Material,
    private readonly getSpawn: () => SpawnPoint,
  ) {
    const spawn = getSpawn();
    this.body = createPlaneBody(physics, spawn.position, spawn.rotation);
    gravity.add(this.body);
    this.model = new PlaneModel();
    this.aril = new PilotAril(material);
    this.piko = new CopilotPiko(material);
    this.model.pilotSeat.add(this.aril.root);
    this.model.copilotSeat.add(this.piko.root);
    this.canopy = new Canopy(
      material,
      this.model.pilotSeat.position.clone().add(new Vector3(0, 0.56, 0.02)),
      this.model.copilotSeat.position.clone().add(new Vector3(0, 0.5, 0.02)),
    );
    this.model.root.add(this.canopy.group);
    this.synced = physics.addSynced(this.body, this.model.root);
    this.ground = new GroundMode(physics);

    // Umpan balik tabrakan: semua collider pesawat melapor ke sini.
    for (let i = 0; i < this.body.numColliders(); i++) {
      const c = this.body.collider(i);
      physics.setInfo(c, { kind: 'plane', material: 'metal', onContact: (e) => this.onContact(e) });
    }
    this.synced.snap();
    this.synced.apply(1);
  }

  /** Bekukan pesawat (layar muat): body dinonaktifkan supaya gravitasi tidak menariknya. */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    this.body.setEnabled(!frozen);
    if (!frozen) {
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.body.wakeUp();
      this.synced.snap();
    }
  }

  /** Baca input per frame (aksi tekan-sekali diantre untuk langkah fisika berikutnya). */
  readInput(input: Input, assist: AssistLevel): void {
    this.env.assist = assist;
    if (this.frozen) {
      this.input.pitch = this.input.roll = this.input.yaw = this.input.gas = 0;
      this.input.boost = this.input.brake = false;
      return;
    }
    this.input.pitch = input.pitch;
    this.input.roll = input.roll;
    this.input.yaw = input.yaw;
    this.input.gas = input.forwardPush;
    this.input.boost = input.isDown('boost');
    this.input.brake = input.isDown('brake');
    if (input.wasPressed('jump')) this.jumpQueued = true;
    if (input.wasPressed('horn')) {
      bus.emit('plane:horn', {});
    }
  }

  /** Perintah autopilot menimpa input pemain (memakai jalur input yang sama → fisika jujur). */
  applyCommand(cmd: { pitch: number; roll: number; gas: number; boost: boolean }): void {
    if (this.frozen) return;
    this.input.pitch = cmd.pitch;
    this.input.roll = cmd.roll;
    this.input.yaw = 0;
    this.input.gas = cmd.gas;
    this.input.boost = cmd.boost;
    this.input.brake = false;
  }

  setWind(w: Vector3): void {
    _wind.copy(w);
  }

  /** Langkah fisika (sebelum world.step). */
  preStep(dt: number): void {
    this.time += dt;
    if (this.frozen) return;
    const b = this.body;
    // Rem parkir otomatis: pesawat diam di landasan sampai pemain menekan gas.
    const parking = this.input.gas < 0.05 && !this.input.boost && this.flight.state.speed < 3;
    {
      const t = b.translation();
      _v.set(t.x, t.y, t.z);
      this.surfaceRadius = this.gravity.centerFor(_v, this.gravityCenter);
      this.onMoon = this.surfaceRadius !== PLANET_RADIUS;
      this.ground.center.copy(this.gravityCenter);
      this.ground.gScale = this.onMoon ? FLIGHT.G0_MOON / FLIGHT.G0 : 1;
    }
    this.ground.step(b, this.input.brake, dt, parking);
    this.water.step(b, dt);
    this.env.grounded = this.ground.grounded;
    this.env.inWater = this.water.inWater && !this.ground.grounded;
    // Tinggi di atas permukaan: tanah (raycast) atau air (permukaan laut), mana yang lebih dekat.
    this.env.heightAboveGround = Math.min(this.ground.heightAboveGround, Math.max(0, this.altitude));
    this.space.preStep(b, this.gravityCenter, this.surfaceRadius, this.ground.grounded, this.env.inWater, this.onMoon);
    this.env.center = this.gravityCenter;
    this.env.surfaceRadius = this.surfaceRadius;
    this.env.aero = this.space.aero;
    this.env.space = this.space.inSpace;
    this.env.wind.copy(_wind).multiplyScalar(this.space.aero);
    if (this.ground.grounded && this.headingHint) {
      const t = b.translation();
      const r = b.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      _v.set(t.x, t.y, t.z);
      _axis.set(0, 0, -1).applyQuaternion(_q);
      this.env.headingHint = this.headingHint(_v, _axis, this.hintVec);
    } else this.env.headingHint = null;
    if (!this.engineRunning) {
      this.input.gas = 0;
      this.input.boost = false;
    }
    if (this.updateRighting(dt)) {
      this.crashCooldown = Math.max(0, this.crashCooldown - dt);
      return;
    }
    this.flight.step(b, this.input, this.env, dt);
    this.space.step(b, this.input, this.env.assist !== 'off', this.gravityCenter, this.surfaceRadius, this.ground.grounded, this.onMoon, dt);

    // Lompat (darat) atau barrel roll (udara).
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    if (this.jumpQueued) {
      this.jumpQueued = false;
      if (this.ground.grounded && this.jumpCooldown <= 0) {
        this.jump();
      } else if (!this.ground.grounded && !this.water.inWater) {
        const dir = this.input.roll < -0.2 ? -1 : 1;
        if (this.flight.startBarrelRoll(dir)) {
          this.upVector(_up);
          b.applyImpulse(_v.copy(_up).multiplyScalar(FLIGHT.BARREL_ROLL_LIFT), true);
          bus.emit('plane:barrelRoll', { dir });
        }
      }
    }

    this.detectStuck(dt);
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    this.propBent = Math.max(0, this.propBent - dt);
  }

  /** Setelah world.step: transisi darat/udara, pendaratan, keamanan. */
  postStep(dt: number): void {
    if (this.frozen) return;
    const s = this.flight.state;
    const grounded = this.ground.grounded;
    if (grounded) {
      this.groundedTime += dt;
      // Pesan pendaratan hanya setelah benar-benar terbang (bukan memantul/melompat kecil).
      if (!this.wasGrounded && this.airborneTime > 1.5 && this.maxAirHeight > 2.5) {
        const vs = this.lastVerticalSpeed;
        const bank = Math.abs(s.bankDeg);
        const smooth = Math.abs(vs) < GROUND.SMOOTH_LANDING_VSPEED && bank < GROUND.SMOOTH_LANDING_BANK_DEG;
        if (smooth || Math.abs(vs) > GROUND.HARD_LANDING_VSPEED) bus.emit('plane:landed', { smooth, verticalSpeed: vs });
        else bus.emit('plane:landed', { smooth: false, verticalSpeed: vs });
      }
      this.airborneTime = 0;
      this.maxAirHeight = 0;
    } else {
      this.airborneTime += dt;
      this.maxAirHeight = Math.max(this.maxAirHeight, Math.min(this.ground.heightAboveGround, 50));
      if (this.wasGrounded && this.groundedTime > 0.8 && s.airspeed > 15) bus.emit('plane:takeoff', {});
      this.groundedTime = 0;
    }
    this.wasGrounded = grounded;
    this.lastVerticalSpeed = s.verticalSpeed;

    if (s.stalled !== this.wasStalled) {
      bus.emit('plane:stall', { active: s.stalled });
      this.wasStalled = s.stalled;
    }
    if (s.boosting !== this.wasBoosting) {
      bus.emit('plane:boost', { active: s.boosting });
      this.wasBoosting = s.boosting;
    }
    if (this.water.entrySpeed > WATER.SPLASH_SPEED) {
      const t = this.body.translation();
      bus.emit('plane:splash', { speed: this.water.entrySpeed, point: { x: t.x, y: t.y, z: t.z } });
    }

    // Diam di darat → Aril melambai.
    if (grounded && s.speed < 0.8) this.idleTime += dt;
    else this.idleTime = 0;

    // Simpan posisi aman tiap 2 detik.
    this.safeTimer += dt;
    if (this.safeTimer > RESPAWN.SAFE_SAVE_INTERVAL) {
      this.safeTimer = 0;
      const upright = this.upVector(_up).dot(this.bodyUp(_ub)) > 0.7;
      if (upright && this.crashCooldown <= 0 && this.altitude > -0.5) {
        const t = this.body.translation();
        const r = this.body.rotation();
        this.safePos.set(t.x, t.y, t.z);
        this.safeRot.set(r.x, r.y, r.z, r.w);
        this.hasSafe = true;
      }
    }

    // Jatuh tembus planet atau keluar sistem → respawn otomatis.
    const t = this.body.translation();
    const rr = Math.hypot(t.x, t.y, t.z);
    if (rr < FALL_THROUGH_RADIUS) this.respawn('fell');
    else if (rr > OUT_OF_BOUNDS_RADIUS) this.respawn('outOfBounds');
  }

  private jump(): void {
    this.jumpCooldown = GROUND.JUMP_COOLDOWN;
    this.upVector(_up);
    this.body.applyImpulse(_v.copy(_up).multiplyScalar(GROUND.JUMP_IMPULSE * FLIGHT.MASS), true);
    // Sedikit hidung naik.
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _axis.set(1, 0, 0).applyQuaternion(_q).multiplyScalar(GROUND.JUMP_PITCH_IMPULSE);
    this.body.applyTorqueImpulse(_axis, true);
    bus.emit('plane:jump', {});
  }

  /**
   * Deteksi terbalik/nyangkut di dekat tanah (docs/03 bagian 6): setelah 1,5 detik terbalik
   * (atau 3 detik nyangkut tanpa bergerak), mulai proses tegak otomatis.
   */
  private detectStuck(dt: number): void {
    const s = this.flight.state;
    const nearGround = this.ground.heightAboveGround < 3 || this.altitude < 1.5;
    const tilt = this.bodyUp(_ub).dot(this.upVector(_up));
    const upsideDown = tilt < 0.25 && nearGround && s.speed < 5 && !this.water.inWater;
    const stuck = !this.ground.grounded && s.speed < 1.2 && nearGround && !this.water.inWater;
    this.upsideDownTime = upsideDown ? this.upsideDownTime + dt : 0;
    this.stuckTime = stuck ? this.stuckTime + dt : 0;
    if (this.upsideDownTime > CRASH.AUTO_RIGHT_DELAY || this.stuckTime > CRASH.AUTO_RIGHT_DELAY * 2) {
      this.righting = CRASH.AUTO_RIGHT_DURATION;
      this.upsideDownTime = this.stuckTime = 0;
    }
  }

  /**
   * Proses tegak otomatis: pesawat diangkat pelan lalu diputar kembali tegak (mesin dipotong sementara).
   * Mengembalikan true selama proses berjalan.
   */
  private updateRighting(dt: number): boolean {
    if (this.righting <= 0) return false;
    this.righting -= dt;
    const ub = this.bodyUp(_ub);
    const up = this.upVector(_up);
    _axis.crossVectors(ub, up);
    const sinA = _axis.length();
    const angle = Math.atan2(sinA, ub.dot(up));
    if (sinA > 1e-4) _axis.divideScalar(sinA);
    else {
      // Terbalik sempurna: putar di sumbu depan pesawat.
      const r = this.body.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      _axis.set(0, 0, -1).applyQuaternion(_q);
    }
    const rate = Math.min(angle, 1.4) * CRASH.AUTO_RIGHT_RATE;
    this.body.setAngvel({ x: _axis.x * rate, y: _axis.y * rate, z: _axis.z * rate }, true);
    // Melayang pelan ke atas, kecepatan mendatar diredam.
    const lv = this.body.linvel();
    _v.set(lv.x, lv.y, lv.z);
    const vUp = _v.dot(up);
    _v.addScaledVector(up, -vUp).multiplyScalar(0.85);
    const lift = this.ground.heightAboveGround < 2.2 ? CRASH.AUTO_RIGHT_LIFT : 0.4;
    _v.addScaledVector(up, lift);
    this.body.setLinvel(_v, true);
    if (angle < 0.12 || this.righting <= 0) {
      this.righting = 0;
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bus.emit('plane:upright', {});
    }
    return true;
  }

  private onContact(e: ContactInfo): void {
    if (this.frozen) return;
    const speed = e.impactSpeed;
    if (speed < CRASH.MIN_SPEED || this.crashCooldown > 0) return;
    // Benda ringan (props) tidak dihitung sebagai tabrakan keras bagi pesawat.
    const isProp = e.otherInfo?.kind === 'prop';
    const [t1, t2, t3] = CRASH.TIER_SPEEDS;
    let tier: 0 | 1 | 2 | 3 = speed < t1 ? 0 : speed < t2 ? 1 : speed < t3 ? 2 : 3;
    if (isProp && tier > 1) tier = 1;
    this.crashCooldown = CRASH.COOLDOWN;
    const material: SurfaceMaterial = e.otherInfo?.material ?? 'grass';
    if (tier >= 3) this.propBent = CRASH.PROP_BENT_DURATION;
    if (tier >= 1) this.piko.bonk(tier);
    bus.emit('plane:crash', { tier, speed, point: { x: e.point.x, y: e.point.y, z: e.point.z }, material });
  }

  /** Respawn ke landasan (atau posisi aman terakhir bila jatuh tembus). */
  respawn(reason: 'manual' | 'fell' | 'outOfBounds' = 'manual'): void {
    const spawn = reason === 'fell' && this.hasSafe ? { position: this.safePos, rotation: this.safeRot } : this.getSpawn();
    this.teleport(spawn.position, spawn.rotation);
    bus.emit('plane:respawn', { reason });
  }

  teleport(pos: Vector3, rot: Quaternion, velocity?: Vector3): void {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w }, true);
    this.body.setLinvel(velocity ? { x: velocity.x, y: velocity.y, z: velocity.z } : { x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.flight.reset();
    this.ground.reset();
    this.space.reset();
    this.upsideDownTime = this.stuckTime = 0;
    this.righting = 0;
    this.airborneTime = 0;
    this.groundedTime = 0;
    this.wasGrounded = !velocity;
    this.propBent = 0;
    this.synced.snap();
  }

  /** Animasi visual per frame. */
  animate(dt: number, nightLights: boolean): void {
    const s = this.flight.state;
    this.ground.animate(dt);
    // Baling-baling: idle pelan saat mesin hidup, cepat saat gas.
    const target = this.engineRunning ? 14 + s.throttle * 60 + s.airspeed * 0.25 : 0;
    this.propAngle = damp(this.propAngle, target, 2.5, dt);
    this.model.animate(dt, this.propAngle, this.input, this.propBent > 0 ? 1 : 0, nightLights, this.time);
    this.model.setSpaceFx(this.space.rocket, this.space.thrust, this.space.heat);
    // Roda: kaki memendek sesuai kompresi, roda berputar.
    this.ground.wheels.forEach((w, i) => {
      const vis = this.model.wheels[i];
      if (!vis) return;
      vis.leg.position.y = vis.restY + w.compression * 0.9;
      vis.wheel.rotation.x = -w.spin;
    });
    const c = this.charCtx;
    c.dt = dt;
    c.time = this.time;
    c.airspeed = s.airspeed;
    c.roll = this.input.roll;
    c.pitch = this.input.pitch;
    c.grounded = this.ground.grounded;
    c.idleTime = this.idleTime;
    c.boosting = s.boosting;
    this.aril.update(c);
    this.piko.update(c);
  }

  // --- Info -----------------------------------------------------------------------------------

  get position(): Vector3 {
    return this.synced.object!.position;
  }

  get quaternion(): Quaternion {
    return this.synced.object!.quaternion;
  }

  /** Ketinggian di atas permukaan benda langit terdekat (Bumi atau Bulan) — untuk HUD. */
  get surfaceAltitude(): number {
    const t = this.body.translation();
    return Math.hypot(t.x - this.gravityCenter.x, t.y - this.gravityCenter.y, t.z - this.gravityCenter.z) - this.surfaceRadius;
  }

  get altitude(): number {
    const t = this.body.translation();
    return Math.hypot(t.x, t.y, t.z) - PLANET_RADIUS;
  }

  /** "Atas" lokal: menjauhi pusat benda langit yang menarik (Bumi, atau Bulan saat di dekatnya). */
  upVector(out: Vector3): Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z).sub(this.gravityCenter).normalize();
  }

  bodyUp(out: Vector3): Vector3 {
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return out.set(0, 1, 0).applyQuaternion(_q);
  }

  velocity(out: Vector3): Vector3 {
    const v = this.body.linvel();
    return out.set(v.x, v.y, v.z);
  }

  /** Mengembalikan bank pesawat dalam derajat. */
  get bankDeg(): number {
    return this.flight.state.bankDeg;
  }

  dispose(): void {
    this.gravity.remove(this.body);
    this.physics.removeSynced(this.synced);
    this.physics.world.removeRigidBody(this.body);
    this.model.dispose();
  }
}
