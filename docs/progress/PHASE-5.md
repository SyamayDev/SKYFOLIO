# Laporan Fase 5 — Poles, performa, keamanan, dan rilis

Tanggal: 11 November 2026

## Ringkasan

SKYFOLIO **sudah online di https://skyfolio-phi.vercel.app** (deploy otomatis dari GitHub `SyamayDev/SKYFOLIO`, branch `main`):
- **Keamanan:** header keamanan dan Content-Security-Policy ketat. CSP diuji di hasil build produksi, tanpa satu pun pelanggaran.
- **SEO lengkap:** OG, canonical, hreflang, sitemap, robots, dan halaman 404 bertema.
- **Audit performa otomatis:** tersedia per tier kualitas.
- **Aksesibilitas baru:** kontras tinggi, teks besar, penanda ramah buta warna, dan reset progres.

Audit otomatis juga menemukan dan memperbaiki empat bug yang tidak terlihat sebelumnya:
1. CSP produksi memblokir pemilih bahasa di Mode Ringkas dan tombol cetak CV.
2. Autopilot "ke orbit" langsung dianggap tiba tanpa naik.
3. Autopilot ke pulau proyek bisa menyenggol mercusuar lalu jatuh ke laut.
4. Sebagian besar koper di bandara tampil putih (indeks warna negatif).

## Cara mencoba

| Perintah | Isi |
| --- | --- |
| `npm run dev` | Situs lokal (http://localhost:5173) |
| `npm run build && npm run preview` | Hasil build produksi dengan CSP yang sama seperti Vercel (http://localhost:4173) |
| `npm run perf` | Audit performa `?autotest=1` per tier (renderer software, angka draw call & error valid) |
| `PERF_GPU=1 PERF_CHANNEL=chrome npm run perf` | Audit dengan GPU asli lewat Chrome terpasang (WebGPU) |
| http://localhost:5173/?autotest=1 | Lihat sendiri skenario terbang otomatis; hasilnya di console |

Aksesibilitas: Pengaturan → **Aksesibilitas** (kurangi gerakan, kontras tinggi, teks besar, penanda ramah buta warna) dan **Data** (reset progres).

## Selesai

### Performa (audit `?autotest=1`)

Rute: bandara → pulau proyek unggulan → Pegunungan Skill → orbit → pulang. Diukur di Chrome dengan WebGPU, GPU laptop NVIDIA, resolusi 1280×720, tanpa batas fps.

| Tier | Draw call rata-rata / puncak | Segitiga rata-rata / puncak | Fisika rata-rata / puncak | fps rata-rata (1% terendah) |
| --- | --- | --- | --- | --- |
| Low | 107 / 171 (sebelum: 132 / 156*) | 252 rb / 331 rb | 0,35 / 1,7 ms | 532 (126) |
| Medium | 136 / 204 (sebelum: 152 / 227*) | 361 rb / 435 rb | 0,34 / 4,4 ms | 481 (138) |
| High | 169 / 234 (sebelum: 266 / 326*) | 539 rb / 774 rb | 0,33 / 1,9 ms | 329 (94) |

\* Rute "sebelum" belum benar-benar naik ke orbit (bug autopilot) dan bisa berakhir di laut, jadi puncaknya tidak sebanding.

Anggaran (`src/config/quality.ts`): High puncak ≤ 250; Low/Medium rata-rata ≤ 120/180 dengan puncak sesaat ≤ 180/220. Ketiga tier lulus. Di situs produksi (Chrome, Wi-Fi), halaman siap dalam 2,6–4,4 detik dengan total unduhan awal 3,63 MB.

Optimasi yang dilakukan:
- Koper bandara menjadi InstancedMesh.
- Papan teks menjadi satu mesh dua sisi.
- Pelat registrasi digabung.
- Wajah Aril dan headset Piko dipanggang ke kepala.
- Bagian kecil tidak lagi menghasilkan bayangan.
- Detail bandara dipangkas dari jauh.
- Radius detail kecil zona di High 170 → 136 unit.

High kini di bawah batas 250 draw call di semua titik rute. Di Low/Medium, rata-ratanya di bawah anggaran. Puncak sesaat (±170 di Low) terjadi saat masuk atmosfer dari orbit. Langkah berikutnya untuk itu adalah menyatukan pesawat dan karakter menjadi satu SkinnedMesh (±40 draw call lebih hemat di semua tier).

Muatan awal (gzip):

| Bagian | Ukuran |
| --- | --- |
| Rapier (fisika + wasm) | 1,67 MB |
| three.js | 0,24 MB |
| Kode UI | 0,16 MB |
| Kode 3D | 0,09 MB |
| CSS | 0,02 MB |
| Data planet (`earth.bin.gz`) | 1,08 MB |
| Sungai | 0,28 MB |
| **Total** | **±3,6 MB** (batas 8 MB) |

### Keamanan

- **`vercel.json`:**
  - CSP tanpa `unsafe-inline`/`unsafe-eval` (hanya `wasm-unsafe-eval` untuk Rapier).
  - `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
  - Cache aset 1 tahun.
  - `/api` tanpa cache.
  - `/hangar` dialihkan, karena Hangar hanya untuk lokal.
- **Uji CSP:** `vite preview` dengan header yang sama, membuka `/`, `/ringkas/`, `/ringkas/?lang=en`, dan `/cv/`. Hasilnya **0 pelanggaran CSP, 0 error console**.
- **Script inline:** dipindah ke `public/boot/*.js`. Ada tes yang mencegah script inline muncul lagi.
- **Rahasia:** tes memastikan tidak ada key di `src/`. Hasil build juga diperiksa: tidak ada key di `dist/`.
- **Fungsi `api/`:**
  - Import memakai `.js` supaya jalan di Node ESM Vercel. Sudah diuji dengan kompilasi tiruan, dan kelima endpoint menjawab tanpa key apa pun (memori + offline).
  - Baru: `DELETE /api/lanterns?id=…` untuk menghapus lampion, wajib `ADMIN_TOKEN`.

### SEO & berbagi

- **Saat build,** dengan URL absolut dari domain Vercel: OG/Twitter card, canonical, dan hreflang (Mode Ringkas). `robots.txt` dan `sitemap.xml` juga dibuat.
- **Gambar dan ikon:** `og.png` 1200×630, favicon SVG, ikon PWA 192/512, apple-touch-icon, `manifest.webmanifest`.
- **Judul tab** mengikuti zona yang sedang diterbangi (misalnya "Lembah Lampion Danau Toba · SKYFOLIO").
- **Halaman 404 bertema** ("Ups, kita tersesat di awan!").
- **JSON-LD `Person`** di Mode Ringkas.

### Aksesibilitas & pengaturan

- **Kontras tinggi:** panel solid, tinta hitam, garis tepi tegas, cincin fokus 3 px.
- **Teks besar:** semua huruf UI ×1,2.
- **Penanda ramah buta warna:** palet Okabe–Ito di radar dan peta.
- **Reset progres:** konfirmasi dua langkah.
- **Kurangi gerakan:** sudah ada sejak Fase 2.

Semua tersimpan di `localStorage`, ada dalam dua bahasa, dan diperiksa lewat screenshot di 390×844 dan 1440×900.

### Materi kompetisi

`docs/press/`: deskripsi ID/EN (pendek dan panjang), rencana video 60 detik per adegan, dan 7 screenshot.

## Pemeriksaan

| Cek | Hasil |
| --- | --- |
| Typecheck + svelte-check | 0 error, 0 warning |
| Lint | bersih |
| Unit test | 95 lulus (14 file) |
| E2E | 13 lulus |
| Build produksi | tanpa peringatan |
| Uji CSP hasil build | 0 pelanggaran, 0 error console |
| Audit performa | lihat tabel di atas |

## Belum / langkah berikutnya

- Pesawat dan karakter disatukan menjadi SkinnedMesh, untuk menurunkan puncak draw call Low/Medium.
- Dari Fase 4: sinar penarik UFO, sektor sirkuit, jejak terbang di globe kedatangan, counter pengunjung Bulan.
- Uji manual di perangkat sungguhan: Safari iOS (audio, giroskop, safe area), HP Android kelas menengah, Firefox. Checklist ada di `docs/11` bagian 5.

## Deploy ke Vercel (langkah demi langkah)

Kode sudah di-push ke GitHub `SyamayDev/SKYFOLIO` (branch `main`), dan Vercel sudah membuat deployment produksi **https://skyfolio-phi.vercel.app** (status: Ready).

Hasil uji di produksi:
- Semua halaman (`/`, `/ringkas/`, `/cv/`, 404) terbuka tanpa error console dan tanpa pelanggaran CSP.
- Kelima API menjawab.
- Header keamanan aktif.
- Alamat `skyfolio-syamaydevs-projects.vercel.app` dan `skyfolio-git-main-…` meminta login Vercel. Itu normal: fitur **Deployment Protection** hanya membuka domain produksi untuk umum. Bagikan selalu `https://skyfolio-phi.vercel.app`.

Setiap `git push` ke `main` otomatis membuat deployment baru.

### 1. Pengaturan project (sudah benar, cukup dicek)

1. Buka https://vercel.com/syamaydevs-projects/skyfolio → **Settings** → **Git**. Harus tertulis **SyamayDev/SKYFOLIO**.
2. Di **Settings → Build and Deployment**, biarkan bawaan. `vercel.json` sudah mengatur framework (Vite), perintah build, dan folder `dist`. **Root Directory** harus kosong (`./`). **Node.js Version**: 22.x atau lebih baru.

### 2. Variabel lingkungan

Buka **Settings → Environment Variables**. Isi setiap baris, centang Production + Preview + Development, lalu **Save**.

| Key | Isi | Wajib? |
| --- | --- | --- |
| `IP_HASH_SALT` | Salin dari file `.env.local` di laptop (sudah dibuatkan, acak) | Ya |
| `LEADERBOARD_SECRET` | Salin dari `.env.local` | Ya |
| `ADMIN_TOKEN` | Salin dari `.env.local` (untuk menghapus lampion) | Ya |
| `VITE_WEB3FORMS_ACCESS_KEY` | Key Web3Forms (langkah 4) | Untuk form kontak |
| `GROQ_API_KEY` + `GROQ_MODEL` dan seterusnya | Lihat PHASE-3 | Opsional |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Terisi otomatis oleh langkah 3 | Otomatis |

File `.env.local` ada di folder proyek (`c:\laragon\www\SKYFOLIO\.env.local`) dan **tidak** ikut ke GitHub. Jangan dibagikan ke siapa pun.

### 3. Upstash Redis (gratis, untuk lampion, papan skor, counter bersama)

1. Di project Vercel → tab **Storage** → **Create Database** (atau **Browse Marketplace**).
2. Pilih **Upstash** → **Upstash for Redis** → **Continue**.
3. Plan **Free**, region **Singapore (ap-southeast-1)** karena paling dekat dengan Medan → beri nama `skyfolio-redis` → **Create**.
4. Di layar berikutnya, pilih project `skyfolio` → **Connect**. Variabel `KV_REST_API_URL`/`KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_*`) akan terisi otomatis. Kode membaca keduanya.

Tanpa Upstash situs tetap jalan, tetapi lampion dan papan skor hanya tersimpan sementara di memori server.

### 4. Web3Forms (form kontak di Kantor Pos Udara)

1. Buka https://web3forms.com → isi email `syahrilmaymubdi2505@gmail.com` → **Create Access Key**.
2. Key dikirim ke email. Salin ke Vercel sebagai `VITE_WEB3FORMS_ACCESS_KEY`. Key ini memang aman dipublikasikan.

### 5. Deploy ulang & uji

1. Tab **Deployments** → titik tiga di deployment teratas → **Redeploy**. Variabel `VITE_…` baru terbaca saat build.
2. Setelah status **Ready**, buka situsnya lalu cek:
   - `https://skyfolio-phi.vercel.app/api/health` → `{"ok":true,"ai":[…],"storage":"upstash"…}`. Kalau isinya `storage: "memory"`, berarti Upstash belum tersambung.
   - Kantor Pos Udara → kirim pesan uji → email masuk.
   - Lembah Lampion → lepas satu lampion, lalu muat ulang halaman. Lampion masih ada kalau Upstash aktif.
   - Sirkuit Langit → selesaikan satu lap → namamu muncul di 10 besar.

### Menghapus lampion yang tidak pantas

1. Buka `https://skyfolio-phi.vercel.app/api/lanterns` di browser, lalu cari `id` lampion yang mau dihapus.
2. Di PowerShell (ganti `<ADMIN_TOKEN>` dan `<ID>`):

```powershell
Invoke-RestMethod -Method Delete -Uri "https://skyfolio-phi.vercel.app/api/lanterns?id=<ID>" -Headers @{ Authorization = "Bearer <ADMIN_TOKEN>" }
```

Jawaban `ok: True` berarti lampionnya sudah terhapus.

## Butuh dari Aril

1. **Isi variabel lingkungan di Vercel** (langkah 2–4 di atas), lalu Redeploy.
2. **Foto & konfirmasi data**: field bertanda `needsConfirmation` masih disembunyikan (31 peringatan di `npm run validate:content`):
   - **Foto profil**: `content/media/profile/aril.jpg`.
   - **Cover 8 proyek**: `content/media/projects/<id>/cover.jpg`, untuk si-raju, si-pandri, si-maung, ecolens, iteens-management, si-labu-smandu, warung-pak-din, dan imuslim.
   - **Peran Aril** di 8 proyek itu.
   - **Tahun** SI-RAJU.
   - **Anggota tim** SI-PANDRI.
   - **Timeline**:
     - hasil LKS Web Technologies 2025;
     - tanggal dan ringkasan PKL di PT Easy Digital Indonesia;
     - tahun menjabat Ketua iTeens;
     - tahun dan jurusan di SMK Tritech.
   - **Skill**: Pascal dan Leadership. Masih ditampilkan atau tidak?

   Cara termudah: `npm run dev` → http://localhost:5173/hangar/ → menu **Konfirmasi**.
3. **Pesan rahasia Bulan** (Hangar → Pesan rahasia Bulan).
4. **Sertifikat PDF** di `content/certificates/pdf/`, lalu jalankan `npm run ingest:certificates`.
5. Uji di HP sendiri (Android dan, kalau ada, iPhone). Kabari bagian yang terasa patah atau lambat.
