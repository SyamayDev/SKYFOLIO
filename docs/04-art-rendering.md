# 04 — Gaya Visual, Model, Render, Siang-Malam, dan Cuaca

## 1. Arah gaya

**Low-poly lucu, cerah, bersih, dan modern.** Seperti mainan kayu dan plastik premium yang dicat tangan, bertemu ilustrasi travel poster modern. Faceted (flat shading), proporsi sedikit chibi, sudut dibulatkan, warna jenuh tapi tidak menyilaukan.

Aturan cepat:
- Setiap benda punya siluet yang terbaca dari jauh.
- Maksimal 3–4 warna per objek, diambil dari palet.
- Tidak ada tekstur foto. Warna dari vertex color atau satu tekstur palet bersama.
- Bayangan lembut berwarna (bukan hitam pekat), sedikit kebiruan di siang hari dan keunguan saat senja.
- Animasi idle di mana-mana: bendera, pohon, kincir, air, lampu.

## 2. Palet (token di `src/config/palette.ts`, dipakai juga oleh CSS)

| Token | Hex | Dipakai untuk |
| --- | --- | --- |
| `skyDayTop` / `skyDayHorizon` | #4DB8FF / #BDE8FF | Langit siang |
| `skySunsetTop` / `skySunsetHorizon` | #6C7BD9 / #FFB27A | Senja dan fajar |
| `skyNightTop` / `skyNightHorizon` | #0B1640 / #27306B | Malam |
| `oceanDeep` / `oceanShallow` / `foam` | #1E6FD9 / #3FD0E0 / #F4FFFF | Laut |
| `sand` | #F6D99A | Pantai |
| `grassTropic` / `grassTemperate` / `grassBoreal` | #5CCB5F / #8BD45A / #3E9B5B | Daratan |
| `desert` / `redRock` | #F2B66D / #D9774A | Gurun |
| `rock` / `snow` / `ice` | #9C8F86 / #F7FBFF / #CDEBFF | Gunung, kutub |
| `cream` | #FFF6E6 | Badan pesawat, UI terang |
| `sun` | #FFC93C | Aksen utama SKYFOLIO |
| `sky` | #3AA0FF | Garis pesawat, tombol |
| `berry` | #FF5A5F | Ujung baling-baling, peringatan |
| `leaf` | #3DCB7A | Sukses |
| `ink` | #2B2D42 | Teks, garis |
| `lantern` | #FFB347 | Lampion, lampu malam |
| `city1..5` | #FFF4E0, #FFD6A5, #A0C4FF, #FFADAD, #CAFFBF | Gedung kota |

## 3. Membuat model tanpa Blender

Aril tidak memakai Blender, jadi **semua model dibuat lewat kode** (`src/vehicle/PlaneModel.ts`, `src/characters/*`, `src/world/Landmarks/*`, `src/world/Zones/*`), ditambah aset CC0 (Kenney, Quaternius) bila benar-benar membantu.

- Sediakan pustaka kecil "kitbash" di `src/utils/modeling/`: rounded box, lathe (badan, cowling), extrude (sayap dengan profil airfoil sederhana, huruf), tube (strut, kabel), torus (roda), dan helper `mergeByMaterial()`.
- Semua mesh statis digabung per material supaya draw call sedikit.
- Opsional: `scripts/bake-models.ts` mengekspor model prosedural ke `.glb` (GLTFExporter + meshopt) supaya waktu muat lebih cepat. Model tetap bisa dibangkitkan ulang dari kode.
- Jika Aril menaruh gambar referensi di `docs/references/`, lihat dulu sebelum membuat model terkait.

### 3.1 Biplane utama "PK-ARL"

- Pesawat dua kursi tandem bergaya klasik yang dibuat lebih bulat dan lucu: badan gemuk, cowling mesin radial di depan, baling-baling kayu dua bilah dengan ujung merah, dua sayap dengan strut dan kabel tipis, roda terbuka dengan pelindung lumpur kecil, roda ekor.
- Warna bawaan: badan `cream`, sayap `sun`, garis `sky`, ujung baling-baling `berry`, detail `ink`.
- Nomor registrasi di ekor dan bawah sayap: **PK-ARL** (awalan registrasi pesawat Indonesia).
- Kursi depan: Aril (pilot). Kursi belakang: Piko, selalu terlihat dari kamera pengejar.
- Detail bergerak: baling-baling (dengan blur disc saat cepat), aileron, elevator, dan rudder yang ikut bergerak sesuai input, roda yang berputar, suspensi, lampu navigasi (merah kiri, hijau kanan, putih ekor) yang berkedip saat malam.
- **Kanopi otomatis**:
  - Bawaan: kokpit terbuka, kanopi kaca tersimpan di fairing belakang.
  - Saat hujan di posisi pesawat (atau saat masuk awan tebal), kanopi meluncur maju di rel selama 1,2 detik dengan bunyi motor "whirr" dan "klak". Wiper kecil di kaca depan menyapu bolak-balik.
  - Tetesan hujan mengalir di kaca mengikuti arah angin (shader TSL dengan tekstur tetesan prosedural).
  - Setelah 8 detik tanpa hujan, kanopi terbuka lagi.
  - Di angkasa kanopi selalu tertutup, dan Aril serta Piko memakai helm gelembung transparan (muncul dengan animasi "pop").
  - Bisa juga ditutup atau dibuka manual dari menu.
- **Kit roket**: dua pendorong kecil yang keluar dari bawah sayap bawah dengan animasi mekanis saat menuju angkasa (`docs/03` bagian 8).

### 3.2 Karakter

- **Aril (pilot)**: proporsi chibi (kepala besar), seragam pilot, topi pilot dengan lencana sayap, kacamata terbang di dahi, syal yang berkibar mengikuti kecepatan (rantai tulang pegas sederhana). Animasi: memegang kemudi dan miring sesuai belokan, melambai saat diam di darat, menoleh ke arah zona.
- **Piko (co-pilot)**: anak kecil, lebih kecil dari Aril, topi pilot kebesaran yang sering melorot, headset kebesaran, pipi merona. Animasi dari `content/copilot.json` (idle dan reaksi). Mulutnya bergerak saat bicara (sinkron kasar dengan amplitudo suara).
- Wajah sederhana: mata bulatan, alis, senyum. Ekspresi bisa diganti (senang, kaget, mengantuk, kagum).

### 3.3 Skin pesawat (`docs/09`)

Biplane, amfibi (pelampung di bawah), jet kecil, pesawat kertas (warna kertas dengan lipatan), balon udara (kontrolnya pelan dan melayang), roket, UFO, dan Phoenix (rahasia). Semua skin memakai fisika yang sama dengan parameter berbeda di `config/skins.ts`.

## 4. Material dan shading (TSL)

- Material dasar: Lambert/Standard node material dengan **ramp 3 tingkat** (efek toon halus) + rim light tipis dari arah langit.
- Pesawat dan karakter: outline inverted hull tipis (tier High ke atas).
- Pohon: vertex sway berbasis angin dan waktu. Daun menyusut dekat pesawat.
- Air: bola laut dengan:
  - warna dari `coast-distance.png` (dangkal ke dalam),
  - gelombang low-poly (displacement vertex kecil),
  - buih di garis pantai,
  - kilau matahari (specular tajam) dan pantulan bulan saat malam,
  - riak di sekitar pesawat saat terbang rendah di atas air.
- Kota malam: jendela emissive per instance, mengikuti sisi malam planet.

## 5. Langit, atmosfer, dan angkasa

- **Kubah langit** mengikuti kamera. Warnanya bercampur antara palet siang, senja, dan malam berdasarkan elevasi matahari terhadap "atas" lokal kamera.
- **Cangkang atmosfer** di sekitar planet (efek fresnel): biru di sisi siang, oranye di garis senja, nyaris tak terlihat di sisi malam. Sangat penting dari orbit.
- **Bintang**: titik-titik dengan sedikit kelap-kelip, muncul saat malam atau saat ketinggian tinggi.
- **Matahari**: cakram + glare + lens flare halus (tier High).
- **Bulan**: terlihat di langit dari Bumi sesuai posisi orbitnya, dan fasenya mengikuti fase nyata.

## 6. Waktu nyata

### 6.1 Posisi matahari (titik subsolar, rumus NOAA)

```text
γ   = 2π/365 × (hari_ke − 1 + (jam_UTC − 12)/24)
EoT = 229,18 × (0,000075 + 0,001868 cosγ − 0,032077 sinγ − 0,014615 cos2γ − 0,040849 sin2γ)    // menit
δ   = 0,006918 − 0,399912 cosγ + 0,070257 sinγ − 0,006758 cos2γ + 0,000907 sin2γ − 0,002697 cos3γ + 0,00148 sin3γ   // radian
lat_subsolar = δ
lon_subsolar = −15 × (jam_UTC − 12 + EoT/60)
arahMatahari = latLonToVec3(lat_subsolar, lon_subsolar, 1)
```

Tulis unit test: 21 Juni pukul 12.00 UTC → lat subsolar ≈ +23,4°, lon ≈ 0°.

### 6.2 Bulan

- Bulan berada di orbit permainan (`MOON_DISTANCE`) pada bidang ekliptika.
- Fase dihitung dari bulan sinodik 29,53059 hari, dihitung dari bulan baru acuan 6 Januari 2000 pukul 18.14 UTC. Sudut Bulan relatif matahari diatur supaya fasenya cocok.

### 6.3 Pengaturan

- Bawaan: **waktu nyata** (dunia sama untuk semua pengunjung pada saat yang sama).
- Pengaturan bisa mengganti ke waktu manual (slider 0–24 jam) atau mengunci siang.
- **Tema UI** mengikuti jam lokal pengunjung: terang 06.30–17.30, transisi senja 17.30–18.30, gelap malam, transisi fajar 05.30–06.30. Bisa dimatikan.

## 7. Cuaca (`src/world/Weather.ts`)

### 7.1 Sumber

- **Medan** (radius 10° dari bandara): cuaca nyata dari Open-Meteo (`docs/10`), disegarkan tiap 15 menit dan disimpan di cache `localStorage`.
- **Tempat lain**: sel cuaca prosedural yang dibangkitkan dari tanggal (seed harian), jadi semua pengunjung melihat pola yang sama. Sel bergerak pelan mengikuti angin global.
- Musim mengikuti belahan bumi dan tanggal.

### 7.2 Pemetaan kode cuaca WMO

| Kode | Kondisi | Efek |
| --- | --- | --- |
| 0 | Cerah | Langit bersih |
| 1–3 | Berawan sebagian sampai mendung | Kepadatan awan 20–90% |
| 45, 48 | Kabut | Fog tebal dekat tanah |
| 51–57 | Gerimis | Hujan tipis, kanopi menutup |
| 61–67, 80–82 | Hujan, hujan lebat | Hujan, genangan, kanopi menutup, angin lebih kencang |
| 71–77, 85–86 | Salju | Salju (jarang di Medan, tetap didukung) |
| 95–99 | Badai petir | Hujan lebat, petir, turbulensi |

### 7.3 Efek

- **Awan**: kumpulan icosphere lembut (instanced) di lapisan awan, bergerak dengan angin. Menembus awan: kabut putih, tetesan di kaca kanopi, suara teredam sebentar.
- **Hujan**: partikel garis (instanced) di silinder sekitar kamera, condong mengikuti angin relatif terhadap pesawat. Cipratan kecil di tanah dan riak di air. Permukaan tanah di sekitar menjadi lebih gelap dan berkilau.
- **Petir**: kilat cahaya + mesh petir bercabang + bunyi guntur yang tertunda sesuai jarak. Petir dekat mengguncang kamera.
- **Salju**: di kutub, puncak tinggi, dan musim dingin belahan bumi. Salju menumpuk tipis di permukaan (shader berbasis normal dan musim).
- **Angin**: vektor angin global memengaruhi pesawat, pohon, bendera, kantong angin, asap, dan lampion.
- **Pelangi**: muncul setelah hujan reda di sisi berlawanan matahari (bonus).

## 8. Post-processing (sesuaikan nama kelas dengan versi three.js terpasang)

| Efek | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Antialias | FXAA | FXAA | SMAA | SMAA |
| Bloom | — | Ringan | Ya | Ya |
| Color grading per waktu | Ya (LUT kecil) | Ya | Ya | Ya |
| Vignette | — | Ya | Ya | Ya |
| Depth of field | — | — | Mode sinematik/foto | Mode sinematik/foto |
| Lens flare | — | — | Ya | Ya |

## 9. Tier kualitas (`src/config/quality.ts`)

| Pengaturan | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Pixel ratio maks | 1,0 | 1,5 | 2,0 | 2,0 |
| Bayangan | Mati (blob shadow) | 1024, dekat pesawat | 2048 | 2048 + cakupan lebih luas |
| Pohon | 1.500 | 3.000 | 6.000 | 9.000 |
| Awan | 40 | 80 | 140 | 200 |
| Partikel hujan | 1.500 | 3.000 | 6.000 | 10.000 |
| Kehidupan latar | Separuh | Penuh | Penuh | Penuh + ekstra |
| Outline karakter | — | — | Ya | Ya |

- **Auto**: tebakan awal dari kemampuan GPU (misalnya library `detect-gpu`, MIT), lalu diatur dinamis. Jika fps rata-rata 3 detik di bawah target − 5, turun satu tier. Jika di atas target + 15 selama 10 detik, naik satu tier. Perubahan tier tidak boleh membuat layar berkedip.
- Pengunjung bisa memilih tier manual di Pengaturan.
