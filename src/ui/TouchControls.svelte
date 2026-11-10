<script lang="ts">
  import Icon from './Icon.svelte';
  import { hud, isPortrait } from '../core/AppState';
  import { touchState } from '../core/Input';
  import { settings } from '../core/Settings';
  import { t } from '../i18n';
  import { actions } from './bridge';

  const RADIUS = 58;
  let stick = $state({ active: false, x: 0, y: 0, kx: 0, ky: 0 });
  let stickId: number | null = null;
  let lookId: number | null = null;
  let lastLook = { x: 0, y: 0 };
  let lastTap = 0;
  let boostDown = $state(false);
  let brakeDown = $state(false);
  let leftSide = $derived($settings.controls.touchJoystickSide !== 'right');

  function capture(e: PointerEvent): void {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer sintetis/tidak aktif — abaikan.
    }
  }

  function onStickDown(e: PointerEvent): void {
    if (stickId !== null) return;
    stickId = e.pointerId;
    capture(e);
    stick = { active: true, x: e.clientX, y: e.clientY, kx: 0, ky: 0 };
    touchState.active = true;
  }

  function onStickMove(e: PointerEvent): void {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - stick.x;
    let dy = e.clientY - stick.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    stick.kx = dx;
    stick.ky = dy;
    // Zona mati kecil + kurva halus.
    const nx = dx / RADIUS;
    const ny = -dy / RADIUS;
    const dz = 0.08;
    const curve = (v: number): number => (Math.abs(v) < dz ? 0 : Math.sign(v) * ((Math.abs(v) - dz) / (1 - dz)) ** 1.4);
    touchState.stickX = curve(nx);
    touchState.stickY = curve(ny);
  }

  function onStickUp(e: PointerEvent): void {
    if (e.pointerId !== stickId) return;
    stickId = null;
    stick = { active: false, x: 0, y: 0, kx: 0, ky: 0 };
    touchState.stickX = 0;
    touchState.stickY = 0;
    touchState.active = false;
  }

  function onLookDown(e: PointerEvent): void {
    if (lookId !== null) return;
    lookId = e.pointerId;
    capture(e);
    lastLook = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    // Ketuk dua kali di sisi kanan = lompat / barrel roll.
    if (now - lastTap < 300) touchState.jumpQueued = true;
    lastTap = now;
  }

  function onLookMove(e: PointerEvent): void {
    if (e.pointerId !== lookId) return;
    actions.addLook(e.clientX - lastLook.x, e.clientY - lastLook.y);
    lastLook = { x: e.clientX, y: e.clientY };
  }

  function onLookUp(e: PointerEvent): void {
    if (e.pointerId === lookId) lookId = null;
  }

  function hold(kind: 'boost' | 'brake', down: boolean): void {
    if (kind === 'boost') {
      touchState.boost = down;
      boostDown = down;
    } else {
      touchState.brake = down;
      brakeDown = down;
    }
  }

  function press(kind: 'jump' | 'horn' | 'interact'): void {
    if (kind === 'jump') touchState.jumpQueued = true;
    else if (kind === 'interact') touchState.actionQueued = true;
    else touchState.hornQueued = true;
    if (navigator.vibrate) navigator.vibrate(10);
  }
</script>

<div class="touch" class:portrait={$isPortrait} class:swap={!leftSide}>
  <div
    class="stick-zone"
    role="application"
    aria-label="Joystick"
    onpointerdown={onStickDown}
    onpointermove={onStickMove}
    onpointerup={onStickUp}
    onpointercancel={onStickUp}
    data-testid="stick-zone"
  >
    {#if stick.active}
      <div class="base" style:left={`${stick.x}px`} style:top={`${stick.y}px`}>
        <div class="knob" style:transform={`translate(${stick.kx}px, ${stick.ky}px)`}></div>
      </div>
    {:else}
      <div class="ghost" aria-hidden="true"><div class="knob"></div></div>
    {/if}
  </div>

  <div
    class="look-zone"
    role="application"
    aria-label={$t('hud.camera')}
    onpointerdown={onLookDown}
    onpointermove={onLookMove}
    onpointerup={onLookUp}
    onpointercancel={onLookUp}
  ></div>

  <div class="buttons">
    {#if $hud.action}
      <button
        class="btn ctx"
        aria-label={$t($hud.action as never)}
        onpointerdown={(e) => {
          e.stopPropagation();
          press('interact');
        }}
        data-testid="btn-ctx">{$t($hud.action as never)}</button
      >
    {/if}
    <button
      class="btn horn"
      aria-label={$t('hud.horn')}
      onpointerdown={(e) => {
        e.stopPropagation();
        press('horn');
      }}><Icon name="horn" size={24} /></button
    >
    <button
      class="btn action"
      aria-label={$hud.grounded ? $t('hud.jump') : $t('hud.roll')}
      onpointerdown={(e) => {
        e.stopPropagation();
        press('jump');
      }}
      data-testid="btn-action">{$hud.grounded ? $t('hud.jump') : $t('hud.roll')}</button
    >
    <button
      class="btn brake"
      class:down={brakeDown}
      aria-label={$t('hud.brake')}
      onpointerdown={(e) => {
        e.stopPropagation();
        hold('brake', true);
      }}
      onpointerup={() => hold('brake', false)}
      onpointercancel={() => hold('brake', false)}
      onpointerleave={() => hold('brake', false)}
      data-testid="btn-brake">{$t('hud.brake')}</button
    >
    <button
      class="btn boost"
      class:down={boostDown}
      aria-label={$t('hud.boost')}
      onpointerdown={(e) => {
        e.stopPropagation();
        hold('boost', true);
      }}
      onpointerup={() => hold('boost', false)}
      onpointercancel={() => hold('boost', false)}
      onpointerleave={() => hold('boost', false)}
      data-testid="btn-boost"><Icon name={$hud.rocket ? 'rocket' : 'boost'} size={20} /><span>{$t('hud.boost')}</span></button
    >
  </div>
</div>

<style>
  .touch {
    position: fixed;
    inset: 0;
    pointer-events: none;
    font-family: var(--font-title);
  }
  .stick-zone,
  .look-zone {
    position: absolute;
    top: 30%;
    bottom: 0;
    pointer-events: auto;
    touch-action: none;
  }
  .stick-zone {
    left: 0;
    width: 45%;
  }
  .look-zone {
    right: 0;
    width: 55%;
    top: 22%;
  }
  .swap .stick-zone {
    left: auto;
    right: 0;
  }
  .swap .look-zone {
    right: auto;
    left: 0;
  }
  .base,
  .ghost {
    position: absolute;
    width: 128px;
    height: 128px;
    margin: -64px 0 0 -64px;
    border-radius: 50%;
    background: rgba(255, 246, 230, 0.35);
    border: 3px solid rgba(255, 246, 230, 0.85);
    box-shadow: var(--shadow);
    display: grid;
    place-items: center;
  }
  .ghost {
    left: calc(110px + var(--safe-left));
    bottom: calc(46px + var(--safe-bottom));
    top: auto;
    margin: 0 0 0 -64px;
    opacity: 0.55;
  }
  .swap .ghost {
    left: auto;
    right: calc(110px + var(--safe-right));
    margin: 0 -64px 0 0;
  }
  .knob {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: var(--sky);
    border: 3px solid #fff;
  }
  .buttons {
    position: absolute;
    right: calc(16px + var(--safe-right));
    bottom: calc(18px + var(--safe-bottom));
    width: 230px;
    height: 200px;
    pointer-events: none;
  }
  .swap .buttons {
    right: auto;
    left: calc(16px + var(--safe-left));
  }
  .btn {
    position: absolute;
    pointer-events: auto;
    border: 0;
    border-radius: 50%;
    color: var(--ink);
    font-weight: 700;
    box-shadow: var(--shadow);
    touch-action: none;
    display: grid;
    place-items: center;
    transition: transform 0.08s;
  }
  .btn:active,
  .btn.down {
    transform: scale(0.92);
  }
  .boost {
    right: 0;
    bottom: 0;
    width: 96px;
    height: 96px;
    background: var(--berry);
    color: #fff;
    font-size: 18px;
  }
  .boost.down {
    background: #ff3d44;
  }
  .brake {
    right: 108px;
    bottom: 0;
    width: 68px;
    height: 68px;
    background: var(--panel-strong);
    font-size: 15px;
  }
  .ctx {
    grid-column: 1 / -1;
    min-width: 150px;
    width: auto;
    border-radius: 999px;
    background: #2f8fa6;
    color: #fff;
    font: 700 15px var(--font-title);
    padding: 0 16px;
  }
  .action {
    right: 18px;
    bottom: 108px;
    width: 72px;
    height: 72px;
    background: var(--sun);
    font-size: 15px;
  }
  .horn {
    right: 104px;
    bottom: 86px;
    width: 56px;
    height: 56px;
    background: var(--panel-strong);
    font-size: 22px;
  }
  .portrait .buttons {
    transform: scale(0.92);
    transform-origin: bottom right;
  }
</style>
