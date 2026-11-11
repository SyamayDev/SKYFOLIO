<script lang="ts">
  /** Gelembung ucapan Piko. `docked` = di pojok kanan bawah (desktop); selain itu ikut alur TopStack. */
  import { settings } from '../core/Settings';
  import { pikoLine } from './glue';
  import PikoAvatar from './PikoAvatar.svelte';

  let { docked = false, side = false }: { docked?: boolean; side?: boolean } = $props();
</script>

{#if $pikoLine && $settings.copilot.enabled}
  {#key $pikoLine.n}
    <div class="piko mood-{$pikoLine.mood}" class:docked class:side aria-hidden="true">
      <span class="avatar"><PikoAvatar size={40} mood={$pikoLine.mood} /></span>
      <span class="bubble">{$pikoLine.text}</span>
    </div>
  {/key}
{/if}

<style>
  .piko {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    pointer-events: none;
    animation: pop 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  .piko.docked {
    position: fixed;
    right: calc(12px + var(--safe-right));
    bottom: calc(150px + var(--safe-bottom));
    width: auto;
    max-width: min(360px, 40vw);
    flex-direction: row-reverse;
    align-items: flex-end;
  }
  /* HP landscape: kanan atas, di bawah tombol HUD dan di atas tombol aksi. */
  .piko.side {
    position: fixed;
    top: calc(70px + var(--safe-top));
    right: calc(12px + var(--safe-right));
    width: min(240px, calc(50vw - 190px));
    flex-direction: row-reverse;
  }
  .side .avatar {
    width: 36px;
    height: 36px;
  }
  .side .bubble {
    border-radius: 18px 4px 18px 18px;
    font-size: calc(13px * var(--text-scale, 1));
    padding: 7px 11px;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: #fff;
    box-shadow: var(--shadow);
    flex: none;
  }
  .bubble {
    background: #fff;
    border-radius: 4px 18px 18px 18px;
    padding: 9px 14px;
    font-size: calc(14px * var(--text-scale, 1));
    line-height: 1.35;
    box-shadow: var(--shadow);
    min-width: 0;
  }
  .docked .bubble {
    border-radius: 18px 18px 4px 18px;
    font-size: calc(15px * var(--text-scale, 1));
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.85) translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .piko {
      animation: none;
    }
  }
</style>
