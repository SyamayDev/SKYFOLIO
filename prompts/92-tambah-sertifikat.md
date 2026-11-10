<!--
CARA PAKAI: taruh semua PDF sertifikat di content/certificates/pdf/, lalu tempel prompt ini.
-->
---

# Tambah sertifikat

Baca `CLAUDE.md` dan `docs/08-content-system.md` bagian 7.

1. Jalankan `npm run ingest:certificates`.
2. Baca setiap PDF di `content/certificates/pdf/` dengan tool Read.
3. Isi judul, penerbit, tanggal, dan kategori di `content/certificates.json`, hanya dari isi PDF. Jangan menebak.
4. Biarkan `needsConfirmation` tetap ada, lalu tampilkan tabel ringkas semua sertifikat supaya aku bisa mengonfirmasi.
5. Usulkan sertifikat mana yang sebaiknya masuk CV (maksimal 6 yang paling kuat), dan sertifikat apa yang bisa menambah item timeline.
6. Setelah aku konfirmasi, hapus `needsConfirmation`, jalankan `npm run build:cv`, dan cek satelit di orbit lewat screenshot.
