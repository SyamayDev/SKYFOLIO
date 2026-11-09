# 11 — Performa, Pengujian, Game Feel, dan Kesiapan Kompetisi

## 1. Anggaran performa

| Metrik | Target |
| --- | --- |
| Muatan awal sebelum bisa terbang (brotli) | ≤ 8 MB |
| JavaScript awal (brotli) | ≤ 600 KB (three, rapier wasm, dan kode inti). Sisanya dimuat malas per zona atau fitur |
| Waktu sampai checklist pra-terbang selesai | ≤ 6 detik di 4G, ≤ 3 detik di Wi-Fi |
| FPS HP Android kelas menengah | ≥ 30 stabil (tier Low/Medium) |
| FPS laptop kelas menengah | 60 (tier High) |
| Draw call | ≤ 120 (Low), ≤ 250 (High) |
| Segitiga di layar | ≤ 300 ribu (Low), ≤ 1 juta (High) |
| Memori GPU | ≤ 300 MB (High) |
| Waktu langkah fisika | ≤ 3 ms per frame di laptop |
| Garbage collection | Tidak ada jeda GC yang terasa saat terbang 5 menit |

## 2. Teknik wajib

- Instancing untuk semua benda berulang (pohon, gedung, batu, awan, partikel, props).
- Gabung geometri statis per material. Satu tekstur palet bersama.
- Frustum culling per chunk planet. LOD untuk landmark dan zona.
- Zona di luar jarak pandang tidak di-update dan tidak di-render detailnya.
- Fisika: benda jauh tidur, chunk collider jauh dinonaktifkan.
- Object pool untuk partikel, efek tabrakan, dan audio.
- Objek sementara dipakai ulang (vektor, quaternion, matriks) di loop panas.
- Kompresi: geometri meshopt/Draco, tekstur KTX2 (jika ada tekstur besar), audio ogg/mp3 kecil.
- Muat bertahap: inti dulu (planet, pesawat, bandara), zona lain di latar belakang setelah pesawat bisa terbang.
- Tier kualitas dinamis (`docs/04` bagian 9).

## 3. Pengujian

| Jenis | Alat | Isi |
| --- | --- | --- |
| Unit | Vitest | Matematika geo dan quaternion, posisi matahari, model terbang (lurus, stall, radius belok), parser konten, IntentRouter, i18n lengkap, validasi API |
| Integrasi API | Vitest + mock | Rantai AI fallback, batas pemakaian, lampion, leaderboard anti-curang |
| End-to-end | Playwright | Halaman terbuka tanpa error console; tombol Naik Pesawat; terbang 20 detik dengan keyboard; kontrol sentuh di viewport HP; panel proyek terbuka; ganti bahasa; Mode Ringkas; CV |
| Screenshot | Playwright (`npm run shots`) | 4 viewport × posisi kamera penting (landasan, zona, orbit, Bulan, malam, hujan). **Claude Code wajib melihat hasilnya** |
| Performa | Hook debug `window.__skyfolio.perf` | Rata-rata fps, draw call, segitiga, waktu fisika selama skenario terbang otomatis 60 detik |
| Manual | HP Android, iPhone, laptop | Checklist bagian 5 |

Playwright dijalankan dengan `--use-gl=swiftshader` atau mode headless yang mendukung WebGL di CI. Jika WebGPU tidak tersedia di lingkungan tes, pastikan fallback WebGL2 yang diuji.

Skenario terbang otomatis (`?autotest=1`): autopilot mengunjungi bandara → pulau proyek → gunung → orbit → kembali, sambil mencatat fps dan error. Dipakai untuk tes regresi performa.

## 4. Checklist game feel ("juice")

Setiap fitur baru dicek dengan daftar ini:

- [ ] Ada antisipasi (sedikit gerakan sebelum aksi besar, misalnya pesawat menunduk sebelum boost).
- [ ] Ada squash/stretch atau pegas pada benda yang muncul, ditabrak, atau dipilih.
- [ ] Ada partikel yang pas (debu, daun, percikan, konfeti, uap).
- [ ] Ada suara, dengan variasi pitch.
- [ ] Ada guncangan kamera atau perubahan FOV untuk kejadian besar (bisa dimatikan).
- [ ] Ada getaran di perangkat yang mendukung.
- [ ] Ada reaksi Piko (animasi atau kalimat).
- [ ] Transisi tidak pernah patah: masuk-keluar memakai easing.
- [ ] Benda kembali ke keadaan rapi setelah diacak (huruf nama, tembok benteng, tumpukan buku).
- [ ] Tidak ada yang diam total: idle animation halus.

## 5. Checklist bug bash sebelum rilis

- [ ] Terbang 10 menit tanpa error, kebocoran memori, atau penurunan fps.
- [ ] Mengunjungi semua zona di HP dan desktop.
- [ ] Rotasi HP portrait ↔ landscape saat terbang.
- [ ] Pindah tab lalu kembali (audio, fisika, waktu tidak meledak).
- [ ] Koneksi lambat (throttling 3G) dan offline setelah memuat.
- [ ] Semua layanan dimatikan (env kosong): situs tetap berfungsi.
- [ ] Ganti bahasa di setiap layar.
- [ ] Ganti kualitas grafis di tengah terbang.
- [ ] Respawn dari tempat sulit (dalam kawah, di bawah laut, terbalik di gunung).
- [ ] Safari iOS: audio unlock, giroskop, Web Share, safe area.
- [ ] Firefox (fallback WebGL2) dan Chrome (WebGPU).
- [ ] Keyboard saja, gamepad saja, sentuh saja.
- [ ] Lighthouse Mode Ringkas sesuai target.

## 6. Checklist kesiapan kompetisi (Awwwards dan sejenisnya)

- [ ] Kesan pertama memukau dalam 5 detik (pra-terbang dan boarding pass dipoles).
- [ ] Konsep kuat dan konsisten: penerbangan, paspor, boarding pass, ATC, kantor pos.
- [ ] Detail mikro di mana-mana (`docs/02`, `docs/04`).
- [ ] Musik original yang berkesan dan adaptif.
- [ ] Performa mulus di HP.
- [ ] Aksesibilitas dan Mode Ringkas tersedia.
- [ ] Panel Behind the Scenes: teknologi, kredit, info renderer.
- [ ] Tidak ada placeholder, teks lorem, atau bug visual yang terlihat.
- [ ] Favicon, gambar OG, judul tab yang ikut lokasi terbang, dan halaman 404 bertema ("Pesawatmu tersesat").
- [ ] Video rekaman 30–60 detik dan 6–8 screenshot terbaik untuk materi submit (simpan di `docs/press/`).
- [ ] Teks deskripsi proyek ID/EN untuk submit (simpan di `docs/press/`).
