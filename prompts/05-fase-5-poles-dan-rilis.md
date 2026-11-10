<!--
CARA PAKAI: mulai sesi Claude Code baru, tempel semua teks di bawah garis.
Siapkan akun gratis: GitHub, Vercel, Web3Forms (lihat README). Upstash dan AI boleh menyusul.
-->
---

# FASE 5 — Poles, performa, aksesibilitas, dan rilis ke Vercel

Baca `CLAUDE.md`, semua laporan di `docs/progress/`, lalu `docs/11-performance-qa.md` (semua) dan `docs/10-backend-free-services.md`.

## Tugas

1. **Audit performa** dengan skenario `?autotest=1` di setiap tier. Perbaiki semua yang di bawah anggaran `docs/11` bagian 1. Laporkan angka sebelum dan sesudah.

2. **Muat bertahap**: inti dulu, zona lain di latar belakang. Ukur ukuran bundel dan muatan awal. Kecilkan yang bisa dikecilkan.

3. **Aksesibilitas**: semua poin `docs/07` bagian 11, kurangi gerakan, kontras tinggi, teks besar, navigasi keyboard di semua panel.

4. **Pengaturan**: pastikan setiap opsi di `docs/07` bagian 6 benar-benar berfungsi dan tersimpan.

5. **SEO dan berbagi**: meta tag, gambar OG (dibuat saat build), favicon, judul tab yang mengikuti lokasi terbang, halaman 404 bertema, JSON-LD di Mode Ringkas, sitemap. Target Lighthouse Mode Ringkas tercapai.

6. **Keamanan**: `vercel.json` dengan header keamanan dan CSP yang lolos uji di WebGPU dan WebGL2, validasi semua endpoint, tidak ada rahasia di bundel klien (periksa hasil build).

7. **Bug bash**: jalankan seluruh checklist `docs/11` bagian 5 dan perbaiki semuanya.

8. **Deploy**: pandu aku langkah demi langkah (bahasa sederhana) untuk push ke GitHub, impor ke Vercel, memasang Upstash dari Marketplace, membuat access key Web3Forms, dan mengisi semua variabel lingkungan. Buatkan string acak untuk `IP_HASH_SALT`, `LEADERBOARD_SECRET`, dan `ADMIN_TOKEN`. Setelah deploy, uji situs produksi (`/api/health`, form kontak, lampion, leaderboard).

9. **Materi kompetisi** (`docs/press/`): 6–8 screenshot terbaik, rencana rekaman video 30–60 detik (urutan adegan), dan deskripsi proyek ID/EN.

## Definisi selesai Fase 5

- [ ] Situs online di `*.vercel.app` dan semua checklist `docs/11` bagian 5 dan 6 terpenuhi.
- [ ] Tidak ada error console di produksi.
- [ ] Laporan `docs/progress/PHASE-5.md` dengan daftar sisa kebutuhan dariku (foto, konfirmasi, sertifikat).
