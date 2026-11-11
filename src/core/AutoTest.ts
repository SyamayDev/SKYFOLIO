/**
 * Skenario terbang otomatis `?autotest=1` (docs/11 bagian 3): naik pesawat, autopilot ke pulau proyek unggulan →
 * Pegunungan Skill → orbit → pulang, sambil mencatat fps, draw call, segitiga, waktu fisika, dan error.
 * Hasilnya di `window.__skyfolio.autotest()` dan ringkasan di console (info).
 * Dipakai `npm run perf` (Playwright) untuk regresi performa per tier.
 */
import { AUTOTEST } from '../config/quality';

export interface AutoTestSample {
  fps: number;
  drawCalls: number;
  triangles: number;
  physicsMs: number;
  altitude: number;
}

export interface AutoTestHost {
  board(): void;
  flyTo(dest: string): boolean;
  autopilot(): { active: boolean; arrived: boolean };
  /** Isi `out` tanpa membuat objek baru (dipanggil tiap frame). */
  sample(out: AutoTestSample): void;
  tier(): string;
  backend(): string;
  /** Posisi pesawat (dipanggil hanya saat rekor draw call baru, bukan tiap frame). */
  geo(): { lat: number; lon: number };
}

export interface AutoTestLeg {
  dest: string;
  seconds: number;
  arrived: boolean;
  maxAltitude: number;
  maxDrawCalls: number;
}

export interface AutoTestResult {
  done: boolean;
  tier: string;
  backend: string;
  seconds: number;
  frames: number;
  avgFps: number;
  /** Rata-rata 1% frame terlambat (fps). */
  low1Fps: number;
  avgDrawCalls: number;
  maxDrawCalls: number;
  avgTriangles: number;
  maxTriangles: number;
  avgPhysicsMs: number;
  maxPhysicsMs: number;
  heapMB: number | null;
  /** Di mana draw call memuncak (untuk mencari biang lonjakan). */
  peak: { lat: number; lon: number; altitude: number; leg: string };
  legs: AutoTestLeg[];
  errors: string[];
  withinBudget: boolean;
}

export class AutoTest {
  private readonly frameTimes = new Float32Array(AUTOTEST.MAX_FRAMES);
  private readonly s: AutoTestSample = { fps: 0, drawCalls: 0, triangles: 0, physicsMs: 0, altitude: 0 };
  private frames = 0;
  private elapsed = 0;
  private started = false;
  private legIndex = -1;
  private legTime = 0;
  private sumDraw = 0;
  private sumTri = 0;
  private sumPhys = 0;
  private maxDraw = 0;
  private maxTri = 0;
  private maxPhys = 0;
  private peak = { lat: 0, lon: 0, altitude: 0, leg: '' };
  private readonly legs: AutoTestLeg[] = [];
  private readonly errors: string[] = [];
  private result: AutoTestResult | null = null;
  private readonly onError = (e: ErrorEvent): void => {
    this.errors.push(`error: ${e.message}`);
  };
  private readonly onRejection = (e: PromiseRejectionEvent): void => {
    this.errors.push(`unhandledrejection: ${String(e.reason)}`);
  };
  private origConsoleError: typeof console.error | null = null;

  constructor(private readonly host: AutoTestHost) {
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
    // Error console juga dihitung (docs/7: error di console adalah bug).
    this.origConsoleError = console.error;
    const orig = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      this.errors.push(`console.error: ${args.map(String).join(' ').slice(0, 300)}`);
      orig(...args);
    };
  }

  get done(): boolean {
    return this.result !== null;
  }

  update(rawDt: number): void {
    if (this.result) return;
    this.elapsed += rawDt;
    if (!this.started) {
      if (this.elapsed < AUTOTEST.START_DELAY) return;
      this.started = true;
      this.elapsed = 0;
      this.host.board();
      this.nextLeg();
      return;
    }
    // Rekam frame
    const h = this.host;
    h.sample(this.s);
    if (this.frames < this.frameTimes.length) this.frameTimes[this.frames] = rawDt;
    this.frames++;
    this.sumDraw += this.s.drawCalls;
    this.sumTri += this.s.triangles;
    this.sumPhys += this.s.physicsMs;
    if (this.s.drawCalls > this.maxDraw) {
      this.maxDraw = this.s.drawCalls;
      const g = this.host.geo();
      this.peak = { lat: Math.round(g.lat * 100) / 100, lon: Math.round(g.lon * 100) / 100, altitude: Math.round(this.s.altitude), leg: AUTOTEST.LEGS[this.legIndex]?.dest ?? '' };
    }
    if (this.s.triangles > this.maxTri) this.maxTri = this.s.triangles;
    if (this.s.physicsMs > this.maxPhys) this.maxPhys = this.s.physicsMs;

    const leg = this.legs[this.legIndex];
    if (!leg) return;
    this.legTime += rawDt;
    if (this.s.altitude > leg.maxAltitude) leg.maxAltitude = this.s.altitude;
    if (this.s.drawCalls > leg.maxDrawCalls) leg.maxDrawCalls = this.s.drawCalls;
    const cap = AUTOTEST.LEGS[this.legIndex]?.cap ?? 30;
    const ap = h.autopilot();
    const arrived = this.legTime > AUTOTEST.MIN_LEG && (ap.arrived || !ap.active);
    if (arrived || this.legTime >= cap) {
      leg.seconds = Math.round(this.legTime * 10) / 10;
      leg.arrived = arrived;
      this.nextLeg();
    }
  }

  private nextLeg(): void {
    this.legIndex++;
    this.legTime = 0;
    const def = AUTOTEST.LEGS[this.legIndex];
    if (!def) {
      this.finish();
      return;
    }
    this.legs.push({ dest: def.dest, seconds: 0, arrived: false, maxAltitude: 0, maxDrawCalls: 0 });
    if (!this.host.flyTo(def.dest)) this.errors.push(`flyTo gagal: ${def.dest}`);
  }

  private finish(): void {
    const n = Math.min(this.frames, this.frameTimes.length);
    const times = Array.from(this.frameTimes.subarray(0, n)).sort((a, b) => b - a);
    const worst = times.slice(0, Math.max(1, Math.floor(n * 0.01)));
    const worstAvg = worst.reduce((a, b) => a + b, 0) / Math.max(1, worst.length);
    const total = times.reduce((a, b) => a + b, 0);
    const f = Math.max(1, this.frames);
    const tier = this.host.tier();
    const budget = AUTOTEST.BUDGET[tier as keyof typeof AUTOTEST.BUDGET] ?? AUTOTEST.BUDGET.high;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    this.result = {
      done: true,
      tier,
      backend: this.host.backend(),
      seconds: Math.round(this.elapsed * 10) / 10,
      frames: this.frames,
      avgFps: round1(n / Math.max(1e-6, total)),
      low1Fps: round1(worstAvg > 0 ? 1 / worstAvg : 0),
      avgDrawCalls: Math.round(this.sumDraw / f),
      maxDrawCalls: this.maxDraw,
      peak: this.peak,
      avgTriangles: Math.round(this.sumTri / f),
      maxTriangles: this.maxTri,
      avgPhysicsMs: Math.round((this.sumPhys / f) * 100) / 100,
      maxPhysicsMs: Math.round(this.maxPhys * 100) / 100,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      legs: this.legs,
      errors: this.errors.slice(0, 50),
      withinBudget: this.sumDraw / f <= budget.drawCalls && this.maxDraw <= budget.peakDrawCalls && this.sumTri / f <= budget.triangles,
    };
    this.restore();
    console.info('[autotest]', JSON.stringify(this.result));
  }

  report(): AutoTestResult | { done: false; seconds: number; leg: string | null } {
    return this.result ?? { done: false, seconds: Math.round(this.elapsed), leg: AUTOTEST.LEGS[this.legIndex]?.dest ?? null };
  }

  private restore(): void {
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
    if (this.origConsoleError) console.error = this.origConsoleError;
    this.origConsoleError = null;
  }

  dispose(): void {
    this.restore();
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
