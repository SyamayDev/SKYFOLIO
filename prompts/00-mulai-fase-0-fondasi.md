<!--
CARA PAKAI (untuk Aril):
1. Buka terminal di folder proyek skyfolio (yang berisi CLAUDE.md).
2. Jalankan `claude`, lalu pilih model Opus terbaru lewat /model.
3. Salin SEMUA teks di bawah garis ini, tempel ke Claude Code, tekan Enter.
-->
---

# FASE 0 — Fondasi: planet, biplane, fisika, kamera, kontrol

Halo! Kita mulai membangun **SKYFOLIO**, portofolio 3D milikku (Aril). Baca dulu `CLAUDE.md` sampai habis, lalu baca `docs/01-vision-experience.md`, `docs/02-world-zones.md` (bagian 1, 2, dan 3.1), `docs/03-flight-physics.md` (semua), `docs/04-art-rendering.md` (bagian 1–4 dan 9), `docs/07-ui-ux.md` (bagian 3 dan 5), dan `docs/11-performance-qa.md`.

Fase ini adalah fondasi. Jangan buru-buru ke fitur lain. **Rasa terbang dan rasa menabrak harus sudah enak di HP dan laptop sebelum fase ini dianggap selesai.**

## Tugas

1. **Setup proyek**
   - Inisialisasi Vite + TypeScript strict, struktur folder persis seperti `CLAUDE.md` bagian 4, semua skrip npm di bagian 8 (yang belum dipakai boleh berupa stub yang mencetak "belum diimplementasikan").
   - Pasang dependensi dari tabel tech stack. Kunci versinya. Catat versi three.js yang terpasang di `docs/decisions.md`, dan baca dokumentasi versi itu untuk `WebGPURenderer`, TSL, dan post-processing.
   - ESLint, Prettier, Vitest, Playwright, `lil-gui` (hanya `#debug`), `.gitignore`, `.env.example` (sudah ada, jangan ditimpa), `CREDITS.md` (sudah ada, perbarui).
   - `git init` dan commit awal.

2. **Inti mesin** (`src/core/`): Experience, Renderer (WebGPURenderer dengan fallback WebGL2 otomatis, info backend tampil di panel debug), Loop dengan fisika langkah tetap 60 Hz + interpolasi, Time, Input (aksi terpadu), Store, EventBus bertipe, Assets, QualityManager (tier + auto), Debug.

3. **Planet**
   - `scripts/build-earth.ts` sesuai `docs/02` bagian 2: data Natural Earth (unduh dan cache), icosphere level 6, klasifikasi biome, punggungan pegunungan bernama, Danau Toba terlihat, output `public/earth/*`.
   - Render planet faceted dengan palet, laut (versi awal shader TSL: warna dangkal/dalam + gelombang sederhana + buih pantai), pohon instanced dengan goyangan angin, kota-kota sederhana.
   - Collider trimesh per chunk.

4. **Biplane PK-ARL** (`src/vehicle/PlaneModel.ts` + pustaka kitbash `src/utils/modeling/`)
   - Model prosedural lengkap sesuai `docs/04` bagian 3.1: badan, cowling, baling-baling berputar (dengan blur disc), dua sayap, strut, kabel, roda, ekor, nomor PK-ARL, lampu navigasi, permukaan kendali yang bergerak sesuai input.
   - Lihat dulu `docs/references/` jika ada gambar biplane.
   - Avatar Aril (pilot) dan Piko (co-pilot) versi awal: low-poly chibi, idle sederhana, syal Aril berkibar sesuai kecepatan.
   - Kanopi dan kit roket cukup disiapkan sebagai bagian model (animasinya di Fase 2).

5. **Fisika dan rasa terbang** sesuai `docs/03`: Rapier, gravitasi radial, model terbang lengkap (dorong, angkat, hambatan, stall, ground effect), semua bantuan arcade (3 level), pengendali laju sudut, barrel roll, mode darat dengan suspensi raycast, lompat, klakson (bunyi sementara boleh sederhana), umpan balik tabrakan bertingkat, bantuan tegak otomatis, respawn. Semua angka di `src/config/flight.ts` dan bisa disetel dari panel debug.

6. **Kamera** (`src/camera/CameraRig.ts`): mode chase lengkap (pegas, look-ahead, kemiringan, FOV boost, anti tembus, geser kamera, kembali otomatis), mode kokpit versi awal, guncangan berbasis trauma.

7. **Kontrol**: keyboard, gamepad, sentuh (joystick dinamis + tombol Boost/Rem/Aksi, geser kamera), giroskop opsional (dengan izin iOS), getaran. Tata letak HP landscape dan portrait sesuai `docs/07` bagian 3.

8. **Bandara Medan versi awal**: landasan dengan marka dan lampu, huruf **S Y A H R I L** fisik yang bisa ditabrak dan kembali tersusun sendiri, 3 cincin latihan, hangar, kantong angin, tumpukan koper fisika. Istana Maimun dan Masjid Raya cukup versi sederhana dulu.

9. **HUD minimal**: kecepatan, ketinggian, kompas, tombol jeda, fps (debug). Tutorial dasar yang menyesuaikan perangkat (keyboard, sentuh, gamepad).

10. **Tes**: unit test `geo`, quaternion, dan model terbang (lurus stabil 20 detik, stall, radius belok) sesuai `docs/03` bagian 4.6. E2E: halaman terbuka tanpa error, terbang 20 detik dengan keyboard, kontrol sentuh di viewport 390×844 dan 844×390. `npm run shots`.

## Definisi selesai Fase 0

- [ ] Lepas landas, terbang keliling planet satu putaran (sekitar 75 detik), dan mendarat lagi di Medan terasa menyenangkan dengan keyboard, gamepad, dan sentuhan.
- [ ] Menabrak huruf, koper, dan tanah terasa memuaskan (fisika + efek + bunyi sementara).
- [ ] Tidak ada glitch saat terbang melewati kutub.
- [ ] FPS sesuai target (`docs/11` bagian 1) di tier yang relevan.
- [ ] Semua tes lulus, screenshot 4 viewport sudah kamu lihat dan rapi.
- [ ] Laporan `docs/progress/PHASE-0.md` ditulis, termasuk bagian "Butuh dari Aril".

Setelah selesai, jelaskan padaku dengan bahasa sederhana cara mencobanya di laptop (`npm run dev`) dan di HP (satu Wi-Fi, `npm run dev -- --host`, buka alamat IP yang muncul).
