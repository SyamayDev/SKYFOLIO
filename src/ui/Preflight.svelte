<script lang="ts">
  import { appPhase, preflight } from '../core/AppState';
  import type { PreflightItemId } from '../core/EventBus';
  import { updateSettings } from '../core/Settings';
  import { locale, t } from '../i18n';
  import { actions } from './bridge';

  const items: PreflightItemId[] = ['fuel', 'propeller', 'map', 'radio', 'copilot', 'weather'];
  let doneCount = $derived(items.filter((i) => $preflight[i]).length);
  let ready = $derived($appPhase === 'ready');
  let boarding = $state(false);

  function board(): void {
    if (!ready || boarding) return;
    boarding = true;
    actions.click();
    actions.board();
  }

  function setLang(l: 'id' | 'en'): void {
    updateSettings('language', l);
  }
</script>

<div class="preflight" class:leaving={boarding}>
  <header class="top">
    <a class="ringkas" href="/ringkas/">{$t('preflight.ringkas')}</a>
    <div class="lang" role="group" aria-label={$t('preflight.language')}>
      <button class:active={$locale === 'id'} onclick={() => setLang('id')} aria-pressed={$locale === 'id'}>ID</button>
      <button class:active={$locale === 'en'} onclick={() => setLang('en')} aria-pressed={$locale === 'en'}>EN</button>
    </div>
  </header>

  <main class="card" aria-live="polite">
    <svg class="biplane" viewBox="0 0 220 110" aria-hidden="true">
      <g class="bob">
        <rect x="40" y="30" width="140" height="12" rx="6" fill="#FFC93C" />
        <rect x="48" y="68" width="124" height="11" rx="5.5" fill="#FFC93C" />
        <rect x="74" y="40" width="5" height="30" fill="#2B2D42" />
        <rect x="142" y="40" width="5" height="30" fill="#2B2D42" />
        <ellipse cx="110" cy="58" rx="58" ry="17" fill="#FFF6E6" stroke="#2B2D42" stroke-width="3" />
        <rect x="52" y="54" width="110" height="5" rx="2.5" fill="#3AA0FF" />
        <circle cx="168" cy="58" r="13" fill="#3AA0FF" stroke="#2B2D42" stroke-width="3" />
        <circle cx="96" cy="42" r="8" fill="#FFD3B0" />
        <circle cx="124" cy="43" r="7" fill="#FFD3B0" />
        <path d="M44 50 L28 36 L32 64 Z" fill="#FF5A5F" />
        <g class="prop"><rect x="180" y="34" width="5" height="48" rx="2.5" fill="#C98B55" /></g>
        <circle cx="80" cy="86" r="7" fill="#3A3D4A" />
        <circle cx="140" cy="86" r="7" fill="#3A3D4A" />
      </g>
    </svg>
    <h1>SKYFOLIO</h1>
    <p class="sub">{$t('preflight.subtitle')}</p>

    <section class="checklist" aria-label={$t('preflight.title')}>
      <h2>{$t('preflight.title')}</h2>
      <ul>
        {#each items as id (id)}
          <li class:done={$preflight[id]}>
            <span class="box" aria-hidden="true">{$preflight[id] ? '✓' : ''}</span>
            <span>{$t(`preflight.items.${id}`)}</span>
            <span class="sr-only">{$preflight[id] ? '✓' : '…'}</span>
          </li>
        {/each}
      </ul>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={items.length} aria-valuenow={doneCount}>
        <div class="fill" style:width={`${(doneCount / items.length) * 100}%`}></div>
      </div>
    </section>

    <button class="board" disabled={!ready || boarding} onclick={board} data-testid="board">
      {ready ? $t('preflight.board') : $t('preflight.loading')}
    </button>
    <p class="hint">🔊 {$t('preflight.hint')}</p>
  </main>
</div>

<style>
  .preflight {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: calc(16px + var(--safe-top)) 16px calc(16px + var(--safe-bottom));
    background: linear-gradient(180deg, rgba(77, 184, 255, 0.55), rgba(189, 232, 255, 0.35));
    backdrop-filter: blur(2px);
    transition:
      opacity 0.45s ease,
      transform 0.45s ease;
    overflow-y: auto;
    pointer-events: auto;
  }
  .preflight.leaving {
    opacity: 0;
    transform: scale(1.04);
    pointer-events: none;
  }
  .top {
    position: fixed;
    top: calc(12px + var(--safe-top));
    right: calc(12px + var(--safe-right));
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .ringkas {
    font-family: var(--font-title);
    font-weight: 600;
    color: var(--ink);
    background: var(--panel);
    padding: 10px 16px;
    border-radius: 999px;
    text-decoration: none;
    box-shadow: var(--shadow);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .lang {
    display: flex;
    background: var(--panel);
    border-radius: 999px;
    padding: 4px;
    box-shadow: var(--shadow);
  }
  .lang button {
    border: 0;
    background: transparent;
    min-width: 44px;
    min-height: 36px;
    border-radius: 999px;
    font-weight: 700;
    color: var(--ink);
  }
  .lang button.active {
    background: var(--sun);
  }
  .card {
    width: min(420px, 100%);
    background: var(--panel-strong);
    border-radius: 28px;
    padding: 18px 22px 20px;
    box-shadow: var(--shadow);
    text-align: center;
  }
  .biplane {
    width: 190px;
    height: 95px;
    margin: -4px auto 0;
    display: block;
  }
  .bob {
    animation: bob 2.6s ease-in-out infinite;
    transform-origin: 110px 58px;
  }
  .prop {
    animation: spin 0.25s linear infinite;
    transform-origin: 182px 58px;
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0) rotate(-2deg);
    }
    50% {
      transform: translateY(-6px) rotate(2deg);
    }
  }
  @keyframes spin {
    to {
      transform: scaleY(-1);
    }
  }
  h1 {
    font-family: var(--font-title);
    font-size: 40px;
    margin: 2px 0 0;
    letter-spacing: 2px;
  }
  .sub {
    margin: 2px 0 12px;
    color: var(--panel-ink);
    font-size: 15px;
  }
  .checklist {
    text-align: left;
    background: #fff;
    border-radius: 18px;
    padding: 12px 16px;
  }
  h2 {
    font-family: var(--font-title);
    font-size: 16px;
    margin: 0 0 8px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
  }
  li {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 15px;
    color: var(--panel-ink);
    transition: color 0.3s;
  }
  li.done {
    color: var(--ink);
  }
  .box {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 2px solid var(--ink);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 800;
    flex: none;
    transition:
      background 0.25s,
      transform 0.25s;
  }
  li.done .box {
    background: var(--leaf);
    color: #fff;
    border-color: var(--leaf);
    transform: scale(1.08);
  }
  .bar {
    margin-top: 10px;
    height: 8px;
    border-radius: 99px;
    background: #eee5d6;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sun), var(--lantern));
    transition: width 0.4s ease;
  }
  .board {
    margin-top: 16px;
    width: 100%;
    min-height: 58px;
    border: 0;
    border-radius: 18px;
    background: var(--sun);
    color: var(--ink);
    font-size: 22px;
    font-weight: 700;
    box-shadow: 0 6px 0 #d9a21f;
    transition:
      transform 0.15s,
      box-shadow 0.15s,
      opacity 0.2s;
  }
  .board:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .board:not(:disabled):active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 #d9a21f;
  }
  .board:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .hint {
    margin: 10px 0 0;
    font-size: 15px;
    color: var(--panel-ink);
  }
  @media (max-height: 520px) {
    .biplane {
      display: none;
    }
    .card {
      padding: 12px 18px 14px;
    }
    h1 {
      font-size: 30px;
    }
  }
</style>
