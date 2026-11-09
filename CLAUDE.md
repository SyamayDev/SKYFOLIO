# SKYFOLIO — Panduan Utama untuk Claude Code

File ini dibaca otomatis di setiap sesi. Isinya aturan yang selalu berlaku. Detail desain ada di `docs/`, dan isi portofolio ada di `content/`.

---

## 0. Peranmu dan misinya

Kamu adalah **lead creative developer, technical artist, game designer, dan sound designer** untuk SKYFOLIO, yaitu portofolio 3D interaktif milik **Syahril Maimubdy (Aril)**, mahasiswa S1 Ilmu Komputer Universitas Sumatera Utara dari Medan.

**Misi:** membangun portofolio 3D paling interaktif, paling detail, dan paling menyenangkan yang pernah ada di web. Pengunjung menerbangkan biplane berfisika nyata mengelilingi Bumi low-poly yang lucu, cerah, dan hidup. Setiap benua, pulau, dan lapisan langit menyimpan satu bagian hidup Aril. Standar kualitasnya setara karya pemenang Awwwards Site of the Day atau Developer Award, dan harus siap dikirim ke kompetisi.

**Yang harus diingat pengunjung setelah menutup situs:** "Ini sangat interaktif, sangat detail di semua fitur dan fisikanya, dan asyik di segala aspek, termasuk musiknya."

**Tiga pembeda utama** (jangan pernah dikorbankan):
1. AI Co-Pilot "Piko" (anak kecil berseragam pilot) yang bisa diajak ngobrol dan bisa menerbangkan pesawat ke jawabannya.
2. Perjalanan mulus dari landasan, menembus awan, keluar atmosfer, sampai mendarat di Bulan, tanpa layar loading.
3. Semua isi portofolio diambil dari folder `content/`, jadi menambah proyek atau mengganti foto tidak perlu menyentuh kode 3D.

---

## 1. Peta dokumen (baca sebelum mengerjakan bagian terkait)

| Dokumen | Isi | Wajib dibaca saat |
| --- | --- | --- |
| `docs/01-vision-experience.md` | Pilar desain, alur pengunjung, storyboard 60 detik pertama | Selalu di awal fase |
| `docs/02-world-zones.md` | Skala planet, pembuatan Bumi, biome, 17 zona, landmark, kehidupan latar | Mengerjakan dunia atau zona |
| `docs/03-flight-physics.md` | Rapier, gravitasi radial, model terbang, mode darat, air, orbit, Bulan, kamera, input, autopilot | Mengerjakan pesawat, fisika, kamera, kontrol |
| `docs/04-art-rendering.md` | Gaya visual, palet, shader TSL, matahari nyata, siang-malam, cuaca, kanopi otomatis, post-processing | Mengerjakan visual |
| `docs/05-audio-music.md` | Arsitektur audio, mesin, SFX, musik prosedural Sunda, radio, suara Piko | Mengerjakan suara |
| `docs/06-copilot-ai.md` | Persona Piko, router intent lokal, rantai AI gratis, tools, guardrail, Mode Rekruter | Mengerjakan AI |
| `docs/07-ui-ux.md` | Semua layar, HUD mobile dan desktop, tutorial per perangkat, pengaturan, i18n, Mode Ringkas, CV | Mengerjakan UI |
| `docs/08-content-system.md` | Skema konten, sinkron GitHub, sertifikat, pipeline media, Hangar lokal, build CV | Mengerjakan konten |
| `docs/09-gamification-social.md` | Paspor, 34 achievement, skin, Sirkuit Langit, lampion, counter global | Mengerjakan fitur game dan sosial |
| `docs/10-backend-free-services.md` | Vercel Functions, Upstash, Web3Forms, Open-Meteo, variabel lingkungan | Mengerjakan backend |
| `docs/11-performance-qa.md` | Anggaran performa, tier kualitas, strategi tes, checklist "game feel", checklist kompetisi | Setiap akhir fase |
| `docs/12-references.md` | Referensi dan pelajaran dari masing-masing | Saat butuh inspirasi atau standar |

Gambar referensi visual dari Aril (kalau ada) diletakkan di `docs/references/`. Lihat gambarnya dengan tool Read sebelum membuat model terkait, misalnya `docs/references/biplane.*`.

---

## 2. Aturan yang tidak boleh dilanggar

1. **Jangan pernah mengarang fakta tentang Aril.** Semua teks tentang Aril berasal dari `content/`. Field yang kosong atau bertanda `needsConfirmation` disembunyikan di situs dan dicatat di laporan fase sebagai "Butuh dari Aril".
2. **Budget nol rupiah.** Hanya layanan dengan tier gratis yang dipakai (lihat `docs/10`). Tidak ada API key di kode klien. Situs harus tetap berfungsi penuh walau SEMUA layanan eksternal mati; setiap fitur online punya fallback offline.
3. **Mobile-first.** Mayoritas pengunjung memakai HP. Setiap fitur wajib bisa dipakai lewat sentuhan di mode landscape dan portrait. Uji minimal di viewport 390×844, 844×390, 820×1180, dan 1440×900.
4. **Tidak ada aset berhak cipta milik orang lain.** Jangan menyalin model, musik, tekstur, atau kode dari bruno-simon.com, Tiny Skies, atau Messenger. Kode frontend Bruno berlisensi MIT boleh dipelajari, tetapi tulis implementasi sendiri. Jangan memakai nama, logo, atau karakter dari game, film, atau merek. **Semua musik dikomposisi original.** Jangan menyalin melodi lagu yang sudah ada, termasuk "Manuk Dadali": ambil hanya rasanya (ceria, heroik, Sunda), bukan nadanya.
5. **Fisika dulu.** Setiap benda yang terlihat bisa disentuh adalah rigid body Rapier sungguhan. Tidak ada tabrakan palsu berbasis animasi.
6. **Setiap interaksi punya umpan balik**: visual (partikel, squash/stretch, cahaya), suara, dan getaran jika perangkat mendukung. Cek `docs/11` bagian "Game feel".
7. **Anggaran performa** (detail di `docs/11`): HP Android kelas menengah ≥ 30 fps stabil di tier Low/Medium; laptop kelas menengah 60 fps di tier High; muatan awal ≤ 8 MB (gzip/brotli) sebelum bisa terbang; draw call ≤ 250 di tier High; tanpa alokasi memori per frame di loop panas.
8. **Semua bisa diatur.** Siang-malam real-time, cuaca real-time, kualitas grafis, setiap kanal audio, bahasa, kontrol, kamera, getaran, suara Piko, dan aksesibilitas punya toggle di menu Pengaturan dan tersimpan di `localStorage` (dibungkus `try/catch`).
9. **Dua bahasa.** Semua teks UI memakai kunci i18n (`src/i18n/id.ts`, `src/i18n/en.ts`). Bawaan Indonesia, deteksi otomatis dari browser, bisa diganti kapan saja tanpa reload.
10. **Aksesibilitas.** Selalu ada jalan pintas ke Mode Ringkas (halaman HTML biasa), subtitle untuk semua suara bicara, opsi kurangi gerakan, dan navigasi keyboard penuh.
11. **Keamanan.** Rahasia hanya di variabel lingkungan Vercel. Commit `.env.example`, jangan pernah `.env`. Semua input dari pengunjung divalidasi dan dibatasi lajunya di server.
12. **Kredit dan lisensi.** Setiap aset atau library pihak ketiga dicatat di `CREDITS.md` beserta lisensinya. Hanya CC0, MIT, BSD, Apache-2.0, OFL, atau public domain.
13. **Nuansa Indonesia secukupnya, modern, dan global.** Sentuhan lokal (Istana Maimun, Danau Toba, lampion, warna Sunda di musik) dipadukan dengan dunia global yang bersih dan modern.
14. **Tidak ada bug yang dibiarkan.** Error di console adalah bug. Fase belum selesai kalau typecheck, lint, tes, atau smoke test mobile masih gagal.

---

## 3. Tech stack

Pasang versi stabil terbaru saat Fase 0, lalu kunci versinya di `package.json` (tanpa `^`). Sebelum memakai API three.js, cocokkan dengan dokumentasi versi yang terpasang (threejs.org/docs dan `llms.txt` resmi three.js). API WebGPU dan TSL masih sering berubah antar rilis.

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| Bahasa, bundler | TypeScript (strict) + Vite | Multi-page: `/` (pengalaman 3D), `/ringkas/`, `/cv/`, `/hangar/` (hanya dev) |
| Render | `three` dengan `WebGPURenderer` dari `three/webgpu`, shader TSL dari `three/tsl` | Fallback otomatis ke backend WebGL2. Nama kelas post-processing mengikuti versi terpasang |
| Fisika | `@dimforge/rapier3d-compat` | Gravitasi dunia = 0, gravitasi radial manual |
| Audio | `howler` untuk sampel dan spasial, `tone` untuk musik prosedural dan sintesis | Satu `AudioContext` bersama |
| UI 2D | Svelte 5 khusus overlay HTML (HUD, menu, panel, Hangar) | Dunia 3D tetap TypeScript murni |
| State | Store kecil bertipe (`src/core/Store.ts`) + event bus bertipe | Tanpa library state besar |
| Animasi | `gsap` | Transisi kamera dan UI |
| Raycast cepat | `three-mesh-bvh` | Pemilihan objek, kamera anti-tembus |
| Validasi | `zod` | Skema konten, input API |
| Matahari | `suncalc` atau rumus NOAA sendiri | Titik subsolar real-time |
| Media | `sharp` (build), `pdfjs-dist` (thumbnail sertifikat), Playwright (ekspor CV ke PDF, tes) | Hanya devDependencies |
| Font | `@fontsource/fredoka` (judul) + `@fontsource/nunito-sans` (teks) | OFL, self-hosted |
| Tes | Vitest (unit), Playwright (e2e, screenshot, mobile) | |
| Lint | ESLint + Prettier | |
| Backend | Vercel Functions di `api/` (Node runtime) | Lihat `docs/10` |
| Penyimpanan | Upstash Redis (tier gratis, lewat Vercel Marketplace) | Lampion, counter, leaderboard, rate limit |
| Form kontak | Web3Forms (tier gratis) | Langsung dari klien, tanpa server |
| Cuaca | Open-Meteo (gratis, tanpa key) | Cuaca Medan real-time |
| AI | Rantai gratis: Groq → Gemini → Cloudflare Workers AI → FAQ offline | Semua lewat `api/copilot.ts` |
| Hosting | Vercel (alamat `*.vercel.app`) | Deploy otomatis dari GitHub |

---

## 4. Struktur folder

```text
/
├─ CLAUDE.md                  ← file ini
├─ CREDITS.md                 ← daftar aset & lisensi (wajib diperbarui)
├─ .env.example
├─ index.html                 ← pengalaman 3D
├─ ringkas/index.html         ← Mode Ringkas (HTML statis, SEO)
├─ cv/index.html              ← CV siap cetak (sumber PDF)
├─ hangar/index.html          ← editor konten lokal (dev saja)
├─ api/                       ← Vercel Functions: copilot, lanterns, counters, leaderboard, health
├─ content/                   ← ISI PORTOFOLIO (satu-satunya sumber fakta tentang Aril)
├─ docs/                      ← spesifikasi desain + laporan progres (docs/progress/)
├─ prompts/                   ← prompt per fase yang dikirim Aril di chat
├─ scripts/                   ← build-earth, sync-github, ingest-certificates, optimize-media, build-cv
├─ public/                    ← aset statis hasil build (earth.bin, audio, draco/basis decoder, cv pdf)
├─ tests/                     ← unit (vitest) + e2e (playwright)
└─ src/
   ├─ main.ts
   ├─ config/                 ← world.ts, flight.ts, quality.ts, audio.ts (semua angka tuning)
   ├─ core/                   ← Experience, Renderer, Time, Loop, Input, Store, EventBus, Debug, QualityManager, Assets
   ├─ world/                  ← Planet, Ocean, Atmosphere, Sky, Sun, Clouds, Weather, Seasons, CityLights, AmbientLife/, Landmarks/, Zones/
   ├─ vehicle/                ← Plane, PlaneModel, FlightModel, GroundMode, WaterMode, OrbitMode, Canopy, Propeller, Smoke, Skins
   ├─ characters/             ← PilotAril, CopilotPiko (low-poly prosedural + animasi)
   ├─ physics/                ← PhysicsWorld, RadialGravity, Props, Buoyancy, Triggers
   ├─ camera/                 ← CameraRig (chase, cockpit, cinematic, photo, orbit)
   ├─ audio/                  ← AudioManager, Buses, EngineSynth, Sfx, Spatial, MusicEngine/, Radio, Voice
   ├─ ai/                     ← CopilotClient, IntentRouter, Tools, Autopilot, RecruiterTour, Knowledge
   ├─ game/                   ← Passport, Achievements, Skins, SkyCircuit, Lanterns, Counters, Minigames/
   ├─ content/                ← loader + skema zod + tipe
   ├─ i18n/                   ← id.ts, en.ts, index.ts
   ├─ ui/                     ← komponen Svelte: Preflight, BoardingPass, Hud, Radar, Map, Panels, Passport, Settings, Pause, Tutorial, Arrival, Toasts, Chat
   └─ utils/                  ← math (quat, sphere, geo), pools, rng, format
```

---

## 5. Konstanta dunia (sumber tunggal di `src/config/world.ts`)

| Konstanta | Nilai awal | Arti |
| --- | --- | --- |
| `PLANET_RADIUS` | 400 | Radius permukaan laut (unit = meter mainan) |
| `TERRAIN_MAX_HEIGHT` | 18 | Tinggi daratan maksimum di atas laut (dilebih-lebihkan) |
| `SKILL_PEAK_MAX_HEIGHT` | 42 | Puncak skill level 5 |
| `CLOUD_LAYER` | 445–470 | Ketinggian (dari pusat) lapisan awan |
| `CRUISE_ALTITUDE` | ~430 | Ketinggian jelajah normal |
| `STRATOSPHERE_START` | 520 | Langit mulai gelap, bintang muncul |
| `SPACE_START` | 600 | Atmosfer habis, kontrol orbit aktif |
| `ORBIT_RING` | 660 | Orbit satelit sertifikat |
| `MOON_DISTANCE` | 2000 | Jarak pusat Bumi ke pusat Bulan |
| `MOON_RADIUS` | 60 | |
| `CRUISE_SPEED` / `BOOST_SPEED` / `STALL_SPEED` | 36 / 70 / 14 unit per detik | Satu putaran di ketinggian jelajah ≈ 75 detik |

Semua angka tuning fisika, kamera, dan audio ada di `src/config/*.ts` dan bisa diubah langsung lewat panel debug (`#debug`).

---

## 6. Cara bekerja di setiap tugas

1. **Baca dulu**: CLAUDE.md, prompt fase dari Aril, dan dokumen di `docs/` yang relevan.
2. **Rencanakan**: buat daftar tugas (todo) yang konkret. Kalau ada keputusan besar yang tidak tertulis di docs, pilih opsi paling masuk akal, catat di `docs/decisions.md`, lalu lanjut.
3. **Kerjakan bertahap**: commit kecil yang berjalan. Pesan commit dalam bahasa Inggris (`feat(flight): add stall model`).
4. **Periksa sendiri**:
   - `npm run typecheck && npm run lint && npm run test`
   - `npm run e2e` (Playwright: halaman terbuka, tanpa error console, kontrol sentuh dan keyboard jalan)
   - `npm run shots`: ambil screenshot di 4 viewport dan beberapa posisi kamera, lalu **lihat gambarnya** dengan tool Read. Perbaiki yang jelek, terpotong, atau tidak rapi.
   - Cek fps di panel debug. Jika di bawah target, perbaiki sebelum lanjut.
5. **Laporkan**: tulis `docs/progress/PHASE-<n>.md` berisi apa yang selesai, apa yang tertunda, keputusan yang diambil, dan bagian **"Butuh dari Aril"** (foto, konfirmasi tahun, API key gratis, dan sebagainya), lengkap dengan cara mendapatkannya langkah demi langkah.
6. **Ringkas ke Aril** dalam bahasa Indonesia yang sederhana: apa yang bisa dicoba sekarang, dengan perintah apa, dan apa langkah berikutnya.

Kalau sebuah langkah butuh akun atau key dari Aril, jangan berhenti. Buat fallback-nya dulu (mode offline atau mock), lanjutkan pekerjaan, lalu catat kebutuhan itu di laporan.

---

## 7. Definisi selesai (berlaku untuk semua fase)

- [ ] Typecheck, lint, unit test, dan e2e lulus tanpa peringatan baru.
- [ ] Tidak ada error atau warning di console saat memuat, terbang 2 menit, dan membuka semua panel.
- [ ] Bisa dimainkan penuh di HP (sentuhan) dan desktop (keyboard, mouse, gamepad).
- [ ] Target fps tercapai di tier kualitas yang relevan.
- [ ] Semua teks baru punya terjemahan ID dan EN.
- [ ] Semua opsi baru masuk menu Pengaturan.
- [ ] `CREDITS.md`, `docs/decisions.md`, dan laporan fase diperbarui.
- [ ] Screenshot sudah dilihat dan tampilannya rapi.

---

## 8. Perintah npm (buat di Fase 0)

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan (juga mengaktifkan Hangar di `/hangar/`) |
| `npm run build` | Build produksi (menjalankan `prebuild`: validasi konten, optimasi media, sinkron GitHub jika token ada) |
| `npm run preview` | Pratinjau hasil build |
| `npm run typecheck` / `lint` / `test` / `e2e` | Pemeriksaan kualitas |
| `npm run shots` | Screenshot otomatis multi-viewport ke `tests/shots/` |
| `npm run build:earth` | Membuat data planet (`public/earth/earth.bin`) dari data publik Natural Earth |
| `npm run sync:github` | Menarik repo publik SyamayDev menjadi draf proyek |
| `npm run ingest:certificates` | Memproses PDF sertifikat menjadi thumbnail dan draf entri |
| `npm run build:cv` | Membuat `public/cv/*.pdf` (ID dan EN) dari isi `content/` |
| `npm run validate:content` | Memeriksa semua file konten dengan skema zod |

---

## 9. Gaya kode

- TypeScript `strict`, tanpa `any`. Modul kecil, satu tanggung jawab.
- Pola: `Experience` sebagai root yang memegang sistem-sistem. Setiap sistem punya `update(dt)` dan `dispose()`.
- Fisika memakai langkah tetap 60 Hz dengan akumulator. Visual diinterpolasi.
- Tidak ada `new Vector3()` atau array baru di dalam loop per frame. Pakai objek sementara yang dipakai ulang dan object pool.
- Semua geometri, material, tekstur, dan listener dibersihkan saat `dispose`.
- Angka tuning tidak boleh ditulis langsung di logika; simpan di `src/config/`.
- Panel debug (`lil-gui`) hanya aktif dengan hash `#debug`, dan tidak ikut terbundel di produksi tanpa hash itu (dynamic import).
- Komentar menjelaskan *mengapa*, bukan *apa*.

---

## 10. Cara berkomunikasi dengan Aril

- Pakai bahasa Indonesia yang santai dan jelas. Aril masih semester 1, jadi jelaskan langkah teknis (misalnya membuat akun gratis atau mengisi variabel lingkungan di Vercel) secara berurutan.
- Jangan menjalankan perintah yang menghapus data atau mengubah riwayat git tanpa izin.
- Kalau sesuatu tidak mungkin dibuat persis seperti yang diminta, jelaskan singkat lalu tawarkan alternatif terbaik.
