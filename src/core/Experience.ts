/**
 * Experience: akar yang memegang semua sistem (CLAUDE.md bagian 9).
 * Alur: create() memuat semuanya (checklist pra-terbang) → board() saat pengunjung menekan "Naik Pesawat".
 */
import type { Texture} from 'three';
import { Scene, TextureLoader, Vector3, Quaternion } from 'three';
import { AudioManager } from '../audio/AudioManager';
import { CameraRig, type CameraTarget } from '../camera/CameraRig';
import { CAMERA } from '../config/camera';
import { HOME, PLANET_RADIUS } from '../config/world';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Autopilot, type AutopilotTarget } from '../ai/Autopilot';
import { AUTOPILOT, SPACE } from '../config/flight';
import { L, content } from '../content';
import { pushToast } from '../ui/toasts';
import { tr } from '../i18n';
import { RadialGravity } from '../physics/RadialGravity';
import { bearingDirection, headingOf, latLonToVec3, vec3ToLatLon } from '../utils/geo';
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
import { sunDirection } from '../world/Sun';
import { WorldClock, dayPartOf } from '../world/WorldClock';
import { Weather } from '../world/Weather';
import { AchievementTracker } from '../game/Achievements';
import { patchProgress, progress } from '../game/Progress';
import { Social } from '../game/Social';
import { skinById } from '../game/Skins';
import { MusicEngine, toStation } from '../audio/MusicEngine/MusicEngine';
import { ZONE_THEME, type ThemeId } from '../audio/MusicEngine/themes';
import { WorldAudio } from '../audio/WorldAudio';
import { circuit } from '../world/Zones/SkyCircuit';
import type { WeatherKind } from '../world/weatherCodes';
import { seasonOf, uFlash, uNight, uSeason } from '../world/WorldState';
import { HomeAirport } from '../world/Zones/HomeAirport';
import { AmbientLife } from '../world/AmbientLife';
import { WorldLandmarks } from '../world/Landmarks/WorldLandmarks';
import { ContributionCity } from '../world/Zones/ContributionCity';
import { ControlTower } from '../world/Zones/ControlTower';
import { ArilKitchen, BlockPark, FortVillage, GymIsland, McStage } from '../world/Zones/EasterEggs';
import { HangarLab } from '../world/Zones/HangarLab';
import { HomeAirportZone } from '../world/Zones/HomeAirportZone';
import { JourneyStream } from '../world/Zones/JourneyStream';
import { LanternValley } from '../world/Zones/LanternValley';
import { PostOffice } from '../world/Zones/PostOffice';
import { ProjectArchipelago } from '../world/Zones/ProjectArchipelago';
import { SkillPeaks } from '../world/Zones/SkillPeaks';
import { SkyCircuit } from '../world/Zones/SkyCircuit';
import { MoonZone, OrbitZone } from '../world/Zones/Space';
import type { ZoneTick } from '../world/Zones/Zone';
import { ZoneManager, horizonVisible } from '../world/Zones/ZoneManager';
import { detailCuller } from '../world/DetailCuller';
import type { ZoneDeps } from '../world/Zones/ZoneKit';
import { TutorialController } from '../ui/tutorial';
import { appPhase, autopilotState, currentZone, fade, fadeColor, hud, isPortrait, panel, paused, planeGeo, preflight } from './AppState';
import { assetUrl, loadEarthAssets } from './Assets';
import { createDebugPanel, isDebugEnabled } from './Debug';
import { bus, type PreflightItemId , type PanelKind } from './EventBus';
import { Input } from './Input';
import { AutoTest } from './AutoTest';
import { FixedStepper } from './Loop';
import { QualityManager } from './QualityManager';
import { Renderer, webgpuAvailable, type PostMode } from './Renderer';
import { reducedMotionActive, settings, updateSettings } from './Settings';
import { Time } from './Time';

const _v = new Vector3();
const _w = new Vector3();
const _apUp = new Vector3();
const _sunTmp = new Vector3();
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
  music: MusicEngine | null = null;
  achievements: AchievementTracker | null = null;
  social: Social | null = null;
  private statDist = 0;
  private statTime = 0;
  private statAlt = 0;
  private statFlush = 0;
  private wasNight = false;
  private wasInCloud = false;
  private wasIdle = false;
  worldAudio: WorldAudio | null = null;
  private musicBoost = 0;
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
  zones!: ZoneManager;
  landmarks!: WorldLandmarks;
  life!: AmbientLife;
  archipelago!: ProjectArchipelago;
  journey!: JourneyStream;
  moon!: MoonZone;
  lantern!: LanternValley;
  post!: PostOffice;
  lab!: HangarLab;
  airportZone!: HomeAirportZone;
  private zoneDeps!: ZoneDeps;
  private readonly zoneTick: ZoneTick = {
    dt: 0,
    time: 0,
    planePos: new Vector3(),
    planeVel: new Vector3(),
    agl: 0,
    grounded: true,
    night: false,
    wind: new Vector3(),
    camPos: new Vector3(),
    sunDir: new Vector3(),
  };
  private readonly assistImpulse = new Vector3();
  private moonTimer = 0;
  autopilot!: Autopilot;
  private readonly geo = { lat: 0, lon: 0 };
  particles!: Particles;
  feedback!: Feedback;
  tutorial!: TutorialController;
  private hudTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 60;
  private autoTest: AutoTest | null = null;
  readonly clock = new WorldClock();
  weather!: Weather;
  private coverage = 0.6;
  /** 0..1 kepadatan awan/kabut di posisi kamera (kanopi, audio). */
  cloudDensity = 0;
  private sunTimer = 0;
  private dayPart = '';
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
    const forceWebGL = params.get('renderer') === 'webgl' || s.graphics.renderer === 'webgl2' || !(await webgpuAvailable());
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
    this.weather = new Weather(this.quality.tier);
    this.scene.add(this.weather.group);
    this.scene.add(this.atmosphere.mesh);
    this.sky = new Sky(this.scene);
    this.sky.setShadow(preset.shadowMapSize, preset.shadowRange);
    this.applySun();
    markLoaded('map');

    // Bandara: aktifkan collider sekitar bandara dulu supaya penempatan di tanah akurat.
    const propMat = createToonMaterial();
    const airportCenter = latLonToVec3(HOME.lat, HOME.lon, PLANET_RADIUS);
    this.planet.updateColliders(airportCenter);
    this.airport = new HomeAirport(this.physics, this.gravity, propMat, (dir) => this.groundHeight(dir));
    this.scene.add(this.airport.group);
    // Papan, huruf, dan props bandara (≤ 6 unit) tidak digambar dari jauh — dari orbit hanya titik.
    detailCuller.add(this.airport.group, 160, 6);
    this.planet.updateColliders(this.airport.spawnPoint().position);
    this.physics.world.step(this.physics.events); // bangun BVH collider

    // Pesawat + karakter.
    this.plane = new Plane(this.physics, this.gravity, propMat, () => this.archipelago?.spawnNear(this.plane.position) ?? this.airport.spawnPoint());
    this.scene.add(this.plane.model.root);
    this.plane.ground.materialAt = (c, f) => this.planet.materialAt(c, f);
    this.plane.headingHint = (pos, fwd, out) => this.airport.runwayHeading(pos, fwd, out);
    this.plane.setFrozen(true);
    markLoaded('propeller');
    markLoaded('copilot');

    this.particles = new Particles(this.scene, 480, preset.particles);

    // Zona, landmark, dan kehidupan latar (isi berat dibangun malas saat mendekat).
    this.zoneDeps = { physics: this.physics, gravity: this.gravity, planet: this.planet, scatter: this.scatter, material: propMat, particles: this.particles };
    this.zones = new ZoneManager(this.scene, this.zoneDeps);
    this.airportZone = new HomeAirportZone();
    this.archipelago = new ProjectArchipelago();
    this.journey = new JourneyStream();
    this.moon = new MoonZone();
    this.lantern = new LanternValley();
    this.post = new PostOffice();
    this.lab = new HangarLab();
    for (const z of [
      this.airportZone,
      new ControlTower(),
      this.post,
      this.lantern,
      this.archipelago,
      new SkillPeaks(),
      this.journey,
      new ContributionCity(),
      this.lab,
      new McStage(),
      new ArilKitchen(),
      new GymIsland(),
      new FortVillage(),
      new BlockPark(),
      new SkyCircuit(),
      new OrbitZone(),
      this.moon,
    ]) {
      this.zones.add(z);
    }
    this.moon.ensureBuilt(this.zoneDeps);
    this.moon.place(this.sky.sunDir, this.clock.now(), this.plane.position, true);
    // Gravitasi Bulan aktif di wilayah pengaruhnya (MOON_SOI); vektor pusat ikut bergerak saat Bulan dipindah.
    this.gravity.moonCenter = this.moon.moonCenter;
    this.landmarks = new WorldLandmarks(this.zoneDeps);
    this.scene.add(this.landmarks.group);
    this.autopilot = new Autopilot((dir) => this.planet.heightAt(dir, 0));
    this.life = new AmbientLife(this.scene, this.planet, this.physics, this.particles, propMat, this.quality.tier);
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
    this.setupGame();
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.unsubs.push(() => window.removeEventListener('resize', this.onResize));
    this.unsubs.push(
      bus.on('quality:changed', () => this.applyQuality()),
      bus.on('interact', (e) => {
        if (e.action === 'crater-dive') this.craterDive();
      }),
      bus.on('input:device', (e) => this.airport.setDevice(e.device)),
      settings.subscribe((st) => this.rig.setMode(st.camera.mode === 'cockpit' ? 'cockpit' : 'chase')),
      settings.subscribe(() => this.rig && this.applyPost()),
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
      getHour: () => this.clock.medanHour(),
      respawn: () => this.requestRespawn(),
      teleport: (lat, lon, alt, heading, speed) => this.teleport(lat, lon, alt, heading, speed),
      returnLetters: () => this.airport.letters.returnAll(),
    });
    if (isDebugEnabled() || import.meta.env.DEV || params.has('test') || params.has('autotest')) this.exposeTestHooks();
    if (params.has('autotest')) this.startAutoTest();
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

  /** Achievement & skin (Fase 4). */
  private setupGame(): void {
    this.achievements = new AchievementTracker();
    this.social = new Social({
      setLanterns: (l) => this.lantern.setLanterns(l),
      releaseLanternAnim: () => this.lantern.releaseLantern(),
      setTotalKm: (km) => this.airportZone.setTotalKm(km),
    });
    this.unsubs.push(() => this.social?.dispose());
    const apply = (id: string): void => this.plane.model.setPaint(skinById(id)?.paint ?? null);
    apply(progress.get().skin);
    this.unsubs.push(
      bus.on('skin:equip', (e) => apply(e.id)),
      bus.on('plane:takeoff', () => patchProgress((p) => void (p.stats.flights += 1))),
      bus.on('plane:crash', (e) => {
        if (e.tier >= 2) patchProgress((p) => void (p.stats.crashes += 1));
      }),
      bus.on('achievement', () => {
        this.music?.stinger('achievement');
        this.plane.piko.emote('cheer');
      }),
      () => this.achievements?.dispose(),
    );
  }

  private startAudioWorld(): void {
    const ctx = this.audio.ctx;
    if (!ctx || this.music || !this.audio.noise) return;
    this.music = new MusicEngine(ctx, this.audio.bus('music'), this.audio.noise);
    this.music.setTheme('home');
    this.music.setStation(toStation(settings.get().audio.radioStation));
    this.music.start();
    this.worldAudio = new WorldAudio(this.audio, this.quality.tier);
    const zc = (id: string): Vector3 | null => this.zones.get(id)?.center ?? null;
    for (const [id, kind, dist] of [
      ['mc-stage', 'crowd', 90],
      ['aril-kitchen', 'sizzle', 70],
      ['hangar-lab', 'lava', 110],
      ['lantern-valley', 'chimes', 80],
    ] as const) {
      const c = zc(id);
      if (c) this.worldAudio.addEmitter(c, dist, kind);
    }
    this.unsubs.push(
      bus.on('stamp', () => this.music?.stinger('stamp')),
      bus.on('zone:enter', () => {
        this.music?.stinger('zone');
        this.musicBoost = 0.3;
      }),
      bus.on('plane:landed', (e) => {
        if (e.smooth) this.music?.stinger('landing');
      }),
      bus.on('moon:landed', () => this.music?.stinger('moon')),
      settings.subscribe((st) => this.music?.setStation(toStation(st.audio.radioStation))),
    );
  }

  private updateAudio(dt: number, camPos: Vector3): void {
    if (!this.audio.ctx) return;
    const reg = this.plane.space.regime;
    const spaceK = reg === 'space' || reg === 'moon' ? 1 : reg === 'stratosphere' ? 0.35 : 0;
    this.audio.update({ cloud: this.cloudDensity, inWater: this.plane.water.inWater, space: spaceK, canopyClosed: this.plane.canopy.closed });
    const cam = this.rig.camera;
    _v.set(0, 0, -1).applyQuaternion(cam.quaternion);
    _w.set(0, 1, 0).applyQuaternion(cam.quaternion);
    this.audio.setListener(camPos.x, camPos.y, camPos.z, _v.x, _v.y, _v.z, _w.x, _w.y, _w.z);
    const sp = this.plane.space;
    this.worldAudio?.update(dt, {
      rocket: sp.thrust,
      heat: sp.heat,
      rain: this.weather.current.rain,
      canopyClosed: this.plane.canopy.closed,
      agl: this.plane.env.heightAboveGround,
      overWater: this.plane.altitude < 25 && this.planet.heightAt(_v.copy(this.plane.position).normalize(), -1) < 0,
      night: this.sky.sunElevation < 0.02,
      space: spaceK,
      camPos,
    });
    this.updateMusic(dt);
  }

  /** Tema musik dari lapisan langit, sirkuit, dan zona. */
  private updateMusic(dt: number): void {
    const m = this.music;
    if (!m) return;
    const reg = this.plane.space.regime;
    let theme: ThemeId;
    if (reg === 'moon') theme = 'moon';
    else if (reg === 'space') theme = 'space';
    else if (circuit.get().racing) theme = 'race';
    else {
      const z = currentZone.get();
      theme = (z && ZONE_THEME[z]) || (this.plane.ground.grounded ? 'home' : 'adventure');
      if (theme === 'lantern' && this.sky.sunElevation > 0.1 && !z) theme = 'adventure';
    }
    m.setTheme(theme);
    this.musicBoost = Math.max(0, this.musicBoost - dt * 0.05);
    const st = this.plane.flight.state;
    m.setIntensity(0.3 + Math.min(1, st.speed / 70) * 0.4 + (st.boosting ? 0.25 : 0) + this.musicBoost);
  }

  /** Paksa jam (debug/tes). `null` kembali mengikuti Pengaturan. */
  setHour(hour: number | null): void {
    this.clock.override = hour;
    this.applySun();
  }

  /** Matahari, musim, dan tema UI dari jam dunia (dipanggil tiap detik; jam nyata bergerak pelan). */
  private applySun(): void {
    const date = this.clock.now();
    this.sky.setSunDirection(sunDirection(date, _sunTmp));
    const st = settings.get().world;
    uSeason.value = st.seasons ? seasonOf(date) : 0;
    const part = st.uiThemeFollowsDayNight ? dayPartOf(new Date().getHours()) : 'day';
    if (part !== this.dayPart) {
      this.dayPart = part;
      document.documentElement.dataset.daypart = part;
    }
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
    this.life?.setTier(this.quality.tier);
    detailCuller.scale = { low: 0.32, medium: 0.6, high: 1, ultra: 1.3 }[this.quality.tier];
    if (this.zones) {
      this.zones.markerRange = this.quality.tier === 'low' ? 650 : 1400;
      this.zones.maxMarkers = this.quality.tier === 'low' ? 5 : this.quality.tier === 'medium' ? 9 : 17;
    }
    this.clouds.setTier(this.quality.tier);
    this.cities.setFraction(p.buildings);
    this.particles.setCapacity(p.particles);
    this.ocean.setDetail(p.oceanDetail);
    this.plane.model.root.traverse((o) => (o.castShadow = p.shadowMapSize > 0 && o.castShadow !== false));
    this.applyPost();
    hud.patch({ tier: this.quality.tier });
  }

  /** Post-processing: Pengaturan (auto/on/off) + tier. Uji otomatis (?test) tanpa efek supaya cepat & stabil. */
  private applyPost(): void {
    const pp = settings.get().graphics.postProcessing;
    const tier = this.quality.tier;
    let mode: PostMode = tier === 'low' ? 'off' : tier === 'medium' ? 'light' : 'full';
    if (pp === 'off') mode = 'off';
    else if (pp === 'on') mode = tier === 'low' ? 'light' : 'full';
    if (new URLSearchParams(location.search).has('nopost')) mode = 'off';
    this.renderer.setPost(this.scene, this.rig.camera, mode);
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
    // Musik dan suara dunia dibuat sesaat setelah naik (render instrumen ±50 ms, tidak mengganggu tombol).
    setTimeout(() => this.startAudioWorld(), 500);
    this.plane.setFrozen(false);
    setTimeout(() => {
      this.plane.engineRunning = true;
    }, 450);
    appPhase.set('flying');
    // Pratinjau dari Hangar: /?fly=project:<id> → langsung diantar autopilot setelah naik.
    const fly = new URLSearchParams(location.search).get('fly');
    if (fly && /^[a-z]+(:[a-z0-9-]+)?$/i.test(fly)) setTimeout(() => this.flyTo(fly), 900);
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
    this.plane.upVector((t.up ??= new Vector3()));
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
      this.wind.copy(this.weather.wind);
      this.plane.setWind(this.wind);
      this.plane.readInput(this.input, s.controls.assistLevel);
      this.updateAutopilot();
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
          fadeColor.set('#FFF6E6');
          this.respawnTimer = -1;
        }
      }

      const night = this.sky.sunElevation < 0.05;
      this.plane.canopy.update(dt, {
        rain: this.weather.current.rain + this.weather.current.snow,
        cloud: this.cloudDensity,
        regime: this.plane.space.regime,
        airspeed: this.plane.flight.state.airspeed,
        mode: s.controls.canopy,
      });
      this.plane.animate(dt, night);
      const pos = this.plane.position;
      this.planet.updateColliders(pos);
      this.airport.update(dt, this.time.elapsed, pos, this.wind, night);
      this.updateWorldSystems(dt, night);
      // Kejadian untuk obrolan otomatis Piko.
      if (this.boarded) {
        const isNight = uNight.value > 0.6;
        if (isNight !== this.wasNight) {
          this.wasNight = isNight;
          bus.emit('world:night', { night: isNight });
        }
        const inCloud = this.cloudDensity > 0.55;
        if (inCloud && !this.wasInCloud) bus.emit('world:cloud', {});
        this.wasInCloud = inCloud;
        const idle = this.plane.idleTime > 25;
        if (idle && !this.wasIdle) bus.emit('plane:idle', {});
        this.wasIdle = idle;
      }
      if (this.boarded && this.social && !this.plane.ground.grounded) this.social.tick(dt, this.plane.flight.state.speed * dt);
      // Statistik penerbangan (untuk layar Kedatangan), disimpan berkala supaya localStorage tidak ditulis tiap frame.
      if (this.boarded && !this.plane.ground.grounded) {
        this.statDist += this.plane.flight.state.speed * dt;
        this.statTime += dt;
        this.statAlt = Math.max(this.statAlt, this.plane.altitude);
      }
      this.statFlush += dt;
      if (this.statFlush > 5 && (this.statDist > 0 || this.statTime > 0)) {
        this.statFlush = 0;
        const d = this.statDist;
        const tm = this.statTime;
        const alt = this.statAlt;
        this.statDist = this.statTime = 0;
        patchProgress((p) => {
          p.stats.distance += d;
          p.stats.flightTime += tm;
          p.stats.maxAltitude = Math.max(p.stats.maxAltitude, alt);
        });
      }
      if (this.boarded && this.achievements) {
        const av = this.plane.body.angvel();
        _w.set(1, 0, 0).applyQuaternion(this.plane.quaternion);
        this.achievements.tick({
          dt,
          airborne: !this.plane.ground.grounded && !this.plane.water.inWater,
          night,
          cloud: this.cloudDensity,
          storm: this.weather.current.storm,
          lon: this.geo.lon,
          pitchRate: av.x * _w.x + av.y * _w.y + av.z * _w.z,
          lettersScattered: this.airport.letters.scatteredCount,
        });
      }
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

    this.sunTimer += this.time.rawDelta;
    if (this.sunTimer > 1) {
      this.sunTimer = 0;
      this.applySun();
    }
    const camPos = this.rig.camera.position;
    this.planet.updateVisibility(camPos);
    this.scatter.update(dt, this.rig.camera, this.plane.position, this.plane.env.heightAboveGround);
    this.clouds.update(isPaused ? 0 : dt, camPos);
    const wx = this.weather;
    wx.update(isPaused ? 0 : dt, camPos, this.plane.position, this.sky.sunDir, this.clock.now(), uSeason.value);
    const wc = wx.current;
    this.coverage += (0.45 + wc.cloud * 0.55 - this.coverage) * Math.min(1, dt * 0.05);
    this.clouds.setCoverage(this.coverage);
    this.clouds.brightness.value = 1 - wc.storm * 0.42 - wc.rain * 0.15;
    this.cloudDensity = Math.max(this.clouds.densityAt(camPos), wx.densityAt(camPos), wc.fog * 0.55);
    this.sky.sunDim = 1 - wc.cloud * 0.3 - wc.storm * 0.35;
    this.sky.setCloudFog(this.cloudDensity);
    this.sky.update(camPos, this.plane.position);
    this.atmosphere.update(camPos, this.sky.sunDir);
    this.renderer.bloomStrength.value = 0.28 + uNight.value * 0.4 + uFlash.value * 0.5;
    this.updateAudio(isPaused ? 0 : dt, camPos);
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
    this.autoTest?.update(this.time.rawDelta);
    this.input.endFrame();
  }

  private updateAutopilot(): void {
    const ap = this.autopilot;
    if (!ap.active || !this.boarded) return;
    const inp = this.input;
    if (Math.abs(inp.pitch) + Math.abs(inp.roll) > AUTOPILOT.OVERRIDE_DEADZONE || inp.isDown('brake')) {
      this.cancelAutopilot(true);
      return;
    }
    _v.set(0, 0, -1).applyQuaternion(this.plane.quaternion);
    _apUp.set(0, 1, 0).applyQuaternion(this.plane.quaternion);
    const cmd = ap.update(this.plane.position, _v, _apUp, this.plane.velocity(_w), this.plane.ground.grounded);
    if (cmd) this.plane.applyCommand(cmd);
    else autopilotState.set({ active: false, target: null });
  }

  private hovering = false;
  /** Melayang mengitari posisi sekarang selama panel terbuka (HP) — supaya tidak jatuh saat membaca. */
  hover(on: boolean): void {
    if (on) {
      if (this.autopilot.active || this.plane.ground.grounded || !this.boarded) return;
      this.hovering = true;
      this.autopilot.engage({ id: 'hover', label: '', position: this.plane.position.clone(), hold: true, orbitRadius: 22, approachAgl: Math.max(14, this.plane.env.heightAboveGround) });
      this.autopilot.arrived = true;
    } else if (this.hovering) {
      this.hovering = false;
      if (this.autopilot.target?.id === 'hover') this.autopilot.cancel();
    }
  }

  cancelAutopilot(byPlayer = false): void {
    if (!this.autopilot.active) return;
    this.autopilot.cancel();
    autopilotState.set({ active: false, target: null });
    bus.emit('autopilot', { active: false });
    if (byPlayer) pushToast(tr('autopilot.takeover'), 'info', '🕹️');
  }

  /**
   * Terbang otomatis ke tujuan: `zone:<id>`, `project:<id>`, `featured:<n>`, `landmark:<id>`, `space`, `moon`, `home`.
   * Mengembalikan false bila tujuan tidak dikenal.
   */
  flyTo(dest: string, opts: { openPanel?: boolean; hold?: boolean; boost?: boolean } = {}): boolean {
    const [kind, id = ''] = dest.split(':');
    let target: AutopilotTarget | null = null;
    const open = opts.openPanel !== false;
    if (kind === 'zone' || kind === 'home') {
      const z = this.zones.get(kind === 'home' ? 'home-airport' : id);
      if (!z) return false;
      if (z.id === 'moon') return this.flyTo('moon', opts);
      if (z.id === 'orbit') return this.flyTo('space', opts);
      target = { id: z.id, label: this.zones.zoneName(z.id), position: z.poi.clone(), onArrive: open ? () => bus.emit('panel:open', { kind: 'zone', id: z.id }) : undefined };
    } else if (kind === 'project' || kind === 'featured') {
      const list = content.get().projects;
      const p = kind === 'featured' ? list.filter((x) => x.featured).sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99))[Number(id) - 1] : list.find((x) => x.id === id);
      if (!p) return false;
      const pos = this.archipelago.islandPosition(p.id);
      if (!pos) return false;
      target = { id: p.id, label: p.title, position: pos, approachAgl: AUTOPILOT.ISLAND_AGL, onArrive: open ? () => bus.emit('panel:open', { kind: 'project', id: p.id }) : undefined };
    } else if (kind === 'landmark') {
      const pos = this.landmarks.position(id);
      const lm = content.get().landmarks.landmarks.find((x) => x.id === id);
      if (!pos || !lm) return false;
      target = { id, label: L(lm.name), position: pos, approachAgl: 26 };
    } else if (kind === 'space') {
      const up = this.plane.position.clone().normalize();
      target = { id: 'space', label: L(content.get().zones.zones.find((z) => z.id === 'orbit')?.name), position: up.multiplyScalar(PLANET_RADIUS), approachAgl: 240, boost: true, arriveAltitude: SPACE.SPACE_ALT + 15 };
    } else if (kind === 'moon') {
      target = { id: 'moon', label: L(content.get().zones.zones.find((z) => z.id === 'moon')?.name), position: this.moon.pad.clone(), approachAgl: 30, boost: true };
    }
    if (!target) return false;
    // Tujuan di permukaan: setelah tiba, terus mengitari sampai pemain memegang kemudi (tidak jatuh ke laut).
    if (opts.hold ?? (kind !== 'space' && kind !== 'moon')) target.hold = true;
    if (opts.boost) target.boost = true;
    this.autopilot.engage(target);
    autopilotState.set({ active: true, target: target.label });
    bus.emit('autopilot', { active: true, target: target.id });
    pushToast(tr('autopilot.engaged', { target: target.label }), 'info', '🧭');
    return true;
  }

  /** Zona, landmark, kehidupan latar, bantuan Arus Perjalanan, aksi kontekstual. */
  private updateWorldSystems(dt: number, night: boolean): void {
    const t = this.zoneTick;
    t.dt = dt;
    t.time = this.time.elapsed;
    t.planePos.copy(this.plane.position);
    this.plane.velocity(t.planeVel);
    t.agl = this.plane.env.heightAboveGround;
    t.grounded = this.plane.ground.grounded;
    t.night = night;
    t.wind.copy(this.wind);
    t.camPos.copy(this.rig.camera.position);
    t.sunDir.copy(this.sky.sunDir);
    _v.set(0, 0, -1).applyQuaternion(this.plane.quaternion);
    this.zones.update(t, _v);
    this.airport.group.visible = horizonVisible(t.camPos, this.airportZone.center, 22);
    this.landmarks.update(dt, t.planePos);
    detailCuller.update(dt, t.camPos);
    this.life.enabled = settings.get().world.ambientLife;
    this.life.update(dt, t.time, t.camPos, t.planePos, night, this.sky.sunElevation);
    // Angin buritan Arus Perjalanan (gaya fisika sungguhan, bisa dilawan).
    if (this.boarded && this.journey.assist(t.planePos, t.planeVel, dt, this.plane.body.mass(), this.assistImpulse)) {
      const i = this.assistImpulse;
      this.plane.body.applyImpulse({ x: i.x, y: i.y, z: i.z }, true);
    }
    this.moonTimer += dt;
    if (this.moonTimer > 5) {
      this.moonTimer = 0;
      this.moon.place(this.sky.sunDir, this.clock.now(), t.planePos);
    }
    // Tombol Aksi kontekstual.
    const act = this.zones.action(t);
    const label = act?.label ?? null;
    if (hud.get().action !== label) hud.patch({ action: label });
    if (act && this.boarded && !paused.get() && !panel.get() && this.input.wasPressed('interact')) act.run();
    if (this.boarded && !paused.get() && this.input.wasPressed('map')) panel.set(panel.get()?.kind === 'map' ? null : { kind: 'map' });
    vec3ToLatLon(t.planePos, this.geo);
    planeGeo.set({ lat: this.geo.lat, lon: this.geo.lon, heading: hud.get().heading });
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
      altitude: Math.max(0, this.plane.surfaceAltitude - 1.2),
      heading,
      verticalSpeed: st.verticalSpeed,
      throttle: st.throttle,
      grounded: this.plane.ground.grounded,
      inWater: this.plane.water.inWater,
      // Peringatan stall hanya saat benar-benar terbang (bukan memantul dekat tanah).
      stalled: st.stalled && this.plane.env.heightAboveGround > 3,
      boosting: st.boosting,
      regime: this.plane.space.regime,
      rocket: this.plane.space.rocket,
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

  /** Terjun ke Kawah Nekat: layar memutih, lalu muncul lagi di bandara. */
  private craterDive(): void {
    if (this.respawnTimer >= 0) return;
    fadeColor.set('#FFFFFF');
    this.respawnTimer = 0;
    fade.set(1);
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

  /** Skenario terbang otomatis untuk audit performa (src/core/AutoTest.ts). */
  private startAutoTest(): void {
    this.autoTest = new AutoTest({
      board: () => void this.board(),
      flyTo: (dest) => this.flyTo(dest, { openPanel: false }),
      autopilot: () => this.autopilot,
      sample: (out) => {
        this.renderer.readInfo(out);
        out.fps = this.fps;
        out.physicsMs = this.physics.lastStepMs;
        out.altitude = this.plane.altitude;
      },
      tier: () => this.quality.tier,
      backend: () => this.renderer.backend,
      geo: () => planeGeo.get(),
    });
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
      /** Posisi zona dalam koordinat lokal bandara (along/side) — untuk memeriksa tabrakan tata letak. */
      zonesLocal: () =>
        Object.fromEntries(
          this.zones.zones.map((z) => {
            const o = { along: 0, side: 0 };
            this.airport.frame.toLocal(z.center.clone().normalize(), o);
            return [z.id, { along: +o.along.toFixed(1), side: +o.side.toFixed(1) }];
          }).concat([
            [
              'plane',
              (() => {
                const o = { along: 0, side: 0 };
                this.airport.frame.toLocal(this.plane.position.clone().normalize(), o);
                return { along: +o.along.toFixed(1), side: +o.side.toFixed(1) };
              })(),
            ],
          ]),
        ),
      /** Peta ASCII sekitar bandara: '#' darat, '~' laut, 'F' kolider statis, 'P' pesawat. */
      asciiMap: (a0: number, a1: number, s0: number, s1: number, step: number) => {
        const rows: string[] = [];
        const v = new Vector3();
        const statics: { a: number; s: number }[] = [];
        for (const z of this.zones.zones) if (z.center.distanceTo(this.plane.position) < 120) z.ensureBuilt(this.zoneDeps);
        this.physics.world.forEachCollider((c) => {
          if (c.parent()?.bodyType() === 0 || c.isSensor() || c.shapeType() === 6) return;
          const t = c.translation();
          const lo = { along: 0, side: 0 };
          this.airport.frame.toLocal(v.set(t.x, t.y, t.z).normalize(), lo);
          statics.push({ a: lo.along, s: lo.side });
        });
        for (let sd = s1; sd >= s0; sd -= step) {
          let row = `${String(sd).padStart(4)} `;
          for (let al = a0; al <= a1; al += step) {
            this.airport.frame.toWorld(al, sd, 0, v).normalize();
            const h = this.planet.heightAt(v, -1);
            const st = statics.some((q) => Math.abs(q.a - al) < step / 2 && Math.abs(q.s - sd) < step / 2);
            row += st ? 'F' : h > 0.2 ? (h > 6 ? '^' : '#') : '~';
          }
          rows.push(row);
        }
        return rows.join(String.fromCharCode(10));
      },
      perf: () => ({ fps: this.fps, ...this.renderer.info, physicsMs: this.physics.lastStepMs, scatter: this.scatter.kindCounts }),
      autotest: () => this.autoTest?.report() ?? null,
      teleport: (lat: number, lon: number, alt: number, heading: number, speed: number) =>
        this.teleport(lat, lon, alt, heading, speed),
      setHour: (h: number | null) => this.setHour(h),
      weather: (kind: WeatherKind | null) => {
        this.weather.force = kind;
      },
      weatherState: () => ({ ...this.weather.current, home: this.weather.home, wet: this.weather.current.rain }),
      /** Pesawat di jalur pendekatan landasan (along negatif = sebelum ambang barat laut). */
      approach: (along: number, height: number, speed: number) => {
        const f = this.airport.frame;
        const p = f.onSurface(along, 0, height);
        const fwd = f.forwardAt(along, 0, new Vector3());
        this.plane.teleport(p, quatFromUpForward(p.clone().normalize(), fwd), fwd.clone().multiplyScalar(speed));
        this.updateCameraTarget();
        this.rig.snap(this.camTarget);
      },
      regime: () => ({ regime: this.plane.space.regime, rocket: this.plane.space.rocket, heat: +this.plane.space.heat.toFixed(2), canopy: this.plane.canopy.closed }),
      music: () => (this.music ? { theme: this.music.theme, station: this.music.station } : null),
      /** Pesawat `h` unit di atas landasan Bulan, turun pelan (uji pendaratan). */
      moonApproach: (h: number, vDown: number) => {
        this.moon.place(this.sky.sunDir, this.clock.now(), this.plane.position, true);
        this.gravity.moonCenter = this.moon.moonCenter;
        const n = this.moon.padNormal;
        const p = this.moon.pad.clone().addScaledVector(n, h);
        const fwd = _v.set(0, 1, 0).cross(n);
        if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
        fwd.normalize();
        this.plane.teleport(p, quatFromUpForward(n.clone(), fwd.clone()), n.clone().multiplyScalar(-vDown).addScaledVector(fwd, 3));
        this.updateCameraTarget();
        this.rig.snap(this.camTarget);
      },
      /** Masuk atmosfer: ketinggian `alt`, menukik dengan kecepatan `speed`. */
      reentry: (alt: number, speed: number) => {
        const up = this.plane.position.clone().normalize();
        const p = up.clone().multiplyScalar(PLANET_RADIUS + alt);
        const fwd = _v.set(0, 1, 0).cross(up).normalize();
        const vel = fwd.clone().multiplyScalar(speed * 0.8).addScaledVector(up, -speed * 0.6);
        this.plane.teleport(p, quatFromUpForward(up, vel.clone().normalize()), vel);
        this.updateCameraTarget();
        this.rig.snap(this.camTarget);
      },
      openPanel: (kind: PanelKind, id?: string) => panel.set(id ? { kind, id } : { kind }),
      autopilot: () => ({ active: this.autopilot.active, target: this.autopilot.target?.id ?? null }),
      freeze: (on: boolean) => {
        this.simFrozen = on;
      },
      respawn: () => this.plane.respawn('manual'),
      drawStats: () => {
        // Jumlah mesh terlihat per kelompok teratas (debug draw call).
        const out: Record<string, number> = {};
        for (const top of this.scene.children) {
          let n = 0;
          top.traverseVisible((o) => {
            if ((o as unknown as { isMesh?: boolean; isSprite?: boolean }).isMesh || (o as unknown as { isSprite?: boolean }).isSprite) n++;
          });
          const key = top.name || top.type;
          out[key] = (out[key] ?? 0) + n;
        }
        return out;
      },
      zoom: (scale: number) => {
        this.rig.distanceScale = scale;
      },
      camera: (mode: 'chase' | 'cockpit') => updateSettings('camera', { mode }),
      orbitCamera: (yaw: number, pitch: number) => this.rig.look(-yaw / CAMERA.ORBIT_SENS_MOUSE, pitch / CAMERA.ORBIT_SENS_MOUSE, CAMERA.ORBIT_SENS_MOUSE, performance.now() / 1000 + 60),
    };
  }

  dispose(): void {
    this.autoTest?.dispose();
    this.renderer.three.setAnimationLoop(null);
    for (const u of this.unsubs) u();
    this.feedback.dispose();
    this.tutorial.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.plane.dispose();
    this.airport.dispose();
    this.zones.dispose();
    this.life.dispose();
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
