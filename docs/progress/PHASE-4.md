# Laporan Fase 4 — Game & sosial

Tanggal: 10–11 November 2026

## Ringkasan

Sekarang ada alasan untuk menjelajah sampai habis:
- 34 achievement (termasuk yang rahasia).
- 9 skin pesawat, dibuka lewat achievement.
- Mini-game di pulau dan zona.
- Sirkuit Langit dengan papan skor harian.
- Lampion Langit yang bisa dilepas pengunjung.
- Counter global.
- Layar kedatangan dengan gambar untuk dibagikan.

Semua fitur online punya cadangan offline. Kalau server tidak bisa dihubungi, situs tetap jalan tanpa error di console.

## Cara mencoba

1. `npm run dev` → **Naik Pesawat**.
2. **Achievement & skin**: buka Paspor (ikon paspor, kanan atas). Daftar achievement dan skin ada di bawah stempel; skin yang sudah terbuka bisa langsung dipakai.
3. **Sirkuit Langit**: terbang ke zona Sirkuit Langit, lewati cincin start → hitung mundur → 24 cincin. Waktu terbaik tampil di panel zona (10 besar hari ini, WIB).
4. **Lampion**: Lembah Lampion Danau Toba → tombol Aksi → tulis harapan (maks. 30 huruf).
5. **Mini-game laundry**: pulau SI-PANDRI → tombol Aksi saat dekat diorama (45 detik).
6. **Layar kedatangan**: menu Jeda → **Akhiri penerbangan** → statistik, paspor, dan tombol **Bagikan** (gambar 1080×1920).

## Selesai

- **34 achievement** (`src/game/Achievements.ts`) lengkap dengan toast, reaksi Piko, dan waktu penyelesaian. "Kapten Sejati" terbuka otomatis setelah semua achievement non-rahasia selesai.
- **Skin**: 9 cat pesawat (Pesawat Mainan, Amfibi, Kertas, Jet, Roket, UFO, Balon, Phoenix rahasia, Emas). Semuanya memakai shader pengganti warna di model yang sama, jadi tidak ada tambahan unduhan atau draw call.
- **Zona interaktif**: Misi Laundry Beres (SI-PANDRI), dapur, barbel Pulau Gym, tembok Desa Benteng yang roboh lalu tersusun lagi, karakter balok berjoget, tepuk tangan Panggung MC.
- **Sirkuit Langit** (`api/leaderboard.ts`):
  - Hitung mundur, deteksi lap tidak sah, dan hantu lap terbaik.
  - Papan skor harian dengan token HMAC per sesi.
  - Lap ditolak kalau lebih cepat dari 25 detik, urutan cincinnya salah, atau lebih lama dari umur token.
- **Lampion** (`api/lanterns.ts`):
  - Moderasi lokal ditambah AI opsional, satu lampion per pengunjung per hari, menyimpan 64 lampion terbaru.
  - Lampion contoh tampil saat offline.
  - *Fase 5*: lampion bisa dihapus dengan `ADMIN_TOKEN` (lihat PHASE-5).
- **Counter global** (`api/counters.ts`): total km, jumlah penerbangan, penerjun Kawah Nekat (Phoenix terbuka di setiap kelipatan 100), dan kunjungan. Nilai kiriman klien dijepit supaya tidak bisa digelembungkan.
- **Layar kedatangan**: statistik, paspor, gambar bagikan 1080×1920 (kanvas, tanpa server) dan Web Share API kalau didukung, tombol CV dan Hubungi.
- **Penyimpanan lokal** berversi (v2) dengan migrasi dari v1, plus tombol reset progres di Pengaturan.

## Disederhanakan / belum dibuat

| Butir dari prompt | Status | Alasan / rencana |
| --- | --- | --- |
| Parameter fisika berbeda per skin | Disederhanakan: skin = cat | Semua pesawat tetap terasa sama dan adil di sirkuit; satu model menghemat draw call |
| Sinar penarik UFO | Belum | Butuh sistem "angkat benda" khusus; kandidat poles berikutnya |
| Sektor waktu di sirkuit | Belum | Waktu total dan hantu lap sudah ada |
| Jejak terbang di globe layar kedatangan | Belum | Layar kedatangan memakai statistik dan paspor |
| Counter "pengunjung yang mencapai Bulan" | Belum | Pendaratan di Bulan sudah tercatat sebagai achievement lokal |
| Tombol hapus lampion di Hangar | Diganti perintah | Penghapusan lewat `DELETE /api/lanterns?id=…` dengan `ADMIN_TOKEN` (perintah siap tempel di PHASE-5) |
| E2E: lap sirkuit, lampion tiruan, gambar bagikan | Unit test | Logika lap, lampion, counter, achievement, dan migrasi diuji di `tests/unit/social-api.test.ts` dan `tests/unit/game.test.ts` |

## Pemeriksaan

| Cek | Hasil |
| --- | --- |
| Unit test | Token HMAC (sah/rusak/kedaluwarsa), validasi lap, 10 besar, lampion (wajar/kasar/batas harian/hapus admin), counter dijepit, 34 achievement ber-i18n, hadiah skin, pelacak kejadian, migrasi v1 → v2, data rusak, reset |
| Console | Tanpa error saat server mati (semua fetch punya cadangan) |

## Butuh dari Aril

1. Tidak ada yang wajib. Agar papan skor dan lampion **bersama** (terlihat oleh semua pengunjung, bukan hanya per server), pasang Upstash dari Vercel Marketplace (langkahnya di PHASE-5).
2. Kalau ada achievement atau skin yang namanya kurang pas, sebut saja. Namanya ada di `src/i18n/id.ts` dan `en.ts`, bagian `achievements` dan `skins`.

## Berikutnya

Fase 5: poles, performa, keamanan, rilis ke Vercel.
