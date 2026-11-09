# 10 — Backend dan Layanan Gratis

Semua layanan di bawah punya tier gratis. Batas tier gratis bisa berubah; **cek halaman harga atau dashboard masing-masing saat setup** dan catat angkanya di `docs/decisions.md`. Situs harus tetap jalan jika salah satu atau semua layanan mati.

## 1. Daftar layanan

| Layanan | Untuk apa | Biaya | Wajib? |
| --- | --- | --- | --- |
| **Vercel** (Hobby) | Hosting situs + Vercel Functions di `api/` | Gratis untuk proyek pribadi non-komersial | Ya |
| **GitHub** | Menyimpan kode, sumber deploy otomatis, sinkron repo | Gratis | Ya |
| **Upstash Redis** (lewat Vercel Marketplace) | Lampion, counter, leaderboard, batas pemakaian AI | Tier gratis | Disarankan |
| **Web3Forms** | Form kontak langsung ke email Aril | Tier gratis 250 kiriman per bulan, tanpa backend | Disarankan |
| **Open-Meteo** | Cuaca Medan real-time | Gratis untuk non-komersial, tanpa API key | Opsional (ada fallback) |
| **Groq** | AI Piko (penyedia utama) | Free plan dengan batas per model | Opsional (ada fallback) |
| **Gemini API** | AI Piko (cadangan) | Tier gratis model Flash/Flash-Lite, batas kecil | Opsional |
| **Cloudflare Workers AI** | AI Piko (cadangan kedua) | 10.000 Neurons per hari | Opsional |
| **GitHub token** (fine-grained) | Data kontribusi untuk Kota Kontribusi | Gratis | Opsional |

## 2. Variabel lingkungan (`.env.example`)

```bash
# --- AI Piko (semua opsional; penyedia tanpa key dilewati) ---
GROQ_API_KEY=
GROQ_MODEL=            # isi nama model gratis terbaru dari console.groq.com
GEMINI_API_KEY=
GEMINI_MODEL=          # model Flash / Flash-Lite yang masih gratis
CF_ACCOUNT_ID=
CF_API_TOKEN=
CF_AI_MODEL=           # model teks dari katalog Workers AI yang tersedia di plan gratis

# --- Penyimpanan (otomatis terisi saat Upstash dipasang dari Vercel Marketplace) ---
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# --- Keamanan ---
IP_HASH_SALT=          # string acak panjang
LEADERBOARD_SECRET=    # string acak panjang
ADMIN_TOKEN=           # string acak panjang, untuk menghapus lampion

# --- Build ---
GITHUB_TOKEN=          # fine-grained, read-only, repo publik saja

# --- Klien (aman dipublikasikan) ---
VITE_WEB3FORMS_ACCESS_KEY=
VITE_SITE_URL=https://<nama-proyek>.vercel.app
```

Hanya variabel berawalan `VITE_` yang boleh sampai ke browser.

## 3. Endpoint (`api/`)

| Endpoint | Metode | Fungsi |
| --- | --- | --- |
| `/api/health` | GET | Status tiap layanan (untuk panel Behind the Scenes dan debug) |
| `/api/copilot` | POST | Pertanyaan ke Piko → `{ say, actions[], mode }` (`docs/06`) |
| `/api/lanterns` | GET, POST, DELETE | Lampion (`docs/09` bagian 5) |
| `/api/counters` | GET, POST | Counter global km, kawah, Bulan |
| `/api/counters/crater` | POST | Penerjun kawah + cek Phoenix |
| `/api/leaderboard` | GET, POST | Leaderboard harian Sirkuit Langit |
| `/api/leaderboard/start` | POST | Token sesi lap |

Aturan untuk semua endpoint:
- Validasi input dengan zod, ukuran body maksimal 4 KB.
- Batas laju per IP (IP di-hash dengan `IP_HASH_SALT`, IP mentah tidak pernah disimpan).
- CORS hanya untuk domain situs.
- Balasan error yang ramah dan konsisten: `{ error: { code, message } }`.
- Timeout pemanggilan pihak ketiga 8 detik.
- Tanpa Upstash: endpoint mengembalikan mode `offline`, dan klien memakai fallback.

## 4. Layanan yang dipanggil langsung dari browser

- **Open-Meteo**:

```text
https://api.open-meteo.com/v1/forecast?latitude=3.5952&longitude=98.6722
  &current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m
  &timezone=Asia%2FJakarta
```

  Cache 15 menit di `localStorage`. Gagal → cuaca cerah bawaan.

- **Web3Forms**: `POST https://api.web3forms.com/submit` dengan `access_key`, `name`, `email`, `message`, `subject: "Pesan baru dari SKYFOLIO"`, field honeypot `botcheck`, dan hCaptcha (gratis di plan gratis). Email masuk ke `syahrilmaymubdi2505@gmail.com` (alamat yang didaftarkan saat membuat access key).

## 5. Konfigurasi Vercel (`vercel.json`)

- Rewrites untuk multi-page (`/ringkas`, `/cv`).
- Header cache panjang (`immutable`) untuk aset ber-hash, cache pendek untuk HTML.
- Header keamanan: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (mikrofon hanya untuk situs sendiri, giroskop diizinkan).
- Content-Security-Policy yang mengizinkan WebAssembly (`'wasm-unsafe-eval'` untuk Rapier), worker, `connect-src` ke Open-Meteo, Web3Forms, dan hCaptcha. Uji CSP di WebGPU dan WebGL2 sebelum rilis.
- Fungsi memakai runtime Node dengan durasi maksimal yang wajar untuk plan Hobby.

## 6. Panduan pendaftaran untuk Aril

Claude Code wajib menyalin bagian ini ke laporan fase saat layanan dibutuhkan, dalam bahasa sederhana.

1. **GitHub**: buat repo baru `skyfolio` (public atau private), push kode.
2. **Vercel**: login dengan akun GitHub → Add New → Project → pilih repo `skyfolio` → Deploy. Alamat situs berupa `https://<nama>.vercel.app`.
3. **Upstash**: di dashboard proyek Vercel → Storage / Marketplace → pilih Upstash Redis → plan gratis → Connect ke proyek. Variabel `UPSTASH_*` terisi otomatis.
4. **Web3Forms**: buka web3forms.com → masukkan email `syahrilmaymubdi2505@gmail.com` → access key dikirim ke email → isi `VITE_WEB3FORMS_ACCESS_KEY` di Vercel.
5. **Groq**: daftar di console.groq.com → API Keys → Create → isi `GROQ_API_KEY`. Pilih model gratis yang tersedia → isi `GROQ_MODEL`.
6. **Gemini** (opsional): Google AI Studio → Get API key → isi `GEMINI_API_KEY` dan `GEMINI_MODEL`.
7. **Cloudflare** (opsional): dash.cloudflare.com → Workers AI → buat API token dengan izin Workers AI → isi `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_AI_MODEL`.
8. **GitHub token** (opsional): GitHub → Settings → Developer settings → Fine-grained tokens → akses "Public repositories (read-only)" → isi `GITHUB_TOKEN`.
9. Isi `IP_HASH_SALT`, `LEADERBOARD_SECRET`, dan `ADMIN_TOKEN` dengan string acak panjang (Claude Code bisa membuatkannya).
10. Setelah mengisi variabel di Vercel → Deployments → Redeploy.

## 7. Pengembangan lokal

- `npm run dev` menjalankan Vite. Endpoint `api/` dijalankan lewat proxy ke `vercel dev` atau handler tiruan lokal (pilih yang paling sederhana dan catat di `docs/decisions.md`).
- Mode tiruan (`VITE_MOCK_API=1`) untuk mengembangkan UI tanpa layanan apa pun.
