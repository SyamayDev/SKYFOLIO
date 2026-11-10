import { defineConfig } from '@playwright/test';

/**
 * `npm run shots` — screenshot otomatis di 4 viewport (CLAUDE.md bagian 6) ke tests/shots/.
 * Claude Code wajib melihat hasilnya.
 */
const PORT = 4174;

export default defineConfig({
  testDir: 'tests/visual',
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/shots',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
