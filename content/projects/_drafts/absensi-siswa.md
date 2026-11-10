---
id: absensi-siswa
title: Absensi Siswa
summary:
  id: Sebuah aplikasi web sederhana untuk mengelola absensi siswa, dibangun dengan CodeIgniter 3.
  en: null
year: 2026
role:
  id: null
  en: null
tech: [HTML]
links:
  demo: null
  repo: https://github.com/SyamayDev/absensi-siswa
media:
  cover: null
  gallery: []
featured: false
featuredRank: null
island:
  diorama: generic
  lat: null
  lon: null
  size: small
github:
  stars: 0
  pushedAt: 2026-03-11
  archived: false
needsConfirmation: [summary, role]
---

## Cerita (ID)


## Story (EN)

## README (sumber)

<!-- Salinan README dari GitHub untuk bahan menulis cerita. Bagian ini diabaikan situs. -->

<h1 align="center">✅ Absensi Siswa</h1>

<p align="center">
  <img src="https://img.shields.io/badge/CodeIgniter-DD4814?style=for-the-badge&logo=codeigniter&logoColor=white"/>
  <img src="https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white"/>
  <img src="https://img.shields.io/badge/PHP-777BB4?style=for-the-badge&logo=php&logoColor=white"/>
  <img src="https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white"/>
</p>

<p align="center">
  Sebuah aplikasi web sederhana untuk mengelola absensi siswa, dibangun dengan CodeIgniter 3.
</p>

<hr>

## 📖 Deskripsi Proyek

Aplikasi Absensi Siswa adalah sistem berbasis web yang dirancang untuk memudahkan para guru atau admin sekolah dalam mencatat dan memantau kehadiran siswa setiap hari. Aplikasi ini dibangun menggunakan **Framework CodeIgniter 3** dengan arsitektur **MVC (Model-View-Controller)** dan antarmuka yang responsif berkat **Bootstrap 5**.

Tema utama aplikasi ini adalah hijau, memberikan kesan yang segar dan profesional.

## ✨ Fitur Utama

-   **Login Admin:** Sistem otentikasi yang aman untuk admin (password di-hash menggunakan MD5).
-   **Dashboard Utama:** Halaman sentral untuk semua aktivitas absensi.
-   **Filter Kelas:** Memungkinkan admin untuk melihat siswa berdasarkan kelas tertentu melalui navigasi horizontal yang intuitif.
-   **Filter Tanggal:** Memfilter data absensi berdasarkan rentang tanggal (dari-sampai).
-   **Tabel Absensi:** Menampilkan daftar siswa beserta status kehadiran mereka.
-   **Input Absensi Interaktif:** Admin dapat dengan mudah mengubah status kehadiran siswa (Hadir, Sakit, Izin, Alpa) langsung dari tabel menggunakan radio button.
-   **Penyimpanan Data:** Perubahan status absensi dapat disimpan ke database dengan satu kali klik.
-   **Cetak Laporan:** Fitur untuk mencetak halaman data absensi yang sedang ditampilkan.
-   **Desain Responsif:** Tampilan yang optimal di berbagai perangkat, baik desktop maupun mobile.

## 🔐 Informasi Login Default

-   **Username:** `admin`
-   **Password:** `admin123`

## 🛠️ Teknologi yang Digunakan

-   PHP (CodeIgniter 3)
-   MySQL (MariaDB)
-   Bootstrap 5
-   HTML5 & CSS3
-   JavaScript

## 🚀 Cara Instalasi

1.  **Clone atau Unduh Repository**
    Pindahkan seluruh file proyek ke dalam folder server web Anda (misalnya: `C:/xampp/htdocs/`).

2.  **Buat Database**
    Buat database baru di phpMyAdmin dengan nama `absensi_siswa`.

3.  **Import Database**
    Impor file `database.sql` yang ada di root proyek ke dalam database `absensi_siswa` yang baru saja Anda buat.

4.  **Konfigurasi Database**
    Buka file `application/config/database.php` dan sesuaikan pengaturan berikut jika diperlukan (pengaturan default sudah disesuaikan untuk XAMPP standar):
    ```php
    'username' => 'root',
    'password' => '',
    'database' => 'absensi_siswa',
    ```

5.  **Konfigurasi Base URL**
    Buka file `application/config/config.php` dan pastikan `base_url` sesuai dengan lokasi proyek Anda:
    ```php
    $config['base_url'] = 'http://localhost/absensi-siswa/';
    ```

6.  **Jalankan Aplikasi**
    Buka browser Anda dan akses URL: `http://localhost/absensi-siswa/`

## 🗂️ Struktur Folder

```
absensi-siswa/
│
├── application/
│   ├── controllers/
│   │   ├── Auth.php
│   │   └── Dashboard.php
│   │
│   ├── models/
│   │   ├── Auth_model.php
│   │   ├── Absensi_model.php
│   │   ├── Kelas_model.php
│   │   └── Siswa_model.php
│   │
│   └── views/
│       ├── login.php
│       └── dashboard.php
│
├── assets/
│   ├── css/
│   │   └── style.css
│   └── images/
│       ├── bg_login.webp
│       └── logo.webp
│
├── database.sql
└── README.md
```
