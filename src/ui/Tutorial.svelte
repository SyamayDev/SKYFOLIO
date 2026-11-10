<script lang="ts">
  import { inputDevice, tutorialStep } from '../core/AppState';
  import { t } from '../i18n';
  import { actions } from './bridge';

  let step = $derived($tutorialStep);
  let device = $derived($inputDevice);
</script>

{#if step !== 'done'}
  {#key step + device}
    <div class="tutorial" class:touch={device === 'touch'} role="status" data-testid="tutorial">
      <span class="icon" aria-hidden="true">{device === 'touch' ? '👆' : device === 'gamepad' ? '🎮' : '⌨️'}</span>
      <p>{$t(`tutorial.${device}.${step}`)}</p>
      <button class="skip" onclick={() => actions.skipTutorial()} aria-label={$t('tutorial.skip')}>✕</button>
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
  .tutorial.touch {
    top: calc(118px + var(--safe-top));
    bottom: auto;
    width: min(440px, calc(100vw - 32px));
  }
  /* Layar sempit: naik di atas indikator kecepatan/ketinggian supaya tidak bertumpuk. */
  @media (max-width: 1100px) {
    .tutorial:not(.touch) {
      bottom: calc(86px + var(--safe-bottom));
    }
  }
  /* Layar pendek (HP landscape): pindah ke atas. */
  @media (max-height: 560px) {
    .tutorial,
    .tutorial:not(.touch) {
      top: calc(58px + var(--safe-top));
      bottom: auto;
    }
  }
  @keyframes pop {
    from {
      transform: translateX(-50%) scale(0.85);
      opacity: 0;
    }
  }
  .icon {
    font-size: 22px;
  }
  p {
    margin: 0;
    flex: 1;
    font-size: 15px;
    line-height: 1.35;
  }
  .skip {
    border: 0;
    background: transparent;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    font-size: 16px;
    color: var(--panel-ink);
  }
  .skip:hover {
    background: rgba(43, 45, 66, 0.08);
  }
</style>
