<script lang="ts">
  import { radar } from '../core/AppState';
  import { t } from '../i18n';
  import { content, L } from '../content';

  // Radar kecil: zona dalam 140 unit tampil di lingkaran, yang lebih jauh jadi panah di tepi (docs/07 bagian 2).
  const RANGE = 140;
  let blips = $derived($radar.slice(0, 10));
  let nearest = $derived($radar.find((b) => !b.visited) ?? $radar[0]);
  function name(id: string): string {
    const z = $content.zones.zones.find((x) => x.id === id);
    return z ? L(z.name) : id;
  }
</script>

<div class="radar" aria-label={$t('hud.radar')} role="img">
  <div class="disc">
    <span class="ring r1"></span><span class="ring r2"></span>
    <span class="me" aria-hidden="true">▲</span>
    {#each blips as b (b.id)}
      {@const inside = b.distance < RANGE}
      {@const r = inside ? (b.distance / RANGE) * 44 : 47}
      <span
        class="blip"
        class:edge={!inside}
        class:visited={b.visited}
        style:left={`${50 + Math.sin(b.bearing) * r}%`}
        style:top={`${50 - Math.cos(b.bearing) * r}%`}
        style:--c={b.color}
        style:transform={`translate(-50%,-50%) rotate(${inside ? 0 : b.bearing}rad)`}
        title={name(b.id)}>{inside ? b.icon : '▲'}</span
      >
    {/each}
  </div>
  {#if nearest}
    <div class="next">{nearest.icon} {name(nearest.id)} · {Math.round(nearest.distance * 20) / 1000 < 1 ? `${Math.round(nearest.distance * 20)} m` : `${(nearest.distance * 0.02).toFixed(1)} km`}</div>
  {/if}
</div>

<style>
  .radar {
    position: fixed;
    left: calc(12px + var(--safe-left));
    top: calc(12px + var(--safe-top));
    width: 118px;
    pointer-events: none;
  }
  .disc {
    position: relative;
    width: 118px;
    height: 118px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 246, 230, 0.9), rgba(255, 246, 230, 0.72));
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .ring {
    position: absolute;
    inset: 25%;
    border: 1px dashed rgba(43, 45, 66, 0.25);
    border-radius: 50%;
  }
  .ring.r2 {
    inset: 8%;
  }
  .me {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: #e5484d;
    font-size: 14px;
  }
  .blip {
    position: absolute;
    font-size: 15px;
    line-height: 1;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
  }
  .blip.edge {
    font-size: 10px;
    color: var(--c);
  }
  .blip.visited {
    opacity: 0.55;
  }
  .next {
    margin-top: 6px;
    font: 600 12px var(--font-title);
    background: var(--panel);
    border-radius: 999px;
    padding: 3px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: var(--shadow);
  }
  @media (max-width: 600px), (max-height: 500px) {
    .radar,
    .disc {
      width: 84px;
    }
    .disc {
      height: 84px;
    }
    .blip {
      font-size: 12px;
    }
  }
</style>
