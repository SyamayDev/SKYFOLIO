<script lang="ts">
  /**
   * Layar Kedatangan (docs/07): ringkasan penerbangan, gambar bagikan 1080×1920 (boarding pass + stempel),
   * dan jalan pintas ke CV & kontak. Gambar dibuat di kanvas lokal (tanpa server).
   */
  import { content, L } from '../content';
  import { panel } from '../core/AppState';
  import { ACHIEVEMENTS } from '../game/Achievements';
  import { progress } from '../game/Progress';
  import { locale, t } from '../i18n';
  import Icon from './Icon.svelte';
  import { ZONE_ICONS, drawIcon } from './icons';
  import { visitor } from './visitor';

  let p = $derived($progress);
  let zoneStamps = $derived(Object.keys(p.stamps).filter((k) => !k.includes(':')).length);
  let landmarkStamps = $derived(Object.keys(p.stamps).filter((k) => k.startsWith('landmark:')).length);
  let ach = $derived(ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length);
  let km = $derived(Math.round(p.stats.distance * 0.02 * 10) / 10);
  let minutes = $derived(Math.max(1, Math.round(p.stats.flightTime / 60)));
  let busy = $state(false);

  function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /** Gambar bagikan 1080×1920 (Story). */
  async function makeImage(): Promise<Blob | null> {
    const cv = document.createElement('canvas');
    cv.width = 1080;
    cv.height = 1920;
    const g = cv.getContext('2d');
    if (!g) return null;
    await document.fonts?.ready;
    const sky = g.createLinearGradient(0, 0, 0, 1920);
    sky.addColorStop(0, '#4DB8FF');
    sky.addColorStop(0.55, '#BDE8FF');
    sky.addColorStop(1, '#FFF6E6');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1080, 1920);
    // Awan-awan bulat.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, r] of [
      [180, 260, 90],
      [290, 230, 120],
      [400, 270, 80],
      [760, 420, 100],
      [880, 390, 70],
      [650, 440, 70],
    ] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2B2D42';
    g.textAlign = 'center';
    g.font = '700 120px Fredoka, sans-serif';
    g.fillText('SKYFOLIO', 540, 620);
    g.font = '600 44px "Nunito Sans", sans-serif';
    g.fillText(c.profile.name, 540, 690);
    // Kartu boarding pass.
    g.fillStyle = '#FFFFFF';
    roundRect(g, 90, 780, 900, 760, 48);
    g.fill();
    g.fillStyle = '#FFC93C';
    roundRect(g, 90, 780, 900, 130, 48);
    g.fill();
    g.fillRect(90, 860, 900, 50);
    g.fillStyle = '#2B2D42';
    g.textAlign = 'left';
    g.font = '700 54px Fredoka, sans-serif';
    g.fillText($t('arrival.pass'), 140, 868);
    g.font = '600 34px "Nunito Sans", sans-serif';
    g.fillStyle = '#5D6178';
    g.fillText($t('boarding.passenger').toUpperCase(), 140, 990);
    g.fillStyle = '#2B2D42';
    g.font = '700 60px Fredoka, sans-serif';
    g.fillText(($visitor.name || $t('boarding.mystery')).slice(0, 18), 140, 1060);
    const stats: [string, string][] = [
      [$t('arrival.km'), `${km}`],
      [$t('arrival.minutes'), `${minutes}`],
      [$t('arrival.stamps'), `${zoneStamps + landmarkStamps}`],
      [$t('arrival.badges'), `${ach}/${ACHIEVEMENTS.length}`],
    ];
    stats.forEach(([label, v], i) => {
      const x = 140 + (i % 2) * 430;
      const y = 1160 + Math.floor(i / 2) * 170;
      g.fillStyle = '#5D6178';
      g.font = '600 30px "Nunito Sans", sans-serif';
      g.fillText(label.toUpperCase(), x, y);
      g.fillStyle = '#2F8FA6';
      g.font = '700 76px Fredoka, sans-serif';
      g.fillText(v, x, y + 80);
    });
    // Stempel zona yang didapat.
    const got = c.zones.zones.filter((z) => p.stamps[z.id]).slice(0, 10);
    got.forEach((z, i) => {
      const x = 170 + (i % 5) * 185;
      const y = 1650 + Math.floor(i / 5) * 150;
      g.fillStyle = ['#E5484D', '#2F8FA6', '#3DCB7A', '#E8A33D', '#6C7BD9'][i % 5]!;
      g.beginPath();
      g.arc(x, y, 62, 0, Math.PI * 2);
      g.fill();
      drawIcon(g, ZONE_ICONS[z.id] ?? 'star', x, y, 64, '#FFFFFF');
    });
    g.textAlign = 'center';
    g.fillStyle = '#2B2D42';
    g.font = '600 36px "Nunito Sans", sans-serif';
    g.fillText(location.host || 'skyfolio', 540, 1880);
    return new Promise((ok) => cv.toBlob((b) => ok(b), 'image/png'));
  }

  async function share(): Promise<void> {
    busy = true;
    try {
      const blob = await makeImage();
      if (!blob) return;
      const file = new File([blob], 'skyfolio-boarding-pass.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'SKYFOLIO', text: $t('arrival.shareText', { name: c.profile.name }) }).catch(() => undefined);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } finally {
      busy = false;
    }
  }

  let c = $derived($content);
  let cvUrl = $derived((c.profile as unknown as { cv?: Record<string, string> }).cv?.[$locale] ?? '');
</script>

<p class="p-kicker">{$t('panels.arrival')}</p>
<h2 class="p-title">{$t('arrival.title', { name: $visitor.name || $t('boarding.mystery') })}</h2>
<p class="p-text">{$t('arrival.thanks', { name: L(c.profile.nickname) || c.profile.name })}</p>
<ul class="grid">
  <li><b>{km}</b><span>{$t('arrival.km')}</span></li>
  <li><b>{minutes}</b><span>{$t('arrival.minutes')}</span></li>
  <li><b>{zoneStamps + landmarkStamps}</b><span>{$t('arrival.stamps')}</span></li>
  <li><b>{ach}/{ACHIEVEMENTS.length}</b><span>{$t('arrival.badges')}</span></li>
</ul>
<div class="p-row">
  <button class="p-btn" onclick={share} disabled={busy} data-testid="share"><Icon name="photo" size={18} /> {$t('arrival.share')}</button>
  {#if cvUrl}<a class="p-btn ghost" href={cvUrl} target="_blank" rel="noopener"><Icon name="file" size={18} /> {$t('panels.cv')}</a>{/if}
  <button class="p-btn ghost" onclick={() => panel.set({ kind: 'contact' })}><Icon name="mail" size={18} /> {$t('panels.contactAril')}</button>
</div>

<style>
  .grid {
    list-style: none;
    padding: 0;
    margin: 12px 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .grid li {
    background: #fff;
    border-radius: 16px;
    padding: 12px;
    display: grid;
  }
  .grid b {
    font: 700 calc(30px * var(--text-scale, 1)) var(--font-title);
    color: #2f8fa6;
  }
  .grid span {
    font-size: calc(13px * var(--text-scale, 1));
    color: var(--panel-ink);
  }
  .p-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
