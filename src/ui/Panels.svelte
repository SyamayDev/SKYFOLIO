<script lang="ts">
  /**
   * Wadah semua panel (docs/07 bagian 2 & 4): bottom sheet di HP (bisa ditarik 50%/90%), panel samping di
   * desktop. Fokus terjebak di dalam panel, Esc menutup. Di HP pesawat otomatis melayang selama membaca.
   */
  import Icon from './Icon.svelte';
  import { inputDevice, isPortrait, panel } from '../core/AppState';
  import { t } from '../i18n';
  import { actions } from './bridge';
  import PanelBts from './PanelBts.svelte';
  import PanelContact from './PanelContact.svelte';
  import PanelLink from './PanelLink.svelte';
  import PanelMap from './PanelMap.svelte';
  import PanelPassport from './PanelPassport.svelte';
  import PanelProject from './PanelProject.svelte';
  import PanelZone from './PanelZone.svelte';

  let el = $state<HTMLElement | null>(null);
  let tall = $state(false);
  let sheet = $derived($inputDevice === 'touch' || $isPortrait);
  let prevFocus: Element | null = null;

  $effect(() => {
    if ($panel && el) {
      prevFocus = document.activeElement;
      tall = $panel.kind === 'map' || $panel.kind === 'passport' || $panel.kind === 'project';
      queueMicrotask(() => (el?.querySelector<HTMLElement>('[data-autofocus], button, a, input, textarea') ?? el)?.focus());
      if (sheet) actions.hover?.(true);
    }
  });

  function close(): void {
    actions.click();
    panel.set(null);
    actions.hover?.(false);
    (prevFocus as HTMLElement | null)?.focus?.();
  }

  function onKey(e: KeyboardEvent): void {
    if (!$panel) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab' && el) {
      const f = [...el.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    // Jangan teruskan tombol ke kontrol pesawat saat mengetik.
    e.stopPropagation();
  }

  let dragY = $state(0);
  let startY = 0;
  function dragStart(e: PointerEvent): void {
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function dragMove(e: PointerEvent): void {
    if (!startY) return;
    dragY = e.clientY - startY;
  }
  function dragEnd(): void {
    if (dragY < -40) tall = true;
    else if (dragY > 120) {
      if (tall) tall = false;
      else close();
    }
    dragY = 0;
    startY = 0;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if $panel}
  <div class="scrim" onpointerdown={close} aria-hidden="true"></div>
  <div
    class="panel"
    class:sheet
    class:tall
    bind:this={el}
    role="dialog"
    aria-modal="true"
    aria-label={$t(`panels.${$panel.kind}` as never)}
    tabindex="-1"
    style:transform={dragY > 0 && sheet ? `translateY(${dragY}px)` : undefined}
    data-testid="panel"
  >
    {#if sheet}
      <div class="handle" role="presentation" onpointerdown={dragStart} onpointermove={dragMove} onpointerup={dragEnd} onpointercancel={dragEnd}><span></span></div>
    {/if}
    <button class="close" onclick={close} aria-label={$t('common.close')} data-testid="panel-close"><Icon name="close" size={20} /></button>
    <div class="body">
      {#if $panel.kind === 'zone'}<PanelZone id={$panel.id ?? ''} />
      {:else if $panel.kind === 'project'}<PanelProject id={$panel.id ?? ''} />
      {:else if $panel.kind === 'passport'}<PanelPassport />
      {:else if $panel.kind === 'map'}<PanelMap onclose={close} />
      {:else if $panel.kind === 'contact'}<PanelContact />
      {:else if $panel.kind === 'link'}<PanelLink id={$panel.id ?? ''} data={$panel.data} onclose={close} />
      {:else if $panel.kind === 'bts'}<PanelBts />
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    z-index: 10;
    inset: 0;
    background: rgba(43, 45, 66, 0.18);
    pointer-events: auto;
  }
  .panel {
    position: fixed;
    z-index: 11;
    top: calc(12px + var(--safe-top));
    right: calc(12px + var(--safe-right));
    bottom: calc(12px + var(--safe-bottom));
    width: min(440px, calc(100vw - 24px));
    background: var(--panel-strong);
    border-radius: 24px;
    box-shadow: var(--shadow);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    animation: slide 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
    outline: none;
    color: var(--ink);
  }
  .panel.sheet {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    height: 52vh;
    border-radius: 24px 24px 0 0;
    padding-bottom: var(--safe-bottom);
    transition: height 0.25s ease;
    animation: up 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .panel.sheet.tall {
    height: 90vh;
  }
  @keyframes slide {
    from {
      transform: translateX(30px);
      opacity: 0;
    }
  }
  @keyframes up {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
  .handle {
    display: grid;
    place-items: center;
    height: 26px;
    flex: none;
    touch-action: none;
    cursor: grab;
  }
  .handle span {
    width: 52px;
    height: 6px;
    border-radius: 3px;
    background: rgba(43, 45, 66, 0.25);
  }
  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    background: rgba(43, 45, 66, 0.08);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--ink);
    z-index: 2;
  }
  .body {
    overflow-y: auto;
    padding: 18px 20px 22px;
    flex: 1;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  .sheet .body {
    padding-top: 4px;
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>
