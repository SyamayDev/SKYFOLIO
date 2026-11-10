<script lang="ts">
  import { toasts } from '../core/AppState';
</script>

<div class="toasts" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast {toast.kind}">
      {#if toast.icon}<span class="icon" aria-hidden="true">{toast.icon}</span>{/if}
      <span>{toast.text}</span>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: calc(58px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    width: min(460px, calc(100vw - 32px));
  }
  .toast {
    background: var(--panel-strong);
    border-radius: 999px;
    padding: 8px 16px;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 17px;
    box-shadow: var(--shadow);
    display: flex;
    gap: 8px;
    align-items: center;
    animation: in 0.35s cubic-bezier(0.2, 1.5, 0.4, 1);
  }
  .toast.success {
    border: 3px solid var(--leaf);
  }
  .toast.warn {
    border: 3px solid var(--berry);
  }
  @keyframes in {
    from {
      transform: translateY(-10px) scale(0.85);
      opacity: 0;
    }
  }
  @media (max-width: 560px) {
    .toasts {
      top: calc(126px + var(--safe-top));
    }
    .toast {
      font-size: 15px;
    }
  }
</style>
