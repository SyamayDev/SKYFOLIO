<script lang="ts">
  import Icon from './Icon.svelte';
  import { inputDevice, tutorialStep } from '../core/AppState';
  import { t } from '../i18n';
  import { actions } from './bridge';

  let { inStack = false }: { inStack?: boolean } = $props();
  let step = $derived($tutorialStep);
  let device = $derived($inputDevice);
</script>

{#if step !== 'done'}
  {#key step + device}
    <div class="tutorial" class:stacked={inStack} role="status" data-testid="tutorial">
      <span class="icon" aria-hidden="true"><Icon name={device === 'touch' ? 'tap' : device === 'gamepad' ? 'gamepad' : 'keyboard'} size={24} /></span>
      <p>{$t(`tutorial.${device}.${step}`)}</p>
      <button class="skip" onclick={() => actions.skipTutorial()} aria-label={$t('tutorial.skip')}><Icon name="close" size={16} /></button>
    </div>
  {/key}
{/if}

<style>
  .tutorial {
    position: fixed;
    left: 50%;
    bottom: calc(18px + var(--safe-bottom));
    transform: translateX(-50%);
    width: min(520px, calc(100vw - 32px));
    background: var(--panel-strong);
    border-radius: 18px;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 14px;
    animation: pop 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
    pointer-events: auto;
  }
  /* Di dalam TopStack (layar sentuh/sempit): ikut alur kolom, bukan fixed. */
  .tutorial.stacked {
    position: static;
    transform: none;
    width: 100%;
    animation-name: popin;
  }
  /* Layar lebar di bawah 1100 px: naik di atas meter kecepatan/ketinggian. */
  @media (max-width: 1100px) {
    .tutorial:not(.stacked) {
      bottom: calc(86px + var(--safe-bottom));
    }
  }
  @keyframes popin {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: translateX(-50%) scale(0.85);
      opacity: 0;
    }
  }
  .icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(47, 143, 166, 0.12);
    color: #2f8fa6;
    flex: none;
  }
  p {
    margin: 0;
    flex: 1;
    font-size: calc(15px * var(--text-scale, 1));
    line-height: 1.35;
  }
  .skip {
    border: 0;
    background: transparent;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--panel-ink);
  }
  .skip:hover {
    background: rgba(43, 45, 66, 0.08);
  }
</style>
