# Catatan Keputusan

Claude Code mencatat setiap keputusan penting yang tidak tertulis di dokumen lain. Format: tanggal, keputusan, alasan, alternatif yang ditolak.

## Keputusan awal (dari sesi perencanaan bersama Aril)

| Topik | Keputusan |
| --- | --- |
| Nama situs | SKYFOLIO |
| Planet | Bumi nyata versi low-poly |
| Gaya | Low-poly lucu dan cerah, rapi, tanpa bug |
| Pesawat awal | Biplane PK-ARL dengan kanopi otomatis saat hujan |
| Pilot | Avatar Aril berseragam dan bertopi pilot |
| Co-pilot | Piko, anak kecil, suara kekanak-kanakan, bahasa bawaan Indonesia |
| Bahasa situs | Indonesia (bawaan) dan Inggris, bisa diganti |
| Nuansa Indonesia | Secukupnya, dipadukan dengan nuansa modern dan global |
| Musik | Original, rasa lagu daerah Sunda yang ceria dan heroik, tanpa menyalin melodi lagu yang ada |
| Siang-malam dan cuaca | Real-time dan aktif secara bawaan, semua bisa dimatikan di Pengaturan |
| Budget | Rp0 untuk layanan. AI memakai tier gratis dengan fallback offline |
| Hosting | Vercel, alamat `*.vercel.app` |
| Edit konten | File di `content/` + Hangar lokal (`/hangar/`) |
| Blender | Tidak dipakai. Semua model dibuat lewat kode + aset CC0 |
| Multiplayer live | Tidak dipakai. Hanya fitur sosial asinkron |
| Perangkat utama | HP: mobile-first, tutorial menyesuaikan perangkat |
| Cara kerja | Claude Code + CLAUDE.md + prompt per fase di chat |
| CV | Dibuat otomatis dari `content/` (ID dan EN) |
| Tujuan | Portofolio pribadi terbaik, siap dikirim ke kompetisi |

## Keputusan selama pengerjaan

<!-- Claude Code menambahkan baris di sini -->

### Fase 0 — 2026-11-10

| Topik | Keputusan | Alasan | Alternatif yang ditolak |
| --- | --- | --- | --- |
| Versi three.js | **r187 (0.187.0)**, dikunci. Render memakai `WebGPURenderer` dari `three/webgpu`, shader TSL dari `three/tsl`. Post-processing nanti memakai `RenderPipeline` (`PostProcessing` sudah deprecated sejak r183). `atan2` di TSL sekarang `atan(y, x)` | Versi stabil terbaru saat Fase 0 | — |
| Catatan API r187 | Pada `InstancedMesh`, instancing diterapkan ke `positionLocal` **sebelum** `positionNode`, jadi shader per-instance (goyangan pohon) memakai `positionGeometry` untuk tinggi lokal | Bug "pohon melayang di langit" saat memakai `positionLocal` | — |
| Versi lain yang dikunci | Vite 8.3.7, Svelte 5.57.3, Rapier compat 0.21.0, TypeScript 6.0.3, Vitest 5.1.0, Playwright 1.65.0, ESLint 10.14.0 | Stabil terbaru yang saling kompatibel | TypeScript 7 (belum didukung typescript-eslint dan svelte-check) |
| GSAP | **Tidak dipasang** | Lisensinya "Standard no-charge", tidak termasuk daftar lisensi yang diizinkan (aturan 12). Transisi memakai Svelte dan kode sendiri | Memakai GSAP |
| detect-gpu | Tidak dipakai. Tier awal ditebak dari perangkat (HP/desktop, RAM, inti CPU), lalu diatur otomatis dari fps | detect-gpu mengunduh data benchmark dari CDN (melanggar prinsip "tetap jalan offline") | detect-gpu |
| Bandara Medan | Landasan **40×7** (bukan 60×8), arah 150°, sebagai pulau/semenanjung reklamasi di mulut Selat Malaka utara Aceh–Medan (tengah 7,2°LU 97,7°BT). Area datar = gabungan persegi panjang (landasan, apron, plaza landmark) + transisi 5 unit | Skala planet 1° ≈ 7 unit: landasan 60 unit (±8,6°) lebih besar dari Sumatra Utara dan menimpa Danau Toba (hanya 1° dari Medan) | Landasan 60×8 tepat di Medan |
| Danau Toba | Diperbesar (elips 0,8° × 0,33°, sumbu 145°) dengan Pulau Samosir, permukaan danau datar | Ukuran asli tidak terlihat di skala ini | Data Natural Earth apa adanya |
| Resolusi planet | Icosphere level 6 (±0,94°/segitiga) + **wilayah detail Sumatra Utara** (subdivisi 4×4, radius 7,5°). Titik di sisi batas diinterpolasi lurus sehingga tidak ada retakan | Bandara dan Toba butuh detail; seluruh planet level 7 melebihi target 1,5 MB | Level 7 global |
| Collider huruf | Gabungan kuboid per batang huruf (bukan convex hull). Huruf tidur sampai disentuh | Convex hull menutup bagian cekung (L, H, Y) | Convex hull |
| Model terbang | Nilai awal docs/03 §4.6 disetel ulang: `S` 0,1, `T_MAX` 6,7, `C_D0` 0,04, `C_L0` 0,2, `CRUISE_THROTTLE` 0,6 | Nilai awal menghasilkan gaya angkat ±10× berat di kecepatan jelajah. Di planet kecil, efek sentrifugal v²/r ≈ 25% berat saat jelajah, dan kecepatan boost ≈ kecepatan orbit | Nilai awal apa adanya |
| Bantuan arcade tambahan | Auto-trim (angkat "camber" jenuh di tekanan dinamis jelajah), weathervane hanya saat stall/bantuan mati, **pitch hold** (Normal), batas angguk aman bergantung kecepatan, auto-throttle PI, feed-forward redaman sudut Rapier | Supaya terbang lurus stabil (uji ±2 unit lulus), boost tidak meroket, pemula tidak langsung stall | — |
| Belokan terkoordinasi | Rumus memakai `TURN_G` = 37 (bukan G0) | Syarat uji radius belok bank 45° = 25–45 unit; dengan G0 = 14 radiusnya ±93 unit | G0 |
| Dorongan statis | Bonus dorongan baling-baling saat pelan (`PROP_STATIC_BONUS`) | Lepas landas cukup dalam ±25 unit landasan | — |
| Mode darat | Gaya suspensi sepanjang normal tanah; gesekan/rem diterapkan 85% menuju ketinggian pusat massa; rem parkir otomatis saat tanpa gas; raycast roda hanya ke medan & bangunan; bantuan "jaga arah landasan" | Mencegah pesawat merayap mundur (posisi tiga roda miring 9°), terjungkal saat mengerem, dan terlempar saat roda mengenai huruf | Gaya sepanjang sumbu badan; gesekan di titik kontak |
| Arah kontrol | W/↑/joystick ke atas = **naik**; di darat = gas | Paling intuitif untuk pemula (mayoritas pengguna HP). Bisa dibalik di Pengaturan | W = hidung turun (gaya simulator) |
| Yaw keyboard | Tidak dipetakan (E dipakai untuk Interaksi) | Belok cukup dengan miring + belokan terkoordinasi | Q/E rudder |
| Kamera | Kamera pengejar "sadar horizon": arah pandang menunduk = dip horizon (acos R/r) + margin | Di planet kecil horizon turun ±26° di ketinggian 45 unit; kamera lurus hanya melihat langit | Kamera pengejar biasa |
| Anti tembus kamera | Raycast ke collider Rapier (medan & bangunan) | Collider sudah ada; tidak perlu BVH terpisah | three-mesh-bvh (tetap terpasang untuk pemilihan objek nanti) |
| Waktu Fase 0 | Waktu manual 10.00 WIB | Render malam lengkap (lampu kota, bintang, bulan) baru di Fase 2 | Waktu nyata langsung |
| Audio Fase 0 | Bunyi sintetis Web Audio (mesin radial, angin, roda, tabrakan per material, klakson, ding, pegas) | "Bunyi sementara boleh sederhana"; Howler & Tone terpasang untuk Fase 2 | — |
| Satuan HUD | 1 unit/dtk = 4 km/j, 1 unit ketinggian = 20 m | Angka terasa wajar untuk biplane | Unit mentah |
| Ukuran bundel | JS awal ±1,45 MB brotli (UI 30 KB, kode 3D 36 KB, three 188 KB, **Rapier compat 1,2 MB**). Muatan total jauh di bawah 8 MB | Wasm Rapier sendiri ±0,85 MB brotli, jadi target "JS ≤ 600 KB termasuk wasm Rapier" tidak mungkin dengan Rapier 0.21. Fase 5: coba `@dimforge/rapier3d` (wasm terpisah, kompilasi streaming) | — |
| Tes otomatis | Parameter URL `?test` (simulasi tetap real-time walau fps rendah), `?renderer=webgl`, `?quality=`. E2E di port 4174 | Renderer software di Playwright sangat lambat; port 5173 dipakai `npm run dev` | — |
