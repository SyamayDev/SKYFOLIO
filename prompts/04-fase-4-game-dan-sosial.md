<!--
CARA PAKAI: mulai sesi Claude Code baru, tempel semua teks di bawah garis.
-->
---

# FASE 4 — Achievement, skin, mini-game, sirkuit, lampion, dan layar kedatangan

Baca `CLAUDE.md`, laporan fase sebelumnya, lalu `docs/09-gamification-social.md` (semua), `docs/02-world-zones.md` bagian 3.5 dan 3.9–3.11, `docs/07-ui-ux.md` bagian 7, dan `docs/10-backend-free-services.md`.

## Tugas

1. **Achievement**: semua 34 achievement di `docs/09` bagian 2, termasuk yang rahasia, dengan toast, jingle, reaksi Piko, dan pencatat waktu penyelesaian.

2. **Skin**: semua skin di `docs/09` bagian 3 dengan model prosedural dan parameter fisika masing-masing. UFO dengan sinar penarik yang bisa mengangkat benda fisika. Asap warna yang bisa dibuka.

3. **Mini-game dan zona interaktif**: Misi Laundry Beres (60 detik, skor lokal), memasak di Dapur Aril, barbel Pulau Gym dengan papan PR, tembok Desa Benteng yang roboh lalu tersusun lagi, karakter balok yang berjoget, tepuk tangan Panggung MC.

4. **Sirkuit Langit** lengkap: hitung mundur, sektor, lap tidak sah, hantu lap terbaik, leaderboard harian dengan token sesi dan anti-curang (`api/leaderboard.ts`).

5. **Lampion Langit** (`api/lanterns.ts`) dengan moderasi dari Fase 3, satu lampion per pengunjung per hari, penghapusan dengan `ADMIN_TOKEN` (juga tombol di Hangar), dan fallback lampion contoh saat offline.

6. **Counter global** (`api/counters.ts`): total km, penerjun Kawah Nekat dengan skin Phoenix untuk setiap kelipatan 100, dan pengunjung yang mencapai Bulan.

7. **Layar Kedatangan**: globe dengan jejak terbang, statistik, paspor, gambar berbagi 1080×1920 + Web Share API, tombol CV dan Hubungi.

8. **Penyimpanan lokal** dengan versi dan migrasi, serta tombol reset progres.

9. **Tes**: logika achievement, anti-curang leaderboard, validasi lampion, migrasi penyimpanan. E2E: selesaikan satu lap sirkuit dengan autopilot tes, lepas lampion dalam mode tiruan, buka layar kedatangan dan buat gambar berbagi.

## Definisi selesai Fase 4

- [ ] Ada alasan untuk menjelajah sampai habis, dan setiap pencapaian terasa memuaskan.
- [ ] Semua fitur online punya fallback dan tidak pernah membuat error di console.
- [ ] Gambar berbagi terlihat bagus di Instagram Story (cek hasilnya dengan tool Read).
- [ ] Laporan `docs/progress/PHASE-4.md`.
