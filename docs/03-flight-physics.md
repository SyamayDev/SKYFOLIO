# 03 — Fisika, Rasa Terbang, Kamera, dan Kontrol

Rasa terbang adalah jantung SKYFOLIO. Targetnya: **semudah mainan untuk pemula, sedalam game untuk yang penasaran.** Semua angka di bawah adalah titik awal. Simpan di `src/config/flight.ts`, buka di panel debug, lalu setel sampai terasa enak di HP dan keyboard.

## 1. Dunia fisika (`src/physics/PhysicsWorld.ts`)

- `await RAPIER.init()` sebelum apa pun. Tampilkan sebagai item checklist pra-terbang.
- `world.gravity = {x:0, y:0, z:0}`. Gravitasi diberikan manual tiap langkah.
- Langkah tetap 1/60 detik dengan akumulator, maksimal 4 sub-langkah per frame (sisanya dibuang supaya tidak "spiral of death"). Posisi visual diinterpolasi antara dua state fisika.
- Event tabrakan memakai `EventQueue` dengan contact force events untuk benda yang perlu bunyi dan efek.
- Benda yang jauh dari pesawat (> 120 unit) dibuat tidur. Chunk collider daratan yang jauh dinonaktifkan.

## 2. Gravitasi radial (`RadialGravity.ts`)

```text
up(p)   = normalize(p - pusatPlanet)
g(r)    = G0 × (PLANET_RADIUS / r)²       // melemah dengan ketinggian
F       = massa × g(r) × (−up)
```

- `G0 = 14` unit/s² (sedikit lebih kuat dari 9,8 supaya terasa "snappy" seperti mainan).
- **Bulan** punya sphere of influence (SOI) radius 350 unit dari pusat Bulan. Di dalam SOI, gravitasi menuju pusat Bulan dengan `G0_MOON = 3` dan gravitasi Bumi diabaikan.
- Benda instanced yang tidur tidak menerima gaya, jadi beban CPU tetap kecil.

## 3. Badan pesawat (`Plane.ts`)

| Properti | Nilai awal | Catatan |
| --- | --- | --- |
| Tipe | Dynamic rigid body, CCD aktif | CCD penting karena kecepatan tinggi |
| Massa | 1,0 | Semua gaya dalam satuan ini |
| Collider | Gabungan: kapsul badan, dua box tipis sayap atas-bawah, box ekor | Gesekan 0,6, restitusi 0,25 |
| Pusat massa | 0,3 unit di depan tengah | Membuat pesawat stabil saat meluncur |
| Linear damping | 0,02 | Hambatan udara utama dihitung di model terbang |
| Angular damping | 1,5 | |
| Roda | Bukan collider. Tiga raycast suspensi (dua roda utama, satu roda ekor) | Lihat bagian 5 |

## 4. Model terbang (`FlightModel.ts`)

Dijalankan setiap langkah fisika sebelum `world.step()`.

### 4.1 Besaran dasar

```text
f, u_b, r_b      = sumbu depan, atas, kanan pesawat (dari rotasi body)
up               = atas lokal planet di posisi pesawat
v_rel            = kecepatan − angin(posisi)      // angin dari sistem cuaca
s                = |v_rel|                         // airspeed
ρ(alt)           = exp(−alt / 90)                  // kepadatan udara, alt = r − PLANET_RADIUS
α                = sudut serang = atan2(−dot(v_rel, u_b), dot(v_rel, f))
```

### 4.2 Gaya

```text
Dorong      T = throttle × T_MAX × ρ × (boost ? BOOST_MULT : 1)        arah f
Angkat      L = ½ × ρ × s² × C_L(α) × S                                  arah normalize(cross(v_rel, r_b))
Hambatan    D = ½ × ρ × s² × (C_D0 + K_I × C_L²) × S                     arah −v_rel
C_L(α)      = C_L0 + C_LA × α, dibatasi di ±C_L_MAX
Stall       jika α > α_STALL atau s < STALL_SPEED:
            C_L × 0,45, torsi hidung turun, getaran "buffet" (kamera + suara + haptic)
Ground effect: jika jarak ke tanah < 3 unit, angkat × (1 + 0,4 × (1 − jarak/3)) → pendaratan lembut
```

### 4.3 Bantuan arcade (bisa diatur di Pengaturan: Penuh / Normal / Mati)

1. **Penjajaran kecepatan**: kecepatan pelan-pelan diarahkan ke sumbu depan, `v ← slerp(v, f × |v|, ALIGN × dt × ρ)`. Ini membuat belokan terasa "nurut" seperti game, bukan seperti simulator.
2. **Auto-level**: tanpa input roll, torsi lembut mengembalikan sayap sejajar horizon lokal. Pada level Penuh, hidung juga perlahan kembali ke horizon.
3. **Belokan terkoordinasi**: kemiringan sayap otomatis menghasilkan yaw, `ω_yaw = G0 × tan(bank) / max(s, 8)`, dibatasi 45°/s.
4. **Auto-throttle**: tanpa input gas, throttle menuju nilai jelajah (`CRUISE_THROTTLE`). Shift = boost, Ctrl/B = rem udara.
5. **Penghindar tanah** (hanya Penuh): jika diprediksi menabrak tanah dalam 1,2 detik dan tidak sedang mendarat, hidung diangkat lembut.

### 4.4 Kontrol rotasi (pengendali laju sudut)

- Input dipetakan ke **laju sudut target**: pitch maksimal 95°/s, roll 170°/s, yaw 40°/s.
- Torsi = `I × (ω_target − ω_sekarang) × K_RATE`.
- Otoritas kontrol diskalakan dengan kecepatan: `clamp(s / CRUISE_SPEED, 0,3, 1,2)`. Pesawat lambat terasa berat, pesawat cepat terasa lincah.
- Input dihaluskan secara eksponensial (τ = 0,08 detik keyboard, 0,05 detik joystick/gamepad).

### 4.5 Manuver spesial

- **Barrel roll** (Space di udara): roll 360° dalam 0,7 detik dengan sedikit dorongan ke atas, jejak asap spiral, bunyi "whoosh", Piko bersorak. Cooldown 1 detik.
- **Loop** terjadi alami dari pitch penuh. Lingkaran penuh pertama memberi achievement.
- **Asap warna** (angka 1–5): jejak partikel berwarna, warnanya bisa dibuka dengan achievement.

### 4.6 Nilai awal `config/flight.ts`

| Nama | Nilai | Nama | Nilai |
| --- | --- | --- | --- |
| `T_MAX` | 46 | `BOOST_MULT` | 1,9 |
| `S` (luas sayap) | 1,0 | `C_L0` | 0,25 |
| `C_LA` | 3,2 per rad | `C_L_MAX` | 1,4 |
| `C_D0` | 0,028 | `K_I` | 0,06 |
| `α_STALL` | 16° | `STALL_SPEED` | 14 |
| `CRUISE_SPEED` | 36 | `BOOST_SPEED` (target) | 70 |
| `CRUISE_THROTTLE` | 0,55 | `ALIGN` | 2,2 |
| `K_RATE` | 6 | `TAKEOFF_SPEED` | 22 |

Uji unit wajib (Vitest + Rapier headless): penerbangan lurus di kecepatan jelajah tetap di ketinggian ±2 unit selama 20 detik; stall terjadi di bawah `STALL_SPEED`; radius belok dengan bank 45° di kecepatan jelajah antara 25 dan 45 unit.

## 5. Mode darat (`GroundMode.ts`)

Aktif jika minimal satu roda menyentuh tanah.

- **Suspensi raycast** per roda (panjang istirahat 0,6 unit), arah `−u_b`:
  `F = K_SPRING × kompresi − C_DAMP × laju_kompresi`, dengan `K_SPRING = 60`, `C_DAMP = 7`. Gaya diberikan di titik roda.
- **Gesekan samping** kuat untuk menghapus selip ke samping. Hambatan gulir kecil.
- **Kemudi roda ekor**: A/D membelokkan di kecepatan rendah, berkurang saat cepat.
- **Gas**: dorongan baling-baling biasa. Pesawat lepas landas sendiri saat gaya angkat > berat (sekitar `TAKEOFF_SPEED`).
- **Rem**: Ctrl/B atau tombol rem.
- **Lompat** (Space di darat): impuls ke atas + sedikit pitch, suspensi terpental, bunyi pegas. Ini versi kita dari lompatan mobil Bruno.
- **Klakson** (H): bunyi klakson kecil yang lucu, burung di dekatnya kabur.
- **Visual**: roda berputar sesuai jarak tempuh, kaki roda memendek sesuai kompresi, debu atau rumput beterbangan saat melaju cepat di tanah.
- **Pendaratan**: kecepatan vertikal < 3 dan sayap hampir datar → "Pendaratan mulus!" (bunyi ban, sedikit asap, stempel jika di pulau proyek). Pendaratan keras → pesawat memantul dan Piko berteriak lucu.

## 6. Tabrakan (`CrashFeedback.ts`)

| Kecepatan tumbukan normal | Efek |
| --- | --- |
| < 6 | Bunyi tumbukan kecil sesuai material, sedikit partikel |
| 6–12 | Guncangan kamera sedang, percikan, haptic pendek |
| 12–25 | Pesawat terpental berputar, asap, bintang kartun di sekitar kepala Piko, topi Piko terbang lalu ditangkap |
| > 25 | Semua efek di atas lebih besar, baling-baling "bengkok" sebentar (visual 1,5 detik), lalu bantuan tegak otomatis |

- Tidak ada game over dan tidak ada nyawa. Setelah 1,5 detik terbalik di tanah, bantuan tegak otomatis memutar pesawat berdiri.
- Benda yang ditabrak menerima impuls dari Rapier secara alami. Bunyinya dipilih dari material benda (kayu, logam, kain, balon, batu).
- `R` atau tombol "Aku nyangkut" → respawn ke landasan terdekat dengan fade 0,4 detik, posisi sejajar landasan.

## 7. Air (`WaterMode.ts`)

- Di bawah permukaan laut: gaya apung sebanding kedalaman tercelup, hambatan air besar, dan pesawat cenderung tegak.
- Menyentuh air dengan cepat → cipratan besar, bunyi "byur", pantulan.
- Semua skin bisa mengapung dan meluncur pelan di air. Skin **amfibi** bisa lepas landas dari air dengan normal; skin lain butuh boost.
- Dorongan baling-baling di air dikurangi 60%.

## 8. Menuju angkasa (`OrbitMode.ts`)

- Kepadatan udara `ρ` turun dengan ketinggian, jadi gaya angkat dan dorongan baling-baling ikut melemah secara alami.
- Saat `r > SPACE_START - 30`, **kit roket** muncul: dua pendorong kecil keluar dari bawah sayap dengan animasi mekanis dan bunyi "klik-whirr". Api roket biru-oranye.
- Di atas `SPACE_START`:
  - Kontrol: pitch/yaw memutar pesawat, gas = dorongan roket ke depan, rem = dorongan mundur.
  - Bantuan RCS meredam putaran supaya tidak berputar liar.
  - **Bantuan orbit**: tanpa input gas, kecepatan tangensial dikoreksi pelan supaya pesawat mengitari planet di ketinggian saat ini. Pengunjung bisa santai menikmati pemandangan.
  - Indikator HUD: ketinggian, arah ke Bumi, arah ke Bulan.
- **Masuk kembali**: menukik ke atmosfer dengan cepat memunculkan efek panas (cahaya oranye di hidung, partikel, guncangan, bunyi gemuruh). Kit roket masuk kembali saat `ρ` cukup.

## 9. Bulan

- Di dalam SOI Bulan, gravitasi Bulan berlaku (`G0_MOON = 3`).
- Perjalanan Bumi ke Bulan dengan boost ± 20 detik. Setelah pertama kali mencapai orbit, Piko menawarkan "Mau Piko antar ke Bulan?" (autopilot).
- **Pendaratan mulus**: kecepatan < 4, normal pesawat sejajar normal permukaan > 0,9, di landasan bercahaya → pesan rahasia + achievement + skin UFO.
- Debu Bulan menyembur pelan dalam gerak lambat saat mendarat.

## 10. Kamera (`src/camera/CameraRig.ts`)

| Mode | Perilaku |
| --- | --- |
| **Chase** (bawaan) | Posisi target = `pos − f × jarak + up_lokal × tinggi`, dihaluskan dengan pegas teredam kritis (smoothDamp). Melihat sedikit ke depan arah kecepatan. Kamera ikut miring 30% dari roll pesawat. FOV 60° → 72° saat boost. Garis kecepatan di layar saat > 55 unit/s |
| **Kokpit** | Dari kursi Aril. Instrumen hidup: altimeter, speedometer, kompas, horizon buatan, indikator bahan bakar lucu yang selalu penuh. Hidung pesawat dan baling-baling terlihat |
| **Sinematik** | Kamera mengitari pesawat pelan dengan depth of field. Dipakai di tur dan saat idle 20 detik |
| **Foto** | Waktu dibekukan (fisika dijeda), kamera bebas dalam radius 30 unit, filter warna, sembunyikan HUD, simpan gambar |
| **Orbit** | Di angkasa kamera mundur lebih jauh supaya planet dan Bulan terlihat |

- Anti tembus: raycast (three-mesh-bvh) dari pesawat ke kamera; kamera dimajukan jika terhalang dan dijaga minimal 1,5 unit di atas tanah.
- Geser kamera: drag mouse kiri di desktop atau dua jari di HP. Kamera kembali ke belakang pesawat setelah 2 detik tanpa input.
- Guncangan kamera memakai noise, dengan amplitudo dari sistem "trauma" (bertambah saat tabrakan, berkurang perlahan). Bisa dimatikan di Pengaturan.

## 11. Input (`src/core/Input.ts`)

Semua sumber input dipetakan ke **aksi** yang sama: `pitch`, `roll`, `yaw`, `throttle`, `boost`, `brake`, `jump`, `interact`, `map`, `respawn`, `horn`, `smoke1..5`, `lantern`, `camera`, `photo`, `talk`, `mute`, `pause`.

| Aksi | Keyboard | Gamepad (standard mapping) | HP / tablet |
| --- | --- | --- | --- |
| Naik-turun, belok | W/S + A/D atau panah | Stik kiri | Joystick virtual atau giroskop |
| Gas / afterburner | Shift | RT | Tombol boost besar |
| Rem | Ctrl atau B | LT | Tombol rem |
| Lompat / barrel roll | Space | A | Ketuk dua kali di sisi kanan layar |
| Interaksi | Enter atau E | X | Tombol aksi kontekstual |
| Peta | M | Select / View | Ikon peta |
| Respawn | R | Y | Menu jeda |
| Klakson | H | B | Ikon klakson |
| Asap warna | 1–5 | D-pad | Menu asap |
| Lampion | T | — | Ikon lampion (di Lembah Lampion) |
| Kamera / kokpit | C | RB | Ikon kamera |
| Mode foto | P | — | Ikon foto |
| Bicara ke Piko | Tahan V | LB | Tahan ikon mikrofon |
| Bisu | L | — | Ikon suara |
| Jeda | Esc | Start / Menu | Ikon jeda |

**Gamepad**: deadzone 0,15 dengan kurva respons kuadrat. Getaran lewat `vibrationActuator` jika tersedia.

**Sentuh** (dirancang untuk jempol):
- Joystick dinamis: muncul di tempat jempol kiri menyentuh (area 45% kiri layar). Sumbu Y = pitch (bisa dibalik di Pengaturan), sumbu X = roll.
- Sisi kanan: tombol **Boost** besar, **Rem** sedang, **Aksi** kontekstual (labelnya berubah: "Lihat", "Jatuhkan paket", "Lepas lampion", "Mendarat").
- Geser satu jari di area kanan yang kosong = memutar kamera.
- Portrait: joystick di kiri bawah, tombol di kanan bawah, HUD diringkas.
- Semua tombol minimal 56×56 px, dengan area aman untuk notch dan home indicator (`env(safe-area-inset-*)`).

**Giroskop** (opsional, mati secara bawaan): miringkan HP kiri/kanan = roll, maju/mundur = pitch. Kalibrasi posisi netral saat diaktifkan. Di iOS, `DeviceOrientationEvent.requestPermission()` harus dipanggil dari ketukan pengguna.

**Getaran HP**: `navigator.vibrate` hanya ada di Android. Deteksi dulu, dan jangan menganggap iOS bisa bergetar.

## 12. Autopilot (`src/ai/Autopilot.ts`)

Dipakai oleh Piko, Mode Rekruter, dan tombol "Antar ke sini" di peta.

1. Target = posisi POI zona + ketinggian pendekatan (20 unit di atas permukaan).
2. Arah yang diinginkan = arah lingkaran besar (great circle) dari posisi sekarang ke target, diproyeksikan ke bidang tangen.
3. Pengendali PID:
   - kesalahan arah → perintah roll,
   - kesalahan ketinggian → perintah pitch,
   - kesalahan kecepatan → throttle.
4. Penghindaran: sampling tinggi tanah di 3 titik di depan (20, 40, 60 unit). Jika ada yang lebih tinggi dari jalur, naik lebih dulu.
5. Tiba: mengitari POI dengan radius 18 unit, lalu membuka panel zona.
6. Input pemain di atas deadzone → autopilot batal dengan toast "Kemudi diambil alih!".
7. Autopilot memakai **input yang sama** dengan pemain (bukan memindahkan posisi), jadi fisikanya tetap jujur.

## 13. Respawn dan keamanan

- Titik respawn: bandara Medan, landasan setiap pulau proyek, landasan Bulan.
- Jika pesawat jatuh ke bawah permukaan planet (bug collider) atau keluar jauh dari sistem (> 3.500 unit), respawn otomatis.
- Simpan posisi terakhir yang aman tiap 2 detik untuk respawn cepat.
