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

### Bumi detail & gaya pesawat — 2026-11-10 (permintaan Aril: "sedetail Tiny Skies & Bruno Simon", gambar referensi)

| Topik | Keputusan | Alasan | Alternatif yang ditolak |
| --- | --- | --- | --- |
| Resolusi planet v2 | Icosphere **level 7** global (±3,3 unit/segitiga) + wilayah detail **seluruh Indonesia & Semenanjung Malaysia** (kotak 11,5°LS–8,5°LU, 94–141,5°BT, subdivisi 3×3 → ±1,1 unit). ±118 ribu segitiga daratan | Permintaan Aril: Bumi kurang detail. Pulau-pulau tanah air (Jawa, Sulawesi, Nusa Tenggara) kini terbaca bentuknya | Level 6 + detail Sumatra Utara saja |
| Ukuran data planet | `earth.bin` ±2,7 MB mentah, dikirim sebagai **`earth.bin.gz` (±1,2 MB)** dan dibuka dengan `DecompressionStream`; file mentah tetap ada sebagai cadangan | Vercel belum tentu mengompres file biner; gzip bawaan browser tidak butuh pustaka | Format terindeks / pembangkitan di klien (lebih rumit) |
| Sungai | Natural Earth `rivers_lake_centerlines` 1:50m (rank ≤ 5 global, rank 6 di Asia Tenggara) + Musi, Asahan, Batang Hari, Bengawan Solo, Mahakam (jalur perkiraan). Medan **dicekungkan** jadi lembah di sepanjang sungai; sungai digambar sebagai pita yang menempel permukaan dengan arus bergerak | Sungai berkelok di lembah memberi kesan peta hidup dari udara | Sungai sebagai warna segitiga (bergerigi) |
| Data per segitiga | Byte `aux` = kepadatan hutan (4 bit) + ladang (4 bit); bit 3–5 byte kelas = kekeringan | Shader medan dan sebaran props membaca data yang sama, deterministik | Tekstur mask terpisah |
| Shader medan | Detail per piksel: ladang tambal-sulam (warna tanaman acak, alur tanam, pagar semak), **pita pantai di garis air** (bukan segitiga pasir), salju per lintang, strata batu, riak gurun, bercak padang rumput; detail halus memudar dengan jarak | Detail tanpa menambah segitiga; pantai tidak menebal di pulau kecil | Warna datar per segitiga saja |
| Sebaran props | **Scatter**: 13 jenis (pohon daun lebar, kelapa, pinus, pinus tinggi, pinus bersalju, akasia, semak, perdu kering, batu, rumput, bunga, kaktus, rumah desa) dibangkitkan deterministik per sel 1° dari data segitiga, hanya di sekitar kamera (radius 165 unit di High), frustum culling per sel, instancing dengan atribut vec4 per instans dan transformasi di shader TSL. Bayangan hanya untuk props dalam 42 unit dari pesawat (`castShadowPositionNode`). Batang pohon terdekat punya collider kapsul sungguhan (pool 18) | Kepadatan setara game eksplorasi modern tanpa jutaan instans di memori; tetap ≤ 120 draw call di Low | `trees.bin` 9.000 pohon global (terlalu jarang) |
| Anggaran setelah detail | Low: 69–113 draw call, ±200–250 ribu segitiga. High: 110–176 draw call, ±0,5–0,8 juta segitiga | Masih di bawah anggaran docs/11 | — |
| Awan | ±1.400 gugus "puff" deterministik, kepadatan mengikuti iklim, dibagi 12 wilayah dengan culling horizon; seluruh lapisan berputar pelan ke timur. `densityAt()` menyiapkan kabut di dalam awan | Awan wajib untuk kesan langit Tiny Skies; dasar untuk cuaca Fase 2 | Awan acak per frame |
| Pesawat bawaan | Mengikuti **gambar referensi Aril** (`docs/references/image.png`): pesawat mainan **bersayap rendah (monoplane)** bergaya gemuk, badan krem, cowling merah + mesin radial, spinner krom, baling-baling biru muda, garis toska, ujung sayap/sirip merah, roundel, paku keling. Nama tetap PK-ARL; biplane klasik bisa kembali sebagai skin di Fase 4 | Aril: "rencananya mau dia tuh kaya" gambar itu | Biplane kuning-biru Fase 0 |
| Roundel | Bintang **kuning** (`sun`) di cakram toska bercincin merah | Bintang merah di gambar referensi bisa dibaca sebagai simbol politik; kuning tetap ceria dan sesuai palet | Bintang merah |
| Aril | Helm kulit toska ber-earcup, kacamata terbang besar di dahi, jaket kulit cokelat bermanset kuning-merah, mata besar berkilau, pipi merona; rambut tetap gelap; syal tetap ada (docs/04) | Gambar referensi + deskripsi avatar di content/profile.json | Seragam & topi pilot biru |

### Fase 1: dunia penuh isi — 2026-11-10

| Topik | Keputusan | Alasan | Alternatif yang ditolak |
| --- | --- | --- | --- |
| Letak Kantor Pos Udara | Pulau pos sendiri (radius 18) **40 unit di sisi laut kiri landasan** (`content/world/zones.json`: 10,03°LU 102,74°BT), pintu menghadap landasan | Koordinat Medan asli jatuh tepat di landasan bandara reklamasi; pesawat menabrak gedung pos saat lepas landas. Dari titik start pulau dan balon sosial medianya langsung terlihat | Gedung pos di daratan Sumatra (medan terlalu terpotong-potong) |
| Letak Menara Kontrol | Digeser ke samping ujung landasan (side 10,5 unit dari garis tengah) | Jalur naik pesawat yang sedikit berbelok ke kanan sempat menabrak menara | Menara di apron (terlalu sesak) |
| Uji tata letak | `tests/unit/layout.test.ts` memastikan tidak ada zona berbangunan di koridor landasan + jalur naik | Mencegah bug serupa saat Aril/Claude menambah zona | — |
| Autopilot | Mengendalikan **sudut miring** (maks ±34°), bukan laju roll; tidak berbelok di bawah 6 unit di atas tanah; terbang jelajah 34 unit di atas permukaan bila tujuan > 160 unit; setelah tiba **terus mengitari** sampai pemain memegang kemudi | Versi awal berguling terus di FPS rendah lalu jatuh ke laut, dan berhenti begitu tiba | Memindahkan posisi pesawat langsung (melanggar "fisika dulu") |
| Nama landmark | Dua bahasa (`{ id, en }`) di `content/world/landmarks.json` | Paspor dan peta tampil Inggris saat bahasa EN | Kunci i18n per landmark |
| Subtitle Piko | Ucapan Piko tampil di gelembung; subtitle yang sama disembunyikan secara visual (tetap dibaca pembaca layar) | Teks dobel memenuhi layar HP | — |
| Hangar | Svelte di `/hangar/` (dev saja). Form generik yang membaca bentuk JSON apa pun (teks dua bahasa, slider level, daftar), editor proyek (frontmatter + cerita), seret-lepas foto, daftar konfirmasi, draf GitHub, diff + Simpan & Publikasikan | Semua file konten bisa diedit tanpa form khusus per file, jadi tetap jalan kalau skema bertambah | Form manual per file |
| Keamanan Hangar | Selain loopback: Host & Origin wajib localhost, permintaan pengubah wajib header `X-Hangar: 1` | Situs lain yang dibuka di browser yang sama bisa mengirim POST ke localhost (CSRF) atau memakai DNS rebinding | Hanya cek alamat loopback |
| Pratinjau Hangar | `/?fly=project:<id>` → setelah naik pesawat, autopilot langsung mengantar ke pulau itu | Aril bisa melihat hasil edit tanpa mencari pulaunya | — |

### Fase 2: dunia hidup & suara — 2026-11-10

| Topik | Keputusan | Alasan | Alternatif yang ditolak |
| --- | --- | --- | --- |
| Suara bicara | **Tidak ada suara bicara sama sekali** (tanpa TTS Web Speech, tanpa "babble"). Piko hanya bicara lewat gelembung teks | Permintaan Aril: "gausah ada speech suara orang… suaranya jelek". Menggantikan docs/05 bagian 5 | TTS dengan pitch anak |
| Mesin musik | Penjadwal Web Audio sendiri (`src/audio/MusicEngine/`), instrumen disintesis: kacapi Karplus-Strong, suling (napas + vibrato + luncuran), kendang, goong, angklung, drum modern. Tone.js & Howler tidak dipakai (tetap terpasang, tidak ikut bundel) | Kontrol penuh atas jadwal di batas birama, bundel 0 KB tambahan, tanpa file audio | Tone.js (±300 KB, API berubah antar versi) |
| Komposisi | 17 tema dengan frasa original 4 birama (notasi derajat pentatonik) + variasi generatif per putaran (sinkop, tanya-jawab kacapi, ganti instrumen utama). Radio Funkot/Timur/Gurun/Energi FM: gaya diprogram, melodi dibangkitkan aturan | Aturan "jangan menyalin melodi apa pun"; tetap terasa satu lagu tapi tidak pernah persis sama | Loop rekaman |
| Waktu | Jam dunia nyata (bawaan) atau manual; matahari NOAA tiap 1 detik; musim dari tanggal; tema UI mengikuti jam lokal pengunjung | docs/04 bagian 6 | — |
| Cuaca | Open-Meteo (Medan, cache 15 menit, tanpa key) + 18 sel cuaca deterministik per hari. Hujan/salju = garis di sekitar kamera (dunia-tetap), awan badai + tirai hujan terlihat dari jauh, petir + guntur tertunda, pelangi saat matahari rendah setelah hujan, tanah basah (uWet) | Fallback offline: tanpa jaringan dunia tetap punya cuaca prosedural. Uji otomatis (`?test`) tidak memanggil jaringan | Partikel GPU (titik 1 px di WebGPU) |
| Angkasa | Satu dunia tanpa loading: lapisan udara → stratosfer → angkasa → Bulan dengan histeresis; kit roket keluar di atas 92 unit (Boost = roket, maks 95 unit/dtk); bantuan orbit ke orbit lingkaran; panas masuk atmosfer; gravitasi Bulan aktif di wilayahnya dan "atas" pesawat/kamera/roda mengikuti benda langit terdekat | docs/03 bagian 8–10, "fisika dulu" | Teleport/cutscene |
| Post-processing | `RenderPipeline` three r187: Low tanpa efek, Medium vinyet + grading, High/Ultra + bloom (lebih kuat saat malam & kilat). Bisa dimatikan di Pengaturan | Anggaran performa per tier | — |
| Ikon | Set ikon SVG sendiri (`src/ui/icons.ts`, garis 2 px membulat) dipakai HUD, menu, panel, peta, radar, toast, dan penanda 3D (Path2D). Avatar Piko vektor | Emoji tampil berbeda/jadi kotak di sebagian perangkat; permintaan Aril agar ikon lebih rapi | Emoji |
| Tata letak responsif | Tumpukan tengah-atas (`TopStack`): label zona, autopilot, toast, tutorial, gelembung Piko dalam satu kolom flex. HP sentuh: meter di tengah bawah; portrait: tombol atas lebih kecil, kompas di baris kedua; landscape: gelembung Piko di kanan atas, menu jeda dua kolom. Checkbox → sakelar geser | Screenshot 4 viewport memperlihatkan elemen saling menimpa | Offset manual per elemen |
