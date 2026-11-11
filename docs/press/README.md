# Materi submit SKYFOLIO (Awwwards, CSS Design Awards, dan sejenisnya)

Isi folder ini:
- `shots/`: 7 screenshot (1440×900 desktop dan 390×844 HP), dibuat dari situs sungguhan.
- Deskripsi proyek dua bahasa.
- Rencana rekaman video 30–60 detik.

Alamat situs: https://skyfolio-phi.vercel.app

## Deskripsi singkat (untuk kolom "Short description", ±150 karakter)

**ID:** Portofolio 3D yang bisa diterbangkan: pesawat mainan berfisika nyata, Bumi low-poly yang hidup, dan co-pilot cilik Piko yang bisa diajak ngobrol.

**EN:** A portfolio you can fly: a physics-driven toy plane, a living low-poly Earth, and Piko, a tiny co-pilot you can chat with.

## Deskripsi panjang

**ID**

SKYFOLIO adalah portofolio interaktif Syahril Maimubdy (Aril), mahasiswa S1 Ilmu Komputer Universitas Sumatera Utara dari Medan. Pengunjung naik pesawat mainan PK-ARL di bandara Medan, lalu terbang bebas mengelilingi Bumi low-poly yang cerah. Setiap pulau, gunung, dan lapisan langit menyimpan satu bagian cerita Aril: proyek, skill, perjalanan, kontak, sampai pesan di Bulan.

Semua gerakan adalah fisika sungguhan (Rapier) dengan gravitasi ke pusat planet. Siang-malam dan cuaca Medan diambil dari dunia nyata, dan pesawat bisa menembus awan, keluar atmosfer dengan kit roket, mengorbit, lalu mendarat di Bulan tanpa satu pun layar loading. Musiknya dikomposisi secara prosedural dengan rasa Sunda yang ceria dan berganti mengikuti zona.

Piko, co-pilot cilik, menjawab pertanyaan tentang Aril dan bisa langsung menerbangkan pesawat ke jawabannya. Untuk rekruter yang sibuk tersedia Mode Rekruter (tur 60 detik), Mode Ringkas (HTML biasa), dan CV PDF. Semua isi portofolio diambil dari folder konten, sehingga menambah proyek tidak perlu menyentuh kode 3D.

Teknologi: three.js (WebGPU dengan fallback WebGL2, shader TSL), Rapier, Svelte 5, Web Audio, Vercel Functions, Upstash. Biaya: nol rupiah.

**EN**

SKYFOLIO is the interactive portfolio of Syahril Maimubdy (Aril), a Computer Science undergraduate at Universitas Sumatera Utara in Medan, Indonesia. Visitors board the toy plane PK-ARL at Medan airport and fly freely around a bright low-poly Earth. Every island, mountain, and layer of sky holds a piece of Aril's story: projects, skills, journey, contact, even a message on the Moon.

Everything moves with real physics (Rapier) and gravity toward the planet's center. Day, night, and Medan's weather follow the real world, and the plane can punch through clouds, leave the atmosphere on a rocket kit, orbit, and land on the Moon without a single loading screen. The procedurally composed soundtrack carries a cheerful Sundanese flavor and changes with each zone.

Piko, a tiny co-pilot, answers questions about Aril and can fly the plane straight to the answer. Busy recruiters get Recruiter Mode (a 60-second tour), a plain-HTML Quick View, and a PDF résumé. All portfolio content lives in a content folder, so adding a project never touches the 3D code.

Stack: three.js (WebGPU with WebGL2 fallback, TSL shaders), Rapier, Svelte 5, Web Audio, Vercel Functions, Upstash. Cost: zero.

## Rencana video 30–60 detik (1920×1080, 60 fps, rekam dengan OBS di Chrome)

Siapkan sebelum merekam: Pengaturan → Grafis **Ultra**, sembunyikan tutorial, Musik aktif. Untuk adegan senja, matikan "Siang-malam waktu nyata" lalu set jam ke 17.50.

| Detik | Adegan | Catatan |
| --- | --- | --- |
| 0–4 | Layar boarding pass → tekan **Naik Pesawat** | Kesan pertama: kartu, nama penumpang, stempel |
| 4–10 | Lepas landas melewati huruf SYAHRIL yang berhamburan | Kamera pengejar; tabrak huruf sedikit supaya fisikanya terlihat |
| 10–16 | Menembus awan, lalu menukik ke Kepulauan Proyek | Tunjukkan papan proyek dan diorama |
| 16–22 | Buka obrolan → ketik "Bawa aku ke proyek terbaikmu" | Autopilot berbelok sendiri, panel proyek terbuka |
| 22–30 | Senja di Danau Toba, lampion naik | Ganti jam ke 17.50 sebelum adegan ini |
| 30–40 | Tahan Boost ke atas: kit roket, keluar atmosfer, orbit | Atau ketik ke Piko: "bawa aku ke orbit" |
| 40–50 | Mendarat pelan di Bulan, Bumi terlihat di langit | Pesan Bulan muncul. Lepas Boost lebih awal supaya mendarat mulus |
| 50–60 | Layar kedatangan + kartu bagikan, logo SKYFOLIO | Tutup dengan alamat skyfolio-phi.vercel.app |

Ekspor: H.264, 1080p, ±20 Mbps, maksimal 60 detik. Untuk Instagram, potong versi 9:16 dari adegan 4–40.

## Screenshot

`shots/` berisi 7 gambar (diambil otomatis dari situs sungguhan). Untuk gambar Bulan, ambil sendiri saat mendarat mulus (lebih bagus dari tangkapan otomatis):

1. `01-boarding.png`: boarding pass (kesan pertama)
2. `02-runway.png`: bandara Medan dan huruf SYAHRIL
3. `03-islands.png`: Kepulauan Proyek
4. `04-dusk.png`: senja
5. `05-night.png`: malam dengan lampu kota
6. `06-space.png`: orbit
7. `08-mobile.png`: tampilan HP (390×844)
