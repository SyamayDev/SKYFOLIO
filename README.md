# SKYFOLIO — Paket Prompt untuk Claude Code

Paket ini berisi semua yang dibutuhkan Claude Code untuk membangun **SKYFOLIO**, portofolio 3D milik Syahril Maimubdy (Aril): Bumi low-poly yang dikelilingi biplane berfisika nyata bersama co-pilot cilik bernama Piko, dari landasan di Medan sampai ke Bulan.

## Isi paket

```text
skyfolio-kit/
├─ README.md            ← file ini (panduan untuk Aril)
├─ CLAUDE.md            ← aturan utama, dibaca otomatis oleh Claude Code
├─ CREDITS.md           ← daftar lisensi (diperbarui Claude Code)
├─ .env.example         ← daftar variabel lingkungan
├─ docs/                ← 12 dokumen desain lengkap + catatan keputusan
├─ content/             ← SEMUA isi portofolio (data dirimu)
└─ prompts/             ← prompt yang kamu tempel ke Claude Code, berurutan
```

## Sebelum mulai

### 1. Pasang alat

- **Node.js** versi LTS terbaru (nodejs.org).
- **Git** (git-scm.com).
- **Claude Code**: ikuti panduan resmi di docs.claude.com (bagian Claude Code), lalu login dengan akunmu.
- VS Code (opsional, untuk melihat file).

### 2. Siapkan foto dan file

| Apa | Taruh di | Catatan |
| --- | --- | --- |
| Foto profil | `content/media/profile/aril.jpg` | Jika nama atau formatnya beda, ubah `avatar.photo` di `content/profile.json` |
| 5–15 foto lain (dari Instagram, dll.) | `content/media/gallery/` | Tampil di Menara Kontrol dan Mode Ringkas |
| Screenshot SI-RAJU | `content/media/projects/si-raju/` | Beri nama `cover.jpg` untuk gambar utama |
| Screenshot SI-PANDRI | `content/media/projects/si-pandri/` | Sama seperti di atas |
| Gambar biplane yang kamu suka | `docs/references/biplane.png` | Gambar yang kamu sebut di chat belum ikut terkirim; taruh di sini supaya Claude Code bisa melihatnya |
| PDF sertifikat | `content/certificates/pdf/` | Boleh menyusul; pakai `prompts/92-tambah-sertifikat.md` |

Format foto bebas (jpg, png, webp). Sistem akan mengecilkan dan mengoptimalkannya otomatis.

## Cara memakai

1. Buat folder baru bernama `skyfolio`, lalu salin **seluruh isi** paket ini ke dalamnya (`CLAUDE.md` harus ada di folder paling atas).
2. Buka terminal di folder itu.
3. Ketik `claude` lalu Enter. Pilih model Opus terbaru lewat perintah `/model`.
4. Buka `prompts/00-mulai-fase-0-fondasi.md`, salin teks di bawah garis `---`, tempel ke Claude Code, tekan Enter.
5. Tunggu sampai Claude Code selesai dan memberi laporan. Coba hasilnya:
   - Laptop: `npm run dev`, buka alamat yang muncul (biasanya http://localhost:5173).
   - HP: sambungkan ke Wi-Fi yang sama, jalankan `npm run dev -- --host`, buka alamat IP yang muncul di browser HP.
6. Baca bagian **"Butuh dari Aril"** di laporan (`docs/progress/PHASE-0.md`), penuhi sebisanya.
7. Mulai **sesi baru** (`/clear` atau buka `claude` lagi), lalu lanjut ke prompt berikutnya.

### Urutan prompt

| Urutan | File | Hasilnya |
| --- | --- | --- |
| 1 | `00-mulai-fase-0-fondasi.md` | Planet, biplane, fisika, kamera, kontrol HP/keyboard/gamepad, bandara Medan |
| 2 | `01-fase-1-dunia-dan-konten.md` | 17 zona, proyek dari GitHub, paspor, Mode Ringkas, CV PDF, Hangar |
| 3 | `02-fase-2-dunia-hidup-dan-suara.md` | Siang-malam nyata, cuaca Medan, kanopi otomatis, angkasa, Bulan, musik, suara |
| 4 | `03-fase-3-ai-copilot-piko.md` | Piko bisa ngobrol dan menerbangkan pesawat, Mode Rekruter |
| 5 | `04-fase-4-game-dan-sosial.md` | Achievement, skin, mini-game, sirkuit, lampion, layar kedatangan |
| 6 | `05-fase-5-poles-dan-rilis.md` | Performa, aksesibilitas, SEO, online di Vercel |
| 7+ | `06-poles-detail-berulang.md` | Ulangi per area supaya makin detail |

Prompt bantuan:
- `90-tambah-atau-ubah-konten.md` untuk menambah proyek, mengganti foto, atau mengonfirmasi data.
- `91-lapor-bug.md` untuk melaporkan bug.
- `92-tambah-sertifikat.md` untuk memasukkan sertifikat PDF.
- `94-lanjutkan-sesi.md` untuk melanjutkan kalau sesi terputus.

## Mengubah isi portofolio nanti

- Cara paling mudah: `npm run dev`, lalu buka `http://localhost:5173/hangar/`. Ada formulir untuk semua isi, seret-lepas foto, dan tombol **Simpan & Publikasikan**.
- Atau edit file di `content/` langsung (di laptop atau lewat GitHub). Panduan lengkap ada di `docs/08-content-system.md` bagian 10.

## Data yang masih perlu kamu pastikan

Data ini ditandai `needsConfirmation`, jadi **disembunyikan dari situs** sampai kamu isi atau konfirmasi (lewat Hangar atau `prompts/90`):

| Data | File |
| --- | --- |
| Tahun, peranmu, dan tech yang dipakai di SI-RAJU 2.0 | `content/projects/si-raju.md` |
| Peranmu dan anggota Tim SEPAKAT di SI-PANDRI | `content/projects/si-pandri.md` |
| Proyek unggulan ketiga dan tema diorama tiap proyek | Diusulkan Claude Code di Fase 1 |
| Hasil atau peringkat LKS Web Technologies 2025 | `content/timeline.json` |
| Tahun dan isi PKL di PT Easy Digital Indonesia | `content/timeline.json` |
| Tahun menjabat Ketua iTeens | `content/timeline.json` |
| Tahun masuk dan jurusan di SMK Tritech Informatika Medan | `content/timeline.json` |
| Level skill Pascal dan Kepemimpinan | `content/skills.json` |
| Pesan rahasiamu untuk pengunjung yang mendarat di Bulan | `content/secret-message.json` |
| Daftar sertifikat | `content/certificates/pdf/` |

## Layanan gratis yang dipakai

Semua layanan memakai tier gratis (Rp0). Situs tetap jalan walau layanan belum dipasang. Panduan pendaftaran langkah demi langkah ada di `docs/10-backend-free-services.md` bagian 6, dan Claude Code akan memandumu saat Fase 3 dan Fase 5.

| Layanan | Untuk |
| --- | --- |
| Vercel | Hosting situs |
| Upstash Redis | Lampion, counter, leaderboard |
| Web3Forms | Form kontak ke emailmu |
| Open-Meteo | Cuaca Medan (tanpa daftar) |
| Groq, Gemini, Cloudflare Workers AI | Otak Piko (opsional; tanpa ini Piko tetap bisa memandu) |

## Catatan

- **Musik** dibuat original dengan rasa lagu daerah Sunda yang ceria dan heroik, seperti yang kamu suka. Melodi lagu yang sudah ada (termasuk Manuk Dadali) tidak disalin, karena itu karya cipta orang lain.
- **Artis favoritmu** hanya disebut oleh Piko. Lagunya tidak diputar, karena butuh lisensi.
- **Logo dan karakter game** (misalnya game strategi dan game balok yang kamu suka) tidak dipakai. Easter egg-nya dibuat versi generik buatan sendiri.
- **Nomor WhatsApp dan email** tampil publik sesuai permintaanmu. Kalau berubah pikiran, ubah `public` menjadi `false` di `content/socials.json`.
