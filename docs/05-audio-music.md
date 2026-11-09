# 05 — Suara dan Musik

Musik dan suara harus membuat orang betah. Targetnya: pengunjung menyalakan suara dan tidak mau mematikannya.

## 1. Arsitektur (`src/audio/`)

- Satu `AudioContext` bersama untuk Howler dan Tone.js. Dibuka saat ketukan pertama (tombol "Naik Pesawat") supaya iOS mengizinkan.
- **Bus** dengan slider sendiri di Pengaturan (mirip Slow Roads yang punya slider per kanal): `master`, `music`, `engine`, `wind`, `sfx`, `ambient`, `voice`, `ui`.
- **Ducking**: saat Piko bicara, musik turun 6 dB dan ambient turun 3 dB.
- **Filter keadaan**: di dalam awan atau air → lowpass sebentar. Di angkasa → semua suara luar dipotong lowpass kuat; yang jelas hanya kokpit, musik, dan suara Piko.
- **Spasial**: `PannerNode` dengan HRTF di tier High, equalpower di tier Low. Listener mengikuti kamera. Model jarak inverse, dan setiap emitter punya jarak maksimum.
- Jika tab disembunyikan, audio dijeda (bisa diatur).
- Total file audio ≤ 1,5 MB. Musik 100% prosedural (0 MB).

## 2. Suara pesawat (disintesis, adaptif)

| Lapisan | Cara membuat | Dikendalikan oleh |
| --- | --- | --- |
| Denyut mesin radial | Pulsa pendek berfrekuensi `rpm/60 × silinder/2`, diberi distorsi ringan | Throttle |
| Gemuruh mesin | Noise coklat yang difilter | Throttle |
| "Whup" baling-baling | Modulasi amplitudo di frekuensi lewat bilah | rpm + airspeed |
| Angin | Pink noise band-pass, cutoff naik seiring kecepatan; siulan saat sangat cepat | Airspeed |
| Boost | Lapisan mesin tambahan + "whoosh" naik | Boost |
| Roket | Noise raung yang difilter + dengung rendah | Gas di angkasa |
| Suspensi dan ban | Sampel CC0 pendek | Kompresi roda, slip |
| Hujan di kanopi | Ketukan acak cepat (kanopi tertutup) atau desis (terbuka) | Intensitas hujan |

## 3. Efek suara (SFX)

Setiap interaksi wajib punya suara. Varian dipilih acak dan pitch-nya diacak ±6% supaya tidak monoton.

| Kategori | Contoh |
| --- | --- |
| Pesawat | Starter mesin, mesin tersendat lalu hidup, klakson lucu, rem, roda menyentuh landasan, pegas suspensi, barrel roll whoosh, kanopi "whirr-klak", wiper, kit roket "klik-whirr", masuk atmosfer bergemuruh |
| Tabrakan per material | Kayu "tok", logam "dang", kain "fwump", balon "boing" atau "pop", batu "dug", air "byur", daun "srrk" |
| Dunia | Burung, jangkrik malam, ombak, angin di pohon, kincir, peluit kereta, klakson kapal, semburan paus, guntur, hujan, api lava, gemerisik daun, tepuk tangan Panggung MC, "tes, tes" mikrofon, desis kuali Dapur Aril, dentang barbel |
| Game | Cincin "ding" (nada naik untuk cincin berurutan), stempel paspor "dok", achievement jingle, hitung mundur sirkuit, lap selesai, lampion terbang, paket masuk kotak pos |
| UI | Satu klik dasar dengan variasi pitch, buka/tutup panel, hover, toast |

Sumber: sintesis Tone.js sebisa mungkin, ditambah sampel CC0 (Kenney audio packs, Freesound berlisensi CC0). Semua dicatat di `CREDITS.md`.

## 4. Musik prosedural "Syamay FM" (`src/audio/MusicEngine/`)

### 4.1 Rasa yang diminta Aril

Aril ingin melodi yang terasa seperti lagu daerah Sunda yang ceria dan heroik tentang burung yang terbang tinggi (Aril menyebut "Manuk Dadali" sebagai rasa yang ia suka). **Ambil rasanya, jangan nadanya.** Semua melodi wajib dikomposisi original. Jangan mentranskripsi, mengutip, atau meniru melodi lagu yang sudah ada.

Karakter yang dituju:
- Ceria, gagah, penuh semangat terbang. Ada rasa "mars kecil" yang riang.
- Lompatan nada pentatonik yang lebar dan pola tanya-jawab antara suling dan kacapi.
- Tempo 118–128 BPM untuk tema utama, birama 4/4 dengan aksen kendang yang hidup.
- Perpaduan **tradisi Sunda + produksi modern global**: tekstur bambu dan petikan di atas bass, pad, dan drum modern yang rapi.

### 4.2 Tangga nada

Simpan sebagai tabel cent di `src/config/audio.ts` supaya mudah disetel dengan telinga. Nilai di bawah adalah titik awal (perkiraan), bukan ukuran baku.

| Nama | Perkiraan cent dari nada dasar | Dipakai untuk |
| --- | --- | --- |
| Salendro (5 nada, jarak hampir sama) | 0, 240, 480, 720, 960 | Tema eksplorasi, malam |
| Pelog degung (pola jarak kecil-besar) | 0, 120, 520, 680, 800 | Tema bandara, momen haru |
| Pentatonik mayor Barat | 0, 200, 400, 700, 900 | Lapisan modern, Energi FM, jembatan ke telinga global |

### 4.3 Instrumen (semua disintesis)

| Instrumen | Cara sintesis |
| --- | --- |
| Suling (seruling bambu) | Sinus/segitiga + noise napas, vibrato lembut, ornamen luncuran nada di awal not |
| Kacapi (petik) | Karplus-Strong, redaman bervariasi |
| Angklung | Beberapa parsial bambu yang digetarkan cepat (tremolo), nada pendek berulang |
| Kendang | Drum membran dengan envelope pitch (pukulan rendah "dung", tinggi "tak", tepuk "pak") |
| Goong | Sinus rendah dengan beating lambat dan decay panjang |
| Lapisan modern | Kick dan clap rapi, bass sub, pad hangat, pluck synth, arpeggio |

### 4.4 Sistem adaptif

- Musik terdiri dari **frasa 8–16 bar** yang dikomposisi Claude Code dalam format skor sendiri (derajat tangga nada + ritme), ditambah **variasi generatif** berbasis aturan: ornamen, pergeseran ritme, tanya-jawab, dan pergantian instrumen. Hasilnya tidak pernah persis sama tapi tetap terasa satu lagu.
- **Lapisan** yang naik-turun dengan parameter `intensity` (0–1) dari kecepatan, boost, dan kejadian: dasar (pad + goong), ritme (kendang + kick), melodi (suling), ornamen (angklung + arpeggio).
- Perpindahan tema hanya di batas bar, dengan crossfade 1–2 bar.
- **Stinger**: motif pendek 1–2 detik untuk achievement, stempel paspor, pendaratan mulus, dan masuk zona.

| Tema | Kapan | Rasa |
| --- | --- | --- |
| `preflight` | Layar loading dan boarding pass | Pembuka gagah yang pelan-pelan membangun |
| `home` | Bandara Medan, Menara, Kantor Pos | Tema utama Syamay FM, ceria |
| `adventure` | Jelajah umum, Kepulauan Proyek | Tema utama versi lebih ramai |
| `mountain` | Pegunungan Skill | Suling panjang, ruang luas |
| `journey` | Arus Perjalanan | Ritme berjalan, rasa bercerita |
| `city` | Kota Kontribusi | Pluck modern, groove |
| `lab` | Hangar Eksperimen | Aneh dan jenaka |
| `stage`, `kitchen`, `gym`, `fort`, `party` | Zona easter egg | Variasi gaya singkat |
| `lantern` | Danau Toba malam | Tenang, hangat, kacapi lembut |
| `race` | Sirkuit Langit | Cepat, 140 BPM, kendang rapat |
| `space` | Orbit | Pad luas, angklung jarang, gema panjang |
| `moon` | Bulan | Hening, satu suling yang sangat lembut |
| `arrival` | Layar kedatangan | Penutup hangat, rasa pulang |

### 4.5 Radio easter egg

Di menu (atau tombol radio di kokpit), pengunjung bisa mengganti stasiun. Semuanya original dan prosedural:

| Stasiun | Gaya |
| --- | --- |
| Syamay FM | Musik utama adaptif (bawaan) |
| Funkot FM | Beat funkot original 170–180 BPM, bass bergoyang, cocok untuk boost |
| Timur FM | Groove pop Indonesia Timur original yang santai dan bikin joget |
| Gurun FM | Nuansa maqam Timur Tengah original dengan perkusi darbuka sintetis |
| Energi FM | Pop-EDM original yang energik dengan drop besar |

Piko boleh bercerita bahwa Aril suka musik energik, musik Arab, funkot, dan lagu-lagu Timur, serta menyebut nama artis favoritnya (`content/easter-eggs.json`). Lagu dan rekaman artis itu tidak boleh diputar atau ditiru.

## 5. Suara Piko (`src/audio/Voice.ts`)

- **Text-to-speech** dari Web Speech API (`speechSynthesis`), gratis di semua browser modern.
  - Pilih suara sesuai bahasa aktif: `id-ID` untuk Indonesia, `en-US`/`en-GB` untuk Inggris.
  - Supaya terdengar seperti anak kecil: `pitch = 1,8`, `rate = 1,05` (nilai dari `content/copilot.json`).
  - Kalimat panjang dipecah per kalimat supaya tidak terpotong di beberapa browser.
- **Fallback "babble"**: jika tidak ada suara untuk bahasa itu, Piko "bicara" dengan suku kata sintetis bernada tinggi (gaya ocehan karakter game yang lucu, buatan sendiri) dan subtitle tetap tampil.
- **Radio ATC**: suara yang sama melewati filter band-pass dan sedikit distorsi, ditambah bunyi "klik" dan desis di awal dan akhir.
- **Speech-to-text** (tombol mikrofon): `SpeechRecognition` / `webkitSpeechRecognition` dengan bahasa aktif. Jika tidak didukung, sembunyikan ikon mikrofon dan sediakan kotak teks.
- Subtitle selalu tampil saat Piko bicara (bisa dimatikan).
