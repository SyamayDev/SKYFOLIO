# Worklog sesi "selesaikan semua fase" (2026-11-10)

Permintaan Aril: selesaikan Fase 1–5 sekaligus, Bumi sedetail Tiny Skies/Bruno Simon, pesawat & pilot seperti
`docs/references/image.png` (gambar lokal, tidak di-commit).

## Selesai
- [x] Bumi v2 (L7 + detail Indonesia, sungai, lembah, shader medan prosedural), Scatter props, awan, atmosfer, laut berbuih.
- [x] Pesawat mainan bersayap rendah + Aril berhelm kulit/kacamata + wajah chibi baru.
- [x] Sistem konten: `src/content/{schema,yaml,markdown,public,index}.ts`, `scripts/lib/content.ts`,
      `scripts/vite-plugin-content.ts` (virtual:content + HMR + render Ringkas/CV), `scripts/hangar-api.ts`.
- [x] sync-github dijalankan: 54 draf di `content/projects/_drafts/`; 8 proyek dipromosikan (SI-RAJU, SI-PANDRI,
      SI-MAUNG [usulan unggulan 3], iMuslim, SI LABU, I-Teens, EcoLens, Warung Pak Din 2). Skill baru HTML, CSS.
- [x] optimize-media, build-cv (PDF ID/EN di public/cv), validate-content, Ringkas (HTML statis + JSON-LD).

## Berikutnya (urutan)
1. Infrastruktur zona: Planet.heightAt, ZoneKit, Zone, ZoneManager, POI, stempel paspor, event zone:enter/exit.
2. 17 zona + landmark + kehidupan latar.
3. UI Fase 1: BoardingPass, HUD (radar/kompas/zona), Map + autopilot dasar, ZonePanel/ProjectPanel, Passport,
   LinkConfirm, ContactForm, BehindTheScenes, Hangar UI.
4. Fase 2: waktu nyata, malam, cuaca, kanopi, air/orbit/Bulan, audio + musik prosedural, suara Piko.
5. Fase 3: IntentRouter, FAQ 40+, api/copilot, chat, Mode Rekruter.
6. Fase 4: achievement, skin, minigame, sirkuit, lampion/counter/leaderboard API, layar kedatangan.
7. Fase 5: performa, a11y, SEO/OG/404, vercel.json, laporan + panduan deploy.

## Catatan teknis penting
- Jangan kirim escape `\u…`/`\r` lewat heredoc Bash (rusak) → pakai Write tool / skrip node.
- node_modules sempat terhapus; `npm ci` gagal jika server Vite masih jalan (rolldown .node terkunci).
- Probe visual: `scripts/.cache/look.mjs` (teleport+screenshot), `scripts/.cache/plane.mjs` (close-up, hook `zoom`).
