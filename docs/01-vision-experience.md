# 01 — Visi dan Pengalaman

## 1. Satu kalimat

SKYFOLIO adalah Bumi mini low-poly yang cerah, tempat pengunjung menerbangkan biplane berfisika nyata bersama co-pilot cilik bernama Piko, untuk menemukan siapa Syahril Maimubdy (Aril), dari landasan di Medan sampai ke Bulan.

## 2. Lima pilar desain

| Pilar | Artinya dalam praktik | Ujiannya |
| --- | --- | --- |
| **Mainan yang hidup** | Semua bisa ditabrak, didorong, dijatuhkan, dan bereaksi. Dunia terasa seperti mainan mahal yang dibuat dengan cinta. | Pengunjung tertawa dalam 10 detik pertama. |
| **Detail sampai ke baut** | Kanopi menutup sendiri saat hujan, syal pilot berkibar sesuai kecepatan, roda berputar di landasan, burung menghindar, lampu kota menyala saat malam. | Setiap kali pengunjung melihat lebih dekat, ada detail baru. |
| **Keajaiban skala** | Dari menyentuh rumput di landasan sampai melihat seluruh planet dari orbit, lalu mendarat di Bulan, tanpa jeda. | Momen "wow" di menit pertama. |
| **Isi yang jujur** | Semua informasi tentang Aril akurat, ringkas, dan mudah ditemukan, baik saat bermain maupun lewat Mode Ringkas. | Rekruter mendapat gambaran lengkap dalam 90 detik. |
| **Ramah semua perangkat** | HP adalah warga kelas satu. Kontrol sentuh terasa alami, tutorial menyesuaikan perangkat. | Bisa dimainkan nyaman dengan satu tangan di HP. |

## 3. Siapa pengunjungnya

| Pengunjung | Kebutuhan | Jalur terbaik |
| --- | --- | --- |
| Teman dan pengikut Instagram (mayoritas, pakai HP) | Hiburan, kagum, ingin membagikan | Bermain bebas, boarding pass, kartu pos untuk Story |
| Rekruter, dosen, panitia lomba | Info cepat dan jelas | Mode Rekruter (tur 60–90 detik) atau Mode Ringkas, unduh CV |
| Developer dan juri kompetisi | Kualitas teknis dan kreativitas | Panel "Di Balik Layar", fps stabil, detail fisika, musik |
| Calon klien | Bukti kemampuan dan cara menghubungi | Kepulauan Proyek dan Kantor Pos Udara |

## 4. Alur kunjungan lengkap

### 4.1 Pra-terbang (layar loading)

- Latar: langit gradasi sesuai jam lokal pengunjung, awan bergerak pelan, siluet biplane berayun.
- Progres pemuatan ditampilkan sebagai **checklist pilot** yang tercentang otomatis sesuai aset yang selesai dimuat: "Bahan bakar", "Baling-baling", "Peta dunia", "Radio", "Co-pilot Piko", "Cuaca Medan".
- Teks kecil bergiliran: fakta lucu tentang Aril dari `content/` (misalnya "Kak Aril jago jadi MC").
- Tombol yang selalu terlihat: **Mode Ringkas** (pojok kanan atas) dan pilihan bahasa.

### 4.2 Boarding pass

- Pengunjung mengetik nama (boleh dilewati, otomatis menjadi "Kapten Misterius" / "Mystery Captain").
- Boarding pass tercetak dengan animasi kertas keluar dari mesin: nama, nomor penerbangan acak (format `SKY-1234`), rute `??? → MDN`, kursi pilot, negara asal (dari locale browser, tanpa meminta lokasi), tanggal.
- Tombol "Naik Pesawat" sekaligus membuka kunci audio di iOS.

### 4.3 Hangar di Bandara Medan

- Kamera sinematik pendek (3–4 detik, bisa dilewati): menyapu landasan, Istana Maimun dan Masjid Raya versi low-poly di kejauhan, lalu berhenti di belakang biplane.
- Aril (pilot) melambai. Piko di kursi belakang menyapa dengan suara dan subtitle.
- Mesin dinyalakan: bunyi starter, baling-baling tersendat lalu berputar, asap knalpot kecil, pesawat bergetar halus.

### 4.4 Lepas landas (tutorial alami)

- Landasan dipenuhi **blok huruf "S Y A H R I L"** yang bisa ditabrak. Blok terlempar dengan fisika dan bunyi kayu, lalu (setelah 20 detik tidak disentuh) kembali tersusun dengan animasi pegas.
- Papan tutorial di pinggir landasan berubah sesuai perangkat: ikon keyboard, sentuh, atau gamepad (lihat `docs/07`).
- Tiga cincin latihan setelah landasan: naik, belok, boost. Masing-masing memberi bunyi "ding" dan stempel paspor pertama.

### 4.5 Jelajah bebas

- Kompas di atas layar dan radar di pojok menunjuk zona terdekat yang belum dikunjungi.
- Memasuki zona memicu: judul zona besar muncul sebentar, musik berpindah tema, Piko berkomentar, panel konten tersedia dengan tombol "Lihat".
- Konten utama tampil sebagai **papan 3D di dunia** (billboard diegetik). Ada juga panel HTML yang lebih nyaman dibaca di HP.

### 4.6 Momen puncak: menuju angkasa

- Terus naik melewati awan: kabut tipis di kaca kanopi, suara angin berubah.
- Di stratosfer langit menggelap ke biru tua, bintang muncul, kurva Bumi terlihat jelas.
- Di luar atmosfer: musik berganti ke tema angkasa, kontrol berubah ke pendorong roket (lihat `docs/03`), satelit sertifikat terlihat mengorbit.
- Bulan terlihat besar. Mendarat di Bulan membuka pesan rahasia dari Aril dan skin UFO.

### 4.7 Pulang dan kedatangan

- Mendarat kembali di Bandara Medan (atau memilih "Akhiri penerbangan" di menu) membuka layar **Kedatangan**:
  - Animasi garis jejak terbang di atas globe yang bisa diputar.
  - Paspor dengan stempel yang sudah terkumpul.
  - Statistik: jarak, waktu terbang, tabrakan, ketinggian maksimum, zona dikunjungi.
  - Tombol **Bagikan**: membuat gambar 1080×1920 (boarding pass + jejak terbang) dan memakai Web Share API di HP, atau mengunduh di desktop.
  - Tombol **Unduh CV** dan **Hubungi Aril**.

### 4.8 Dua jalur cepat

- **Mode Rekruter**: satu tombol di layar boarding pass dan di menu. Piko mengambil alih kemudi, membawa tur sinematik 60–90 detik ke Menara Kontrol, 3 pulau proyek unggulan, Pegunungan Skill, Arus Perjalanan, lalu Kantor Pos Udara sambil bercerita (suara + subtitle). Pengunjung bisa mengambil alih kapan saja. Tur ditutup dengan tombol unduh CV.
- **Mode Ringkas** (`/ringkas/`): halaman HTML statis, cepat, ramah SEO, berisi semua isi yang sama dan tautan kembali ke pengalaman 3D.

## 5. Storyboard 60 detik pertama (target emosi)

| Detik | Yang terjadi | Emosi |
| --- | --- | --- |
| 0–5 | Checklist pilot tercentang, musik pembuka Sunda yang ceria mulai pelan | Penasaran |
| 5–12 | Boarding pass tercetak dengan nama pengunjung | Merasa disambut |
| 12–16 | Kamera menyapu bandara, Piko menyapa | Hangat |
| 16–25 | Mesin menyala, pesawat melaju, menabrak huruf nama | Tertawa |
| 25–40 | Lepas landas, melewati cincin latihan, Danau Toba terlihat | Bebas |
| 40–60 | Pertama kali melihat bentuk bulat planet dan kota-kota kecil, Piko menunjuk Kepulauan Proyek | Terpesona |

## 6. Ukuran keberhasilan

- 70% pengunjung terbang lebih dari 2 menit.
- 40% mengunjungi minimal 1 pulau proyek.
- 15% mencapai orbit.
- Tidak ada laporan "macet di HP".
- Lighthouse Mode Ringkas: Performance ≥ 95, Accessibility ≥ 95, SEO 100.
- Siap dikirim ke Awwwards dengan checklist di `docs/11` terpenuhi.
