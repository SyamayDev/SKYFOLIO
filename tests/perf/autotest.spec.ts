/**
 * Audit performa (docs/11): skenario `?autotest=1` (bandara → pulau proyek → Pegunungan Skill → orbit → pulang)
 * per tier. Gagal bila ada error, atau draw call / segitiga melewati anggaran tier.
 * Hasil lengkap: tests/perf/results/last.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface PerfLeg {
  dest: string;
  seconds: number;
  arrived: boolean;
  maxAltitude: number;
  maxDrawCalls: number;
}
interface PerfResult {
  done: boolean;
  tier: string;
  backend: string;
  seconds: number;
  frames: number;
  avgFps: number;
  low1Fps: number;
  avgDrawCalls: number;
  maxDrawCalls: number;
  avgTriangles: number;
  maxTriangles: number;
  avgPhysicsMs: number;
  maxPhysicsMs: number;
  heapMB: number | null;
  peak: { lat: number; lon: number; altitude: number; leg: string };
  legs: PerfLeg[];
  errors: string[];
  withinBudget: boolean;
}
type SkyWindow = Window & { __skyfolio?: { ready?: boolean; autotest(): PerfResult | { done: false } | null } };

const TIERS = (process.env.PERF_TIERS ?? 'low,medium,high').split(',').map((t) => t.trim());
// Tanpa GPU (swiftshader) atau PERF_RENDERER=webgl → paksa WebGL2.
const RENDERER = !process.env.PERF_GPU || process.env.PERF_RENDERER === 'webgl' ? '&renderer=webgl' : '';
const results: PerfResult[] = [];

for (const tier of TIERS) {
  test(`autotest tier ${tier}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`/?autotest=1&test&quality=${tier}${RENDERER}`);
    await page.waitForFunction(() => (window as SkyWindow).__skyfolio?.ready === true, null, { timeout: 150_000 });
    await page.waitForFunction(() => (window as SkyWindow).__skyfolio?.autotest()?.done === true, null, { timeout: 330_000, polling: 2000 });
    const r = (await page.evaluate(() => (window as SkyWindow).__skyfolio?.autotest())) as PerfResult;
    results.push(r);
    const legs = r.legs.map((l) => `${l.dest}${l.arrived ? '✓' : '…'}${l.seconds}s/${l.maxDrawCalls}dc/${Math.round(l.maxAltitude)}m`).join(' ');
    console.log(
      `[${r.tier}/${r.backend}] ${r.seconds}s fps avg ${r.avgFps} (1% low ${r.low1Fps}) · draw ${r.avgDrawCalls}/${r.maxDrawCalls} · tri ${(r.avgTriangles / 1000).toFixed(0)}k/${(r.maxTriangles / 1000).toFixed(0)}k · fisika ${r.avgPhysicsMs}/${r.maxPhysicsMs} ms · heap ${r.heapMB ?? '-'} MB · puncak di ${r.peak.lat},${r.peak.lon} alt ${r.peak.altitude} (${r.peak.leg}) · ${legs}`,
    );
    expect(pageErrors, 'pageerror').toEqual([]);
    expect(r.errors, 'error selama skenario').toEqual([]);
    expect(r.withinBudget, `anggaran ${tier}: draw ${r.maxDrawCalls}, tri ${r.maxTriangles}`).toBe(true);
  });
}

test.afterAll(() => {
  mkdirSync('tests/perf/results', { recursive: true });
  writeFileSync(`tests/perf/results/last-${process.env.PERF_GPU ? 'gpu' : 'sw'}-${RENDERER ? 'webgl' : 'auto'}.json`, JSON.stringify({ at: new Date().toISOString(), gpu: !!process.env.PERF_GPU, results }, null, 2));
});
