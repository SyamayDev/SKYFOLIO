/**
 * Experience: akar yang memegang semua sistem (CLAUDE.md bagian 9).
 * Alur: create() memuat semuanya (checklist pra-terbang) → board() saat pengunjung menekan "Naik Pesawat".
 */
import type { Texture} from 'three';
import { Scene, TextureLoader, Vector3, Quaternion } from 'three';
import { AudioManager } from '../audio/AudioManager';
import { CameraRig, type CameraTarget } from '../camera/CameraRig';
import { CAMERA } from '../config/camera';
import { BASE_WIND, HOME, PLANET_RADIUS } from '../config/world';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { RadialGravity } from '../physics/RadialGravity';
import { bearingDirection, headingOf, latLonToVec3 } from '../utils/geo';
import { createToonMaterial } from '../utils/modeling/materials';
import { Atmosphere } from '../world/Atmosphere';
import { Clouds } from '../world/Clouds';
import { Rivers } from '../world/Rivers';
import { Scatter, type TreeHit } from '../world/Scatter';
import { createTerrainMaterial, type TerrainDetail } from '../world/TerrainMaterial';
import { quatFromUpForward } from '../utils/quat';
import { toKmh } from '../utils/format';
import { Feedback } from '../vehicle/CrashFeedback';
import { Plane } from '../vehicle/Plane';
import { Cities } from '../world/Cities';
import { Ocean } from '../world/Ocean';
import { Particles } from '../world/Particles';
import { Planet } from '../world/Planet';
import { Sky } from '../world/Sky';
import { manualDate, sunDirection } from '../world/Sun';
import { HomeAirport } from '../world/Zones/HomeAirport';
import { TutorialController } from '../ui/tutorial';
import { appPhase, fade, hud, isPortrait, paused, preflight } from './AppState';
import { assetUrl, loadEarthAssets } from './Assets';
import { createDebugPanel, isDebugEnabled } from './Debug';
import { bus, type PreflightItemId } from './EventBus';
import { Input } from './Input';
import { FixedStepper } from './Loop';
import { QualityManager } from './QualityManager';
import { Renderer } from './Renderer';
import { reducedMotionActive, settings, updateSettings } from './Settings';
import { Time } from './Time';

const _v = new Vector3();
const _w = new Vector3();
const _hv = new Vector3();

function markLoaded(id: PreflightItemId): void {
  preflight.update((p) => ({ ...p, [id]: true }));
  bus.emit('load:item', { id, done: true });
}

export class Experience {
  readonly scene = new Scene();
  readonly time = new Time();
  stepper = new FixedStepper(1 / 60, 4);
  readonly audio = new AudioManager();
  renderer!: Renderer;
  physics!: PhysicsWorld;
  gravity!: RadialGravity;
  rig!: CameraRig;
  input!: Input;
  quality!: QualityManager;
  planet!: Planet;
  ocean!: Ocean;
  sky!: Sky;
  scatter!: Scatter;
  rivers!: Rivers;
  clouds!: Clouds;
  atmosphere!: Atmosphere;
  private terrainMats = new Map<TerrainDetail, ReturnType<typeof createTerrainMaterial>>();
  private readonly treeHit: TreeHit = { x: 0, y: 0, z: 0, scale: 1, kind: 0 };
  cities!: Cities;
  airport!: HomeAirport;
  plane!: Plane;
  particles!: Particles;
  feedback!: Feedback;
  tutorial!: TutorialController;
  private hudTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 60;
  private hour = 10;
  private readonly wind = new Vector3();
  private readonly camTarget: CameraTarget = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    velocity: new Vector3(),
    speed: 0,
    grounded: true,
    boosting: false,
    cockpitEye: new Vector3(),
  };
  private respawnTimer = -1;
  /** Fisika dibekukan (render tetap jalan). */
  simFrozen = false;
  private readonly unsubs: (() => void)[] = [];
  private running = false;
  boarded = false;

  private constructor(private readonly canvas: HTMLCanvasElement) {}

  static async create(canvas: HTMLCanvasElement): Promise<Experience> {
    const exp = new Experience(canvas);
    await exp.init();
    return exp;
  }

  private async init(): Promise<void> {
    const params = new URLSearchParams(location.search);
    // Mode tes otomatis: simulasi tetap real-time walau fps rendah (renderer software di CI).
    if (params.has('test')) {
      this.stepper = new FixedStepper(1 / 60, 15);
      this.time.maxDelta = 0.25;
    }
    const q = params.get('quality');
    if (q === 'low' || q === 'medium' || q === 'high' || q === 'ultra') updateSettings('graphics', { quality: q });
    const s = settings.get();
    const forceWebGL = params.get('renderer') === 'webgl' || s.graphics.renderer === 'webgl2';
    this.quality = new QualityManager();
    this.renderer = new Renderer({ canvas: this.canvas, forceWebGL, antialias: this.quality.tier !== 'low' });
    const rendererReady = this.renderer.init();

    // Bahan bakar = mesin fisika.
    this.physics = await PhysicsWorld.create();
    this.gravity = new RadialGravity();
    markLoaded('fuel');

    const [assets, coast] = await Promise.all([
      loadEarthAssets(),
      new TextureLoader().loadAsync(assetUrl('earth/coast-distance.png')),
      rendererReady,
    ]);
    const preset = this.quality.preset;
    this.planet = new Planet(assets.earth, assets.meta, this.terrainMaterial(), this.physics);
    this.scene.add(this.planet.group);
    this.rivers = new Rivers(assets.rivers, assets.meta);
    this.scene.add(this.rivers.mesh);
    this.ocean = new Ocean(coast as Texture, preset.oceanDetail);
    this.scene.add(this.ocean.mesh);
    this.scatter = new Scatter(this.planet, this.physics, this.quality.tier);
    this.scene.add(this.scatter.group);
    this.cities = new Cities(assets.buildings, assets.meta.quantRadius, preset.buildings);
    this.scene.add(this.cities.group);
    this.clouds = new Clouds(this.quality.tier);
    this.scene.add(this.clouds.group);
    this.atmosphere = new Atmosphere();
    this.scene.add(this.atmosphere.mesh);
    this.sky = new Sky(this.scene);
    this.sky.setShadow(preset.shadowMapSize, preset.shadowRange);
    this.setHour(s.world.manualTimeOfDay ?? 10);
    markLoaded('map');

    // Bandara: aktifkan collider sekitar bandara dulu supaya penempatan di tanah akurat.
    const propMat = createToonMaterial();
    const airportCenter = latLonToVec3(HOME.lat, HOME.lon, PLANET_RADIUS);
    this.planet.updateColliders(airportCenter);
    this.airport = new HomeAirport(this.physics, this.gravity, propMat, (dir) => this.groundHeight(dir));
    this.scene.add(this.airport.group);
    this.planet.updateColliders(this.airport.spawnPoint().position);
    this.physics.world.step(this.physics.events); // bangun BVH collider

    // Pesawat + karakter.
    this.plane = new Plane(this.physics, this.gravity, propMat, () => this.airport.spawnPoint());
    this.scene.add(this.plane.model.root);
    this.plane.ground.materialAt = (c, f) => this.planet.materialAt(c, f);
    this.plane.headingHint = (pos, fwd, out) => this.airport.runwayHeading(pos, fwd, out);
    this.plane.setFrozen(true);
    markLoaded('propeller');
    markLoaded('copilot');

    this.particles = new Particles(this.scene, 480, preset.particles);
    this.rig = new CameraRig(window.innerWidth / Math.max(1, window.innerHeight), this.physics);
    this.scene.add(this.rig.camera);
    this.input = new Input(this.canvas);
    this.feedback = new Feedback(this.plane, this.particles, this.rig, this.audio);
    this.tutorial = new TutorialController();
    markLoaded('radio');
    // Cuaca nyata Medan datang di Fase 2 → untuk sekarang "cerah".
    markLoaded('weather');

    this.updateCameraTarget();
    this.rig.snap(this.camTarget);
    this.applyQuality();
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.unsubs.push(() => window.removeEventListener('resize', this.onResize));
    this.unsubs.push(
      bus.on('quality:changed', () => this.applyQuality()),
      bus.on('input:device', (e) => this.airport.setDevice(e.device)),
      settings.subscribe((st) => this.rig.setMode(st.camera.mode === 'cockpit' ? 'cockpit' : 'chase')),
      paused.subscribe((p) => {
        if (!p) this.time.resetClock();
      }),
    );
    this.airport.setDevice(this.input.currentDevice);

    // Kompilasi shader di muka supaya terbang pertama tidak tersendat.
    try {
      await this.renderer.three.compileAsync(this.scene, this.rig.camera);
    } catch {
      // Tidak fatal: shader akan dikompilasi saat render pertama.
    }
    hud.patch({ backend: this.renderer.backend, tier: this.quality.tier });
    void createDebugPanel({
      setHour: (h) => this.setHour(h),
      getHour: () => this.hour,
      respawn: () => this.requestRespawn(),
      teleport: (lat, lon, alt, heading, speed) => this.teleport(lat, lon, alt, heading, speed),
      returnLetters: () => this.airport.letters.returnAll(),
    });
    if (isDebugEnabled() || import.meta.env.DEV || params.has('test')) this.exposeTestHooks();
    appPhase.set('ready');
    this.start();
  }

  /** Tinggi medan di bawah arah `dir` (raycast collider), null bila tidak ada. */
  private groundHeight(dir: Vector3): number | null {
    const origin = _v.copy(dir).normalize().multiplyScalar(PLANET_RADIUS + 60);
    const down = _w.copy(dir).normalize().negate();
    const hit = this.physics.castRay(origin, down, 80);
    return hit ? hit.point.length() - PLANET_RADIUS : null;
  }

  setHour(hour: number): void {
    this.hour = hour;
    this.sky.setSunDirection(sunDirection(manualDate(hour)));
  }

  /** Material medan sesuai tier (detail prosedural penuh kecuali tier Low). */
  private terrainMaterial(): ReturnType<typeof createTerrainMaterial> {
    const detail: TerrainDetail = this.quality.tier === 'low' ? 'low' : 'high';
    let m = this.terrainMats.get(detail);
    if (!m) {
      m = createTerrainMaterial(detail);
      this.terrainMats.set(detail, m);
    }
    return m;
  }

  private applyQuality(): void {
    const p = this.quality.preset;
    this.renderer.setPixelRatioCap(p.pixelRatio);
    this.sky.setShadow(p.shadowMapSize, p.shadowRange);
    this.planet.setMaterial(this.terrainMaterial());
    this.scatter.setTier(this.quality.tier);
    this.clouds.setTier(this.quality.tier);
    this.cities.setFraction(p.buildings);
    this.particles.setCapacity(p.particles);
    this.ocean.setDetail(p.oceanDetail);
    this.plane.model.root.traverse((o) => (o.castShadow = p.shadowMapSize > 0 && o.castShadow !== false));
    hud.patch({ tier: this.quality.tier });
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.renderer.resize();
    this.rig.resize(w / h);
    isPortrait.set(h > w);
  };

  /** Pengunjung menekan "Naik Pesawat": buka audio (gestur pengguna), nyalakan mesin. */
  async board(): Promise<void> {
    if (this.boarded) return;
    this.boarded = true;
    await this.audio.unlock();
    this.audio.sfx?.starter();
    this.plane.setFrozen(false);
    setTimeout(() => {
      this.plane.engineRunning = true;
    }, 450);
    appPhase.set('flying');
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.renderer.three.setAnimationLoop((t: number) => this.tick(t));
  }

  private fixedStep = (dt: number): void => {
    this.plane.preStep(dt);
    this.gravity.apply(dt);
    this.physics.step();
    this.plane.postStep(dt);
  };

  private updateCameraTarget(): void {
    const t = this.camTarget;
    t.position.copy(this.plane.position);
    t.quaternion.copy(this.plane.quaternion);
    this.plane.velocity(t.velocity);
    t.speed = t.velocity.length();
    t.grounded = this.plane.ground.grounded;
    t.boosting = this.plane.flight.state.boosting;
    this.plane.model.cockpitEye.getWorldPosition(t.cockpitEye);
  }

  private tick(now: number): void {
    this.time.tick(now);
    const dt = this.time.delta;
    const isPaused = paused.get();
    this.input.update(dt);

    // Aksi global
    if (this.input.wasPressed('pause') && appPhase.get() === 'flying') paused.set(!isPaused);
    if (!isPaused && this.boarded) {
      if (this.input.wasPressed('respawn')) this.requestRespawn();
      if (this.input.wasPressed('camera')) {
        const next = this.rig.mode === 'chase' ? 'cockpit' : 'chase';
        updateSettings('camera', { mode: next });
      }
      if (this.input.wasPressed('mute')) this.audio.toggleMute();
    }

    if (!isPaused) {
      if (!this.simFrozen) this.time.advance(dt);
      const s = settings.get();
      // Angin dasar (arah dari timur laut) di posisi pesawat.
      bearingDirection(this.plane.position, (BASE_WIND.fromBearingDeg + 180) % 360, this.wind).multiplyScalar(BASE_WIND.speed);
      this.plane.setWind(this.wind);
      this.plane.readInput(this.input, s.controls.assistLevel);
      // Simulasi bisa dibekukan (tes/screenshot; dasar Mode Foto) sementara render & kamera tetap jalan.
      const alpha = this.simFrozen ? 1 : this.stepper.advance(dt, this.fixedStep);
      this.physics.interpolate(alpha);

      // Respawn tertunda (fade 0,4 detik).
      if (this.respawnTimer >= 0) {
        this.respawnTimer += dt;
        if (this.respawnTimer >= 0.4 && fade.get() >= 1) {
          this.plane.respawn('manual');
          this.updateCameraTarget();
          this.rig.snap(this.camTarget);
          fade.set(0);
          this.respawnTimer = -1;
        }
      }

      const night = this.sky.sunElevation < 0.05;
      this.plane.animate(dt, night);
      const pos = this.plane.position;
      this.planet.updateColliders(pos);
      this.airport.update(dt, this.time.elapsed, pos, this.wind, night);
      if (this.boarded && this.plane.env.heightAboveGround < 6) {
        const hit = this.scatter.checkBrush(pos, this.time.elapsed, this.treeHit);
        if (hit) {
          const v = this.plane.velocity(_v);
          bus.emit('tree:brush', { point: { x: pos.x, y: pos.y, z: pos.z }, speed: v.length() });
          this.plane.body.setLinvel({ x: v.x * 0.97, y: v.y * 0.97, z: v.z * 0.97 }, true);
        }
      }
      this.feedback.update(dt);
      this.particles.update(dt);
      this.tutorial.update(dt, !this.plane.ground.grounded, this.plane.altitude);

      this.updateCameraTarget();
      const now2 = performance.now() / 1000;
      const look = this.input.consumeLook();
      const sens = this.input.look.source === 'touch' ? CAMERA.ORBIT_SENS_TOUCH : CAMERA.ORBIT_SENS_MOUSE;
      this.rig.look(look.dx, look.dy, sens, now2);
      this.rig.update(
        dt,
        this.camTarget,
        {
          portrait: isPortrait.get(),
          reducedMotion: reducedMotionActive(s),
          shake: s.controls.cameraShake,
          fovBoost: s.camera.fovBoost,
        },
        now2,
      );
      // Mode kokpit: kamera berada di posisi mata Aril, jadi model Aril disembunyikan (Piko tetap ada di belakang).
      this.plane.aril.root.visible = this.rig.mode !== 'cockpit';

      const st = this.plane.flight.state;
      this.audio.engine?.update(
        {
          throttle: st.throttle,
          airspeed: st.airspeed,
          boosting: st.boosting,
          grounded: this.plane.ground.grounded,
          wheelSpeed: this.plane.ground.wheels[0]?.forwardSpeed ?? 0,
          inWater: this.plane.water.inWater,
          buffet: st.buffet,
          running: this.plane.engineRunning,
        },
        dt,
      );
    }

    const camPos = this.rig.camera.position;
    this.planet.updateVisibility(camPos);
    this.scatter.update(dt, this.rig.camera, this.plane.position, this.plane.env.heightAboveGround);
    this.clouds.update(isPaused ? 0 : dt, camPos);
    this.sky.setCloudFog(this.clouds.densityAt(camPos));
    this.sky.update(camPos, this.plane.position);
    this.atmosphere.update(camPos, this.sky.sunDir);
    this.renderer.render(this.scene, this.rig.camera);

    // fps + HUD (±15 Hz)
    this.fpsFrames++;
    this.fpsTime += this.time.rawDelta;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.quality.update(this.time.rawDelta);
    this.hudTimer += dt;
    if (this.hudTimer > 1 / 15) {
      this.hudTimer = 0;
      this.pushHud();
    }
    this.input.endFrame();
  }

  private pushHud(): void {
    const st = this.plane.flight.state;
    const info = this.renderer.info;
    const pos = this.plane.position;
    const fwd = _v.set(0, 0, -1).applyQuaternion(this.plane.quaternion);
    const up = _w.copy(pos).normalize();
    fwd.addScaledVector(up, -fwd.dot(up));
    const heading = fwd.lengthSq() > 1e-6 ? headingOf(pos, fwd.normalize()) : hud.get().heading;
    // Di darat pakai kecepatan mendatar (tanpa getaran suspensi); di udara pakai kecepatan udara.
    const v = this.plane.velocity(_hv);
    const groundSpeed = Math.sqrt(Math.max(0, v.lengthSq() - v.dot(up) ** 2));
    hud.patch({
      speed: toKmh(this.plane.ground.grounded ? (groundSpeed < 0.4 ? 0 : groundSpeed) : st.airspeed),
      // Ketinggian roda di atas permukaan laut (pusat badan ±1,2 unit di atas roda).
      altitude: Math.max(0, this.plane.altitude - 1.2),
      heading,
      verticalSpeed: st.verticalSpeed,
      throttle: st.throttle,
      grounded: this.plane.ground.grounded,
      inWater: this.plane.water.inWater,
      // Peringatan stall hanya saat benar-benar terbang (bukan memantul dekat tanah).
      stalled: st.stalled && this.plane.env.heightAboveGround > 3,
      boosting: st.boosting,
      fps: this.fps,
      drawCalls: info.drawCalls,
      triangles: info.triangles,
      physicsMs: this.physics.lastStepMs,
      tier: this.quality.tier,
    });
  }

  /** Izin sensor gerak (iOS) — dipanggil dari ketukan pengguna di Pengaturan. */
  async requestGyro(): Promise<'granted' | 'denied' | 'unavailable'> {
    const res = await Input.requestGyroPermission();
    if (res === 'granted') this.input.recalibrateGyro();
    return res;
  }

  requestRespawn(): void {
    if (this.respawnTimer >= 0) return;
    this.respawnTimer = 0;
    fade.set(1);
  }

  /** Teleport (debug/tes). */
  teleport(lat: number, lon: number, alt: number, heading: number, speed: number): void {
    const p = latLonToVec3(lat, lon, PLANET_RADIUS + alt);
    const up = p.clone().normalize();
    const fwd = bearingDirection(p, heading);
    const q = quatFromUpForward(up, fwd);
    this.plane.teleport(p, q, fwd.clone().multiplyScalar(speed));
    this.updateCameraTarget();
    this.rig.snap(this.camTarget);
  }

  private exposeTestHooks(): void {
    const w = window as unknown as { __skyfolio?: unknown };
    w.__skyfolio = {
      ready: true,
      board: () => this.board(),
      state: () => {
        const st = this.plane.flight.state;
        const p = this.plane.position;
        return {
          altitude: this.plane.altitude,
          speed: st.speed,
          airspeed: st.airspeed,
          grounded: this.plane.ground.grounded,
          stalled: st.stalled,
          throttle: st.throttle,
          bank: st.bankDeg,
          pitch: st.pitchDeg,
          position: { x: p.x, y: p.y, z: p.z },
          lettersScattered: this.airport.letters.scatteredCount,
          wheels: this.plane.ground.wheels.map((w) => ({ c: w.contact, comp: +w.compression.toFixed(3), load: +w.load.toFixed(2) })),
          hag: this.plane.ground.heightAboveGround,
          ringsPassed: this.airport.rings.rings.filter((r) => r.passed).length,
          backend: this.renderer.backend,
          fps: this.fps,
          tier: this.quality.tier,
        };
      },
      perf: () => ({ fps: this.fps, ...this.renderer.info, physicsMs: this.physics.lastStepMs, scatter: this.scatter.kindCounts }),
      teleport: (lat: number, lon: number, alt: number, heading: number, speed: number) =>
        this.teleport(lat, lon, alt, heading, speed),
      setHour: (h: number) => this.setHour(h),
      /** Pesawat di jalur pendekatan landasan (along negatif = sebelum ambang barat laut). */
      approach: (along: number, height: number, speed: number) => {
        const f = this.airport.frame;
        const p = f.onSurface(along, 0, height);
        const fwd = f.forwardAt(along, 0, new Vector3());
        this.plane.teleport(p, quatFromUpForward(p.clone().normalize(), fwd), fwd.clone().multiplyScalar(speed));
        this.updateCameraTarget();
        this.rig.snap(this.camTarget);
      },
      freeze: (on: boolean) => {
        this.simFrozen = on;
      },
      respawn: () => this.plane.respawn('manual'),
      zoom: (scale: number) => {
        this.rig.distanceScale = scale;
      },
      camera: (mode: 'chase' | 'cockpit') => updateSettings('camera', { mode }),
      orbitCamera: (yaw: number, pitch: number) => this.rig.look(-yaw / CAMERA.ORBIT_SENS_MOUSE, pitch / CAMERA.ORBIT_SENS_MOUSE, CAMERA.ORBIT_SENS_MOUSE, performance.now() / 1000 + 60),
    };
  }

  dispose(): void {
    this.renderer.three.setAnimationLoop(null);
    for (const u of this.unsubs) u();
    this.feedback.dispose();
    this.tutorial.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.plane.dispose();
    this.airport.dispose();
    this.particles.dispose();
    this.scatter.dispose();
    this.rivers.dispose();
    this.clouds.dispose();
    this.atmosphere.dispose();
    for (const m of this.terrainMats.values()) m.dispose();
    this.cities.dispose();
    this.ocean.dispose();
    this.sky.dispose();
    this.planet.dispose();
    this.physics.dispose();
    this.renderer.dispose();
  }
}
