import { defineConfig } from '@playwright/test';

/**
 * `npm run perf` — audit performa dengan skenario `?autotest=1` per tier (docs/11 bagian 1 & 3).
 * Memakai hasil build produksi (vite preview), bukan server dev.
 * Bawaan: renderer software (swiftshader) supaya jalan di mana saja → fps tidak mewakili HP/laptop sungguhan,
 * tetapi draw call, segitiga, dan error tetap valid. `PERF_GPU=1` memakai GPU asli (WebGPU bila ada).
 */
const PORT = 4176;
const gpu = !!process.env.PERF_GPU;
/** PERF_CHANNEL=chrome memakai Chrome terpasang (Chromium Playwright di Windows tidak membawa dxcompiler → WebGPU gagal). */
const channel = process.env.PERF_CHANNEL;

export default defineConfig({
  testDir: 'tests/perf',
  timeout: 420_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/perf',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    ...(channel ? { channel } : {}),
    launchOptions: {
      args: gpu
        ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']
        : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `npx vite build --logLevel warn && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
