<script lang="ts">
  import { toasts } from '../core/AppState';
  import Icon from './Icon.svelte';
  import { isIconName, type IconName } from './icons';

  let { max = 4 }: { max?: number } = $props();
  let shown = $derived($toasts.slice(-max));

  /** Sumber lama masih mengirim emoji: dipetakan ke ikon SVG supaya tampilan seragam di semua perangkat. */
  const FROM_EMOJI: Record<string, IconName> = {
    '🕹️': 'gamepad', '🧭': 'compass', '🛂': 'passport', '📸': 'camera', '🛬': 'takeoff', '💥': 'warn', '⚠️': 'warn',
    '💦': 'rain', '🛫': 'takeoff', '🏅': 'trophy', '⭐': 'star', '😵': 'warn', '🔔': 'sparkle', '🚀': 'rocket',
    '👏': 'mic', '💪': 'dumbbell', '🧱': 'blocks', '📬': 'mail', '🎈': 'sparkle', '🎵': 'music', '🏁': 'flag', '🍳': 'pan',
    '🏮': 'lantern', '🏆': 'trophy',
  };
  const DEFAULT: Record<string, IconName> = { success: 'check', warn: 'warn', info: 'info' };
  function iconFor(icon: string | undefined, kind: string): IconName {
    if (isIconName(icon)) return icon;
    return (icon && FROM_EMOJI[icon]) || DEFAULT[kind] || 'info';
  }
</script>

<div class="toasts" aria-live="polite">
  {#each shown as toast (toast.id)}
    <div class="toast {toast.kind}">
      <span class="badge" aria-hidden="true"><Icon name={iconFor(toast.icon, toast.kind)} size={18} /></span>
      <span class="text">{toast.text}</span>
    </div>
  {/each}
</div>

<style>
  /* Berada di dalam TopStack (tidak fixed sendiri). */
  .toasts {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    width: 100%;
  }
  .toast {
    background: var(--panel-strong);
    border-radius: 999px;
    padding: 6px 16px 6px 6px;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: calc(16px * var(--text-scale, 1));
    line-height: 1.25;
    box-shadow: var(--shadow);
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: 100%;
    animation: in 0.35s cubic-bezier(0.2, 1.5, 0.4, 1);
  }
  .badge {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #2f8fa6;
    color: #fff;
  }
  .toast.success .badge {
    background: var(--leaf);
  }
  .toast.warn .badge {
    background: var(--berry);
  }
  .text {
    min-width: 0;
  }
  @keyframes in {
    from {
      transform: translateY(-10px) scale(0.85);
      opacity: 0;
    }
  }
  @media (max-width: 560px) {
    .toast {
      font-size: calc(14px * var(--text-scale, 1));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
