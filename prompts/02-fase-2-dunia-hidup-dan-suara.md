<!--
CARA PAKAI: mulai sesi Claude Code baru, tempel semua teks di bawah garis.
-->
---

# FASE 2 — Dunia hidup: waktu nyata, cuaca, angkasa, Bulan, dan seluruh suara

Baca `CLAUDE.md`, laporan fase sebelumnya di `docs/progress/`, lalu `docs/04-art-rendering.md` (semua), `docs/03-flight-physics.md` bagian 7–10, dan `docs/05-audio-music.md` (semua).

## Tugas

1. **Waktu nyata**: posisi matahari NOAA (dengan unit test 21 Juni), siang-malam di seluruh planet, garis senja, lampu kota dan jendela gedung saat malam, lampu landasan, lampu navigasi pesawat, bintang, fase Bulan nyata, tema UI mengikuti jam lokal. Semua bisa diatur di Pengaturan (`docs/07` bagian 6).

2. **Langit dan atmosfer**: kubah langit tiga palet, cangkang atmosfer fresnel (indah dari orbit), cakram matahari dan glare, post-processing per tier (`docs/04` bagian 8).

3. **Cuaca** (`docs/04` bagian 7): Open-Meteo untuk Medan + sel cuaca prosedural harian untuk tempat lain, awan yang bisa ditembus, hujan, genangan, petir dengan guntur tertunda, salju, angin yang memengaruhi semuanya, pelangi setelah hujan, musim per belahan bumi.

4. **Kanopi otomatis** dan wiper: menutup saat hujan atau masuk awan tebal, terbuka 8 detik setelah reda, tetesan air di kaca, selalu tertutup di angkasa + helm gelembung untuk Aril dan Piko. Opsi manual di Pengaturan.

5. **Air dan angkasa** (`docs/03` bagian 7–9): mode air dengan apung dan cipratan, kit roket, mode orbit dengan bantuan orbit, masuk kembali ke atmosfer dengan efek panas, gravitasi Bulan, pendaratan mulus di Bulan dengan pesan rahasia (`content/secret-message.json`, pakai ucapan netral jika belum dikonfirmasi). Transisi darat → orbit → Bulan → kembali harus mulus tanpa loading.

6. **Seluruh audio** (`docs/05`): bus dan slider, ducking, filter keadaan (awan, air, angkasa), suara pesawat yang disintesis dan adaptif, semua SFX (sintesis + CC0), audio spasial, ambient per zona.

7. **Musik prosedural Syamay FM**:
   - Komposisi **original** dengan rasa lagu daerah Sunda yang ceria dan heroik, perpaduan tradisi + produksi modern. **Jangan menyalin atau meniru melodi lagu mana pun**, termasuk lagu yang aku sebut sebagai contoh rasa.
   - Semua tema di tabel `docs/05` bagian 4.4, lapisan adaptif, perpindahan di batas bar, stinger.
   - Radio easter egg: Funkot FM, Timur FM, Gurun FM, Energi FM (semua original).
   - Buat juga halaman debug `#debug-music` untuk mendengarkan setiap tema dan lapisan secara terpisah.

8. **Suara Piko**: TTS Web Speech dengan suara anak kecil (pitch dan rate dari `content/copilot.json`), fallback babble, efek radio ATC untuk bio di Menara Kontrol, subtitle.

9. **Tes**: posisi matahari, fase Bulan, pemetaan kode cuaca WMO, transisi mode terbang. Screenshot: siang, senja, malam, hujan di Medan, dari orbit, di Bulan.

## Definisi selesai Fase 2

- [ ] Membuka situs pada jam yang berbeda memberi suasana yang sesuai jam dunia nyata.
- [ ] Hujan nyata di Medan terlihat di bandara, dan kanopi menutup sendiri.
- [ ] Perjalanan dari landasan ke Bulan lalu pulang mulus dan memukau.
- [ ] Musik terasa original, ceria, dan berganti alami antar zona. Tidak ada klik atau letupan audio.
- [ ] FPS tetap sesuai target dengan cuaca dan post-processing aktif.
- [ ] Laporan `docs/progress/PHASE-2.md`.
