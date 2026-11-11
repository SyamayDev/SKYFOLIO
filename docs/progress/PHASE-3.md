# Laporan Fase 3 — AI Co-Pilot Piko

Tanggal: 10–11 November 2026

## Ringkasan

Piko sekarang bisa diajak ngobrol lewat teks dan bisa menerbangkan pesawat ke jawabannya. Pertanyaan umum dijawab langsung di browser oleh router lokal, tanpa internet dan tanpa biaya. Pertanyaan yang lebih bebas diteruskan ke rantai AI gratis (Groq → Gemini → Cloudflare). Kalau semua layanan mati atau key belum diisi, Piko memakai FAQ offline. Mode Rekruter memandu tur otomatis sekitar 60–90 detik.

Sesuai permintaan Aril, Piko **tidak bersuara**. Semua ucapannya tampil sebagai teks di gelembung dan subtitle.

## Cara mencoba

1. `npm run dev`, buka http://localhost:5173, tekan **Naik Pesawat**.
2. Tekan tombol obrolan (ikon gelembung, kanan atas), lalu coba:
   - "Bawa aku ke proyek terbaikmu" → autopilot terbang ke pulau SI-RAJU 2.0.
   - "Take me to the moon" → kit roket keluar, pesawat terbang ke Bulan.
   - "Skill apa yang paling dikuasai?", "Kontak Aril?", "Ganti radio ke funkot", "Jadikan malam".
3. Di layar boarding pass, tekan **Mode Rekruter** untuk tur otomatis (tombol Lewati, Berikutnya, Ambil Alih, Unduh CV).

## Selesai

- **Router intent lokal** (`src/ai/IntentRouter.ts`): normalisasi, sinonim dua bahasa yang diambil dari konten, toleran salah ketik. **Golden set 60/60 benar** (30 ID + 30 EN, target ≥ 70%).
- **FAQ**: 68 entri dua bahasa di `content/faq.json`, semuanya dari isi `content/`, masing-masing dengan aksi yang relevan.
- **Paket pengetahuan** (`scripts/build-knowledge.ts` → `api/_generated/knowledge.ts`): field `needsConfirmation` dibuang sebelum dikirim ke AI.
- **`/api/copilot`**:
  - Rantai Groq → Gemini → Cloudflare Workers AI lewat endpoint kompatibel OpenAI.
  - Balasan JSON divalidasi zod. Kalau gagal, diulang sekali dengan instruksi ketat, lalu pindah ke penyedia berikutnya.
  - Timeout 8 detik per penyedia.
  - Batas 15 pertanyaan per IP per jam dan 800 per hari (Upstash, atau memori kalau Upstash belum dipasang).
  - Cek asal permintaan dan IP di-hash.
  - Model penalaran (gpt-oss, Gemini 2.5/3.x) mendapat jatah token lebih besar dengan usaha berpikir rendah.
- **Aksi**: terbang ke zona/proyek/landmark/Bulan, buka panel, ganti cuaca/waktu/radio/skin, emote, sinematik, tur. Maksimal 2 aksi, divalidasi ulang di server **dan** di klien.
- **Autopilot** jujur secara fisika (mengendalikan sudut miring, bukan teleport) dan bisa diambil alih kapan saja. *Diperbaiki di Fase 5*: tujuan "orbit" sekarang benar-benar menanjak sampai angkasa sebelum dianggap tiba.
- **UI obrolan**: avatar Piko, chip jawaban cepat, indikator mengetik, catatan privasi.
- **Obrolan otomatis** berbasis kejadian: 17 kejadian × 5 variasi kalimat per bahasa, tingkat kecerewetan di Pengaturan, dan animasi reaksi Piko.
- **Mode Rekruter**: Menara Kontrol → 3 proyek unggulan → Pegunungan Skill → Arus Perjalanan → Kantor Pos, dengan subtitle besar.
- **Moderasi lampion**: penyaring kata kasar lokal ditambah klasifikasi AI opsional (dipakai di Fase 4).

## Tidak dibuat (dengan alasan)

- **Tombol mikrofon (STT)**:
  - Aril tidak mau ada fitur suara/"speech".
  - SpeechRecognition di Chrome mengirim rekaman suara ke server Google.
  - Header Permissions-Policy situs memang memblokir mikrofon.
  - Kalau suatu saat ingin ada, ini bisa ditambahkan sebagai opsi yang mati secara bawaan.

## Pemeriksaan

| Cek | Hasil |
| --- | --- |
| Unit test | Golden set, rantai fallback dengan penyedia tiruan, JSON rusak, timeout, batas pemakaian, validasi aksi, origin asing, model penalaran |
| E2E | "proyek terbaik" → pulau unggulan; "Take me to the moon" → autopilot ke Bulan; Mode Rekruter berjalan |

## Butuh dari Aril: key AI gratis (opsional)

Tanpa key apa pun, Piko tetap bisa menjawab pertanyaan umum, mengantar ke zona, dan memandu Mode Rekruter. Key hanya membuat Piko bisa menjawab pertanyaan bebas. Cukup satu penyedia; dua atau tiga lebih tahan gangguan.

> Nama model sering berganti. Saat laporan ini ditulis, Groq sudah mematikan Llama 3.3 70B (16 Agustus 2026) dan model produksinya adalah `openai/gpt-oss-20b` dan `openai/gpt-oss-120b`. Selalu salin nama model dari halaman resmi masing-masing.

### 1. Groq (paling cepat)

1. Buka https://console.groq.com, daftar dengan akun Google atau GitHub.
2. Menu **API Keys** → **Create API Key** → beri nama `skyfolio` → salin key-nya (diawali `gsk_`). Key hanya ditampilkan sekali.
3. Buka https://console.groq.com/docs/models dan pilih model di bagian **Production Models**. Rekomendasi: `openai/gpt-oss-20b` (cepat, kuota gratis besar).
4. Isi di Vercel (lihat bagian "Cara mengisi di Vercel"): `GROQ_API_KEY` = key tadi, `GROQ_MODEL` = `openai/gpt-oss-20b`.

### 2. Google Gemini

1. Buka https://aistudio.google.com, masuk dengan akun Google.
2. Klik **Get API key** → **Create API key** → salin key-nya (diawali `AIza`).
3. Buka https://ai.google.dev/gemini-api/docs/models, cari model berlabel **Flash-Lite** atau **Flash** (tier gratis hanya mencakup Flash dan Flash-Lite). Salin kode modelnya persis, bentuknya seperti `gemini-…-flash-lite`.
4. Isi di Vercel: `GEMINI_API_KEY` dan `GEMINI_MODEL`.

### 3. Cloudflare Workers AI

1. Buka https://dash.cloudflare.com, daftar akun gratis.
2. **Account ID**: di halaman utama dashboard, klik nama akun. Account ID ada di kolom kanan (atau di alamat URL: `dash.cloudflare.com/<ACCOUNT_ID>`).
3. **API token**: ikon profil → **My Profile** → **API Tokens** → **Create Token** → pilih template **Workers AI** → **Continue** → **Create Token** → salin.
4. **Model**: buka https://developers.cloudflare.com/workers-ai/models/, filter **Text Generation**, salin nama model (contoh `@cf/meta/llama-3.1-8b-instruct`).
5. Isi di Vercel: `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_AI_MODEL`.

### Cara mengisi di Vercel

1. Buka https://vercel.com/syamaydevs-projects/skyfolio → tab **Settings** → **Environment Variables**.
2. Untuk setiap variabel: isi **Key** (misalnya `GROQ_API_KEY`) dan **Value**, centang **Production**, **Preview**, dan **Development**, lalu **Save**.
3. Buka tab **Deployments** → titik tiga di deployment teratas → **Redeploy**. Variabel baru hanya terbaca setelah deploy ulang.
4. Cek di `https://skyfolio-phi.vercel.app/api/health`. Kolom `ai` akan berisi nama penyedia yang aktif, misalnya `["groq","gemini"]`.

Jangan pernah menaruh key di kode atau di file yang di-commit. Hanya `.env.example` (tanpa isi) yang boleh masuk Git.

## Berikutnya

Fase 4: achievement, skin, mini-game, Sirkuit Langit, lampion, layar kedatangan.
