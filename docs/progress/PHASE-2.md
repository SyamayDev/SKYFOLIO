# Laporan Fase 2 — Dunia hidup, angkasa, dan suara

Tanggal: 10 November 2026

## Ringkasan

Dunia SKYFOLIO sekarang mengikuti jam dan cuaca nyata. Siang, senja, dan malam sesuai waktu dunia; malam punya bintang, jendela kota yang menyala, dan lampu landasan. Cuaca Medan diambil langsung dari Open-Meteo (saat laporan ini dibuat, Medan sedang hujan, dan bandara ikut hujan). Pesawat bisa terbang dari landasan menembus awan, keluar atmosfer dengan kit roket, mengorbit, mendarat di Bulan, lalu pulang dengan efek panas masuk atmosfer, tanpa satu pun layar loading. Musik "Syamay FM" dimainkan prosedural dengan rasa Sunda original, berganti alami antar zona.

Sesuai permintaan Aril, **tidak ada suara bicara** (TTS/ocehan); Piko tetap bicara lewat gelembung teks. Semua ikon diganti set ikon SVG buatan sendiri, dan tata letak HP portrait/landscape dirapikan.

## Cara mencoba

1. `npm run dev`, buka http://localhost:5173, tekan **Naik Pesawat**.
2. **Malam/senja**: Pengaturan → Dunia → matikan "Siang-malam waktu nyata", geser jam.
3. **Cuaca**: Pengaturan → Dunia → matikan "Cuaca nyata", pilih Hujan/Badai petir/Salju/Kabut. Kanopi menutup sendiri, wiper bergerak.
4. **Ke angkasa**: terbang naik terus; di ketinggian ±1.800 m kit roket keluar → tahan **Shift/Boost** sambil menanjak. Di angkasa lepaskan Boost: bantuan orbit membawa pesawat ke orbit stabil.
5. **Ke Bulan**: Peta → Bulan → "Antar ke sini", atau arahkan hidung ke Bulan dan tahan Boost. Mendarat pelan di landasan hijau → panel Bulan terbuka.
6. **Radio**: Pengaturan → Audio → Stasiun radio (Syamay FM, Funkot FM, Timur FM, Gurun FM, Energi FM).
7. **Debug musik**: buka http://localhost:5173/#debug-music untuk memutar setiap tema, lapisan (klik = bisu, shift+klik = solo), stasiun, dan stinger.

## Selesai

- **Waktu nyata**: matahari NOAA, siang-malam & garis senja di seluruh planet, bintang berkelip, jendela kota menyala (pola kisi, sebagian gedung saja), lampu landasan & navigasi pesawat, fase Bulan nyata, musim per belahan (garis salju bergeser), tema UI ikut jam lokal.
- **Langit & post-processing**: palet siang/senja/malam/angkasa (angkasa kini hitam kebiruan), cangkang atmosfer dari orbit, cahaya matahari meredup di malam & saat mendung; bloom (High/Ultra), vinyet + grading (Medium ke atas).
- **Cuaca**: Open-Meteo Medan (cache 15 menit) + 18 sel prosedural harian; hujan & salju di sekitar kamera, awan badai gelap + tirai hujan dari jauh (bisa ditembus), petir + guntur tertunda sesuai jarak, pelangi setelah hujan, tanah basah, angin nyata memengaruhi pesawat.
- **Kanopi otomatis**: menutup saat hujan/awan tebal/stratosfer/angkasa, terbuka 8 detik setelah reda, wiper, tetesan air meluncur ke belakang, helm gelembung di angkasa. Mode manual di Pengaturan.
- **Angkasa & Bulan**: lapisan terbang dengan histeresis, kit roket (api, suara), batas kecepatan roket, bantuan orbit, panas masuk atmosfer (cangkang oranye, hambatan, gemuruh), gravitasi Bulan, pendaratan dengan pesan Bulan (ucapan netral sampai Aril menulis pesan rahasia), HUD ketinggian relatif Bulan.
- **Audio**: filter keadaan (awan/air/angkasa/kanopi), listener 3D mengikuti kamera, sumber spasial per zona (tepuk tangan Panggung MC, desis kuali, gemuruh lava, lonceng angin Toba), ombak, burung siang, jangkrik malam, hujan di kanopi, SFX kanopi/wiper/roket/guntur/stempel/panel/lonceng.
- **Musik Syamay FM**: 17 tema original, 4 lapisan adaptif mengikuti kecepatan & boost, pergantian di batas birama dengan crossfade, variasi generatif, stinger, 4 stasiun radio original, halaman `#debug-music`.
- **UI**: set ikon SVG sendiri, avatar Piko vektor, tumpukan pesan tengah-atas yang tidak bisa saling menimpa, meter sentuh di tengah bawah, sakelar geser di Pengaturan, menu jeda dua kolom di HP landscape, papan 3D tidak lagi terbaca terbalik dari belakang. Pengaturan baru: dunia (jam, cuaca, musim, tema), kanopi, semua slider audio, stasiun radio, Piko (aktif, subtitle, kecerewetan), efek kamera.

## Pemeriksaan

| Cek | Hasil |
| --- | --- |
| Typecheck + svelte-check | 0 error, 0 warning |
| Lint | bersih |
| Unit test | 57 lulus (termasuk posisi matahari 21 Juni, fase Bulan, kode cuaca WMO, sel cuaca, musim, transisi lapisan terbang, kecepatan orbit, skor musik) |
| E2E | 11 lulus |
| Screenshot | 4 viewport × 22 adegan dilihat, termasuk senja, malam, hujan Medan, orbit, Bulan |

## Keputusan

Lihat `docs/decisions.md` bagian "Fase 2". Yang penting: suara bicara dihapus sesuai permintaan; mesin musik ditulis sendiri di atas Web Audio (Tone.js tidak dipakai); uji otomatis tidak memanggil jaringan.

## Butuh dari Aril

1. **Pesan rahasia Bulan** (`content/secret-message.json`, atau Hangar → Pesan rahasia Bulan): kalimat yang muncul saat mendarat mulus di Bulan. Sementara memakai ucapan netral.
2. **Dengarkan musiknya** di `/#debug-music` dan beri tahu tema mana yang kurang pas (terlalu cepat, terlalu ramai, nadanya kurang ceria, dan sebagainya). Semua angka (BPM, tangga nada, frasa) ada di `src/audio/MusicEngine/themes.ts`.
3. Kalau ada ikon yang kurang cocok, sebut namanya (daftar lengkap di `src/ui/icons.ts`).

## Berikutnya

Fase 3: AI Co-Pilot Piko (obrolan teks, router intent lokal, FAQ offline, rantai AI gratis lewat `api/copilot.ts`, Mode Rekruter).
