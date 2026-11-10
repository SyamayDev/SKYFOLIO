# Laporan Fase 1 — Dunia penuh isi

Tanggal: 10 November 2026

## Ringkasan

Bumi sekarang jauh lebih detail (sungai, lembah, ladang, pantai, hutan, desa, awan) dan penuh isi: **17 zona**, 17 landmark dunia, kehidupan latar (burung, paus, kapal, kereta, balon udara, aurora), paspor stempel, peta globe dengan autopilot "Antar ke sini", panel proyek, form kontak, Mode Ringkas, CV PDF, dan Hangar untuk mengedit konten tanpa menyentuh kode.

## Cara mencoba

1. `npm install` (sekali), lalu `npm run dev`, buka http://localhost:5173.
2. Tekan **Naik Pesawat**, tahan **W** untuk lepas landas.
3. Tekan ikon 🗺️ (atau tombol **M**), pilih tujuan, tekan **Antar ke sini**. Gerakkan kemudi kapan saja untuk mengambil alih.
4. Ikon 🛂 membuka paspor. Mendekati zona memunculkan judul, stempel, dan komentar Piko.
5. **Hangar**: buka http://localhost:5173/hangar/ saat `npm run dev` berjalan.
6. **Mode Ringkas**: http://localhost:5173/ringkas/ · **CV**: http://localhost:5173/cv/ (PDF ada di `public/cv/`).

## Selesai

- **Sistem konten** (`docs/08`): skema zod untuk semua file, `virtual:content` dengan hot reload (menambah file di `content/projects/` langsung memunculkan pulau baru), `npm run validate:content`, aturan `needsConfirmation` (field disembunyikan dan tercatat), pipeline media otomatis di `prebuild`.
- **Sinkron GitHub** dijalankan untuk `SyamayDev`: 54 draf proyek, 8 dipromosikan jadi pulau (SI-RAJU 2.0, SI-PANDRI, SI-MAUNG, EcoLens, I-Teens, SI LABU, Warung Pak Din 2, iMuslim). 45 draf lain menunggu di Hangar → Draf GitHub.
- **17 zona**: Bandara Medan, Menara Kontrol (profil), Kantor Pos Udara (paket ke kotak surat, balon sosial media, form kontak Web3Forms dengan cadangan `mailto:`), Lembah Lampion Toba, Kepulauan Proyek (penempatan otomatis + 12 preset diorama), Pegunungan Skill, Arus Perjalanan, Kota Kontribusi, Hangar Eksperimen + Kawah Nekat, Panggung MC, Dapur Aril, Pulau Gym, Desa Benteng, Taman Balok, Sirkuit Langit (24 cincin + waktu lokal), Orbit Sertifikat, Bulan (model + landasan).
- **Landmark & kehidupan latar** dengan stempel bonus; nama landmark kini dua bahasa.
- **UI**: boarding pass, HUD + radar zona terdekat, banner zona, gelembung Piko, status autopilot, waktu sirkuit, panel Zona/Proyek (bottom sheet di HP), Peta globe, Paspor, Kontak, konfirmasi tautan keluar, Di Balik Layar, tombol aksi kontekstual (sentuh) dan petunjuk tombol (keyboard/gamepad).
- **Autopilot** jujur fisika (memakai input yang sama dengan pemain): lepas landas lurus, belok dengan sudut miring terbatas, menghindari medan, lalu mengitari tujuan sampai diambil alih.
- **Hangar** (`/hangar/`): form untuk profil, kontak, skill (slider level), perjalanan, sertifikat, FAQ, Piko, pesan Bulan; editor proyek dengan seret-lepas foto; daftar "Butuh konfirmasi" dengan tombol ✔; draf GitHub → "Tampilkan di situs"; Pratinjau (terbang otomatis ke pulau); Validasi; Simpan & Publikasikan dengan diff. API-nya hanya menerima permintaan dari komputer sendiri dan dilindungi dari CSRF.
- **Mode Ringkas & CV**: HTML statis + JSON-LD, PDF ID/EN dari `npm run build:cv`.
- **i18n** ID/EN lengkap, ganti bahasa tanpa reload termasuk papan 3D.

## Perbaikan penting di akhir fase

- Kantor Pos sempat berdiri **di tengah landasan** (koordinat Medan asli bertabrakan dengan bandara reklamasi) sehingga pesawat tidak bisa lepas landas. Sekarang di pulau pos sendiri di sebelah landasan, plus tes otomatis yang mencegah zona menimpa landasan lagi.
- Autopilot sempat berguling terus lalu jatuh ke laut di FPS rendah, dan berhenti begitu sampai. Sekarang stabil.
- Teks Piko tidak lagi tampil dobel (gelembung + subtitle).

## Pemeriksaan

| Cek | Hasil |
| --- | --- |
| `npm run typecheck` (tsc + svelte-check) | 0 error, 0 warning |
| `npm run lint` | bersih |
| `npm run test` | 42 tes lulus (fisika, geo, i18n termasuk kunci yang dipakai kode, konten, tata letak, sun, loop, quat) |
| `npm run e2e` | 11 tes lulus: muat tanpa error console, terbang 20 detik, ganti bahasa, menu jeda, sentuh portrait & landscape, Peta → Antar ke sini, panel proyek + ganti bahasa, paspor, Mode Ringkas, CV |
| `npm run shots` | 4 viewport × 17 adegan (termasuk 8 panel) sudah dilihat |
| Draw call | High ±170–250, Low ±100–160 (renderer software di tes; GPU asli lebih ringan) |

## Butuh dari Aril

Semua bisa diisi lewat **Hangar** (`npm run dev` → http://localhost:5173/hangar/ → Ringkasan → tombol **Buka**). Setelah mengisi, tekan **✔ Konfirmasi** di sebelah nama field supaya tampil di situs.

1. **Foto profil**: taruh foto di `content/media/profile/aril.jpg` (atau seret ke Hangar → Profil). Rasio persegi, minimal 800×800.
2. **Sampul proyek** (8 file): `content/media/projects/<id>/cover.jpg` untuk `si-raju`, `si-pandri`, `si-maung`, `ecolens`, `iteens-management`, `si-labu-smandu`, `warung-pak-din`, `imuslim`. Paling mudah: Hangar → Proyek → Edit → seret screenshot aplikasinya ke kotak foto. Selama belum ada, pulau memakai sampul gradasi otomatis.
3. **Tahun & peran proyek**: tahun SI-RAJU; peran di semua proyek (misalnya "Pembuat tunggal, full-stack" atau "Ketua tim, frontend"); anggota tim SI-PANDRI.
4. **Proyek unggulan**: saat ini urutannya SI-RAJU (1), SI-PANDRI (2), **SI-MAUNG (3, usulan Claude)**. Setuju? Kalau tidak, ganti `featuredRank` di Hangar.
5. **Draf GitHub lain**: lihat Hangar → Draf GitHub (45 repo). Tekan **Tampilkan di situs** untuk repo yang ingin jadi pulau.
6. **Perjalanan** (`timeline.json`): tanggal mulai/selesai SMK Tritech dan jurusannya, PKL Easy Digital (tanggal + ringkasan kegiatan), I-Teens (tanggal), hasil LKS Web 2025.
7. **Skill** yang menunggu konfirmasi: Pascal (Free Pascal) dan Kepemimpinan. Atur juga level 1–5 skill lain kalau perlu.
8. **Pesan rahasia Bulan** (`secret-message.json`): kalimat yang muncul saat pengunjung mendarat di Bulan. Sementara ini memakai ucapan netral.
9. **Key Web3Forms (gratis, opsional)** untuk form kontak. Tanpa key, tombol kirim membuka aplikasi email.
   1. Buka https://web3forms.com, masukkan email Kakak, tekan **Create Access Key**.
   2. Cek email, salin access key-nya.
   3. Buat file `.env` di folder proyek (jangan di-commit), isi `VITE_WEB3FORMS_ACCESS_KEY=<key>`.
   4. Nanti di Vercel: Project → Settings → Environment Variables → tambahkan variabel yang sama.
10. **GITHUB_TOKEN (opsional)** supaya `npm run sync:github` tidak kena batas 60 permintaan/jam:
    1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
    2. Repository access: "Public repositories (read-only)". Tidak perlu izin tambahan.
    3. Salin token ke `.env`: `GITHUB_TOKEN=<token>`.

## Berikutnya

Fase 2: waktu & cuaca nyata, malam dengan lampu kota, kanopi otomatis, mode air/orbit/Bulan, audio lengkap dan musik prosedural original bernuansa Sunda.
