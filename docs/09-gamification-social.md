# 09 — Paspor, Achievement, Skin, Sirkuit, dan Fitur Sosial

## 1. Paspor (`src/game/Passport.ts`)

- Buku paspor bergaya ilustrasi dengan satu halaman per wilayah (Indonesia, Asia, Eropa, Afrika, Amerika, Oseania, Angkasa).
- **Stempel** untuk setiap zona dan landmark saat kunjungan pertama. Setiap stempel punya desain SVG unik (bentuk, warna, ikon), tanggal, dan sedikit rotasi acak supaya terlihat dicap tangan.
- Animasi cap: stempel turun, bunyi "dok", sedikit tinta memercik.
- Jumlah stempel tampil di boarding pass dan gambar berbagi.

## 2. Achievement (`src/game/Achievements.ts`)

Ada 34 achievement. Yang bertanda rahasia tidak tampil di daftar sebelum terbuka (tampil sebagai "???").

| ID | Nama (ID / EN) | Syarat | Hadiah |
| --- | --- | --- | --- |
| `first-flight` | Lepas Landas / Wheels Up | Lepas landas pertama kali | Stempel pertama |
| `name-crasher` | Penabrak Nama / Name Crasher | Menjatuhkan ketujuh huruf SYAHRIL | Asap emas |
| `training-done` | Lulus Latihan / Flight School | Melewati 3 cincin latihan | Asap biru |
| `smooth-landing` | Pendaratan Mulus / Butter Landing | Pendaratan mulus pertama | — |
| `island-hopper` | Lompat Pulau / Island Hopper | Mendarat di 3 pulau proyek | Skin amfibi |
| `project-collector` | Kolektor Proyek / Project Collector | Membuka semua panel proyek | Skin pesawat kertas |
| `around-the-world` | Keliling Dunia / Around the World | Satu putaran penuh planet dalam satu penerbangan | Skin jet kecil |
| `cloud-surfer` | Menembus Awan / Cloud Surfer | Terbang menembus awan | — |
| `edge-of-space` | Menembus Langit / Edge of Space | Mencapai `SPACE_START` | Skin roket |
| `moonwalker` | Pendarat Bulan / Moonwalker | Mendarat mulus di Bulan | Skin UFO |
| `night-owl` | Pilot Malam / Night Owl | Terbang 2 menit di sisi malam | Lampu navigasi neon |
| `storm-chaser` | Pemburu Badai / Storm Chaser | Menembus sel badai petir | — |
| `loop-de-loop` | Jungkir Balik / Loop-de-Loop | Loop penuh | Asap pelangi |
| `barrel-master` | Raja Barrel Roll / Barrel Roll Master | 10 barrel roll | — |
| `under-bridge` | Kolong Jembatan / Bridge Diver | Terbang di bawah jembatan bertanda `flyUnder` | — |
| `landmark-tourist` | Turis Dunia / World Tourist | Mengunjungi 10 landmark | Skin balon udara |
| `passport-full` | Paspor Penuh / Full Passport | Semua stempel zona | Sampul paspor emas |
| `skill-climber` | Penakluk Skill / Skill Climber | Melewati semua cincin skill | — |
| `time-traveler` | Penjelajah Waktu / Time Traveler | Menyusuri Arus Perjalanan dari awal sampai akhir | — |
| `city-lights` | Lampu Kota / City Lights | Mengunjungi Kota Kontribusi saat malam | — |
| `mailman` | Tukang Pos / Mail Carrier | Paket masuk kotak surat | — |
| `lantern-lighter` | Penyala Lampion / Lantern Lighter | Melepas lampion | — |
| `chef-aril` | Chef Aril / Chef Aril | Memasak satu hidangan di Dapur Aril | Topi koki untuk Piko |
| `gym-pr` | Angkat Beban / New PR | Menembus barbel 5 kali | — |
| `laundry-hero` | Laundry Beres / Laundry Hero | Skor ≥ 8 di Misi Laundry Beres | — |
| `fort-breaker` | Pendobrak Benteng / Wall Breaker | Merobohkan tembok Desa Benteng | — |
| `mc-applause` | Tepuk Tangan / Standing Ovation | Terbang rendah di atas Panggung MC | — |
| `piko-friend` | Sahabat Piko / Piko's Buddy | Bertanya 5 kali ke Piko | Suara Piko alternatif |
| `recruiter-tour` | Tur Kilat / Speed Tour | Menyelesaikan Mode Rekruter | — |
| `circuit-finisher` | Satu Lap / First Lap | Menyelesaikan satu lap Sirkuit Langit | — |
| `circuit-champ` | Juara Sirkuit / Circuit Champ | Masuk 10 besar harian | Lencana di boarding pass |
| `daredevil` (rahasia) | Nekat / Daredevil | Terjun ke Kawah Nekat | — |
| `phoenix` (rahasia) | Phoenix | Menjadi penerjun ke-100 (kelipatan 100) di seluruh dunia | Skin Phoenix |
| `true-captain` | Kapten Sejati / True Captain | Semua achievement yang tidak rahasia | Skin biplane emas |

- Toast achievement: ikon, nama, hadiah, jingle, Piko tepuk tangan.
- Waktu yang dibutuhkan untuk menyelesaikan semua achievement dicatat dan tampil di paspor (ide dari Bruno, dalam versi kita).

## 3. Skin (`src/config/skins.ts`)

Semua skin dibuat prosedural dan memakai fisika yang sama dengan parameter berbeda.

| Skin | Rasa terbang | Keunikan |
| --- | --- | --- |
| Biplane (bawaan) | Seimbang | Kanopi otomatis, kit roket |
| Amfibi | Sedikit lebih lambat | Pelampung, lepas landas dari air dengan mudah |
| Jet kecil | Jelajah 48, boost 95, stall 20 | Kurang lincah di kecepatan rendah, suara jet |
| Pesawat kertas | Ringan, melayang lama, dorongan kecil, belok tajam | Saat tabrakan kusut lalu terlipat lagi |
| Balon udara | Pelan, naik-turun dengan pembakar, hanyut mengikuti angin | Mode santai, suara pembakar |
| Roket | Boost sangat cepat, belok lebar | Jejak asap tebal |
| UFO | Melayang, bisa geser ke samping | **Sinar penarik**: bisa mengangkat benda fisika kecil (koper, peti, huruf) |
| Phoenix (rahasia) | Seperti biplane, sedikit lebih cepat | Jejak api, bercahaya saat malam |
| Biplane emas | Seperti biplane | Kilau emas |

Ganti skin dari paspor atau menu jeda. Skin dan warna asap tersimpan.

## 4. Sirkuit Langit (`src/game/SkyCircuit.ts`)

- 24 cincin (`docs/02` bagian 3.11). Cincin berikutnya menyala dan ada panah di HUD.
- Hitung mundur 3-2-1 dengan bunyi, waktu lap besar di HUD, waktu per sektor (hijau jika lebih cepat dari terbaik).
- Melewatkan cincin = lap tidak sah (ditampilkan jelas, lalu bisa diulang).
- Hantu lap terbaik pribadi disimpan lokal (posisi dan rotasi tiap 0,1 detik, dikompresi).
- Leaderboard harian 10 besar (reset 00.00 WIB) tampil di papan dekat gerbang start dan di panel.

**Anti-curang sederhana** (`api/leaderboard.ts`):
1. Saat mulai lap, klien meminta token sesi bertanda tangan (HMAC dengan `LEADERBOARD_SECRET`).
2. Klien mengirim waktu lap, urutan cincin dengan cap waktu, dan token.
3. Server menolak jika: token tidak sah atau kedaluwarsa, urutan cincin salah, waktu di bawah batas fisik minimum, atau lebih dari 20 kiriman per hari dari IP yang sama.
4. Nama diambil dari boarding pass, maksimal 16 karakter, disaring kata kasar.

## 5. Lampion Langit (`api/lanterns.ts`)

- `GET /api/lanterns` → maksimal 30 lampion aktif: `{ id, text, country, createdAt, seed }`.
- `POST /api/lanterns` → `{ text (≤ 30 karakter), country }`. Validasi zod, tanpa URL dan nomor telepon, disaring (`docs/06` bagian 8), satu lampion per pengunjung per hari (hash IP).
- Penyimpanan: list Redis, `LPUSH` lalu `LTRIM 0 29`.
- `seed` menentukan posisi acak yang stabil di atas Danau Toba.
- Klien mengambil ulang tiap 60 detik saat berada di zona.
- Penghapusan oleh Aril: `DELETE /api/lanterns/:id` dengan header `Authorization: Bearer <ADMIN_TOKEN>` (juga tersedia sebagai tombol di Hangar).
- Saat API mati: tampilkan lampion contoh lokal yang ditandai jelas sebagai contoh, dan tombol lepas lampion tetap memberi animasi tanpa menyimpan.

## 6. Counter global (`api/counters.ts`)

| Counter | Cara kerja |
| --- | --- |
| Total km diterbangkan | Klien mengumpulkan jarak dan mengirim selisihnya tiap 60 detik serta saat keluar (`navigator.sendBeacon`). Server membatasi maksimal yang masuk akal per menit. Tampil di papan bandara dan layar kedatangan |
| Penerjun Kawah Nekat | `POST /api/counters/crater` → `{ count, phoenix: count % 100 === 0 }` |
| Pengunjung yang mencapai Bulan | Untuk statistik di Behind the Scenes |

Saat API mati, papan menampilkan angka terakhir dari cache dengan tanda "offline".

## 7. Penyimpanan lokal

- Kunci `skyfolio:v1:settings`, `skyfolio:v1:progress` (achievement, stempel, skin, asap, lap terbaik, hantu), dan `skyfolio:v1:visitor` (nama).
- Ada nomor versi dan fungsi migrasi.
- Semua akses dibungkus `try/catch`. Jika `localStorage` tidak bisa dipakai (mode privat tertentu), simpan di memori dan beri tahu pelan-pelan bahwa progres tidak tersimpan.
- Tombol "Reset progres" di Pengaturan dengan konfirmasi.
