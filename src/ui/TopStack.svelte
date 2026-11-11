<script lang="ts">
  /**
   * Tumpukan tengah-atas di bawah kompas: label zona, status autopilot, toast, dan (di layar sentuh/sempit)
   * kartu tutorial. Satu kolom flex → elemen-elemen ini tidak mungkin saling menimpa di ukuran layar apa pun.
   */
  import { autopilotState, currentZone, inputDevice, panel, paused } from '../core/AppState';
  import { L, content } from '../content';
  import { locale, t } from '../i18n';
  import { actions } from './bridge';
  import Icon from './Icon.svelte';
  import { ZONE_ICONS } from './icons';
  import { compact, shortLandscape } from './layout';
  import PikoBubble from './PikoBubble.svelte';
  import Toasts from './Toasts.svelte';
  import Tutorial from './Tutorial.svelte';

  let zoneName = $derived($currentZone ? L($content.zones.zones.find((z) => z.id === $currentZone)?.name, $locale) : '');
  let tutorialHere = $derived($compact || $inputDevice === 'touch');
  let { rotate = false, onrotate }: { rotate?: boolean; onrotate?: () => void } = $props();
</script>

<div class="stack">
  {#if rotate}
    <button class="rotate" onclick={() => onrotate?.()}><Icon name="rotate" size={18} /> <span>{$t('hud.rotateHint')}</span> <Icon name="close" size={14} /></button>
  {/if}
  {#if zoneName && $inputDevice !== 'touch'}
    <div class="zone-chip"><Icon name={ZONE_ICONS[$currentZone ?? ''] ?? 'pin'} size={14} /> <span>{zoneName}</span></div>
  {/if}
  {#if $autopilotState.active}
    <div class="autopilot" role="status">
      <Icon name="compass" size={20} />
      <span class="txt">{$t('autopilot.flyingTo', { target: $autopilotState.target ?? '' })}</span>
      <button onclick={() => actions.cancelAutopilot()} aria-label={$t('autopilot.cancel')}><Icon name="close" size={16} /></button>
    </div>
  {/if}
  <Toasts max={tutorialHere ? 2 : 4} />
  {#if tutorialHere && !$paused}<Tutorial inStack />{/if}
  {#if tutorialHere && !$shortLandscape && !$paused && !$panel}<PikoBubble />{/if}
</div>
{#if tutorialHere && $shortLandscape && !$paused && !$panel}<PikoBubble side />{/if}
{#if !tutorialHere && !$paused}<Tutorial />{/if}

<style>
  .stack {
    position: fixed;
    top: var(--stack-top);
    left: 50%;
    transform: translateX(-50%);
    width: min(460px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    pointer-events: none;
    z-index: 4;
  }
  .zone-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    font: 600 calc(13px * var(--text-scale, 1)) var(--font-title);
    background: var(--panel);
    border-radius: 999px;
    padding: 4px 12px 4px 9px;
    box-shadow: var(--shadow);
    color: var(--ink);
  }
  .zone-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .zone-chip :global(.icon) {
    color: #2f8fa6;
  }
  .autopilot {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 100%;
    background: #2f8fa6;
    color: #fff;
    border-radius: 999px;
    padding: 5px 6px 5px 14px;
    font: 600 calc(15px * var(--text-scale, 1)) var(--font-title);
    pointer-events: auto;
    box-shadow: var(--shadow);
  }
  .txt {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rotate {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    border-radius: 999px;
    background: var(--panel-strong);
    color: var(--ink);
    box-shadow: var(--shadow);
    padding: 8px 14px;
    font: 600 calc(14px * var(--text-scale, 1)) var(--font-title);
    pointer-events: auto;
    cursor: pointer;
  }
  /* HP landscape: tumpukan lebih sempit supaya radar (kiri) & tombol (kanan) tetap bebas. */
  @media (max-height: 560px) {
    .stack {
      width: min(400px, calc(100vw - 500px));
      min-width: 300px;
    }
  }
  .autopilot button {
    flex: none;
    border: 0;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
</style>
