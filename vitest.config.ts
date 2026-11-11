import { defineConfig } from 'vitest/config';
import { contentPlugin } from './scripts/vite-plugin-content.ts';

export default defineConfig({
  // `virtual:content` (isi content/) dibutuhkan modul game & UI yang diuji.
  plugins: [contentPlugin()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
