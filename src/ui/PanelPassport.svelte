<script lang="ts">
  import Icon from './Icon.svelte';
  import PassportExtras from './PassportExtras.svelte';
  import { ZONE_ICONS } from './icons';
  /** Paspor (docs/09 bagian 1): satu halaman per wilayah, stempel unik per zona & landmark (dicap tangan). */
  import { content, L } from '../content';
  import { progress, progressPersistent } from '../game/Progress';
  import { locale, t } from '../i18n';
  import { REGIONS, regionOfLandmark, regionOfZone, stampColor } from '../game/Passport';

  let stamps = $derived($progress.stamps);
  let c = $derived($content);
  let total = $derived(c.zones.zones.length + c.landmarks.landmarks.length);
  let have = $derived(Object.keys(stamps).filter((k) => !k.startsWith('project:')).length);
  let fmt = $derived(new Intl.DateTimeFormat($locale === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short' }));
</script>

<p class="p-kicker">{$t('panels.passport')}</p>
<h2 class="p-title">{$t('passport.title')}</h2>
<p class="p-muted">{$t('passport.count', { n: have, total })}{$progressPersistent ? '' : ` · ${$t('passport.notSaved')}`}</p>

{#each REGIONS as region (region)}
  {@const zones = c.zones.zones.filter((z) => regionOfZone(z.id, z.lat, z.lon) === region)}
  {@const lms = c.landmarks.landmarks.filter((l) => regionOfLandmark(l.lat, l.lon) === region)}
  {#if zones.length || lms.length}
    <h3 class="p-section">{$t(`passport.region.${region}` as never)}</h3>
    <div class="page">
      {#each zones as z (z.id)}
        {@const s = stamps[z.id]}
        <div class="stamp" class:got={!!s} style:--c={stampColor(z.id)} style:--r={`${s?.rot ?? 0}deg`} title={L(z.name, $locale)}>
          <span class="ring">{#if s}<Icon name={ZONE_ICONS[z.id] ?? 'star'} size={24} />{:else}?{/if}</span>
          <span class="name">{L(z.name, $locale)}</span>
          {#if s}<span class="date">{fmt.format(new Date(s.date))}</span>{/if}
        </div>
      {/each}
      {#each lms as l (l.id)}
        {@const s = stamps[`landmark:${l.id}`]}
        <div class="stamp small" class:got={!!s} style:--c={stampColor(l.id)} style:--r={`${s?.rot ?? 0}deg`} title={L(l.name, $locale)}>
          <span class="ring">{#if s}<Icon name="camera" size={18} />{:else}?{/if}</span>
          <span class="name">{L(l.name, $locale)}</span>
        </div>
      {/each}
    </div>
  {/if}
{/each}

<PassportExtras />

<style>
  .page {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    background: repeating-linear-gradient(0deg, #fffaf0 0 22px, #f6efe0 22px 23px);
    border-radius: 16px;
    padding: 12px;
    border: 1px solid rgba(43, 45, 66, 0.08);
  }
  .stamp {
    display: grid;
    justify-items: center;
    gap: 2px;
    text-align: center;
    opacity: 0.35;
    filter: grayscale(1);
  }
  .stamp.got {
    opacity: 1;
    filter: none;
    transform: rotate(var(--r));
    animation: stamp 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  .ring {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 4px double var(--c);
    color: var(--c);
    display: grid;
    place-items: center;
    font-size: 24px;
    background: color-mix(in srgb, var(--c) 10%, transparent);
  }
  .small .ring {
    width: 52px;
    height: 52px;
    font-size: 20px;
  }
  .name {
    font: 600 11.5px var(--font-title);
    line-height: 1.15;
    color: var(--ink);
  }
  .date {
    font-size: 10.5px;
    color: var(--c);
    font-weight: 700;
  }
  @keyframes stamp {
    from {
      transform: scale(1.6) rotate(var(--r));
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .stamp.got {
      animation: none;
    }
  }
</style>
