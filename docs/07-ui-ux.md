# 07 — UI, UX, Tutorial, Pengaturan, dan Halaman Pendukung

## 1. Prinsip

- **Dunia dulu, UI belakangan.** UI HTML tipis, membulat, setengah transparan, dan tidak menutupi pesawat. Konten utama tampil diegetik di dunia 3D, dengan panel HTML sebagai versi nyaman baca.
- **Satu tangan di HP.** Semua aksi penting terjangkau jempol.
- **Konsisten dengan palet** (`docs/04`). Tema terang dan gelap mengikuti jam lokal pengunjung (bisa dimatikan).
- **Animasi UI** pakai pegas lembut (GSAP atau transisi Svelte), 150–300 ms. Hormati `prefers-reduced-motion`.
- **Tipografi**: Fredoka untuk judul dan angka HUD, Nunito Sans untuk teks. Ukuran teks minimal 15 px di HP.

## 2. Daftar layar dan komponen (`src/ui/`)

| Komponen | Isi |
| --- | --- |
| `Preflight` | Checklist pilot yang tercentang sesuai progres muat, fakta lucu bergiliran, tombol Mode Ringkas, pilihan bahasa |
| `BoardingPass` | Input nama, boarding pass beranimasi, tombol "Naik Pesawat" dan "Mode Rekruter" |
| `Hud` | Kecepatan, ketinggian, kompas, mini-radar, indikator zona, tombol peta, Piko, jeda, dan kontrol sentuh |
| `Radar` | Lingkaran kecil dengan ikon zona terdekat; panah di tepi untuk zona di luar jangkauan |
| `Map` | Globe yang bisa diputar dengan semua zona, landmark, dan posisi pesawat. Ketuk zona → "Antar ke sini" (autopilot) |
| `ZonePanel` | Panel konten zona (profil, proyek, skill, timeline, kontak, sertifikat). Di HP berupa bottom sheet yang bisa ditarik |
| `ProjectPanel` | Galeri yang bisa digeser, video, tech chips, peran, tahun, tombol Demo dan Repo |
| `Passport` | Halaman paspor dengan stempel per zona dan landmark, ditambah daftar achievement |
| `Settings` | Semua pengaturan (bagian 6) |
| `Pause` | Lanjut, Respawn, Peta, Paspor, Pengaturan, Mode Ringkas, Akhiri Penerbangan |
| `Tutorial` | Kartu tutorial per perangkat (bagian 5) |
| `Toasts` | Achievement, stempel, info kecil. Antri, maksimal 2 sekaligus |
| `Chat` | Obrolan dengan Piko (`docs/06`) |
| `Subtitles` | Subtitle besar untuk suara Piko dan ATC |
| `Arrival` | Layar kedatangan: jejak terbang di globe, statistik, paspor, Bagikan, CV, Hubungi |
| `BehindTheScenes` | Teknologi yang dipakai, kredit lisensi, fps, info renderer (WebGPU atau WebGL2). Penting untuk juri |
| `ContactForm` | Form Web3Forms: nama, email, pesan, hCaptcha, honeypot |
| `LinkConfirm` | Konfirmasi sebelum membuka tautan keluar |

## 3. HUD

### 3.1 Desktop

```text
┌──────────────────────────────────────────────────────────────┐
│ [Kompas N · · · E · · · S]                     [Peta][⏸]     │
│                                                              │
│                        (pesawat)                             │
│ [Radar]                                                      │
│                                                              │
│ 36 km/j  ·  ALT 32                    [Piko + gelembung chat] │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 HP landscape

```text
┌────────────────────────────────────────────────────────┐
│ [Radar]      [Kompas]                    [Peta][Piko][⏸]│
│                                                        │
│                     (pesawat)                          │
│                                                        │
│ (joystick dinamis           [Aksi]                     │
│  di area kiri)          [Rem]      [BOOST]             │
└────────────────────────────────────────────────────────┘
```

### 3.3 HP portrait

- Kompas dan tombol di atas, radar diperkecil, joystick kiri bawah, Boost dan Aksi kanan bawah.
- Kamera sedikit lebih jauh dan FOV lebih lebar supaya pesawat dan sekitarnya tetap terlihat.
- Saat pertama kali portrait, tampilkan saran kecil "Miringkan HP untuk pengalaman terbaik" yang bisa ditutup. Portrait tetap didukung penuh.

### 3.4 Aturan

- Gunakan `env(safe-area-inset-*)`.
- Tombol minimal 56×56 px, jarak antar tombol minimal 8 px.
- HUD meredup saat diam 6 detik dan muncul lagi saat ada input.
- Tombol Aksi kontekstual dengan label jelas dan ikon.

## 4. Panel konten

- Papan 3D di dunia: judul besar, 1–2 baris ringkasan, ikon. Dirender ke `CanvasTexture` dengan font yang sama, dan dirender ulang saat bahasa diganti.
- Panel HTML: dibuka dari tombol "Lihat" atau dengan mengetuk papan. Di HP berupa bottom sheet (bisa ditarik 50% dan 90%). Di desktop berupa panel samping kanan.
- Saat panel terbuka di HP, pesawat otomatis masuk mode "melayang" (autopilot mengitari) supaya tidak jatuh selama membaca.

## 5. Tutorial menyesuaikan perangkat

- Deteksi: `pointer: coarse` → sentuh, gamepad tersambung → gamepad, sisanya keyboard dan mouse. Jika perangkat berganti di tengah jalan (misalnya gamepad disambung), tutorial dan ikon ikut berubah.
- Tutorial bertahap, tidak sekaligus:
  1. Di landasan: cara gas dan belok.
  2. Saat lepas landas: cara naik-turun.
  3. Cincin latihan ketiga: boost.
  4. Zona pertama: tombol Aksi dan panel.
  5. Pertama kali dekat Piko bicara: cara bertanya ke Piko.
- Setiap langkah selesai sendiri saat pengunjung melakukannya. Bisa dilewati dan diulang dari Pengaturan.
- Papan tutorial di landasan juga berganti ikon sesuai perangkat.

## 6. Pengaturan (semua tersimpan, bawaan di `content/settings.defaults.json`)

| Bagian | Opsi |
| --- | --- |
| Umum | Bahasa (Otomatis/Indonesia/English), ulangi tutorial, reset progres |
| Dunia | Siang-malam waktu nyata (on/off), waktu manual (slider), cuaca nyata Medan (on/off), cuaca manual, tema UI ikut siang-malam, musim, kehidupan latar |
| Grafis | Kualitas (Auto/Low/Medium/High/Ultra), renderer (Auto/WebGPU/WebGL2), batas fps, bayangan, post-processing, depth of field, tampilkan fps |
| Audio | Slider: master, musik, mesin, angin, efek, ambient, suara Piko, UI. Stasiun radio. Bisu saat tab tersembunyi |
| Kontrol | Balik arah naik-turun, kemudi giroskop + sensitivitas, sisi joystick, tingkat bantuan (Penuh/Normal/Mati), getaran, guncangan kamera |
| Kamera | Mode bawaan (Pengejar/Kokpit/Sinematik), FOV melebar saat boost, garis kecepatan |
| Piko | Aktif, suara, subtitle, tingkat obrolan (Pendiam/Normal/Cerewet), catatan privasi |
| Aksesibilitas | Kurangi gerakan, UI kontras tinggi, teks besar, penanda ramah buta warna |
| Kanopi | Otomatis / Selalu terbuka / Selalu tertutup |

## 7. Layar kedatangan dan berbagi

- Globe kecil yang bisa diputar, dengan garis jejak terbang bercahaya.
- Statistik: jarak (km mainan), durasi, tabrakan, ketinggian maksimum, zona dan landmark dikunjungi, achievement baru.
- Gambar berbagi 1080×1920 dibuat di `<canvas>`: boarding pass + jejak terbang + jumlah stempel + "skyfolio" + URL.
  - HP: Web Share API dengan file gambar (jika didukung), fallback unduh.
  - Desktop: unduh PNG.
- Tombol Unduh CV dan Hubungi Aril.

## 8. Internasionalisasi (`src/i18n/`)

- Kunci bertipe (`t('hud.speed')`), file `id.ts` dan `en.ts` dengan struktur sama. Tes memastikan tidak ada kunci yang hilang.
- Konten dari `content/` sudah dua bahasa (`{ id, en }`).
- Bahasa bisa diganti kapan saja tanpa reload: UI, papan 3D, subtitle, suara Piko, dan bahasa permintaan AI ikut berubah.
- Format angka dan tanggal memakai `Intl` sesuai bahasa.

## 9. Mode Ringkas (`/ringkas/`)

- HTML statis yang dirender saat build dari `content/` (tanpa three.js). Ukuran halaman ≤ 150 KB.
- Isi: hero (foto, nama, tagline, kampus), tentang, proyek (kartu dengan gambar dan tautan), skill, perjalanan, sertifikat, kontak, unduh CV, tombol besar "Masuk ke dunia 3D".
- Tema terang dan gelap, tombol bahasa, meta tag SEO dan Open Graph lengkap, data terstruktur JSON-LD `Person`.
- Target Lighthouse: Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO 100.
- Halaman `/` juga menyertakan `<noscript>` dan fallback otomatis ke Mode Ringkas jika WebGL2 tidak tersedia sama sekali.

## 10. CV (`/cv/` dan PDF)

- Halaman HTML khusus cetak, satu sampai dua halaman A4, ramah ATS (teks asli, bukan gambar), dua bahasa (`/cv/?lang=id` dan `?lang=en`).
- Isi dari `content/`: nama, kontak, ringkasan (dari bio), pendidikan, pengalaman (PKL), organisasi (iTeens), kompetisi (LKS), proyek unggulan, skill (dikelompokkan, tanpa bar persentase), sertifikat.
- Field `needsConfirmation` tidak dicetak.
- `npm run build:cv` memakai Playwright (hanya di komputer Aril, bukan saat deploy) untuk mencetak ke `public/cv/Syahril-Maimubdy-CV-ID.pdf` dan `-EN.pdf`. Hasil PDF di-commit.
- Desain bersih dan profesional, dengan aksen warna `sun` dan `sky` yang tipis.

## 11. Aksesibilitas

- Semua tombol HTML punya label (`aria-label`), fokus terlihat, dan bisa dipakai dengan keyboard.
- Panel dan dialog menjebak fokus dengan benar dan bisa ditutup dengan Esc.
- Kontras teks minimal WCAG AA.
- Subtitle untuk semua suara bicara.
- "Kurangi gerakan" mematikan guncangan kamera, garis kecepatan, dan FOV melebar, serta memperlambat transisi.
