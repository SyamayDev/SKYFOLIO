# 12 — Referensi dan Pelajarannya

Referensi dipakai untuk **standar kualitas dan ide**, bukan untuk disalin.

| Referensi | Yang dipelajari | Yang dibuat beda di SKYFOLIO |
| --- | --- | --- |
| [bruno-simon.com](https://bruno-simon.com/) (versi 2025) dan [studi kasusnya di Awwwards](https://www.awwwards.com/brunos-portfolio-case-study.html) | Three.js WebGPU + TSL dengan fallback, fisika Rapier, audio Howler. Dunia terasa seperti mainan yang bisa ditabrak. Cuaca, siang-malam, dan musim yang sama untuk semua pengunjung. Fitur sosial asinkron (Whispers 30 pesan dengan bendera dan moderasi, counter global, leaderboard harian 10 besar). Achievement yang membuka skin. Audio spasial dan suara kendaraan berlapis. UI dibuat sebagai objek 3D. Preset mobile yang mematikan efek berat. Kontrol keyboard, sentuh, dan gamepad. | Planet bulat dengan gravitasi ke pusat, pesawat (bukan mobil), perjalanan sampai Bulan, AI co-pilot, dan konten dari folder. |
| [GlobeFly / Tiny Skies (repo)](https://github.com/dannylimanseta/tinyskies) dan [tinyskies.vercel.app](https://tinyskies.vercel.app/) | Terbang mengelilingi bola dengan matematika quaternion tanpa glitch di kutub. Kontrol WASD + Shift/Ctrl. Multiplayer relay dengan prediksi klien. Nuansa eksplorasi santai dengan beberapa kendaraan. | Ditambah fisika rigid body, dunia penuh konten, dan multiplayer yang sengaja dibuat asinkron. |
| [Messenger oleh Abeto](https://messenger.abeto.co/) | Planet mungil yang bisa dikelilingi dalam sekitar 30 detik, tetap mulus di HP, dibuat dengan Three.js tanpa game engine, dengan aset terkompresi supaya ukurannya kecil. Pemain lain hadir lewat emote. Suasana santai dengan musik yang tenang. | Skala lebih besar (Bumi nyata), terbang, dan fokus portofolio. Pelajari cara mereka membuat dunia bola terasa nyaman dan tidak bikin pusing. |
| [Slow Roads](https://slowroads.io/) dan [studi kasus web.dev](https://web.dev/case-studies/slow-roads) | Pemandangan prosedural di browser, rasa "zen", dan pengaturan audio yang sangat rinci (slider per kanal: master, ambient, angin, mesin, rem, ban, tabrakan). Tombol reset, ganti kamera, dan bisu yang sederhana. | Menu Pengaturan audio dan kamera SKYFOLIO meniru kerapian ini. |
| [Life Island](https://island.digiscalability.com) | Portofolio planet bola di Three.js yang memakai AI (NPC berbasis LLM). | Piko adalah satu karakter yang fokus memandu dan menerbangkan pesawat, dengan fallback offline. |
| [Portofolio Jordan Delcros](https://jordan-delcros.com/) (pembuat Coastal World) | Portofolio 100% WebGL dengan kerapian visual tinggi. | Standar kebersihan visual dan transisi. |
| [Explore Primland](https://explore.ownprimland.com) | Pengalaman terbang melintasi lanskap yang sinematik. | Standar kamera sinematik untuk Mode Rekruter. |
| [Dokumentasi three.js](https://threejs.org/docs/) dan [manual WebGPURenderer](https://threejs.org/manual/en/webgpurenderer) | Impor dari `three/webgpu` dan `three/tsl`, fallback WebGL2 otomatis, post-processing berbasis node. Nama kelas berubah di beberapa rilis 2026. Mulai r183, three.js menyediakan `llms.txt` resmi untuk alat AI. | Selalu cocokkan dengan versi yang terpasang. |
| Game terbang klasik (seri game terbang arcade, game mobile berbasis kemiringan) | Kontrol yang memaafkan, rasa kecepatan, auto-level, dan pendaratan yang memuaskan. | Diterapkan lewat bantuan arcade di `docs/03`. |

## Catatan teknologi 2026

- WebGPU sudah tersedia di browser utama (Safari 26 menambahkan dukungan). Firefox belum punya WebGPU stabil di semua platform (misalnya Android dan Linux), jadi fallback WebGL2 tetap wajib diuji.
- Tier gratis API AI sering berubah. Selalu cek dokumentasi resmi saat implementasi, dan jangan pernah menulis angka batas kuota di kode.
