<!--
CARA PAKAI: mulai sesi Claude Code baru di folder proyek, lalu tempel semua teks di bawah garis.
Sebelum menjalankan fase ini, taruh foto-fotomu di content/media/ (lihat README).
-->
---

# FASE 1 — Dunia penuh isi: sistem konten, semua zona, paspor, dan halaman pendukung

Baca `CLAUDE.md`, laporan `docs/progress/PHASE-0.md`, lalu `docs/02-world-zones.md`, `docs/07-ui-ux.md`, `docs/08-content-system.md`, dan `docs/09-gamification-social.md` bagian 1.

## Tugas

1. **Sistem konten** (`docs/08`): skema zod untuk semua file `content/`, plugin Vite `virtual:content` dengan hot reload, `npm run validate:content`, aturan `needsConfirmation`, dan pipeline media (`scripts/optimize-media.ts`, dijalankan otomatis di `prebuild`).

2. **Sinkron GitHub**: implementasikan `scripts/sync-github.ts`, lalu **jalankan** untuk akun `SyamayDev`.
   - Baca semua draf dan README di `content/projects/_drafts/`.
   - Tulis ringkasan dan cerita ID/EN hanya dari fakta di README dan deskripsi repo. Lengkapi juga `si-raju.md` dan `si-pandri.md` dari repo atau situs demonya jika ditemukan.
   - Pilih proyek yang layak tampil dan pindahkan ke `content/projects/`. Usulkan 3 proyek unggulan (SI-RAJU dan SI-PANDRI sudah unggulan 1 dan 2; usulkan yang ketiga). Pilih preset diorama untuk tiap proyek.
   - Tambahkan skill dari bahasa repo sesuai aturan di `docs/08` bagian 6.
   - Catat semua usulan di laporan supaya bisa aku konfirmasi.

3. **Semua zona versi lengkap** sesuai `docs/02` bagian 3: Menara Kontrol, Kantor Pos Udara (paket ke kotak surat + balon sosial media + form kontak Web3Forms dengan fallback jika key kosong), Lembah Lampion Danau Toba (tampilan dulu, API di Fase 4), Kepulauan Proyek (penempatan otomatis + semua preset diorama + mendarat membuka panel), Pegunungan Skill, Arus Perjalanan, Kota Kontribusi (pakai data jika ada, jika tidak tampil konstruksi), Hangar Eksperimen + Kawah Nekat (efek lokal dulu), Panggung MC, Dapur Aril, Pulau Gym, Desa Benteng, Taman Balok, Sirkuit Langit (cincin + waktu lokal dulu), Orbit Sertifikat (satelit dari `certificates.json`), dan Bulan (model + landasan).

4. **Landmark** dari `content/world/landmarks.json` dan **kehidupan latar** dasar (burung, paus, kapal, kereta, balon udara).

5. **UI** sesuai `docs/07`: Preflight dengan checklist pilot, Boarding Pass, HUD lengkap, Radar, Peta globe dengan "Antar ke sini" (autopilot dasar dari `docs/03` bagian 12), ZonePanel dan ProjectPanel (bottom sheet di HP), Paspor dengan stempel unik per zona dan landmark, Pause, Toasts, LinkConfirm, Behind the Scenes, tutorial bertahap.

6. **i18n** lengkap ID/EN dengan tes kunci yang hilang. Ganti bahasa tanpa reload, termasuk papan 3D.

7. **Mode Ringkas** (`/ringkas/`) dan **CV** (`/cv/` + `npm run build:cv` menghasilkan PDF ID dan EN) sesuai `docs/07` bagian 9 dan 10. Jalankan `build:cv` dan lihat PDF-nya (tool Read) untuk memastikan rapi.

8. **Hangar lokal** (`/hangar/`) sesuai `docs/08` bagian 8, termasuk tombol Simpan & Publikasikan dengan tampilan diff.

9. **Tes**: unit test skema konten, penempatan pulau (deterministik), i18n. E2E: buka panel proyek, ganti bahasa, Mode Ringkas, CV, Peta → Antar ke sini. Screenshot semua zona (siang).

## Definisi selesai Fase 1

- [ ] Menambah file proyek baru di `content/projects/` langsung memunculkan pulau baru saat dev, tanpa menyentuh kode.
- [ ] Semua 17 zona bisa dikunjungi, punya interaksi fisika khasnya, panel, stempel, dan komentar Piko (teks).
- [ ] Tidak ada fakta karangan. Semua field yang belum pasti tersembunyi dan tercatat.
- [ ] Mode Ringkas dan PDF CV rapi.
- [ ] Laporan `docs/progress/PHASE-1.md` berisi daftar konfirmasi untukku (proyek usulan, tahun, peran, dan lainnya).
