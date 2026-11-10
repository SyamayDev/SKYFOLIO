<script lang="ts">
  import Icon from './Icon.svelte';
  import { appPhase, preflight } from '../core/AppState';
  import type { PreflightItemId } from '../core/EventBus';
  import { updateSettings } from '../core/Settings';
  import { content, L } from '../content';
  import { locale, t } from '../i18n';
  import { actions } from './bridge';
  import { cleanName, visitor } from './visitor';
  import { progress } from '../game/Progress';

  const items: PreflightItemId[] = ['fuel', 'propeller', 'map', 'radio', 'copilot', 'weather'];
  let doneCount = $derived(items.filter((i) => $preflight[i]).length);
  let ready = $derived($appPhase === 'ready');
  let boarding = $state(false);
  let name = $state($visitor.name);
  let printed = $derived(ready);
  let factIdx = $state(0);
  let stampCount = $derived(Object.keys($progress.stamps).length);

  // Fakta lucu bergiliran — hanya dari isi content/ (aturan 1).
  let facts = $derived.by(() => {
    const c = $content;
    const loc = $locale;
    const out: string[] = [];
    out.push(`${c.profile.nickname} · ${L(c.profile.tagline, loc)} · ${c.profile.education.campus}`);
    for (const h of c.easterEggs.hobbies) out.push(`${$t('preflight.factHobby')} ${L(h.label, loc)}`);
    const expert = c.skills.groups.flatMap((g) => g.skills).filter((s) => s.level >= 5);
    if (expert.length) out.push(`${$t('preflight.factSkills')} ${expert.slice(0, 4).map((s) => (typeof s.name === 'string' ? s.name : L(s.name, loc))).join(', ')}`);
    out.push(`${$t('preflight.factProjects', { n: c.projects.length })}`);
    return out;
  });

  $effect(() => {
    const id = setInterval(() => (factIdx = (factIdx + 1) % Math.max(1, facts.length)), 3600);
    return () => clearInterval(id);
  });

  let today = $derived(new Intl.DateTimeFormat($locale === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()));

  function saveName(): void {
    visitor.set({ ...$visitor, name: cleanName(name) });
  }

  function board(recruiter = false): void {
    if (!ready || boarding) return;
    saveName();
    boarding = true;
    actions.click();
    actions.board();
    if (recruiter) setTimeout(() => actions.startTour?.(), 900);
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
    <svg class="plane" viewBox="0 0 240 120" aria-hidden="true">
      <g class="bob">
        <ellipse cx="120" cy="104" rx="70" ry="6" fill="rgba(43,45,66,0.12)" />
        <path d="M58 62 L22 50 L26 74 Z" fill="#E5484D" />
        <rect x="28" y="66" width="34" height="9" rx="4.5" fill="#F4E7CD" />
        <ellipse cx="116" cy="62" rx="68" ry="22" fill="#F4E7CD" stroke="#2B2D42" stroke-width="3" />
        <path d="M60 64 Q116 72 172 62" stroke="#2F8FA6" stroke-width="4" fill="none" />
        <rect x="70" y="70" width="110" height="12" rx="6" fill="#F4E7CD" stroke="#2B2D42" stroke-width="2.5" />
        <rect x="160" y="70" width="22" height="12" rx="6" fill="#E5484D" />
        <circle cx="110" cy="76" r="5" fill="#2F8FA6" /><circle cx="110" cy="76" r="2.4" fill="#FFC93C" />
        <ellipse cx="182" cy="62" rx="14" ry="22" fill="#E5484D" stroke="#2B2D42" stroke-width="3" />
        <circle cx="186" cy="62" r="6" fill="#DCE2EA" />
        <g class="prop"><rect x="193" y="30" width="6" height="64" rx="3" fill="#7CC3F0" /></g>
        <circle cx="112" cy="40" r="11" fill="#FFD3B0" /><path d="M100 38 A12 12 0 0 1 124 38 L124 34 A12 10 0 0 0 100 34 Z" fill="#2F8FA6" />
        <circle cx="106" cy="33" r="3.5" fill="#CFEFFF" stroke="#C9954E" stroke-width="2" /><circle cx="118" cy="33" r="3.5" fill="#CFEFFF" stroke="#C9954E" stroke-width="2" />
        <circle cx="86" cy="44" r="8" fill="#FFD3B0" /><path d="M77 42 A9 8 0 0 1 95 42 Z" fill="#3AA0FF" />
        <path d="M100 52 Q112 46 124 52" stroke="#2F8FA6" stroke-width="5" fill="none" />
        <line x1="96" y1="86" x2="92" y2="98" stroke="#2F8FA6" stroke-width="3" /><circle cx="92" cy="99" r="6" fill="#3A3D4A" />
        <line x1="140" y1="86" x2="144" y2="98" stroke="#2F8FA6" stroke-width="3" /><circle cx="144" cy="99" r="6" fill="#3A3D4A" />
      </g>
    </svg>
    <h1>SKYFOLIO</h1>
    <p class="sub">{$t('preflight.subtitle')}</p>

    {#if !printed}
      <section class="checklist" aria-label={$t('preflight.title')}>
        <h2>{$t('preflight.title')}</h2>
        <ul>
          {#each items as id (id)}
            <li class:done={$preflight[id]}>
              <span class="box" aria-hidden="true">{#if $preflight[id]}<Icon name="check" size={14} />{/if}</span>
              <span>{$t(`preflight.items.${id}`)}</span>
              <span class="sr-only">{$preflight[id] ? '✓' : '…'}</span>
            </li>
          {/each}
        </ul>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={items.length} aria-valuenow={doneCount}>
          <div class="fill" style:width={`${(doneCount / items.length) * 100}%`}></div>
        </div>
        {#key factIdx}<p class="fact"><Icon name="sparkle" size={16} /> {facts[factIdx % facts.length]}</p>{/key}
      </section>
    {:else}
      <section class="pass" aria-label={$t('boarding.title')}>
        <div class="stub">
          <span class="lbl">{$t('boarding.title')}</span>
          <span class="flight">{$visitor.flight}</span>
        </div>
        <div class="grid">
          <label class="namebox">
            <span class="lbl">{$t('boarding.passenger')}</span>
            <input
              type="text"
              maxlength="16"
              bind:value={name}
              onblur={saveName}
              placeholder={$t('boarding.mystery')}
              aria-label={$t('boarding.passenger')}
              data-testid="name-input"
            />
          </label>
          <div><span class="lbl">{$t('boarding.route')}</span><b>{$visitor.country} → MDN</b></div>
          <div><span class="lbl">{$t('boarding.seat')}</span><b>{$t('boarding.pilotSeat')}</b></div>
          <div><span class="lbl">{$t('boarding.date')}</span><b>{today}</b></div>
          <div><span class="lbl">{$t('boarding.stamps')}</span><b>{stampCount}</b></div>
          <div><span class="lbl">{$t('boarding.copilot')}</span><b>{$content.copilot.name}</b></div>
        </div>
        <div class="barcode" aria-hidden="true"></div>
      </section>
    {/if}

    <button class="board" disabled={!ready || boarding} onclick={() => board(false)} data-testid="board">
      {ready ? $t('preflight.board') : $t('preflight.loading')}
    </button>
    {#if ready}
      <button class="recruiter" disabled={boarding} onclick={() => board(true)} data-testid="recruiter"><Icon name="clapper" size={18} /> {$t('boarding.recruiter')}</button>
    {/if}
    <p class="hint"><Icon name="sound" size={16} /> {$t('preflight.hint')}</p>
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
    z-index: 2;
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
    width: min(440px, 100%);
    background: var(--panel-strong);
    border-radius: 28px;
    padding: 18px 22px 20px;
    box-shadow: var(--shadow);
    text-align: center;
  }
  .plane {
    width: 210px;
    height: 105px;
    margin: -8px auto 0;
    display: block;
  }
  .bob {
    animation: bob 2.6s ease-in-out infinite;
    transform-origin: 120px 60px;
  }
  .prop {
    animation: spin 0.18s linear infinite;
    transform-origin: 196px 62px;
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0) rotate(-2deg);
    }
    50% {
      transform: translateY(-5px) rotate(2deg);
    }
  }
  @keyframes spin {
    to {
      transform: scaleY(0.15);
    }
  }
  h1 {
    font-family: var(--font-title);
    font-size: 34px;
    margin: 0;
    letter-spacing: 1px;
  }
  .sub {
    margin: 2px 0 12px;
    color: var(--panel-ink);
  }
  .checklist h2 {
    font-family: var(--font-title);
    font-size: 17px;
    margin: 0 0 8px;
  }
  .checklist ul {
    list-style: none;
    padding: 0;
    margin: 0 auto 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 14px;
    text-align: left;
    max-width: 320px;
  }
  .checklist li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--panel-ink);
    transition: color 0.2s;
  }
  .checklist li.done {
    color: var(--ink);
    font-weight: 700;
  }
  .box {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 2px solid var(--ink);
    display: grid;
    place-items: center;
    font-size: 14px;
    background: #fff;
    flex: none;
  }
  li.done .box {
    background: var(--leaf);
    color: #fff;
    border-color: var(--leaf);
  }
  .bar {
    height: 8px;
    border-radius: 99px;
    background: rgba(43, 45, 66, 0.1);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sky), var(--sun));
    transition: width 0.3s ease;
  }
  .fact {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 15px;
    min-height: 44px;
    margin: 10px 0 0;
    animation: fadein 0.4s ease;
  }
  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .pass {
    position: relative;
    background: #fff;
    border-radius: 18px;
    border: 2px dashed rgba(43, 45, 66, 0.25);
    padding: 12px 14px;
    text-align: left;
    animation: print 0.9s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    transform-origin: top center;
    overflow: hidden;
  }
  @keyframes print {
    from {
      clip-path: inset(0 0 100% 0);
      transform: translateY(-14px);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }
  .stub {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 2px solid var(--sun);
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .flight {
    font-family: var(--font-title);
    font-size: 22px;
    color: #2f8fa6;
  }
  .lbl {
    display: block;
    font-size: 11px;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--panel-ink);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px 12px;
  }
  .namebox {
    grid-column: 1 / -1;
  }
  .namebox input {
    width: 100%;
    font: 700 18px var(--font-title);
    border: 0;
    border-bottom: 2px solid rgba(43, 45, 66, 0.2);
    padding: 6px 2px;
    background: transparent;
    color: var(--ink);
    min-height: 44px;
  }
  .namebox input:focus {
    outline: none;
    border-bottom-color: var(--sky);
  }
  .barcode {
    height: 26px;
    margin-top: 10px;
    background: repeating-linear-gradient(90deg, #2b2d42 0 2px, transparent 2px 5px, #2b2d42 5px 6px, transparent 6px 9px);
    opacity: 0.75;
    border-radius: 4px;
  }
  .board {
    margin-top: 14px;
    width: 100%;
    min-height: 56px;
    border: 0;
    border-radius: 18px;
    background: var(--sun);
    color: var(--ink);
    font: 700 20px var(--font-title);
    box-shadow: 0 6px 0 #d9a21c;
    transition: transform 0.12s ease;
  }
  .board:not(:disabled):hover {
    transform: translateY(-1px);
  }
  .board:not(:disabled):active {
    transform: translateY(3px);
    box-shadow: 0 3px 0 #d9a21c;
  }
  .board:disabled {
    opacity: 0.6;
  }
  .recruiter {
    margin-top: 10px;
    width: 100%;
    min-height: 48px;
    border: 2px solid rgba(43, 45, 66, 0.15);
    border-radius: 16px;
    background: #fff;
    font: 600 16px var(--font-title);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
  }
  .hint {
    font-size: 14px;
    color: var(--panel-ink);
    margin: 10px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  @media (max-height: 560px) {
    .plane {
      display: none;
    }
    .card {
      padding: 12px 18px;
    }
    .grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bob,
    .prop,
    .pass {
      animation: none;
    }
  }
</style>
