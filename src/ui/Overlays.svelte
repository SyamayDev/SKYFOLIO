<script lang="ts">
  /** Banner judul zona, gelembung Piko + subtitle, status autopilot, waktu sirkuit, petunjuk aksi. */
  import { autopilotState, currentZone, hud, inputDevice, subtitle, zoneBanner } from '../core/AppState';
  import { settings } from '../core/Settings';
  import { L, content } from '../content';
  import { locale, t } from '../i18n';
  import { circuit, fmt } from '../world/Zones/SkyCircuit';
  import { actions } from './bridge';
  import { pikoLine } from './glue';

  let bannerVisible = $state(false);
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if ($zoneBanner) {
      bannerVisible = true;
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => (bannerVisible = false), 3200);
    }
  });
  let keyHint = $derived($inputDevice === 'gamepad' ? 'X' : $inputDevice === 'keyboard' ? 'E' : '');
</script>

{#if $zoneBanner && bannerVisible}
  {#key $zoneBanner.n}
    <div class="banner" role="status">
      <h2>{$zoneBanner.title}</h2>
      <p>{$zoneBanner.subtitle}</p>
    </div>
  {/key}
{/if}

{#if $pikoLine && $settings.copilot.enabled}
  {#key $pikoLine.n}
    <div class="piko mood-{$pikoLine.mood}" aria-hidden="true">
      <span class="avatar">🧒</span>
      <span class="bubble">{$pikoLine.text}</span>
    </div>
  {/key}
{/if}

{#if $subtitle && $settings.copilot.subtitles}
  <!-- Ucapan Piko sudah tampil di gelembung → subtitle hanya untuk pembaca layar agar tidak dobel. -->
  <div class="subtitle" class:sr-only={$pikoLine?.n === $subtitle.n && $settings.copilot.enabled} role="status" aria-live="polite">
    <b>{$subtitle.speaker}:</b>
    {$subtitle.text}
  </div>
{/if}

{#if $autopilotState.active}
  <div class="autopilot" role="status">
    🧭 {$t('autopilot.flyingTo', { target: $autopilotState.target ?? '' })}
    <button onclick={() => actions.cancelAutopilot()} aria-label={$t('autopilot.cancel')}>✕</button>
  </div>
{/if}

{#if $circuit.racing}
  <div class="race" class:invalid={$circuit.invalid} role="timer">
    <span class="time">{fmt($circuit.time)}</span>
    <span>{$t('hud.ring')} {Math.min($circuit.next, $circuit.total)}/{$circuit.total}</span>
    {#if $circuit.best}<span class="best">{$t('hud.best')} {fmt($circuit.best)}</span>{/if}
  </div>
{/if}

{#if $hud.action && $inputDevice !== 'touch'}
  <div class="action-hint">
    <kbd>{keyHint}</kbd>
    {$t($hud.action as never)}
  </div>
{/if}

{#if $currentZone && $inputDevice !== 'touch'}
  <div class="zone-chip">{L($content.zones.zones.find((z) => z.id === $currentZone)?.name, $locale)}</div>
{/if}

<style>
  .banner {
    position: fixed;
    top: 22%;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    pointer-events: none;
    animation: banner 3.2s ease forwards;
    width: min(90vw, 760px);
  }
  .banner h2 {
    font-family: var(--font-title);
    font-size: clamp(28px, 6vw, 56px);
    margin: 0;
    color: #fff;
    text-shadow:
      0 3px 0 rgba(43, 45, 66, 0.35),
      0 8px 24px rgba(43, 45, 66, 0.35);
  }
  .banner p {
    margin: 4px 0 0;
    font: 700 16px var(--font-title);
    color: var(--ink);
    background: var(--sun);
    display: inline-block;
    padding: 4px 14px;
    border-radius: 999px;
  }
  @keyframes banner {
    0% {
      opacity: 0;
      transform: translate(-50%, 18px) scale(0.92);
    }
    12%,
    80% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -10px);
    }
  }
  .piko {
    position: fixed;
    right: calc(12px + var(--safe-right));
    bottom: calc(150px + var(--safe-bottom));
    display: flex;
    align-items: flex-end;
    gap: 8px;
    max-width: min(360px, 70vw);
    pointer-events: none;
    animation: pop 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  .avatar {
    font-size: 34px;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.25));
  }
  .bubble {
    order: -1;
    background: #fff;
    border-radius: 18px 18px 4px 18px;
    padding: 10px 14px;
    font-size: 15px;
    box-shadow: var(--shadow);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(10px);
    }
  }
  .subtitle.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .subtitle {
    position: fixed;
    left: 50%;
    bottom: calc(96px + var(--safe-bottom));
    transform: translateX(-50%);
    background: rgba(43, 45, 66, 0.82);
    color: #fff;
    padding: 8px 16px;
    border-radius: 14px;
    max-width: min(720px, 92vw);
    font-size: 16px;
    text-align: center;
    pointer-events: none;
  }
  .autopilot {
    position: fixed;
    top: calc(62px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    background: #2f8fa6;
    color: #fff;
    border-radius: 999px;
    padding: 6px 8px 6px 16px;
    font: 600 15px var(--font-title);
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
    box-shadow: var(--shadow);
  }
  .autopilot button {
    border: 0;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    font-size: 16px;
  }
  .race {
    position: fixed;
    top: calc(64px + var(--safe-top));
    right: calc(12px + var(--safe-right));
    background: var(--panel-strong);
    border-radius: 18px;
    padding: 8px 14px;
    display: grid;
    text-align: right;
    font: 600 13px var(--font-title);
    box-shadow: var(--shadow);
  }
  .race .time {
    font-size: 30px;
  }
  .race.invalid .time {
    color: #e5484d;
    text-decoration: line-through;
  }
  .best {
    color: #2f8fa6;
  }
  .action-hint {
    position: fixed;
    left: 50%;
    bottom: calc(24px + var(--safe-bottom));
    transform: translateX(-50%);
    background: var(--panel-strong);
    border-radius: 999px;
    padding: 6px 16px 6px 8px;
    font: 600 16px var(--font-title);
    display: flex;
    gap: 10px;
    align-items: center;
    box-shadow: var(--shadow);
    pointer-events: none;
  }
  kbd {
    background: var(--ink);
    color: #fff;
    border-radius: 8px;
    min-width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    font-family: var(--font-title);
  }
  .zone-chip {
    position: fixed;
    top: calc(60px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    font: 600 13px var(--font-title);
    background: var(--panel);
    border-radius: 999px;
    padding: 3px 12px;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .banner,
    .piko {
      animation: none;
    }
  }
</style>
