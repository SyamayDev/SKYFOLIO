/**
 * Cuaca (docs/04 bagian 7): cuaca nyata Medan (Open-Meteo) + sel prosedural harian di tempat lain.
 * - Hujan & salju: garis tipis di sekitar kamera (dunia-tetap, jadi pesawat menembusnya), memanjang sesuai
 *   kecepatan relatif → efek hujan menyambar kaca saat terbang cepat.
 * - Awan badai gelap + tirai hujan di bawahnya, terlihat dari jauh dan bisa ditembus (densityAt).
 * - Petir: kilatan langit + sambaran, guntur tertunda sesuai jarak (event `weather:thunder`).
 * - Pelangi setelah hujan saat matahari rendah, genangan (uWet), angin nyata yang memengaruhi semuanya.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { LineBasicNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, color, fract, mix, positionGeometry, sin, smoothstep, time, uniform, uv, vec3 } from 'three/tsl';
import type { QualityTier } from '../config/quality';
import { BASE_WIND, HOME, PLANET_RADIUS } from '../config/world';
import { bus } from '../core/EventBus';
import { settings } from '../core/Settings';
import { bearingDirection, latLonToVec3 } from '../utils/geo';
import { smoothstep as sstep } from '../utils/math';
import { createToonMaterial } from '../utils/modeling/materials';
import { quatFromUpForward } from '../utils/quat';
import { mulberry32 } from '../utils/rng';
import { cellsFor, type WeatherCell } from './weatherCells';
import { manualProfile, windKmhToUnits, wmoToProfile, type WeatherKind, type WeatherProfile } from './weatherCodes';
import { fetchHomeWeather, type HomeWeather } from './WeatherService';
import { uFlash, uWet } from './WorldState';

const RAIN_MAX: Record<QualityTier, number> = { low: 450, medium: 800, high: 1400, ultra: 2000 };
const BOX_R = 30;
const BOX_H = 24;
const CLOUD_BASE = 50;
const HOME_RADIUS_DEG = 7;
const MAX_SHAFTS = 8;
const PUFFS_PER_CELL = 7;
const UNIT_PER_DEG = (Math.PI / 180) * PLANET_RADIUS;

interface CellRuntime extends WeatherCell {
  dir: Vector3;
}

export type WeatherSample = WeatherProfile;

const _v = new Vector3();
const _w = new Vector3();
const _up = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();
const _s = new Vector3();
const _homeDir = latLonToVec3(HOME.lat, HOME.lon, 1);

function emptySample(): WeatherSample {
  return { kind: 'clear', rain: 0, snow: 0, storm: 0, cloud: 0.35, fog: 0 };
}

export class Weather {
  readonly group = new Group();
  /** Cuaca yang dirasakan di posisi kamera (dihaluskan). */
  readonly current: WeatherSample = emptySample();
  home: HomeWeather | null = null;
  /** Angin di posisi pesawat (unit/dtk). */
  readonly wind = new Vector3();
  /** Paksa jenis cuaca (tes/screenshot). */
  force: WeatherKind | null = null;

  private cells: CellRuntime[] = [];
  private cellsDay = -1;
  private readonly target: WeatherSample = emptySample();
  private readonly raw: WeatherSample = emptySample();
  private readonly tier: QualityTier;

  // Hujan / salju
  private readonly rainPos: Float32Array;
  private readonly rainGeo: BufferGeometry;
  private readonly rain: LineSegments;
  private readonly snowPos: Float32Array;
  private readonly snowGeo: BufferGeometry;
  private readonly snow: LineSegments;
  private readonly drops: Float32Array;
  private readonly flakes: Float32Array;
  private readonly rainOpacity = uniform(0);
  private readonly snowOpacity = uniform(0);
  private readonly prevCam = new Vector3();
  private readonly camVel = new Vector3();
  private readonly rng = mulberry32(99);

  // Petir
  private readonly boltPos = new Float32Array(24 * 3);
  private readonly bolt: LineSegments;
  private boltT = -1;
  private nextStrike = 6;

  // Pelangi
  private readonly rainbow: Mesh;
  private readonly rainbowK = uniform(0);
  private sinceRain = 999;

  // Badai jauh
  private readonly shafts: InstancedMesh;
  private readonly puffs: InstancedMesh;
  private readonly shaftK = uniform(0.3);
  private readonly visibleCells: CellRuntime[] = [];

  private fetchTimer = 0;
  private wetness = 0;

  constructor(tier: QualityTier) {
    this.tier = tier;
    this.group.name = 'weather';
    const n = RAIN_MAX.ultra;
    this.drops = new Float32Array(n * 3);
    this.rainPos = new Float32Array(n * 6);
    this.rainGeo = new BufferGeometry();
    this.rainGeo.setAttribute('position', new BufferAttribute(this.rainPos, 3));
    this.rainGeo.setDrawRange(0, 0);
    const rm = new LineBasicNodeMaterial({ transparent: true, depthWrite: false });
    rm.colorNode = color(new Color('#D6E6FF'));
    rm.opacityNode = this.rainOpacity;
    rm.fog = false;
    this.rain = new LineSegments(this.rainGeo, rm);
    this.rain.frustumCulled = false;
    this.rain.name = 'rain';

    const ns = 700;
    this.flakes = new Float32Array(ns * 3);
    this.snowPos = new Float32Array(ns * 12);
    this.snowGeo = new BufferGeometry();
    this.snowGeo.setAttribute('position', new BufferAttribute(this.snowPos, 3));
    this.snowGeo.setDrawRange(0, 0);
    const sm = new LineBasicNodeMaterial({ transparent: true, depthWrite: false });
    sm.colorNode = color(new Color('#FFFFFF'));
    sm.opacityNode = this.snowOpacity;
    this.snow = new LineSegments(this.snowGeo, sm);
    this.snow.frustumCulled = false;
    this.snow.name = 'snow';

    const bg = new BufferGeometry();
    bg.setAttribute('position', new BufferAttribute(this.boltPos, 3));
    const bm = new LineBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    bm.colorNode = color(new Color('#EAF2FF'));
    this.bolt = new LineSegments(bg, bm);
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;

    // Pelangi: torus tipis, warna spektrum di sepanjang ketebalan tabung.
    const rg = new TorusGeometry(1, 0.045, 6, 96);
    const rbm = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    const t = uv().y;
    const spec = vec3(
      smoothstep(0.55, 0.85, t).add(smoothstep(0.25, 0.0, t).mul(0.6)),
      smoothstep(0.2, 0.5, t).mul(smoothstep(0.95, 0.6, t)),
      smoothstep(0.45, 0.15, t),
    );
    rbm.colorNode = spec;
    rbm.opacityNode = this.rainbowK.mul(0.42).mul(smoothstep(0.0, 0.2, t).mul(smoothstep(1.0, 0.8, t)));
    rbm.fog = false;
    this.rainbow = new Mesh(rg, rbm);
    this.rainbow.visible = false;
    this.rainbow.name = 'rainbow';

    // Tirai hujan di bawah awan badai: silinder terbuka bergaris yang mengalir turun.
    const sg = new CylinderGeometry(1, 1, 1, 14, 1, true);
    sg.translate(0, 0.5, 0);
    const shm = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    const streak = abs(sin(uv().x.mul(70).add(sin(uv().x.mul(9)).mul(2)))).pow(6);
    const flow = fract(uv().y.mul(3).add(time.mul(1.6)));
    shm.colorNode = mix(color(new Color('#8E9DB8')), color(new Color('#C9D4E6')), flow);
    shm.opacityNode = this.shaftK.mul(streak.mul(0.55).add(0.25)).mul(smoothstep(0.0, 0.25, positionGeometry.y)).mul(smoothstep(1.0, 0.75, positionGeometry.y));
    this.shafts = new InstancedMesh(sg, shm, MAX_SHAFTS);
    this.shafts.count = 0;
    this.shafts.frustumCulled = false;
    this.shafts.name = 'rain-shafts';

    const pg = new IcosahedronGeometry(1, 1);
    const pm = createToonMaterial();
    pm.colorNode = color(new Color('#7B8498')).mul(uFlash.mul(0.6).add(1));
    this.puffs = new InstancedMesh(pg, pm, MAX_SHAFTS * PUFFS_PER_CELL);
    this.puffs.count = 0;
    this.puffs.frustumCulled = false;
    this.puffs.castShadow = false;
    this.puffs.name = 'storm-clouds';

    for (let i = 0; i < n; i++) this.drops[i * 3 + 1] = -1e9;
    for (let i = 0; i < ns; i++) this.flakes[i * 3 + 1] = -1e9;
    this.group.add(this.rain, this.snow, this.bolt, this.rainbow, this.shafts, this.puffs);
    void this.refreshHome();
  }

  private async refreshHome(): Promise<void> {
    if (!settings.get().world.realHometownWeather) return;
    // Uji otomatis harus deterministik & tanpa jaringan (kecuali ?realweather).
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    if (q?.has('test') && !q.has('realweather')) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const w = await fetchHomeWeather();
    if (w) {
      this.home = w;
      bus.emit('weather:home', { code: w.code, temperature: w.temperature });
    }
  }

  private ensureCells(date: Date, season: number): void {
    const day = Math.floor(date.getTime() / 600000); // perbarui tiap 10 menit (sel bergeser)
    if (day === this.cellsDay) return;
    this.cellsDay = day;
    this.cells = cellsFor(date, season).map((c) => ({ ...c, dir: latLonToVec3(c.lat, c.lon, 1) }));
  }

  /** Cuaca di arah `dir` (satuan) dari pusat planet, tanpa pengaruh ketinggian. */
  sample(dir: Vector3, out: WeatherSample): WeatherSample {
    const s = settings.get().world;
    if (this.force) return Object.assign(out, manualProfile(this.force === 'drizzle' ? 'rain' : this.force));
    if (!s.realHometownWeather) return Object.assign(out, manualProfile(s.manualWeather));
    out.kind = 'clear';
    out.rain = out.snow = out.storm = out.fog = 0;
    out.cloud = 0.35;
    let best = 0;
    for (const c of this.cells) {
      const d = Math.acos(Math.min(1, Math.max(-1, dir.dot(c.dir)))) * (180 / Math.PI);
      if (d > c.radiusDeg) continue;
      const k = c.strength * (1 - sstep(c.radiusDeg * 0.5, c.radiusDeg, d));
      out.cloud = Math.max(out.cloud, 0.5 + k * 0.5);
      if (c.kind === 'rain') out.rain = Math.max(out.rain, k * 0.8);
      else if (c.kind === 'storm') {
        out.rain = Math.max(out.rain, k);
        out.storm = Math.max(out.storm, k * 0.9);
      } else if (c.kind === 'snow') out.snow = Math.max(out.snow, k * 0.85);
      else out.fog = Math.max(out.fog, k * 0.8);
      if (k > best) {
        best = k;
        out.kind = c.kind;
      }
    }
    if (this.home) {
      const dh = Math.acos(Math.min(1, dir.dot(_homeDir))) * (180 / Math.PI);
      if (dh < HOME_RADIUS_DEG) {
        const kh = 1 - sstep(HOME_RADIUS_DEG * 0.65, HOME_RADIUS_DEG, dh);
        const p = wmoToProfile(this.home.code);
        out.rain += (p.rain - out.rain) * kh;
        out.snow += (p.snow - out.snow) * kh;
        out.storm += (p.storm - out.storm) * kh;
        out.fog += (p.fog - out.fog) * kh;
        out.cloud += (Math.max(p.cloud, this.home.cloudCover) - out.cloud) * kh;
        if (kh > 0.5) out.kind = p.kind;
      }
    }
    return out;
  }

  /** 0..1 seberapa dalam titik berada di dalam awan badai (untuk kabut & kanopi). */
  densityAt(pos: Vector3): number {
    const r = pos.length();
    const alt = r - PLANET_RADIUS;
    if (alt < CLOUD_BASE - 6 || alt > CLOUD_BASE + 22) return 0;
    _v.copy(pos).divideScalar(r);
    let best = 0;
    for (const c of this.visibleCells) {
      const dDeg = Math.acos(Math.min(1, _v.dot(c.dir))) * (180 / Math.PI);
      const rr = Math.min(40, c.radiusDeg * UNIT_PER_DEG * 0.45) / UNIT_PER_DEG;
      if (dDeg < rr) best = Math.max(best, (1 - dDeg / rr) * c.strength);
    }
    return Math.min(1, best * 1.4);
  }

  update(dt: number, camPos: Vector3, planePos: Vector3, sunDir: Vector3, date: Date, season: number): void {
    this.ensureCells(date, season);
    this.fetchTimer += dt;
    if (this.fetchTimer > 15 * 60) {
      this.fetchTimer = 0;
      void this.refreshHome();
    }
    const r = camPos.length();
    _up.copy(camPos).divideScalar(r);
    const alt = r - PLANET_RADIUS;
    this.sample(_up, this.raw);
    // Di atas dasar awan tidak ada hujan; di stratosfer tidak ada cuaca.
    const below = 1 - sstep(CLOUD_BASE - 4, CLOUD_BASE + 8, alt);
    const atmo = 1 - sstep(110, 150, alt);
    this.target.rain = this.raw.rain * below;
    this.target.snow = this.raw.snow * below;
    this.target.storm = this.raw.storm * atmo;
    this.target.cloud = this.raw.cloud * atmo;
    this.target.fog = this.raw.fog * (1 - sstep(10, 40, alt));
    const k = Math.min(1, dt * 0.6);
    const c = this.current;
    c.rain += (this.target.rain - c.rain) * k;
    c.snow += (this.target.snow - c.snow) * k;
    c.storm += (this.target.storm - c.storm) * k;
    c.cloud += (this.target.cloud - c.cloud) * k;
    c.fog += (this.target.fog - c.fog) * k;
    c.kind = this.raw.kind;

    // Genangan: cepat basah, lambat kering.
    const wetTarget = this.raw.rain;
    this.wetness += (wetTarget - this.wetness) * Math.min(1, dt * (wetTarget > this.wetness ? 0.15 : 1 / 90));
    uWet.value = this.wetness;

    // Kecepatan kamera (untuk memanjangkan garis hujan).
    if (dt > 0) this.camVel.copy(camPos).sub(this.prevCam).divideScalar(dt);
    if (this.camVel.lengthSq() > 400 * 400) this.camVel.set(0, 0, 0); // teleport
    this.prevCam.copy(camPos);

    this.updateWind(planePos, date);
    this.updateRain(dt, camPos);
    this.updateSnow(dt, camPos);
    this.updateLightning(dt, camPos);
    this.updateRainbow(dt, camPos, sunDir, alt);
    this.updateStorms(camPos);
  }

  private updateWind(planePos: Vector3, date: Date): void {
    const t = date.getTime() / 1000;
    let speed: number = BASE_WIND.speed;
    let from: number = BASE_WIND.fromBearingDeg;
    if (this.home && !this.force) {
      _v.copy(planePos).normalize();
      const dh = Math.acos(Math.min(1, _v.dot(_homeDir))) * (180 / Math.PI);
      const kh = 1 - sstep(HOME_RADIUS_DEG * 0.65, HOME_RADIUS_DEG * 1.6, dh);
      speed += (windKmhToUnits(this.home.windKmh) - speed) * kh;
      from += (((this.home.windFromDeg - from + 540) % 360) - 180) * kh;
    }
    // Hembusan saat badai.
    speed *= 1 + this.current.storm * (1.2 + Math.sin(t * 0.7) * 0.6 + Math.sin(t * 2.3) * 0.3);
    bearingDirection(planePos, (from + 180) % 360, this.wind).multiplyScalar(speed);
  }

  private updateRain(dt: number, cam: Vector3): void {
    const max = RAIN_MAX[this.tier];
    const active = Math.floor(max * Math.min(1, this.current.rain * 1.15));
    this.rainOpacity.value = 0.22 + this.current.rain * 0.3;
    this.rainGeo.setDrawRange(0, active * 2);
    this.rain.visible = active > 0;
    if (!active) return;
    const fall = 26 + this.current.storm * 8;
    const ux = _up.x;
    const uy = _up.y;
    const uz = _up.z;
    const vx = -ux * fall + this.wind.x * 1.6;
    const vy = -uy * fall + this.wind.y * 1.6;
    const vz = -uz * fall + this.wind.z * 1.6;
    // Garis memanjang ke arah kecepatan relatif (hujan "menyambar" saat terbang cepat).
    const rx = (vx - this.camVel.x) * 0.035;
    const ry = (vy - this.camVel.y) * 0.035;
    const rz = (vz - this.camVel.z) * 0.035;
    const d = this.drops;
    const p = this.rainPos;
    for (let i = 0; i < active; i++) {
      const o = i * 3;
      let x = d[o]! + vx * dt;
      let y = d[o + 1]! + vy * dt;
      let z = d[o + 2]! + vz * dt;
      const dx = x - cam.x;
      const dy = y - cam.y;
      const dz = z - cam.z;
      const h = dx * ux + dy * uy + dz * uz;
      const tx = dx - ux * h;
      const ty = dy - uy * h;
      const tz = dz - uz * h;
      const t2 = tx * tx + ty * ty + tz * tz;
      if (h < -BOX_H || h > BOX_H * 1.2 || t2 > BOX_R * BOX_R * 1.4) {
        this.respawn(cam, h < -BOX_H || t2 > BOX_R * BOX_R * 4, _v);
        x = _v.x;
        y = _v.y;
        z = _v.z;
      } else if (t2 > BOX_R * BOX_R) {
        // Keluar dari samping (pesawat melaju): pantulkan ke sisi seberang supaya kerapatan tetap.
        x = cam.x - tx * 0.96 + ux * h;
        y = cam.y - ty * 0.96 + uy * h;
        z = cam.z - tz * 0.96 + uz * h;
      }
      d[o] = x;
      d[o + 1] = y;
      d[o + 2] = z;
      const q = i * 6;
      p[q] = x;
      p[q + 1] = y;
      p[q + 2] = z;
      p[q + 3] = x - rx;
      p[q + 4] = y - ry;
      p[q + 5] = z - rz;
    }
    (this.rainGeo.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }

  /** Titik acak di kotak sekitar kamera; `top` = muncul di atas (bukan di mana saja). */
  private respawn(cam: Vector3, anywhere: boolean, out: Vector3): void {
    const a = this.rng() * Math.PI * 2;
    const rr = Math.sqrt(this.rng()) * BOX_R;
    // Dua sumbu tangen sederhana dari "atas".
    _w.set(_up.y, -_up.x, 0);
    if (_w.lengthSq() < 1e-6) _w.set(1, 0, 0);
    _w.normalize();
    _s.crossVectors(_up, _w);
    const h = anywhere ? (this.rng() * 2 - 1) * BOX_H : BOX_H * (0.8 + this.rng() * 0.4);
    out
      .copy(cam)
      .addScaledVector(_w, Math.cos(a) * rr)
      .addScaledVector(_s, Math.sin(a) * rr)
      .addScaledVector(_up, h);
  }

  private updateSnow(dt: number, cam: Vector3): void {
    const max = this.tier === 'low' ? 250 : 700;
    const active = Math.floor(max * Math.min(1, this.current.snow * 1.15));
    this.snowOpacity.value = 0.5 + this.current.snow * 0.4;
    this.snowGeo.setDrawRange(0, active * 4);
    this.snow.visible = active > 0;
    if (!active) return;
    const t = performance.now() / 1000;
    const f = this.flakes;
    const p = this.snowPos;
    _w.set(_up.y, -_up.x, 0).normalize();
    _s.crossVectors(_up, _w);
    for (let i = 0; i < active; i++) {
      const o = i * 3;
      const wob = Math.sin(t * 1.3 + i * 1.7) * 0.9;
      let x = f[o]! + (-_up.x * 3.2 + this.wind.x * 0.8 + _w.x * wob) * dt;
      let y = f[o + 1]! + (-_up.y * 3.2 + this.wind.y * 0.8 + _w.y * wob) * dt;
      let z = f[o + 2]! + (-_up.z * 3.2 + this.wind.z * 0.8 + _w.z * wob) * dt;
      const dx = x - cam.x;
      const dy = y - cam.y;
      const dz = z - cam.z;
      const h = dx * _up.x + dy * _up.y + dz * _up.z;
      const t2 = dx * dx + dy * dy + dz * dz - h * h;
      if (h < -BOX_H || h > BOX_H * 1.3 || t2 > BOX_R * BOX_R) {
        this.respawn(cam, true, _v);
        x = _v.x;
        y = _v.y;
        z = _v.z;
      }
      f[o] = x;
      f[o + 1] = y;
      f[o + 2] = z;
      // Kepingan = dua garis pendek bersilang.
      const s = 0.09;
      const q = i * 12;
      p[q] = x - _w.x * s;
      p[q + 1] = y - _w.y * s;
      p[q + 2] = z - _w.z * s;
      p[q + 3] = x + _w.x * s;
      p[q + 4] = y + _w.y * s;
      p[q + 5] = z + _w.z * s;
      p[q + 6] = x - _up.x * s;
      p[q + 7] = y - _up.y * s;
      p[q + 8] = z - _up.z * s;
      p[q + 9] = x + _up.x * s;
      p[q + 10] = y + _up.y * s;
      p[q + 11] = z + _up.z * s;
    }
    (this.snowGeo.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }

  private updateLightning(dt: number, cam: Vector3): void {
    uFlash.value = Math.max(0, uFlash.value - dt * 4.5);
    if (this.boltT >= 0) {
      this.boltT += dt;
      this.bolt.visible = this.boltT < 0.22 && Math.sin(this.boltT * 90) > -0.3;
      if (this.boltT > 0.3) this.boltT = -1;
    }
    // Badai di sekitar (kamera di bawah/dekat sel badai).
    let storm = this.current.storm;
    for (const c of this.visibleCells) if (c.kind === 'storm') storm = Math.max(storm, c.strength * 0.5);
    if (storm < 0.25) return;
    this.nextStrike -= dt * storm;
    if (this.nextStrike > 0) return;
    this.nextStrike = 3 + this.rng() * 9;
    // Sambaran di arah acak, 30–170 unit dari kamera.
    const dist = 30 + this.rng() * 140;
    this.respawn(cam, true, _v);
    _v.sub(cam);
    _v.addScaledVector(_up, -_v.dot(_up));
    if (_v.lengthSq() < 1e-4) _v.set(1, 0, 0);
    _v.normalize().multiplyScalar(dist).add(cam);
    const ground = _w.copy(_v).normalize();
    const top = _s.copy(ground).multiplyScalar(PLANET_RADIUS + CLOUD_BASE);
    const segs = 12;
    const bp = this.boltPos;
    let px = top.x;
    let py = top.y;
    let pz = top.z;
    for (let i = 0; i < segs; i++) {
      const k = (i + 1) / segs;
      const hh = CLOUD_BASE * (1 - k);
      const jx = (this.rng() - 0.5) * 3.5;
      const jy = (this.rng() - 0.5) * 3.5;
      const jz = (this.rng() - 0.5) * 3.5;
      const nx = ground.x * (PLANET_RADIUS + hh) + jx;
      const ny = ground.y * (PLANET_RADIUS + hh) + jy;
      const nz = ground.z * (PLANET_RADIUS + hh) + jz;
      const o = i * 6;
      bp[o] = px;
      bp[o + 1] = py;
      bp[o + 2] = pz;
      bp[o + 3] = nx;
      bp[o + 4] = ny;
      bp[o + 5] = nz;
      px = nx;
      py = ny;
      pz = nz;
    }
    (this.bolt.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.bolt.geometry.setDrawRange(0, segs * 2);
    this.boltT = 0;
    uFlash.value = Math.min(1, 0.45 + 60 / dist);
    // Guntur tertunda: dunia mainan → "kecepatan suara" 55 unit/dtk.
    bus.emit('weather:thunder', { delay: Math.min(4, Math.max(0.15, dist / 55)), strength: Math.min(1, 50 / dist + 0.3) });
  }

  private updateRainbow(dt: number, cam: Vector3, sunDir: Vector3, alt: number): void {
    if (this.raw.rain > 0.08) this.sinceRain = 0;
    else this.sinceRain += dt;
    const sunUp = _up.dot(sunDir);
    const want = this.wetness > 0.2 && this.sinceRain > 3 && this.sinceRain < 70 && sunUp > 0.04 && sunUp < 0.75 && alt < 140;
    this.rainbowK.value += ((want ? 1 : 0) - this.rainbowK.value) * Math.min(1, dt * 0.4);
    this.rainbow.visible = this.rainbowK.value > 0.01;
    if (!this.rainbow.visible) return;
    // Pusat pelangi = titik anti-matahari; torus menghadap kamera di arah itu.
    _v.copy(sunDir).negate();
    const dist = 190;
    this.rainbow.position.copy(cam).addScaledVector(_v, dist);
    quatFromUpForward(_up, _v, _q);
    this.rainbow.quaternion.copy(_q);
    this.rainbow.scale.setScalar(dist * Math.tan((42 * Math.PI) / 180));
  }

  private updateStorms(cam: Vector3): void {
    this.visibleCells.length = 0;
    if (this.force || !settings.get().world.realHometownWeather) {
      this.shafts.count = 0;
      this.puffs.count = 0;
      return;
    }
    _v.copy(cam).normalize();
    for (const c of this.cells) {
      if (c.kind === 'fog') continue;
      const dDeg = Math.acos(Math.min(1, _v.dot(c.dir))) * (180 / Math.PI);
      if (dDeg * UNIT_PER_DEG < 420) this.visibleCells.push(c);
      if (this.visibleCells.length >= MAX_SHAFTS) break;
    }
    // Hujan nyata Medan juga dapat awan gelap di atas bandara.
    if (this.home && this.visibleCells.length < MAX_SHAFTS) {
      const p = wmoToProfile(this.home.code);
      if (p.rain > 0.2 || p.snow > 0.2) {
        this.visibleCells.push({ lat: HOME.lat, lon: HOME.lon, radiusDeg: 4, kind: p.storm > 0.3 ? 'storm' : 'rain', strength: Math.max(p.rain, p.snow), dir: _homeDir });
      }
    }
    let pi = 0;
    this.visibleCells.forEach((c, i) => {
      const radius = Math.min(38, c.radiusDeg * UNIT_PER_DEG * 0.42);
      quatFromUpForward(c.dir, _w.set(0, 1, 0).cross(c.dir).lengthSq() > 1e-6 ? _w.normalize() : _w.set(1, 0, 0), _q);
      _s.set(radius, CLOUD_BASE, radius);
      _m.compose(_v.copy(c.dir).multiplyScalar(PLANET_RADIUS - 1), _q, _s);
      this.shafts.setMatrixAt(i, _m);
      const rng = mulberry32(Math.floor(c.lat * 1000 + c.lon * 7));
      for (let k = 0; k < PUFFS_PER_CELL; k++) {
        const a = (k / PUFFS_PER_CELL) * Math.PI * 2 + rng();
        const rr = k === 0 ? 0 : radius * (0.45 + rng() * 0.45);
        const size = radius * (k === 0 ? 0.62 : 0.34 + rng() * 0.2);
        _w.set(Math.cos(a) * rr, CLOUD_BASE + 6 + rng() * 6, Math.sin(a) * rr).applyQuaternion(_q);
        _s.set(size, size * 0.42, size);
        _m.compose(_w.add(_up.copy(c.dir).multiplyScalar(PLANET_RADIUS)), _q, _s);
        this.puffs.setMatrixAt(pi++, _m);
      }
    });
    this.shafts.count = this.visibleCells.length;
    this.puffs.count = pi;
    this.shafts.instanceMatrix.needsUpdate = true;
    this.puffs.instanceMatrix.needsUpdate = true;
    this.shaftK.value = 0.3;
    _up.copy(cam).normalize();
  }

  dispose(): void {
    for (const o of [this.rain, this.snow, this.bolt, this.rainbow]) {
      o.geometry.dispose();
      (o.material as LineBasicNodeMaterial).dispose();
    }
    this.shafts.geometry.dispose();
    this.puffs.geometry.dispose();
    this.shafts.dispose();
    this.puffs.dispose();
  }
}
