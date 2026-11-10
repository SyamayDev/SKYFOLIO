<script lang="ts">
  import { hud, inputDevice, paused } from '../core/AppState';
  import { reducedMotionActive, settings, updateSettings } from '../core/Settings';
  import { isDebugEnabled } from '../core/Debug';
  import { locale, t } from '../i18n';
  import { formatNumber, toMeters } from '../utils/format';
  import { actions } from './bridge';
  import { panel } from '../core/AppState';

  function openPanel(kind: 'map' | 'passport'): void {
    actions.click();
    panel.set({ kind });
  }

  const debug = isDebugEnabled();
  let compassOffset = $derived(-($hud.heading / 360) * 720);
  let speedLines = $derived(
    $hud.speed > 220 && $settings.camera.speedLines && !reducedMotionActive($settings),
  );
  let touch = $derived($inputDevice === 'touch');

  function togglePause(): void {
    actions.click();
    paused.set(!$paused);
  }

  function toggleCamera(): void {
    actions.click();
    updateSettings('camera', { mode: $settings.camera.mode === 'cockpit' ? 'chase' : 'cockpit' });
  }

  const marks = ['n', 'e', 's', 'w'] as const;
</script>

{#if speedLines}
  <div class="speedlines" aria-hidden="true"></div>
{/if}

<div class="hud" class:touch>
  <div class="compass" aria-label="{$t('hud.compass.n')} {Math.round($hud.heading)}°">
    <div class="strip" style:transform={`translateX(${compassOffset}px)`}>
      {#each [0, 1, 2] as rep (rep)}
        {#each marks as m, i (m)}
          <span class="mark" class:north={m === 'n'} style:left={`${rep * 720 + i * 180}px`}>{$t(`hud.compass.${m}`)}</span>
          <span class="tick" style:left={`${rep * 720 + i * 180 + 90}px`}></span>
          <span class="tick small" style:left={`${rep * 720 + i * 180 + 45}px`}></span>
          <span class="tick small" style:left={`${rep * 720 + i * 180 + 135}px`}></span>
        {/each}
      {/each}
    </div>
    <span class="needle" aria-hidden="true"></span>
  </div>

  <div class="buttons">
    <button class="round" onclick={() => openPanel('map')} aria-label={$t('hud.map')} title={$t('hud.map')} data-testid="open-map">🗺️</button>
    <button class="round" onclick={() => openPanel('passport')} aria-label={$t('hud.passport')} title={$t('hud.passport')} data-testid="open-passport">🛂</button>
    <button class="round" onclick={toggleCamera} aria-label={$t('hud.camera')} title={$t('hud.camera')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>
    </button>
    <button class="round" onclick={togglePause} aria-label={$t('hud.pause')} title={$t('hud.pause')} data-testid="pause">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
    </button>
  </div>

  <div class="gauges">
    <div class="gauge">
      <span class="label">{$t('hud.speed')}</span>
      <span class="value" data-testid="speed">{formatNumber($hud.speed, $locale)}</span>
      <span class="unit">{$t('hud.speedUnit')}</span>
    </div>
    <div class="gauge">
      <span class="label">{$t('hud.altitude')}</span>
      <span class="value" data-testid="altitude">{formatNumber(toMeters($hud.altitude), $locale)}</span>
      <span class="unit">{$t('hud.altitudeUnit')}</span>
    </div>
    <div class="throttle" aria-hidden="true"><div class="fill" class:boost={$hud.boosting} style:height={`${Math.round($hud.throttle * 100)}%`}></div></div>
  </div>

  {#if $hud.stalled}
    <div class="stall" role="alert">{$t('hud.stall')}</div>
  {/if}

  {#if $settings.graphics.showFps || debug}
    <div class="fps" data-testid="fps">{Math.round($hud.fps)} {$t('hud.fps')} · {$hud.backend} · {$hud.tier}{debug ? ` · ${$hud.drawCalls} dc` : ''}</div>
  {/if}
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    font-family: var(--font-title);
  }
  .compass {
    position: absolute;
    top: calc(10px + var(--safe-top));
    left: 50%;
    width: min(340px, 52vw);
    height: 38px;
    transform: translateX(-50%);
    background: var(--panel);
    border-radius: 999px;
    overflow: hidden;
    box-shadow: var(--shadow);
    mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
  }
  .strip {
    position: absolute;
    top: 0;
    left: 50%;
    height: 100%;
    margin-left: -720px;
    will-change: transform;
  }
  .mark {
    position: absolute;
    top: 7px;
    width: 30px;
    margin-left: -15px;
    text-align: center;
    font-weight: 700;
    font-size: 17px;
  }
  .mark.north {
    color: var(--berry);
  }
  .tick {
    position: absolute;
    top: 13px;
    width: 2px;
    height: 12px;
    margin-left: -1px;
    background: var(--ink);
    border-radius: 2px;
  }
  .tick.small {
    top: 16px;
    height: 6px;
    opacity: 0.5;
  }
  .needle {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 0;
    height: 0;
    margin-left: -6px;
    border: 6px solid transparent;
    border-bottom-color: var(--berry);
  }
  .buttons {
    position: absolute;
    top: calc(10px + var(--safe-top));
    right: calc(12px + var(--safe-right));
    display: flex;
    gap: 10px;
  }
  .round {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    border: 0;
    background: var(--panel);
    color: var(--ink);
    box-shadow: var(--shadow);
    display: grid;
    place-items: center;
    padding: 0;
  }
  .touch .round {
    width: 56px;
    height: 56px;
  }
  .round svg {
    width: 24px;
    height: 24px;
  }
  .round:active {
    transform: scale(0.94);
  }
  .gauges {
    position: absolute;
    left: calc(14px + var(--safe-left));
    bottom: calc(14px + var(--safe-bottom));
    display: flex;
    gap: 10px;
    align-items: stretch;
  }
  .touch .gauges {
    bottom: auto;
    top: calc(10px + var(--safe-top));
  }
  .gauge {
    background: var(--panel);
    border-radius: 16px;
    padding: 6px 12px;
    min-width: 92px;
    box-shadow: var(--shadow);
    display: grid;
    grid-template-columns: auto auto;
    align-items: baseline;
    column-gap: 4px;
  }
  .label {
    grid-column: 1 / -1;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--panel-ink);
  }
  .value {
    font-size: 24px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    font-size: 14px;
    color: var(--panel-ink);
  }
  .touch .gauge {
    min-width: 76px;
    padding: 4px 10px;
  }
  .touch .value {
    font-size: 19px;
  }
  .throttle {
    width: 12px;
    border-radius: 8px;
    background: var(--panel);
    box-shadow: var(--shadow);
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .throttle .fill {
    width: 100%;
    background: var(--leaf);
    transition: height 0.15s;
  }
  .throttle .fill.boost {
    background: var(--berry);
  }
  .stall {
    position: absolute;
    top: calc(60px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    background: var(--berry);
    color: #fff;
    font-weight: 700;
    font-size: 20px;
    padding: 6px 18px;
    border-radius: 999px;
    animation: blink 0.5s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.45;
    }
  }
  .fps {
    position: absolute;
    right: calc(12px + var(--safe-right));
    top: calc(68px + var(--safe-top));
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 700;
    background: var(--panel);
    padding: 4px 10px;
    border-radius: 999px;
  }
  .speedlines {
    position: fixed;
    inset: -10%;
    pointer-events: none;
    background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.14) 0deg 0.6deg, transparent 0.6deg 7deg);
    mask-image: radial-gradient(circle, transparent 38%, #000 75%);
    animation: lines 0.25s linear infinite;
  }
  @keyframes lines {
    to {
      transform: rotate(7deg);
    }
  }
  @media (max-width: 560px) {
    .compass {
      top: calc(76px + var(--safe-top));
      width: 64vw;
    }
  }
</style>
