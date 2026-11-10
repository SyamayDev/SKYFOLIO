# Kredit dan Lisensi

Claude Code wajib memperbarui file ini setiap kali menambah library, data, font, atau aset pihak ketiga. Hanya lisensi CC0, MIT, BSD, Apache-2.0, OFL, atau public domain.

| Nama | Jenis | Sumber | Lisensi | Dipakai untuk |
| --- | --- | --- | --- | --- |
| three.js | Library | threejs.org | MIT | Render 3D |
| Rapier | Library | rapier.rs | Apache-2.0 | Fisika |
| Howler.js | Library | howlerjs.com | MIT | Audio |
| Tone.js | Library | tonejs.github.io | MIT | Musik prosedural |
| Natural Earth | Data | naturalearthdata.com | Public domain | Garis pantai, danau, kota |
| Fredoka | Font | Google Fonts / Fontsource | OFL | Judul |
| Nunito Sans | Font | Google Fonts / Fontsource | OFL | Teks |
| Open-Meteo | Data cuaca | open-meteo.com | Lihat ketentuan Open-Meteo (gratis non-komersial, wajib atribusi) | Cuaca Medan |

<!-- Tambahkan baris baru di bawah -->
| Svelte | Library | svelte.dev | MIT | UI overlay (HUD, menu, pengaturan) |
| three-mesh-bvh | Library | github.com/gkjohnson/three-mesh-bvh | MIT | Raycast cepat (disiapkan untuk pemilihan objek) |
| zod | Library | zod.dev | MIT | Validasi skema konten (Fase 1) |
| suncalc | Library | github.com/mourner/suncalc | BSD-2-Clause | Cadangan perhitungan matahari/bulan (Fase 2) |
| lil-gui | Library | lil-gui.georgealways.com | MIT | Panel debug (`#debug`, dimuat dinamis) |
| Natural Earth: ne_50m_land, ne_50m_lakes, ne_50m_populated_places_simple | Data | naturalearthdata.com (via github.com/nvkelso/natural-earth-vector) | Public domain | Garis pantai, danau, dan kota di `scripts/build-earth.ts` |
| Algoritma simplex noise (Stefan Gustavson) | Algoritma | Makalah publik "Simplex noise demystified" | Public domain | Implementasi sendiri di `src/utils/noise.ts` |
| Vite, Vitest | Alat build/tes | vitejs.dev, vitest.dev | MIT | Pengembangan |
| Playwright | Alat tes | playwright.dev | Apache-2.0 | Tes e2e dan screenshot |
| TypeScript | Bahasa | typescriptlang.org | Apache-2.0 | Pengembangan |
| ESLint, typescript-eslint, eslint-plugin-svelte, Prettier | Alat | eslint.org, prettier.io | MIT | Kualitas kode |
| tsx | Alat | github.com/privatenumber/tsx | MIT | Menjalankan skrip TypeScript |
| sharp | Alat build | sharp.pixelplumbing.com | Apache-2.0 (biner libvips bawaan: LGPL-3.0, hanya dipakai saat build, tidak ikut ke situs) | Menulis PNG data planet; optimasi foto (Fase 1) |
| pdfjs-dist | Alat build | mozilla.github.io/pdf.js | Apache-2.0 | Thumbnail sertifikat (Fase 1) |

Catatan: GSAP sengaja tidak dipakai karena lisensinya ("Standard no-charge") tidak termasuk daftar lisensi yang diizinkan. Semua model 3D, tekstur, dan bunyi di Fase 0 dibuat sendiri lewat kode (tanpa aset pihak ketiga).
