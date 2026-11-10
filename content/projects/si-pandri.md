---
id: si-pandri
title: SI-PANDRI
fullTitle:
  id: Sistem Pengelolaan Parfait Laundry
  en: Parfait Laundry Management System
summary:
  id: 'Proyek UTS Dasar Pemrograman berbahasa Free Pascal, lengkap dengan game pendamping "SI-PANDRI: Misi Laundry Beres!".'
  en: 'An Intro to Programming midterm project written in Free Pascal, with a companion game, "SI-PANDRI: Misi Laundry Beres!".'
year: 2026
role:
  id: null            # konfirmasi peran Aril di Tim SEPAKAT
  en: null
team: Tim SEPAKAT
course:
  id: Dasar Pemrograman, Universitas Sumatera Utara
  en: Intro to Programming, Universitas Sumatera Utara
tech: [Free Pascal, HTML, CSS, JavaScript]
links:
  demo: https://syamaydev.github.io/SI_PANDRI_OP/game/
  repo: https://github.com/SyamayDev/SI_PANDRI_OP
media:
  cover: media/projects/si-pandri/cover.jpg
  gallery: []
featured: true
featuredRank: 2
tags: [pascal, cli, game, campus]
island:
  diorama: laundry    # mesin cuci raksasa berputar, jemuran yang bisa ditabrak
  lat: -15.0
  lon: 92.0
  size: large
minigame:
  id: misi-laundry-beres
  title: Misi Laundry Beres
  description:
    id: Jatuhkan karung cucian dari pesawat tepat ke mesin cuci raksasa sebelum waktu habis.
    en: Drop laundry bags from your plane straight into the giant washing machine before time runs out.
needsConfirmation: [role, team-members]
---

## Cerita (ID)

SI-PANDRI adalah sistem pengelolaan laundry "Parfait Laundry" yang dibuat Tim SEPAKAT untuk UTS mata kuliah Dasar Pemrograman (Ilmu Komputer, Fasilkom-TI USU), menggunakan **Free Pascal**.

Aplikasi *command-line* ini menangani alur laundry dari awal sampai akhir: registrasi dan login pelanggan (dibatasi 3 percobaan), pemesanan, penimbangan berat, perhitungan biaya otomatis (berat × tarif per kg), pelacakan status cucian bertahap, pembayaran, penyiapan pesan WhatsApp, sampai laporan transaksi. Semua data disimpan permanen di file `.dat`.

Untuk presentasi, tim membuat game web berbasis narasi **"SI-PANDRI: Misi Laundry Beres!"**: 9 babak bersama Bu Ratna, pemilik Parfait Laundry, dengan XP dan achievement, dibangun dengan HTML, CSS, dan JavaScript murni tanpa library. README mencatat 1.566 baris kode Pascal, 60 prosedur dan fungsi, dan 131 uji otomatis yang lulus.

## Story (EN)

SI-PANDRI is a laundry management system for "Parfait Laundry", built by Team SEPAKAT in **Free Pascal** for the Intro to Programming midterm (Computer Science, Fasilkom-TI USU).

The command-line app covers the whole laundry flow: customer sign-up and login (limited to 3 attempts), orders, weighing, automatic pricing (weight × rate per kg), step-by-step laundry status tracking, payments, ready-to-send WhatsApp messages, and transaction reports. All data is stored in `.dat` files.

For the presentation, the team built a narrative web game, **"SI-PANDRI: Misi Laundry Beres!"**: 9 chapters with Bu Ratna, the laundry owner, plus XP and achievements, written in plain HTML, CSS, and JavaScript with no libraries. The README lists 1,566 lines of Pascal, 60 procedures and functions, and 131 passing automated tests.
