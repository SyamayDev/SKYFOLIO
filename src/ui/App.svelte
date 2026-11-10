<script lang="ts">
  import { appPhase, fade, fadeColor, fatalError, inputDevice, isPortrait, paused } from '../core/AppState';
  import { t } from '../i18n';
  import Hud from './Hud.svelte';
  import Pause from './Pause.svelte';
  import Preflight from './Preflight.svelte';
  import Toasts from './Toasts.svelte';
  import TouchControls from './TouchControls.svelte';
  import Tutorial from './Tutorial.svelte';

  let rotateDismissed = $state(false);
  let flying = $derived($appPhase === 'flying');
  let showRotate = $derived(flying && $isPortrait && $inputDevice === 'touch' && !rotateDismissed);
</script>

{#if $fatalError}
  <div class="error" role="alert">
    <p>{$fatalError}</p>
    <a href="/ringkas/">{$t('errors.openRingkas')}</a>
  </div>
{:else}
  {#if flying}
    <Hud />
    {#if $inputDevice === 'touch' && !$paused}<TouchControls />{/if}
    {#if !$paused}<Tutorial />{/if}
    <Toasts />
    {#if showRotate}
      <button class="rotate" onclick={() => (rotateDismissed = true)}>📱↻ {$t('hud.rotateHint')} ✕</button>
    {/if}
    {#if $paused}<Pause />{/if}
  {:else}
    <Preflight />
  {/if}
{/if}

<div class="fade" style:opacity={$fade} style:background={$fadeColor} aria-hidden="true"></div>

<style>
  .fade {
    position: fixed;
    inset: 0;
    background: #fff6e6;
    pointer-events: none;
    transition: opacity 0.35s ease;
  }
  .error {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 12px;
    text-align: center;
    padding: 24px;
    pointer-events: auto;
    font-size: 18px;
  }
  .error a {
    font-family: var(--font-title);
    background: var(--sun);
    color: var(--ink);
    padding: 14px 20px;
    border-radius: 16px;
    text-decoration: none;
    font-weight: 700;
  }
  .rotate {
    position: fixed;
    left: 50%;
    top: calc(196px + var(--safe-top));
    transform: translateX(-50%);
    border: 0;
    background: var(--panel-strong);
    border-radius: 999px;
    padding: 10px 16px;
    font-size: 15px;
    box-shadow: var(--shadow);
    min-height: 44px;
  }
</style>
