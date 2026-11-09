<!--
CARA PAKAI: mulai sesi Claude Code baru, tempel semua teks di bawah garis.
API key AI boleh belum ada. Fase ini tetap bisa selesai dengan mode offline, lalu key diisi belakangan.
-->
---

# FASE 3 — AI Co-Pilot Piko dan Mode Rekruter

Baca `CLAUDE.md`, laporan fase sebelumnya, lalu `docs/06-copilot-ai.md` (semua), `docs/03-flight-physics.md` bagian 12, dan `docs/10-backend-free-services.md`.

Budget AI-ku **Rp0**. Piko harus tetap berguna walau tidak ada AI online sama sekali.

## Tugas

1. **IntentRouter lokal** dua bahasa dengan kamus sinonim yang dibangkitkan dari konten. Target ≥ 70% pertanyaan di `tests/ai/golden.json` ditangani lokal dengan benar.

2. **FAQ**: lengkapi `content/faq.json` menjadi minimal 40 entri per bahasa, hanya dari isi `content/`, masing-masing dengan aksi yang relevan.

3. **Paket pengetahuan** (`scripts/build-knowledge.ts`) yang mengabaikan field `needsConfirmation`.

4. **`api/copilot.ts`**: rantai Groq → Gemini → Cloudflare Workers AI. **Cek dokumentasi resmi masing-masing untuk URL endpoint dan nama model gratis terbaru**, simpan di env. Kontrak balasan JSON + validasi zod + retry sekali, batas pemakaian dengan Upstash, timeout, mode offline, dan prompt sistem dari `docs/06` bagian 4.

5. **Aksi dan autopilot**: semua tools di `docs/06` bagian 5, divalidasi ulang di klien. Autopilot lengkap dan jujur secara fisika, bisa dibatalkan pemain.

6. **UI obrolan**: gelembung dari avatar Piko, chip jawaban cepat, indikator mengetik, tombol mikrofon (STT) jika didukung, catatan privasi di Pengaturan.

7. **Obrolan otomatis Piko** berbasis kejadian (minimal 5 variasi per kejadian per bahasa), dengan tingkat obrolan dari Pengaturan, plus animasi reaksi Piko.

8. **Mode Rekruter**: tur 60–90 detik berbasis template (tanpa AI online), kamera sinematik, subtitle besar, tombol Lewati, Berikutnya, Ambil Alih, Unduh CV.

9. **Moderasi lampion** (penyaring lokal + klasifikasi AI opsional), untuk dipakai di Fase 4.

10. **Tes**: golden set ID/EN, rantai fallback dengan penyedia tiruan, JSON rusak, timeout, batas pemakaian, validasi aksi. E2E: tanya "proyek terbaik" → pesawat terbang ke pulau unggulan.

## Definisi selesai Fase 3

- [ ] Tanpa API key apa pun: Piko menjawab pertanyaan umum, mengantar ke zona, dan memandu Mode Rekruter dengan benar.
- [ ] Dengan API key: pertanyaan bebas dijawab akurat, singkat, bergaya anak kecil, tanpa mengarang.
- [ ] "Bawa aku ke proyek terbaikmu" dan "Take me to the moon" benar-benar menerbangkan pesawat.
- [ ] Laporan `docs/progress/PHASE-3.md` berisi langkah demi langkah membuat key Groq, Gemini, dan Cloudflare gratis, serta cara mengisinya di Vercel.
