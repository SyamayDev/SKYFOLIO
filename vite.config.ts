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
    // Rapier (compat) menyematkan wasm ±3 MB sebagai base64, jadi chunk-nya memang besar (lihat docs/decisions.md).
    chunkSizeWarningLimit: 4600,
    rollupOptions: {
      output: {
        // Pisahkan pustaka besar supaya diunduh paralel dan di-cache terpisah dari kode kita.
        manualChunks(id: string) {
          if (id.includes('@dimforge/rapier3d')) return 'rapier';
          if (id.includes('/node_modules/three/')) return 'three';
          return undefined;
        },
      },
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
