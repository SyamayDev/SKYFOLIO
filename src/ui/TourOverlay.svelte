<script lang="ts">
  /** Mode Rekruter: subtitle besar + tombol Lewati, Berikutnya, Ambil Alih, Unduh CV (docs/06 bagian 7). */
  import { downloadCv, endTour, next, takeOver, tour } from '../ai/RecruiterTour';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import PikoAvatar from './PikoAvatar.svelte';
</script>

{#if $tour.active}
  {#key $tour.step}
    <section class="tour" aria-label={$t('tour.aria')} aria-live="polite" data-testid="tour">
      <div class="head">
        <span class="av"><PikoAvatar size={40} mood="wow" /></span>
        <div class="meta">
          <span class="kicker">{$t('tour.kicker')} · {$tour.step}/{$tour.total}</span>
          <h2>{$tour.title}</h2>
        </div>
      </div>
      <p class="text">{$tour.text}</p>
      <div class="bar" aria-hidden="true"><span style:width={`${($tour.step / $tour.total) * 100}%`}></span></div>
      <div class="btns">
        <button class="ghost" onclick={() => endTour(false)}><Icon name="close" size={16} /> {$t('tour.skip')}</button>
        <button class="ghost" onclick={takeOver}><Icon name="gamepad" size={16} /> {$t('tour.takeover')}</button>
        <button class="ghost" onclick={downloadCv}><Icon name="file" size={16} /> {$t('tour.cv')}</button>
        <button class="primary" onclick={next} data-testid="tour-next">{$tour.last ? $t('tour.finish') : $t('tour.next')} <Icon name="next" size={16} /></button>
      </div>
    </section>
  {/key}
{/if}

<style>
  .tour {
    position: fixed;
    left: 50%;
    bottom: calc(18px + var(--safe-bottom));
    transform: translateX(-50%);
    width: min(720px, calc(100vw - 24px));
    background: var(--panel-strong);
    border-radius: 22px;
    box-shadow: var(--shadow);
    padding: 14px 16px 12px;
    z-index: 9;
    pointer-events: auto;
    animation: up 0.35s cubic-bezier(0.2, 1.3, 0.4, 1);
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .av {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: #fff;
    display: grid;
    place-items: center;
    box-shadow: 0 1px 3px rgba(43, 45, 66, 0.2);
    flex: none;
  }
  .kicker {
    font: 600 calc(12px * var(--text-scale, 1)) var(--font-title);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #2f8fa6;
  }
  h2 {
    margin: 0;
    font: 700 clamp(18px, 3.4vw, 24px) var(--font-title);
  }
  .text {
    margin: 8px 0 10px;
    font-size: clamp(16px, 2.6vw, 20px);
    line-height: 1.4;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: rgba(43, 45, 66, 0.1);
    overflow: hidden;
    margin-bottom: 10px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--sun);
    transition: width 0.4s ease;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 14px;
    font: 600 calc(14px * var(--text-scale, 1)) var(--font-title);
    color: var(--ink);
    cursor: pointer;
  }
  .ghost {
    background: rgba(43, 45, 66, 0.07);
  }
  .primary {
    background: var(--sun);
  }
  @keyframes up {
    from {
      transform: translate(-50%, 20px);
      opacity: 0;
    }
  }
  @media (max-height: 560px) and (orientation: landscape) {
    .tour {
      width: min(560px, calc(100vw - 420px));
      min-width: 320px;
      padding: 10px 12px;
    }
    .text {
      font-size: calc(15px * var(--text-scale, 1));
      margin: 4px 0 8px;
    }
    button {
      min-height: 38px;
      font-size: calc(13px * var(--text-scale, 1));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tour {
      animation: none;
    }
  }
</style>
