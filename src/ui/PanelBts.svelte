<script lang="ts">
  /** Di Balik Layar (docs/07): teknologi, kredit lisensi, fps, info renderer — penting untuk juri. */
  import { hud } from '../core/AppState';
  import { t } from '../i18n';

  const STACK = [
    ['three.js r187 (WebGPURenderer + TSL)', 'MIT'],
    ['Rapier 0.21 (physics)', 'Apache-2.0'],
    ['Svelte 5 (UI)', 'MIT'],
    ['Tone.js / Howler.js (audio)', 'MIT'],
    ['zod (validasi konten)', 'MIT'],
    ['Natural Earth (data peta)', 'Public domain'],
    ['Fredoka & Nunito Sans (font)', 'OFL-1.1'],
  ];
</script>

<p class="p-kicker">{$t('panels.bts')}</p>
<h2 class="p-title">{$t('bts.title')}</h2>
<p class="p-text">{$t('bts.intro')}</p>
<ul class="p-list">
  <li class="p-card"><b>{$t('bts.renderer')}</b>: {$hud.backend || '—'} · {$t('bts.tier')} {$hud.tier}</li>
  <li class="p-card"><b>FPS</b>: {Math.round($hud.fps)} · {$hud.drawCalls} draw calls · {Math.round($hud.triangles / 1000)}k △ · {$t('bts.physics')} {$hud.physicsMs.toFixed(1)} ms</li>
</ul>
<h3 class="p-section">{$t('bts.made')}</h3>
<ul class="p-list">
  <li class="p-card">{$t('bts.f1')}</li>
  <li class="p-card">{$t('bts.f2')}</li>
  <li class="p-card">{$t('bts.f3')}</li>
  <li class="p-card">{$t('bts.f4')}</li>
</ul>
<h3 class="p-section">{$t('bts.credits')}</h3>
<ul class="p-list">
  {#each STACK as [name, lic] (name)}<li class="p-card">{name} <span class="p-muted">· {lic}</span></li>{/each}
</ul>
<p class="p-muted">{$t('bts.creditsNote')}</p>
