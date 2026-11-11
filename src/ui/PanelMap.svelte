<script lang="ts">
  import Icon from './Icon.svelte';
  import { ZONE_ICONS, drawIcon, type IconName } from './icons';
  /**
   * Peta globe (docs/07 bagian 2): globe ortografis di <canvas> yang bisa diputar (seret), semua zona & landmark,
   * posisi pesawat. Ketuk zona → info + "Antar ke sini" (autopilot).
   */
  import { onMount } from 'svelte';
  import { content, L } from '../content';
  import { planeGeo } from '../core/AppState';
  import { progress } from '../game/Progress';
  import { locale, t } from '../i18n';
  import { actions } from './bridge';
  import { settings } from '../core/Settings';
  import { OKABE_ITO } from './a11y';

  let { onclose }: { onclose: () => void } = $props();
  let canvas = $state<HTMLCanvasElement | null>(null);
  let lat0 = $state($planeGeo.lat);
  let lon0 = $state($planeGeo.lon);
  let selected = $state<{ dest: string; name: string; icon: IconName } | null>(null);
  let mask: ImageData | null = null;
  const D = Math.PI / 180;

  interface Pt {
    dest: string;
    name: string;
    icon: IconName;
    lat: number;
    lon: number;
    big: boolean;
  }
  let points = $derived.by((): Pt[] => {
    const c = $content;
    const out: Pt[] = [];
    for (const z of c.zones.zones) {
      const lat = z.id === 'journey-stream' ? 0 : z.id === 'sky-circuit' ? 7.2 : z.id === 'home-airport' ? 7.2 : z.lat;
      const lon = z.id === 'journey-stream' ? 104 : z.id === 'sky-circuit' ? 98.5 : z.id === 'home-airport' ? 97.7 : z.lon;
      if (lat == null || lon == null) continue;
      out.push({ dest: `zone:${z.id}`, name: L(z.name, $locale), icon: ZONE_ICONS[z.id] ?? 'pin', lat, lon, big: true });
    }
    for (const p of c.projects) if (p.island.lat != null && p.island.lon != null) out.push({ dest: `project:${p.id}`, name: p.title, icon: 'island', lat: p.island.lat, lon: p.island.lon, big: false });
    for (const l of c.landmarks.landmarks) out.push({ dest: `landmark:${l.id}`, name: L(l.name, $locale), icon: $progress.stamps[`landmark:${l.id}`] ? 'camera' : 'pin', lat: l.lat, lon: l.lon, big: false });
    return out;
  });

  function project(lat: number, lon: number, r: number, cx: number, cy: number): { x: number; y: number; front: boolean } {
    const la = lat * D;
    const dl = (lon - lon0) * D;
    const p0 = lat0 * D;
    const x = Math.cos(la) * Math.sin(dl);
    const y = Math.cos(p0) * Math.sin(la) - Math.sin(p0) * Math.cos(la) * Math.cos(dl);
    const z = Math.sin(p0) * Math.sin(la) + Math.cos(p0) * Math.cos(la) * Math.cos(dl);
    return { x: cx + x * r, y: cy - y * r, front: z > 0 };
  }

  function draw(): void {
    const cv = canvas;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const w = cv.width;
    const h = cv.height;
    const r = Math.min(w, h) * 0.46;
    const cx = w / 2;
    const cy = h / 2;
    g.clearRect(0, 0, w, h);
    // Laut + daratan (inverse ortografis per piksel, langkah 2 px).
    const img = g.createImageData(w, h);
    const p0 = lat0 * D;
    const step = 2;
    for (let py = 0; py < h; py += step) {
      for (let px = 0; px < w; px += step) {
        const x = (px - cx) / r;
        const y = (cy - py) / r;
        const rho = x * x + y * y;
        if (rho > 1) continue;
        const z = Math.sqrt(1 - rho);
        const lat = Math.asin(y * Math.cos(p0) + z * Math.sin(p0));
        const lon = lon0 * D + Math.atan2(x, z * Math.cos(p0) - y * Math.sin(p0));
        let col = [48, 124, 222];
        if (mask) {
          const mx = Math.floor((((lon / D + 180) % 360) + 360) % 360 / 360 * mask.width);
          const my = Math.floor(((90 - lat / D) / 180) * mask.height);
          const o = (Math.min(mask.height - 1, my) * mask.width + Math.min(mask.width - 1, mx)) * 4;
          const d = mask.data;
          if (d[o]! + d[o + 1]! + d[o + 2]! > 30) col = [d[o]!, d[o + 1]!, d[o + 2]!];
        }
        const shade = 0.75 + z * 0.25;
        for (let sy = 0; sy < step; sy++)
          for (let sx = 0; sx < step; sx++) {
            const o = ((py + sy) * w + px + sx) * 4;
            img.data[o] = col[0]! * shade;
            img.data[o + 1] = col[1]! * shade;
            img.data[o + 2] = col[2]! * shade;
            img.data[o + 3] = 255;
          }
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    // Titik-titik.
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const pt of points) {
      const p = project(pt.lat, pt.lon, r, cx, cy);
      if (!p.front) continue;
      // Lencana bulat + ikon vektor (sama di semua perangkat, tidak bergantung font emoji).
      const rad = pt.big ? 13 : pt.icon === 'pin' ? 4 : 9;
      const cb = $settings.accessibility.colorblindFriendlyMarkers;
      g.fillStyle = pt.big ? '#FFF6E6' : pt.icon === 'island' ? (cb ? OKABE_ITO[0] : '#FFC93C') : pt.icon === 'camera' ? (cb ? OKABE_ITO[2] : '#3DCB7A') : '#FFFFFF';
      g.beginPath();
      g.arc(p.x, p.y, rad, 0, Math.PI * 2);
      g.fill();
      if (pt.big || pt.icon !== 'pin') drawIcon(g, pt.icon, p.x, p.y, pt.big ? 17 : 12, '#2B2D42');
      if (selected?.dest === pt.dest) {
        g.strokeStyle = '#FFC93C';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(p.x, p.y, 16, 0, Math.PI * 2);
        g.stroke();
      }
    }
    const me = project($planeGeo.lat, $planeGeo.lon, r, cx, cy);
    if (me.front) {
      g.fillStyle = '#E5484D';
      g.beginPath();
      g.arc(me.x, me.y, 7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fff';
      g.stroke();
    }
  }

  onMount(() => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d');
      if (g) {
        g.drawImage(im, 0, 0);
        mask = g.getImageData(0, 0, im.width, im.height);
        draw();
      }
    };
    im.src = '/earth/biome-mask.png';
    draw();
  });

  $effect(() => {
    void lat0;
    void lon0;
    void selected;
    void points;
    draw();
  });

  let drag: { x: number; y: number; moved: boolean } | null = null;
  function down(e: PointerEvent): void {
    drag = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent): void {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    lon0 -= dx * 0.4;
    lat0 = Math.max(-80, Math.min(80, lat0 + dy * 0.4));
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function up(e: PointerEvent): void {
    if (drag && !drag.moved && canvas) {
      const rect = canvas.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const sy = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const r = Math.min(canvas.width, canvas.height) * 0.46;
      let best: Pt | null = null;
      let bd = 26;
      for (const pt of points) {
        const p = project(pt.lat, pt.lon, r, canvas.width / 2, canvas.height / 2);
        if (!p.front) continue;
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < bd) {
          bd = d;
          best = pt;
        }
      }
      selected = best ? { dest: best.dest, name: best.name, icon: best.icon } : null;
    }
    drag = null;
  }
  function fly(): void {
    if (!selected) return;
    if (actions.flyTo(selected.dest)) onclose();
  }
</script>

<p class="p-kicker">{$t('panels.map')}</p>
<h2 class="p-title">{$t('map.title')}</h2>
<canvas bind:this={canvas} width="360" height="360" onpointerdown={down} onpointermove={move} onpointerup={up} aria-label={$t('map.aria')} data-testid="map-canvas"></canvas>
<p class="p-muted">{$t('map.hint')}</p>
<ul class="quick">
  {#each $content.zones.zones as z (z.id)}
    <li><button class="p-btn ghost" class:on={selected?.dest === `zone:${z.id}`} onclick={() => (selected = { dest: `zone:${z.id}`, name: L(z.name, $locale), icon: ZONE_ICONS[z.id] ?? 'pin' })} data-testid="map-zone-{z.id}"><Icon name={ZONE_ICONS[z.id] ?? 'pin'} size={18} /> <span>{L(z.name, $locale)}</span></button></li>
  {/each}
</ul>
{#if selected}
  <div class="sel p-card" role="status">
    <b class="selname"><Icon name={selected.icon} size={20} /> {selected.name}</b>
    <button class="p-btn" onclick={fly} data-testid="fly-here"><Icon name="compass" size={18} /> {$t('map.flyHere')}</button>
  </div>
{/if}

<style>
  canvas {
    width: min(100%, 360px);
    aspect-ratio: 1;
    display: block;
    margin: 4px auto;
    touch-action: none;
    cursor: grab;
    border-radius: 50%;
  }
  .quick {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .quick .p-btn {
    min-height: 40px;
    font-size: calc(13px * var(--text-scale, 1));
    padding: 6px 12px 6px 8px;
    gap: 6px;
  }
  .quick .p-btn :global(.icon) {
    color: #2f8fa6;
  }
  .quick .on {
    background: var(--sun);
  }
  .sel {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    box-shadow: var(--shadow);
  }
  .selname {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
</style>
