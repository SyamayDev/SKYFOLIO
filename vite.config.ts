import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    // Rapier menyematkan wasm sebagai base64, jadi chunk-nya memang besar.
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        ringkas: resolve(root, 'ringkas/index.html'),
        cv: resolve(root, 'cv/index.html'),
        // Hangar hanya untuk pengembangan lokal, tidak ikut ke produksi.
        ...(command === 'serve' ? { hangar: resolve(root, 'hangar/index.html') } : {}),
      },
    },
  },
}));
