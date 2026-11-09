<!--
CARA PAKAI: isi bagian "Perubahan yang aku mau", lalu tempel ke Claude Code.
Untuk perubahan kecil kamu juga bisa pakai Hangar (npm run dev, buka /hangar/).
-->
---

# Ubah konten SKYFOLIO

Baca `CLAUDE.md` dan `docs/08-content-system.md`.

## Perubahan yang aku mau

- (contoh) Tambah proyek baru: <nama>, link demo <url>, repo <url>, foto ada di content/media/projects/<id>/
- (contoh) Ganti foto profil dengan file content/media/profile/<nama-file>
- (contoh) Konfirmasi: PKL di PT Easy Digital tahun <tahun>, peranku <peran>
- (contoh) Naikkan level skill <nama> jadi <level>

## Aturan

- Ubah hanya file di `content/` (dan media). Jangan mengubah kode 3D kecuali benar-benar perlu.
- Hapus `needsConfirmation` hanya untuk field yang aku konfirmasi di pesan ini.
- Jalankan `npm run validate:content`, `npm run test`, dan `npm run build:cv`.
- Tunjukkan ringkasan perubahan, lalu commit dengan pesan `content: ...`. Push hanya jika aku minta.
