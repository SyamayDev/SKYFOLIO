<script lang="ts">
  import { t } from '../i18n';
  import { actions } from './bridge';
  import Settings from './Settings.svelte';
  import { panel, paused } from '../core/AppState';

  function openPanel(kind: 'map' | 'passport' | 'bts'): void {
    paused.set(false);
    panel.set({ kind });
  }

  let showSettings = $state(false);
  let dialog: HTMLDivElement | undefined = $state();

  $effect(() => {
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
  });
</script>

<div class="backdrop" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" bind:this={dialog}>
    <h2 id="pause-title">{showSettings ? $t('settings.title') : $t('pause.title')}</h2>
    {#if showSettings}
      <button class="back" onclick={() => (showSettings = false)}>← {$t('common.back')}</button>
      <div class="scroll"><Settings /></div>
    {:else}
      <div class="menu">
        <button class="primary" onclick={() => actions.resume()} data-testid="resume">▶ {$t('pause.resume')}</button>
        <button onclick={() => actions.respawn()} data-testid="respawn">🛬 {$t('pause.respawn')}</button>
        <button onclick={() => openPanel('map')}>🗺️ {$t('hud.map')}</button>
        <button onclick={() => openPanel('passport')}>🛂 {$t('hud.passport')}</button>
        <button onclick={() => (showSettings = true)} data-testid="open-settings">⚙️ {$t('pause.settings')}</button>
        <button onclick={() => openPanel('bts')}>🔧 {$t('panels.bts')}</button>
        <a class="button" href="/ringkas/">📄 {$t('pause.ringkas')}</a>
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(43, 45, 66, 0.35);
    display: grid;
    place-items: center;
    padding: calc(12px + var(--safe-top)) 16px calc(12px + var(--safe-bottom));
    pointer-events: auto;
    backdrop-filter: blur(3px);
  }
  .panel {
    width: min(460px, 100%);
    max-height: 100%;
    background: var(--panel-strong);
    border-radius: 24px;
    box-shadow: var(--shadow);
    padding: 16px;
    display: flex;
    flex-direction: column;
    animation: pop 0.25s cubic-bezier(0.2, 1.3, 0.4, 1);
  }
  @keyframes pop {
    from {
      transform: scale(0.92);
      opacity: 0;
    }
  }
  h2 {
    margin: 0 0 10px;
    font-family: var(--font-title);
    text-align: center;
  }
  .menu {
    display: grid;
    gap: 10px;
  }
  .menu button,
  .menu .button {
    min-height: 56px;
    border: 0;
    border-radius: 16px;
    background: #fff;
    color: var(--ink);
    font-family: var(--font-title);
    font-size: 18px;
    font-weight: 600;
    text-decoration: none;
    display: grid;
    place-items: center;
  }
  .menu .primary {
    background: var(--sun);
  }
  .back {
    align-self: flex-start;
    border: 0;
    background: transparent;
    font-size: 16px;
    min-height: 40px;
    margin-bottom: 6px;
  }
  .scroll {
    overflow-y: auto;
    touch-action: pan-y;
    overscroll-behavior: contain;
  }
</style>
