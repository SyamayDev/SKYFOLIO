---
id: rilstaurant2
title: Rilstaurant2
summary:
  id: Rilstaurant - CodeIgniter 3 sample restaurant app
  en: null
year: 2025
role:
  id: null
  en: null
tech: [HTML]
links:
  demo: null
  repo: https://github.com/SyamayDev/rilstaurant2
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
  pushedAt: 2025-11-09
  archived: false
needsConfirmation: [summary, role]
---

## Cerita (ID)


## Story (EN)

## README (sumber)

<!-- Salinan README dari GitHub untuk bahan menulis cerita. Bagian ini diabaikan situs. -->

Rilstaurant - CodeIgniter 3 sample restaurant app

Setup

1. Copy this project into your webserver root (e.g., c:/laragon/www/ or htdocs in XAMPP).
2. Import `restoran_db.sql` into MySQL (phpMyAdmin) to create `restoran_db` and sample data.
3. Edit `application/config/database.php` if your DB credentials differ (default username=root with empty password).
4. Ensure `base_url` is correct or leave config to auto-detect (it is auto-detected in `application/config/config.php`).
5. Start the webserver and visit http://localhost/rilstaurant/ (or adjust according to your setup).

Admin

- Login: /admin
- Default admin credentials: username: admin, password: admin123

Notes

- Uploaded images are stored in `assets/uploads/`.
- If images aren't visible, ensure PHP has write permission to the uploads folder.
- This is a starter project; for production use, improve password storage (use password_hash) and harden file uploads.

