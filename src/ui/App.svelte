<script lang="ts">
  import { appPhase, fade, fadeColor, fatalError, inputDevice, isPortrait, paused } from '../core/AppState';
  import { t } from '../i18n';
  import Hud from './Hud.svelte';
  import Overlays from './Overlays.svelte';
  import Panels from './Panels.svelte';
  import Radar from './Radar.svelte';
  import { panel } from '../core/AppState';
  import Pause from './Pause.svelte';
  import Preflight from './Preflight.svelte';
  import TouchControls from './TouchControls.svelte';
  import TopStack from './TopStack.svelte';
  import TourOverlay from './TourOverlay.svelte';

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
    <Radar />
    <Overlays />
    {#if $inputDevice === 'touch' && !$paused}<TouchControls />{/if}
    <TourOverlay />
    <TopStack rotate={showRotate} onrotate={() => (rotateDismissed = true)} />
    {#if $paused}<Pause />{/if}
    {#if !$paused && $panel}<Panels />{/if}
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
    font-size: calc(18px * var(--text-scale, 1));
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

</style>
