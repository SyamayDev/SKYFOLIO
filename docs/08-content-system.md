# 08 — Sistem Konten, Sinkron GitHub, Sertifikat, Media, Hangar, dan CV

Tujuan: Aril bisa menambah proyek, mengganti foto, atau memperbarui skill **tanpa menyentuh kode 3D**, dan semua isi selalu akurat.

## 1. Sumber kebenaran

Semua fakta tentang Aril ada di `content/`:

| File | Isi |
| --- | --- |
| `profile.json` | Nama, panggilan, tagline, pendidikan, kota asal, bio, minat, avatar, CV |
| `socials.json` | Kontak publik dan tautan sosial media |
| `skills.json` | Kelompok skill dan level 1–5 |
| `timeline.json` | Pendidikan, organisasi, PKL, kompetisi |
| `projects/*.md` | Satu file per proyek (frontmatter YAML + cerita dua bahasa) |
| `certificates.json` + `certificates/pdf/` | Sertifikat (jadi satelit) |
| `copilot.json` | Persona dan pengaturan Piko |
| `easter-eggs.json` | Hobi, favorit, stasiun radio |
| `faq.json` | Jawaban offline Piko |
| `world/zones.json`, `world/landmarks.json` | Zona dan landmark |
| `settings.defaults.json` | Nilai bawaan Pengaturan |
| `secret-message.json` (opsional) | Pesan rahasia Aril di Bulan, dua bahasa |
| `media/` | Foto profil, galeri, gambar proyek |

## 2. Skema dan validasi (`src/content/schema.ts`)

- Setiap file punya skema zod. `npm run validate:content` memeriksa semuanya dan memberi pesan yang mudah dimengerti, misalnya "content/projects/si-raju.md: field `links.demo` harus berupa URL".
- `prebuild` menjalankan validasi. Build gagal jika konten rusak, jadi situs produksi tidak pernah layar putih karena salah ketik.
- **`needsConfirmation`**: field yang terdaftar di sini disembunyikan di situs, CV, paket pengetahuan AI, dan Mode Ringkas, lalu ditampilkan sebagai peringatan kuning di Hangar. Ada juga daftar otomatis di laporan fase.
- Teks dua bahasa selalu `{ id, en }`. Jika salah satu kosong, tampilkan bahasa yang ada dan catat peringatan.

## 3. Loader

- Plugin Vite (`scripts/vite-plugin-content.ts`) membaca `content/`, mem-parse frontmatter (`gray-matter`) dan markdown, memvalidasi, lalu menyediakan modul virtual `virtual:content` yang bertipe.
- Saat dev, perubahan file di `content/` memicu hot reload: pulau, papan, dan panel langsung diperbarui tanpa memuat ulang halaman.
- Hasil build juga ditulis ke `src/content/_generated/` untuk Mode Ringkas, CV, dan paket pengetahuan AI.

## 4. Pipeline media (`scripts/optimize-media.ts`)

- Input: gambar apa pun di `content/media/**` (jpg, png, webp, heic jika bisa).
- Output ke `public/media/**`: webp dan avif ukuran 480, 960, 1600 px, ditambah placeholder blur kecil (base64) untuk efek muat halus.
- Hanya memproses file yang berubah (cache berbasis hash).
- Video: mp4 H.264 ≤ 8 MB per video, dimuat malas (lazy) hanya saat panel dibuka.
- Foto Instagram dimasukkan manual ke `content/media/gallery/`, karena API Instagram untuk akun pribadi sangat terbatas.

## 5. Penempatan pulau otomatis (`src/world/Zones/ProjectArchipelago.ts`)

1. Proyek dengan `island.lat/lon` diletakkan di koordinat itu.
2. Sisanya ditempatkan dengan Poisson disk di dalam area Kepulauan Proyek, dengan jarak minimum = jumlah radius dua pulau + 6 unit.
3. Urutan: `featuredRank` kecil lebih dekat ke Medan, lalu proyek terbaru.
4. Seed tetap supaya posisinya stabil antar deploy. Menambah proyek baru tidak menggeser pulau lama.
5. Mode debug menampilkan koordinat tiap pulau dan tombol "salin koordinat" untuk menyematkan posisinya.

## 6. Sinkron GitHub (`scripts/sync-github.ts`, `npm run sync:github`)

Aril meminta isi proyek dan skill diambil dari GitHub-nya (`SyamayDev`).

1. **Daftar repo**: `GET https://api.github.com/users/SyamayDev/repos?per_page=100&type=owner&sort=updated`. Tanpa token berlaku batas permintaan anonim GitHub. Dengan `GITHUB_TOKEN` (fine-grained token gratis, akses hanya baca repo publik) batasnya jauh lebih besar.
2. Untuk setiap repo yang bukan fork: nama, deskripsi, bahasa (`languages_url`), topik, homepage, bintang, `created_at`, `pushed_at`, dan README.
3. Tulis **draf** ke `content/projects/_drafts/<nama-repo>.md`:
   - `title` dari nama repo yang dirapikan,
   - `tech` dari bahasa dan topik,
   - `links.repo` dan `links.demo` (homepage) jika ada,
   - `year` dari `created_at`,
   - `summary` dari deskripsi atau paragraf pertama README,
   - `needsConfirmation: [summary, role]`.
4. Draf tidak tampil di situs. **Claude Code** lalu membaca setiap draf dan README-nya, menulis ringkasan dan cerita ID/EN **hanya dari fakta di README dan deskripsi**, mengusulkan urutan unggulan, lalu memindahkan draf yang layak ke `content/projects/`. Usulan dicatat di laporan fase untuk dikonfirmasi Aril.
5. **Skill**: bahasa dari semua repo dijumlahkan. Bahasa yang belum ada di `skills.json` ditambahkan dengan `source: github-sync` dan level 3. Level skill yang sudah diisi Aril tidak boleh diubah.
6. **Kontribusi** (untuk Kota Kontribusi): butuh `GITHUB_TOKEN`, lewat GraphQL:

```graphql
query {
  user(login: "SyamayDev") {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}
```

   Simpan ke `src/content/_generated/contributions.json`. Tanpa token, langkah ini dilewati dan Kota Kontribusi tampil sebagai lokasi konstruksi.
7. Supaya Kota Kontribusi tetap segar: opsional, GitHub Action terjadwal mingguan (gratis) yang memanggil Deploy Hook Vercel.

## 7. Sertifikat (`scripts/ingest-certificates.ts`, `npm run ingest:certificates`)

1. Aril menaruh semua PDF di `content/certificates/pdf/`.
2. Script membuat thumbnail halaman pertama (`pdfjs-dist` + `@napi-rs/canvas`, lalu `sharp` ke webp 480 dan 1200 px) ke `public/media/certificates/`.
3. Script menambah entri draf ke `certificates.json` dengan `needsConfirmation: ["title", "issuer", "date"]`.
4. **Claude Code membaca setiap PDF** (tool Read mendukung PDF), mengisi judul, penerbit, tanggal, dan kategori (kompetisi, kursus, seminar, organisasi), lalu mencatat ringkasannya di laporan untuk dikonfirmasi Aril.
5. Sertifikat yang terkonfirmasi tampil sebagai satelit di orbit, di panel Sertifikat, di Mode Ringkas, dan di CV.

## 8. Hangar: editor konten lokal (`/hangar/`, hanya saat `npm run dev`)

Supaya Aril tidak perlu mengedit JSON dengan tangan:

- Halaman Svelte di `/hangar/` yang hanya aktif di server dev (middleware Vite). Tidak ada di build produksi, jadi tidak perlu login dan aman.
- Fitur:
  - Formulir untuk profil, kontak, skill (slider level), timeline, proyek, sertifikat, FAQ Piko, dan pesan rahasia Bulan.
  - Seret-lepas foto ke proyek atau galeri. File disalin ke `content/media/` dan langsung dioptimalkan.
  - Daftar peringatan `needsConfirmation` dengan tombol "Konfirmasi".
  - Daftar draf dari sinkron GitHub dengan tombol "Tampilkan di situs".
  - Pratinjau langsung: membuka dunia 3D di tab lain dan terbang ke pulau yang sedang diedit.
  - Tombol **Validasi**.
  - Tombol **Simpan & Publikasikan**: menampilkan ringkasan perubahan (diff), lalu menjalankan `git add content public/media && git commit -m "content: ..." && git push`. Vercel otomatis deploy.
- Cara alternatif tanpa Hangar: edit file langsung di GitHub (tombol pensil), dan Vercel otomatis deploy dalam sekitar satu menit.

## 9. Build CV (`npm run build:cv`)

Lihat `docs/07` bagian 10. Data diambil dari loader yang sama, dan field `needsConfirmation` tidak dicetak.

## 10. Panduan singkat untuk Aril (salin juga ke README)

- **Tambah proyek**: buka Hangar → Proyek → Tambah, atau salin `content/projects/si-raju.md` menjadi file baru lalu ubah isinya. Taruh gambar di `content/media/projects/<id>/`.
- **Ganti foto profil**: timpa `content/media/profile/aril.jpg` (format lain juga boleh, perbarui `avatar.photo` di `profile.json`).
- **Ubah level skill**: Hangar → Skill, atau edit `content/skills.json`.
- **Tambah sertifikat**: taruh PDF di `content/certificates/pdf/`, jalankan `npm run ingest:certificates`, lalu minta Claude Code membaca dan mengisinya.
- **Publikasikan**: tombol di Hangar, atau `git add . && git commit -m "update konten" && git push`.
