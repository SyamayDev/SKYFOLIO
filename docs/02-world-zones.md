# 02 — Dunia, Planet, dan Zona

## 1. Skala dan koordinat

- Planet = Bumi nyata versi mainan. Radius laut `PLANET_RADIUS = 400` unit. Pusat planet di titik asal (0,0,0).
- Konversi lat/lon ke posisi: `src/utils/geo.ts` → `latLonToVec3(lat, lon, radius)`, dengan sumbu Y = kutub utara dan lon 0 menghadap +Z. Sediakan juga kebalikannya, `vec3ToLatLon`.
- "Atas" lokal di titik mana pun = `normalize(posisi)`. Semua logika (kamera, pesawat, props, partikel) memakai atas lokal, tidak boleh memakai `(0,1,0)`.
- Karena planetnya kecil, jarak antar zona dibesar-besarkan. Area zona ditentukan `radiusDeg` di `content/world/zones.json`. 1° busur di permukaan ≈ 7 unit.
- Satu putaran di ketinggian jelajah dengan kecepatan jelajah ≈ 75 detik. Pengunjung harus merasa "dunia ini kecil, aku bisa mengelilinginya".

## 2. Membuat Bumi low-poly (`scripts/build-earth.ts`)

Bumi dibuat sekali di build (bukan di browser) lalu disimpan sebagai data biner kecil.

### 2.1 Sumber data (semuanya public domain)

- **Garis pantai**: Natural Earth "land" skala 1:50m (GeoJSON). Unduh saat script berjalan, simpan cache di `scripts/.cache/`, dan catat di `CREDITS.md`.
- **Danau besar**: Natural Earth "lakes" 1:50m. Danau Toba wajib terlihat (jika terlalu kecil di data, tambahkan manual sebagai poligon).
- **Kota**: Natural Earth "populated places". Ambil sekitar 150 kota terbesar plus kota Indonesia utama (Medan, Jakarta, Surabaya, Bandung, Makassar, Denpasar, Palembang, Pekanbaru, Banda Aceh).
- **Ketinggian**: tidak memakai data elevasi besar. Tinggi dibuat dari:
  1. jarak dari pantai (makin ke dalam, makin tinggi, maksimal pelan),
  2. noise fBm halus,
  3. **punggungan pegunungan bernama** yang ditulis tangan sebagai polyline lat/lon: Himalaya, Andes, Rocky, Alpen, Bukit Barisan (Sumatra), Ural, Atlas, Great Dividing Range, pegunungan Papua.
  Hasilnya stilistik dan ringan, tapi bentuk benua tetap akurat.

### 2.2 Mesh

- Icosphere subdivisi level 6 (sekitar 82 ribu segitiga untuk seluruh bola). Hanya segitiga daratan yang dipakai untuk mesh darat. Laut adalah bola terpisah.
- Klasifikasi tiap titik: laut, pantai (pasir), daratan, gunung, salju, es kutub, gurun.
- **Gaya faceted**: geometri non-indexed, normal per muka (flat shading), warna per muka dari palet biome (`docs/04` bagian palet). Variasi kecerahan ±4% per muka supaya tidak datar.
- Pantai: satu cincin segitiga berwarna pasir di batas darat dan laut.
- Bagi planet menjadi **80 chunk** (20 muka icosahedron × 4) untuk frustum culling dan LOD.
- Output:
  - `public/earth/earth.bin`: posisi (int16 terkuantisasi relatif radius), warna (uint8), indeks chunk.
  - `public/earth/earth-meta.json`: daftar chunk, bounding sphere, versi.
  - `public/earth/coast-distance.png` (1024×512, equirectangular): jarak ke pantai untuk shader laut (air dangkal, buih).
  - `public/earth/biome-mask.png` (512×256): untuk menyebar pohon dan rumput.
- Target ukuran total ≤ 1,5 MB sebelum kompresi.

### 2.3 Collider

- Rapier `trimesh` dari mesh darat level 6, dibagi per chunk supaya bisa diaktifkan bertahap.
- Laut bukan collider padat. Air ditangani oleh `WaterMode` (`docs/03`): daya apung dan cipratan.

### 2.4 Biome dan sebaran props

| Biome | Aturan | Props (instanced) |
| --- | --- | --- |
| Tropis | \|lat\| < 23, bukan gurun | Pohon kelapa, pohon daun lebar bulat, semak |
| Subtropis/sedang | 23–50 | Pohon bulat, pohon cemara pendek, ladang petak |
| Boreal | 50–66 | Cemara tinggi, batu |
| Tundra/es | \|lat\| > 66, Greenland, Antartika | Batu berlapis salju, beruang kutub kecil (bonus) |
| Gurun | Poligon tangan: Sahara, Arab, Thar, Gobi, Australia tengah, Kalahari, Atacama, Mojave | Kaktus, bukit pasir, batu merah |
| Gunung | Tinggi > 70% maksimum | Batu, salju di puncak |

- Penyebaran memakai Poisson disk per chunk dengan seed tetap, jadi dunia selalu sama untuk semua orang.
- Jumlah total pohon ≈ 6.000 (tier High), 3.000 (Medium), 1.500 (Low).
- Pohon yang terlalu dekat jalur landasan, zona, atau landmark dihapus otomatis.
- Pohon bergoyang dengan angin (vertex shader TSL), dan **daunnya menyusut sedikit saat pesawat lewat dekat** supaya pandangan tidak tertutup.
- Pohon adalah sensor: menabrak pohon memberi guncangan, daun berhamburan, dan bunyi gemerisik, tapi tidak menghentikan pesawat. Batang pohon besar tetap collider padat.

### 2.5 Kota

- Setiap kota = kumpulan gedung low-poly instanced (5–40 gedung tergantung populasi), dengan jalan sederhana sebagai garis tekstur.
- Jendela menyala acak saat malam (emissive per instance). Gedung tinggi punya lampu merah berkedip di atap.
- Medan dibuat lebih detail: kluster gedung modern, Istana Maimun, Masjid Raya, dan jalan menuju bandara.

## 3. Zona

Setiap zona memakai kelas dasar `Zone` (`src/world/Zones/Zone.ts`):

- Trigger bola (`enter`/`exit`) berdasarkan `radiusDeg` dan ketinggian.
- Penanda POI (ikon melayang yang terlihat dari jauh dan muncul di radar).
- Judul zona (animasi teks besar saat masuk) dan perubahan tema musik.
- Panel konten: papan 3D diegetik (teks dirender ke `CanvasTexture`, dirender ulang saat bahasa diganti) **dan** panel HTML Svelte untuk dibaca nyaman di HP.
- Stempel paspor saat kunjungan pertama.
- Komentar Piko saat masuk (diambil dari teks zona + konten).
- Hook `onUpdate(dt)` untuk animasi lokal. Zona di luar jarak pandang berhenti di-update.

### 3.1 Bandara Asal Medan (`home-airport`)

- Landasan 60×8 unit, arah timur-barat (tangen permukaan), dengan marka putih, lampu landasan yang menyala saat senja dan malam, serta lampu PAPI.
- **Huruf "S Y A H R I L"** berdiri di landasan, 25 unit dari ujung. Setiap huruf = rigid body (convex hull dari geometri huruf extrude yang tebal), massa ringan, warna-warni dari palet. Setelah 20 detik diam di luar posisi, huruf melayang kembali ke tempatnya dengan animasi pegas dan bunyi "plop".
- Tiga cincin latihan sesudah landasan: naik, belok kiri, boost.
- Hangar bergaya modern, truk BBM yang bisa ditabrak, tumpukan koper (rigid body), kantong angin (windsock) yang mengikuti arah dan kecepatan angin nyata Medan.
- **Papan counter global**: total kilometer yang sudah diterbangkan semua pengunjung (`docs/09`).
- Landmark dekat bandara: Istana Maimun dan Masjid Raya Al-Mashun versi low-poly.
- Titik respawn utama dan landasan pendaratan pulang.

### 3.2 Menara Kontrol: Tentang Aril (`control-tower`)

- Menara tinggi dengan piringan radar berputar dan lampu suar.
- Saat pesawat mendekat, **radio ATC** membacakan bio Aril dengan suara Piko yang dibuat formal ala pengatur lalu lintas udara ("Menara Medan kepada SKY-1234, kenalan dulu dengan Kak Aril..."), dengan filter radio dan subtitle.
- Dinding kaca menara menampilkan bingkai foto dari `content/media/profile` dan `content/media/gallery` (berganti pelan). Foto bisa dibuka besar di panel HTML.
- Papan 3D: nama, tagline, kampus, minat, tombol CV.

### 3.3 Kantor Pos Udara: Kontak (`post-office`)

- Gedung pos mungil dengan kotak surat raksasa yang mulutnya menghadap ke atas.
- **Menjatuhkan paket**: tekan aksi untuk menjatuhkan paket dari pesawat. Paket masuk kotak surat → membuka form kontak (Web3Forms). Kalau meleset, paket memantul di tanah dan bisa dicoba lagi.
- **Balon sosial media**: balon udara bertuliskan Email, WhatsApp, LinkedIn, Instagram, GitHub (dari `socials.json`). Tabrak balon → balon memantul, panel konfirmasi "Buka Instagram?" muncul (jangan langsung membuka tab baru tanpa konfirmasi).
- Peluncur pesawat kertas: setelah pesan terkirim, pesawat kertas meluncur dari kotak surat menuju cakrawala.

### 3.4 Lembah Lampion Danau Toba (`lantern-valley`)

- Danau Toba dengan Pulau Samosir di tengahnya, perahu kecil, dan dermaga.
- Lampion pengunjung (maksimal 30 aktif, `docs/09`) melayang di atas danau, bergoyang pelan, bercahaya hangat saat malam. Mendekati lampion menampilkan pesan dan bendera negaranya.
- Dermaga lampion: tempat melepas lampion sendiri (tombol T atau ikon lampion).
- Kunang-kunang saat malam.

### 3.5 Kepulauan Proyek (`project-archipelago`)

- Gugusan pulau di Samudra Hindia barat daya Sumatra. Satu pulau per file di `content/projects/`.
- **Penempatan otomatis**: jika `island.lat/lon` kosong, letakkan dengan Poisson disk di dalam area zona. Urutan `featuredRank` paling kecil paling dekat ke Medan.
- Ukuran pulau: `large` radius 10 unit, `medium` 7, `small` 5.
- Setiap pulau punya: landasan pendek, mercusuar dengan spanduk nama proyek, papan 3D proyek, dan diorama preset di tengahnya.
- **Mendarat** di landasan pulau (kecepatan rendah, roda menyentuh) membuka panel proyek penuh: galeri, video, tech, peran, tahun, tautan demo dan repo, plus stempel paspor. Terbang lewat rendah sudah cukup untuk menampilkan papan ringkas.

**Preset diorama**:

| Preset | Isi | Interaksi fisika |
| --- | --- | --- |
| `compass` (SI-RAJU) | Plaza mawar kompas raksasa, jarum yang selalu menunjuk pesawat, rambu arah bertuliskan bidang ilmu umum (Teknik, Kesehatan, Seni, Bisnis, Sains) | Rambu bisa ditabrak lalu bergoyang dengan engsel pegas |
| `laundry` (SI-PANDRI) | Mesin cuci raksasa dengan drum berputar, jemuran dengan kain berkibar (cloth sederhana Verlet), keranjang cucian | Benda yang jatuh ke drum ikut berputar; kain bereaksi pada angin dan wake pesawat; mini-game Misi Laundry Beres |
| `books` | Tumpukan buku raksasa | Buku bisa dirobohkan |
| `robot` | Robot besar yang melambai | Kepala robot menoleh mengikuti pesawat |
| `shop` | Toko kecil dengan kanopi | Kotak-kotak barang bisa ditabrak |
| `school` | Gedung sekolah dengan bendera | Bel berbunyi saat pesawat lewat |
| `rocket` | Roket di landasan peluncuran | Roket meluncur kecil saat disentuh |
| `garden` | Taman dan kincir angin | Kincir berputar sesuai angin |
| `lab` | Laboratorium dengan tabung bercahaya | Tabung berbuih saat pesawat lewat |
| `stage` | Panggung kecil | Lampu sorot mengikuti pesawat |
| `generic` | Pulau tropis dengan papan foto | Pohon kelapa bergoyang |

**Mini-game Misi Laundry Beres** (pulau SI-PANDRI): 60 detik, jatuhkan karung cucian (diambil otomatis saat terbang rendah melewati keranjang) ke drum mesin cuci. Skor tersimpan lokal. Achievement jika skor ≥ 8.

### 3.6 Pegunungan Skill (`skill-peaks`)

- Satu puncak per skill. Tinggi = `level / 5 × SKILL_PEAK_MAX_HEIGHT`. Puncak level 5 bersalju dan berbendera "AHLI / EXPERT".
- Kelompok skill (bahasa, framework, database, soft skill) membentuk punggungan berbeda.
- Cincin bertuliskan nama skill melayang di dekat puncaknya. Menembus cincin → papan skill + bunyi nada (nada naik sesuai level).
- Balon skill kecil beterbangan; ditabrak → pecah menjadi konfeti dan menampilkan skill-nya.
- Logo teknologi resmi tidak dipakai. Tampilkan nama skill dengan tipografi rapi dan ikon generik buatan sendiri.

### 3.7 Arus Perjalanan (`journey-stream`)

- Pita angin berbentuk tabung transparan berpartikel di atas khatulistiwa (ketinggian 34 unit di atas permukaan), mengalir ke timur mulai dari meridian Medan.
- Masuk arus → angin buritan kuat, pesawat dibantu tetap di jalurnya (spline assist yang lembut, bisa dilawan).
- Checkpoint berupa gerbang melayang dengan ikon dan tahun. Urutan kronologis dari yang terlama. Item tanpa tahun yang terkonfirmasi tetap tampil tanpa label tahun.
- Melewati gerbang menampilkan kartu timeline (judul, organisasi, ringkasan) dan Piko bercerita singkat.

### 3.8 Kota Kontribusi (`contribution-city`)

- Satu gedung per hari selama 53 minggu terakhir (grid 53×7), di dataran tengah Australia.
- Tinggi = `log2(commit + 1) × 2.2`. Warna dari hijau muda ke hijau tua (atau palet SKYFOLIO).
- Malam hari: jendela menyala sebanding jumlah kontribusi.
- Papan reklame menampilkan repo dengan bintang terbanyak.
- Data dari `npm run sync:github` saat build (`docs/08`). Tanpa data, kota tampil sebagai lokasi konstruksi dengan crane yang berputar.

### 3.9 Hangar Eksperimen dan Kawah Nekat (`hangar-lab`)

- Pulau gunung api di Selat Sunda dengan kepulan asap dan cahaya lava saat malam.
- Hangar berisi "mesin aneh": proyek bertag `experiment` tampil sebagai mesin yang bisa dimainkan.
- **Kawah Nekat**: terbang masuk ke kawah → layar memutih dengan bunyi "fwoosh", counter global bertambah, pesawat muncul lagi di bandara. Papan di bibir kawah menampilkan jumlah total penerjun di seluruh dunia.
- **Rahasia (jangan diumumkan di UI)**: setiap penerjun ke-100 di seluruh dunia mendapat skin "Phoenix" (biplane berapi keemasan). Server yang menentukan nomornya (`docs/09`).

### 3.10 Zona easter egg

| Zona | Lokasi | Isi |
| --- | --- | --- |
| Panggung MC (`mc-stage`) | Eropa | Panggung, mikrofon raksasa, lampu sorot yang mengikuti pesawat; terbang rendah memicu tepuk tangan dan suara "tes, tes"; panel pengalaman MC dan pemateri Aril |
| Dapur Aril (`aril-kitchen`) | Anatolia | Kuali raksasa di atas tungku; peti bahan halal (sapi, ayam, kambing, rempah, cabai) bisa dijatuhkan ke kuali → uap, bunyi "cesss", resep jadi (rendang, sate, steak); achievement "Chef Aril" |
| Pulau Gym (`gym-island`) | Pasifik | Barbel raksasa yang celahnya bisa diterbangi (papan "PR" bertambah), dumbel fisika, rak beban bergoyang; achievement "Angkat Beban" |
| Desa Benteng (`fort-village`) | Afrika tengah | Desa bertembok dengan menara dan ketapel; balon air dari pesawat merobohkan tembok fisika yang lalu tersusun kembali; desain generik, tanpa nama atau karakter game mana pun |
| Taman Balok (`block-park`) | Amerika Selatan | Karakter balok generik berjoget saat pesawat lewat, balok raksasa yang bisa ditumpuk dan dirobohkan |

### 3.11 Sirkuit Langit (`sky-circuit`)

- 24 cincin di sepanjang lingkaran besar yang miring 35° dan melewati atas bandara. Ketinggian bervariasi 22–60 unit.
- Gerbang start di dekat bandara. Waktu lap tampil besar di HUD.
- Hantu lap terbaik pribadi (rekaman posisi lokal) terbang transparan di sampingmu.
- Leaderboard harian 10 besar di papan dekat gerbang start (`docs/09`).

### 3.12 Orbit Sertifikat (`orbit`)

- Satu satelit per sertifikat, mengorbit pelan di ketinggian `ORBIT_RING`. Panel surya satelit berkilau terkena matahari.
- Mendekati satelit menampilkan thumbnail sertifikat. Ketuk untuk melihat besar.
- Stasiun angkasa kecil sebagai pusat, dengan dinding achievement.

### 3.13 Bulan (`moon`)

- Bola low-poly dengan kawah, gravitasi sendiri (lemah), dan landasan pendaratan bercahaya.
- Bendera SKYFOLIO yang berkibar pelan (tanpa angin, gerak lambat).
- Pemandangan "Bumi terbit" dari permukaan Bulan.
- Mendarat mulus → pesan rahasia. Ambil dari `content/secret-message.json` jika ada. Jika belum ada, tampilkan ucapan netral dari "SKYFOLIO" (bukan atas nama Aril) dan catat di laporan sebagai kebutuhan dari Aril.

## 4. Landmark dunia

Daftar ada di `content/world/landmarks.json`. Semuanya versi low-poly "terinspirasi", diperbesar supaya terlihat dari udara, dengan collider sederhana.

- Kunjungan pertama (lewat dalam radius kecil) memberi stempel paspor bonus.
- Landmark bertanda `flyUnder: true` (Jembatan Ampera, jembatan merah San Francisco) punya trigger di bawah bentangnya untuk achievement "Kolong Jembatan".
- Landmark tidak memakai logo, papan nama komersial, atau pertunjukan cahaya berhak cipta.

## 5. Kehidupan latar

| Elemen | Perilaku |
| --- | --- |
| Kawanan burung | Boids sederhana, menghindar dari pesawat, pulang ke pohon saat malam |
| Paus | Melompat dan menyembur di samudra, bunyi "byur" spasial |
| Kapal | Berlayar di jalur laut dengan buih di belakangnya |
| Kereta | Rel melingkar di beberapa benua, peluit spasial |
| Balon udara | Melayang pelan, bisa ditabrak lalu memantul |
| Aurora | Pita cahaya animasi di kedua kutub, lebih terang saat malam |
| Kunang-kunang | Di Danau Toba dan hutan tropis saat malam |

Semua kehidupan latar hanya di-update bila dekat kamera, dan jumlahnya menyesuaikan tier kualitas.
