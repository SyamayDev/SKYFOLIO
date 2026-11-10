# Laporan Fase 0 — Fondasi

Tanggal: 10 November 2026

## Ringkasan

Fondasi SKYFOLIO sudah bisa dimainkan: Bumi low-poly dari data Natural Earth, biplane PK-ARL berfisika nyata (Rapier) bersama Aril dan Piko, kamera pengejar dan kokpit, kontrol keyboard/sentuh/gamepad/giroskop, dan Bandara Medan dengan huruf **S Y A H R I L** yang bisa ditabrak lalu tersusun kembali, tiga cincin latihan, hangar, kantong angin, dan tumpukan koper fisika. Pesawat bisa lepas landas, terbang keliling planet (±75 detik), melewati kutub, mendarat, dan mengerem sampai berhenti.

## Cara mencoba

### Di laptop

1. Buka terminal di folder proyek (folder yang berisi `CLAUDE.md`).
2. Jalankan `npm install` (sekali saja), lalu `npm run dev`.
3. Buka alamat yang muncul, biasanya http://localhost:5173.
4. Tekan **Naik Pesawat**. Nyalakan suara.

### Di HP (satu Wi-Fi dengan laptop)

1. Sambungkan HP dan laptop ke Wi-Fi yang sama.
2. Di laptop jalankan `npm run dev -- --host`.
3. Terminal menampilkan baris `Network: http://192.168.x.x:5173`. Ketik alamat itu di browser HP (Chrome/Safari).
4. Kalau tidak bisa terbuka, izinkan Node.js di Windows Firewall (jaringan Private) lalu coba lagi.

### Kontrol

| Aksi | Keyboard | Sentuh (HP) | Gamepad |
| --- | --- | --- | --- |
| Melaju di darat / naik | W atau ↑ | Joystick ke atas (sentuh sisi kiri layar) | Stik kiri ke atas |
| Turun | S atau ↓ | Joystick ke bawah | Stik kiri ke bawah |
| Miring & belok | A/D atau ←/→ | Joystick kiri/kanan | Stik kiri |
| Boost | Shift | Tombol **Boost** | RT |
| Rem (darat) / rem udara | B atau Ctrl | Tombol **Rem** | LT |
| Lompat (darat) / barrel roll (udara) | Spasi | Tombol **Lompat/Putar** atau ketuk 2× sisi kanan | A |
| Klakson | H | Tombol 📯 | B |
| Kamera pengejar ↔ kokpit | C | Ikon kamera | RB |
| Geser kamera | Seret mouse | Geser jari di sisi kanan | Stik kanan |
| Kembali ke landasan | R | Menu jeda → "Aku nyangkut!" | Y |
| Jeda & pengaturan | Esc | Ikon ⏸ | Start |

Tips mendarat: arahkan ke landasan, tekan S sebentar untuk turun pelan, tahan **Rem** saat roda menyentuh landasan.

### Panel debug

Buka http://localhost:5173/#debug untuk panel lil-gui: info renderer (WebGPU/WebGL2), fps, draw call, segitiga, waktu fisika, jam matahari, dan semua angka terbang/kamera yang bisa disetel langsung saat terbang. fps juga bisa ditampilkan dari **Pengaturan → Grafis → Tampilkan fps**.

## Yang selesai

1. **Setup proyek**: Vite + TypeScript strict + Svelte 5, struktur folder sesuai CLAUDE.md, semua skrip npm (yang belum dipakai mencetak "belum diimplementasikan"), versi dikunci tanpa `^`, ESLint + Prettier + Vitest + Playwright, lil-gui hanya dengan `#debug` (dimuat dinamis), `.gitignore`, `.editorconfig`, `.gitattributes`, git dengan beberapa commit kecil.
2. **Inti mesin** (`src/core/`): Experience, Renderer (WebGPU dengan fallback otomatis ke WebGL2, info backend di panel debug dan HUD fps), Loop langkah tetap 60 Hz + interpolasi (maks. 4 sub-langkah), Time, Input terpadu, Store, EventBus bertipe, Assets, QualityManager (4 tier + otomatis dari fps), Settings (tersimpan di localStorage, dibungkus try/catch), Debug.
3. **Planet**: `npm run build:earth` mengunduh dan meng-cache Natural Earth, membuat icosphere level 6 + wilayah detail Sumatra Utara, klasifikasi biome (tropis, sedang, boreal, gurun bergaya poligon, gunung, salju, es kutub), 18 punggungan pegunungan bernama (Himalaya, Andes, Bukit Barisan, dll.), Danau Toba + Samosir, 80 chunk, ±8.800 pohon, ±2.000 gedung di 144 kota. Output `public/earth/*` ±0,9 MB. Render faceted dengan material toon + rim light, laut TSL (dangkal→dalam, gelombang, buih pantai, kilau matahari), pohon instanced bergoyang ditiup angin (6 jenis), kota sederhana, collider trimesh per chunk (chunk jauh dinonaktifkan), culling horizon.
4. **Biplane PK-ARL**: model prosedural lengkap (badan gemuk, cowling mesin radial, baling-baling dengan cakram blur, dua sayap airfoil, strut, kabel, roda dengan suspensi dan pelindung lumpur, ekor, nomor PK-ARL di sirip dan bawah sayap, lampu navigasi, aileron/elevator/rudder yang bergerak sesuai input). Kanopi dan kit roket sudah disiapkan sebagai bagian model (animasi Fase 2). Aril chibi (seragam, topi berlencana sayap, kacamata terbang, syal berkibar sesuai kecepatan, condong saat belok, melambai saat diam). Piko (topi kebesaran, headset, pipi merona, menengok kiri-kanan, tangan ke atas saat boost, topi terbang + bintang saat tabrakan).
5. **Fisika dan rasa terbang**: gravitasi radial, model terbang lengkap (dorong, angkat, hambatan, stall dengan getaran, ground effect), bantuan arcade 3 level (Penuh/Normal/Mati), pengendali laju sudut, barrel roll, mode darat dengan suspensi raycast 3 roda, rem, lompat, klakson, air (apung + cipratan), umpan balik tabrakan 4 tingkat (bunyi per material, partikel, percikan, asap, guncangan kamera, getaran, baling-baling "bengkok"), tegak otomatis, respawn (manual dan otomatis bila jatuh tembus/keluar sistem). Semua angka di `src/config/flight.ts` dan bisa disetel dari panel debug.
6. **Kamera**: pengejar (pegas rotasi, look-ahead, ikut miring 30%, FOV 60→72 saat boost, anti tembus, geser kamera dengan kembali otomatis setelah 2 detik, "sadar horizon" supaya Bumi selalu terlihat), kokpit versi awal, guncangan berbasis trauma, transisi mode yang halus.
7. **Kontrol**: keyboard, gamepad (zona mati 0,15 + kurva kuadrat, rumble), sentuh (joystick dinamis, Boost/Rem/Aksi/Klakson, geser kamera, ketuk dua kali), giroskop opsional dengan izin iOS, getaran Android. Tata letak HP portrait dan landscape, tombol ≥ 56 px, area aman notch.
8. **Bandara Medan**: landasan melengkung mengikuti bola planet dengan marka, nomor 15/33, lampu tepi, lampu ambang, PAPI; apron + garis taksi; huruf SYAHRIL fisik (kembali tersusun 20 detik setelah diam, dengan pegas dan bunyi "plop"); 3 cincin latihan (naik, belok, boost) dengan label dua bahasa, bunyi "ding" bernada naik, konfeti; hangar yang bisa dimasuki; kantong angin yang mengikuti angin; dua tumpukan koper fisika; papan tutorial yang berganti sesuai perangkat; Istana Maimun dan Masjid Raya versi sederhana.
9. **HUD**: kecepatan, ketinggian, kompas, indikator throttle, peringatan stall, tombol jeda dan kamera, fps (debug/pengaturan), garis kecepatan saat ngebut, toast. Layar pra-terbang (checklist pilot + pilihan bahasa + Mode Ringkas). Menu jeda + pengaturan (bahasa, bantuan terbang, balik arah, getaran, guncangan, giroskop, sisi joystick, mode kamera, kualitas, fps, volume, kurangi gerakan). Tutorial bertahap sesuai perangkat.
10. **Tes**: lihat bagian berikut.

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` (tsc + svelte-check) | 0 error, 0 warning |
| `npm run lint` | 0 error, 0 warning |
| `npm run test` | 28 tes lulus: geo, quaternion, posisi matahari, i18n lengkap, loop, model terbang (lurus 20 dtk ±2 unit → simpangan 0,15; stall; radius belok bank 45° = 25–45 unit; melintasi kutub; **satu putaran planet melewati kedua kutub dalam 60–90 dtk**) |
| `npm run e2e` | 6 tes lulus: halaman tanpa error console, terbang 20 detik dengan keyboard, ganti bahasa tanpa reload, menu jeda + respawn, kontrol sentuh di 390×844 dan 844×390 |
| `npm run shots` | 36 screenshot (4 viewport × 9 adegan) di `tests/shots/`, sudah dilihat dan dirapikan |
| `npm run build` | Berhasil. Build produksi diuji: siap dalam 1,5 dtk, terbang normal, tanpa error console |

### Anggaran performa (diukur dengan renderer software di headless Chrome)

| Tier | Draw call | Segitiga | Batas docs/11 |
| --- | --- | --- | --- |
| Low | 73–97 | 210–223 ribu | ≤ 120 draw call, ≤ 300 ribu segitiga ✅ |
| Medium | 148–162 | 395–428 ribu | — |
| High | 143–163 | 613–677 ribu | ≤ 250 draw call, ≤ 1 juta segitiga ✅ |
| Ultra | 148–165 | 828–925 ribu | — |

- Waktu langkah fisika 0,1–0,3 ms (batas 3 ms) ✅
- Muatan awal: ±1,5 MB JS brotli + ±0,9 MB data planet + font (batas 8 MB) ✅
- JS awal ≤ 600 KB brotli ❌ — Rapier compat sendiri 1,2 MB brotli (lihat "Tertunda").
- fps nyata di HP dan laptop belum bisa diukur di sini (tes memakai renderer software tanpa GPU). Di renderer software pun build produksi berjalan ±31 fps pada tier Low.

## Definisi selesai Fase 0

| Butir | Status |
| --- | --- |
| Lepas landas, keliling planet ±75 dtk, mendarat lagi di Medan terasa menyenangkan (keyboard, gamepad, sentuh) | ✅ keyboard & sentuh diuji otomatis; ⚠️ gamepad belum diuji di perangkat asli; rasa akhir perlu dicoba Aril |
| Menabrak huruf, koper, dan tanah terasa memuaskan | ✅ fisika + partikel + bunyi + guncangan + getaran |
| Tidak ada glitch saat melewati kutub | ✅ diuji unit test dan screenshot |
| FPS sesuai target | ⚠️ anggaran draw call/segitiga/fisika terpenuhi; fps di perangkat asli perlu dicek Aril |
| Semua tes lulus, screenshot 4 viewport rapi | ✅ |
| Laporan ini | ✅ |

## Keputusan penting

Detail lengkap di `docs/decisions.md` (bagian "Fase 0"). Yang paling perlu diketahui:

1. **Tata letak bandara.** Di planet mainan ini 1° ≈ 7 unit, jadi landasan 60 unit lebih besar dari Sumatra Utara dan menimpa Danau Toba. Landasan dibuat 40×7 unit sebagai pulau/semenanjung reklamasi di mulut Selat Malaka, utara Aceh–Medan. Lepas landas ke arah tenggara: Medan, Istana Maimun, Masjid Raya, lalu Danau Toba ada di depan kanan.
2. **Arah kontrol: W/↑ = naik.** Paling mudah untuk pemula di HP. Bisa dibalik di Pengaturan → Kontrol → "Balik arah naik-turun".
3. **Angka fisika disetel ulang** supaya terbang lurus stabil, belokan lincah (radius ±35 unit), lepas landas ±25 unit landasan, dan mendarat tidak terjungkal.
4. **GSAP tidak dipakai** karena lisensinya tidak termasuk daftar yang diizinkan di CLAUDE.md.
5. **Waktu Fase 0 = 10.00 WIB tetap.** Siang-malam nyata diaktifkan di Fase 2 bersama lampu kota, bintang, dan bulan.

## Tertunda / catatan untuk fase berikutnya

- **Ukuran Rapier** (1,2 MB brotli). Fase 5: coba paket `@dimforge/rapier3d` (file .wasm terpisah, kompilasi streaming) dan/atau pemuatan bertahap.
- **Culling per wilayah untuk pohon & gedung** (sekarang satu InstancedMesh per jenis untuk seluruh planet). Bisa memangkas ±50% segitiga di tier tinggi (Fase 5).
- Pohon menyusut saat pesawat lewat dekat, burung kabur saat klakson, kehidupan latar, awan, cuaca, malam: Fase 2.
- Starter mesin baru versi bunyi sederhana; animasi baling-baling tersendat, sampel bunyi CC0, dan musik prosedural Sunda: Fase 2.
- Kamera sinematik, mode foto penuh (dasar "bekukan simulasi" sudah ada untuk tes), instrumen kokpit hidup: fase berikutnya.
- Zona lain, konten dari `content/`, Mode Ringkas lengkap, CV, Hangar editor: Fase 1.
- `npm audit`: 12 peringatan hanya di alat pengembangan (eslint/typescript-eslint/vite-plugin-svelte), **0 di dependensi produksi**. Tidak dijalankan `--force` karena akan memasang versi yang tidak kompatibel.

## Butuh dari Aril

1. **Coba terbang di HP dan laptop** (cara di atas), lalu ceritakan rasanya: terlalu sensitif atau terlalu lambat? Kamera nyaman? Untuk melihat fps: Pengaturan (⏸ → Pengaturan) → Grafis → centang **Tampilkan fps**. Target: HP Android kelas menengah ≥ 30 fps, laptop 60 fps. Sebutkan merek/tipe HP dan angka fps-nya.
2. **Gambar biplane yang kamu suka**: simpan sebagai `docs/references/biplane.png` (atau .jpg). Folder itu masih kosong, jadi model dibuat dari deskripsi di docs/04. Kalau ada, Claude Code akan menyesuaikan bentuknya.
3. **Gambar gaya Aril dan Piko** (opsional): `docs/references/pilot-aril.png` dan `docs/references/piko.png`.
4. **Konfirmasi arah kontrol**: apakah W/↑ = naik sudah enak, atau kamu lebih suka gaya simulator (W = hidung turun)?
5. **Konfirmasi tata letak bandara** (pulau reklamasi utara Medan, landasan 40 unit). Kalau ingin landasan persis di kota Medan, konsekuensinya Danau Toba harus digeser atau dikecilkan.
6. **Gamepad** (kalau punya): colok ke laptop, tekan tombol apa saja, lalu coba terbang. Laporkan tombol yang terasa aneh.
7. **Untuk Fase 1** (boleh dicicil): foto profil di `content/media/profile/aril.jpg`, 5–15 foto di `content/media/gallery/`, screenshot SI-RAJU dan SI-PANDRI, dan data bertanda `needsConfirmation` (daftar lengkap di `README.md` bagian "Data yang masih perlu kamu pastikan").
