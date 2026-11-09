# Folder proyek

Satu file `.md` = satu pulau di Kepulauan Proyek.

- Bagian atas (di antara `---`) adalah data. Bagian bawah adalah cerita proyek dalam dua bahasa.
- File yang namanya diawali `_` diabaikan oleh situs (misalnya file ini).
- `scripts/sync-github.ts` menaruh draf proyek dari repo GitHub publik ke `content/projects/_drafts/`. Draf tidak tampil di situs sampai dipindahkan ke folder ini (atau disetujui lewat Hangar).
- Gambar proyek ditaruh di `content/media/projects/<id>/`. Format bebas (jpg/png/webp); pipeline build otomatis membuat versi webp dan avif yang kecil.
- `island.lat` dan `island.lon` boleh dikosongkan (`null`). Sistem penempatan otomatis akan mencari tempat kosong di Kepulauan Proyek.
- `island.diorama` memilih preset: `compass`, `laundry`, `books`, `robot`, `shop`, `school`, `rocket`, `garden`, `lab`, `stage`, `generic`. Atau isi path ke file `.glb` sendiri.

Field bertanda `needsConfirmation` tampil sebagai peringatan kuning di Hangar. Nilainya disembunyikan di situs sampai Aril mengisi atau mengonfirmasi.
