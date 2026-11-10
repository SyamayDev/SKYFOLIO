<script lang="ts">
  /**
   * Obrolan dengan Piko (docs/06 bagian 9): gelembung dari avatar Piko, chip jawaban cepat, indikator
   * mengetik (Piko mencoret-coret buku kecil). Riwayat hanya selama sesi. Teks saja (tanpa suara).
   */
  import { tick } from 'svelte';
  import { ask, chat } from '../ai/CopilotClient';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import PikoAvatar from './PikoAvatar.svelte';

  let input = $state('');
  let list: HTMLElement | undefined = $state();
  let field: HTMLInputElement | undefined = $state();
  const quick = ['chat.q.best', 'chat.q.skills', 'chat.q.contact', 'chat.q.tour', 'chat.q.moon'] as const;

  async function send(text: string): Promise<void> {
    const q = text.trim();
    if (!q || $chat.typing) return;
    input = '';
    await ask(q);
  }

  $effect(() => {
    void $chat.messages.length;
    void $chat.typing;
    void tick().then(() => list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }));
  });

  $effect(() => {
    setTimeout(() => field?.focus({ preventScroll: true }), 250);
  });
</script>

<p class="p-kicker">{$t('panels.chat')}</p>
<h2 class="p-title">{$t('chat.title')}</h2>
<div class="log" bind:this={list} aria-live="polite" data-testid="chat-log">
  {#if !$chat.messages.length}
    <div class="msg piko">
      <span class="av"><PikoAvatar size={34} mood="wow" /></span>
      <p>{$t('chat.hello')}</p>
    </div>
  {/if}
  {#each $chat.messages as m (m.id)}
    <div class="msg {m.from}">
      {#if m.from === 'piko'}<span class="av"><PikoAvatar size={34} /></span>{/if}
      <p>{m.text}</p>
    </div>
  {/each}
  {#if $chat.typing}
    <div class="msg piko typing" aria-label={$t('chat.typing')}>
      <span class="av"><PikoAvatar size={34} mood="think" /></span>
      <p class="scribble" aria-hidden="true"><span class="book"><i></i><i></i><i></i></span><span class="pen"></span></p>
    </div>
  {/if}
</div>
<div class="chips" role="group" aria-label={$t('chat.quick')}>
  {#each quick as k (k)}
    <button class="chip" onclick={() => send($t(k))} disabled={$chat.typing}>{$t(k)}</button>
  {/each}
</div>
<form
  class="row"
  onsubmit={(e) => {
    e.preventDefault();
    void send(input);
  }}
>
  <input bind:this={field} bind:value={input} maxlength="300" placeholder={$t('chat.placeholder')} aria-label={$t('chat.placeholder')} enterkeyhint="send" autocomplete="off" data-testid="chat-input" />
  <button class="send" type="submit" disabled={!input.trim() || $chat.typing} aria-label={$t('chat.send')} data-testid="chat-send"><Icon name="arrow" size={20} /></button>
</form>
<p class="p-muted privacy">{$t('chat.privacy')}</p>

<style>
  .log {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: min(46vh, 420px);
    min-height: 140px;
    overflow-y: auto;
    padding: 4px 2px 8px;
    overscroll-behavior: contain;
  }
  .msg {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    max-width: 92%;
  }
  .msg p {
    margin: 0;
    padding: 9px 13px;
    border-radius: 16px;
    font-size: 15px;
    line-height: 1.4;
    box-shadow: 0 1px 0 rgba(43, 45, 66, 0.08);
  }
  .msg.piko p {
    background: #fff;
    border-bottom-left-radius: 4px;
  }
  .msg.me {
    align-self: flex-end;
  }
  .msg.me p {
    background: #2f8fa6;
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  .av {
    flex: none;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(43, 45, 66, 0.2);
  }
  /* Piko mencoret-coret buku kecil. */
  .scribble {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .book {
    display: inline-flex;
    gap: 3px;
    padding: 6px 8px;
    border-radius: 6px;
    background: #fff6e6;
    border: 2px solid #e8dcc6;
  }
  .book i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2f8fa6;
    animation: dot 1s infinite ease-in-out;
  }
  .book i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .book i:nth-child(3) {
    animation-delay: 0.3s;
  }
  .pen {
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: #ffc93c;
    transform-origin: bottom;
    animation: pen 0.5s infinite alternate ease-in-out;
  }
  @keyframes dot {
    50% {
      transform: translateY(-4px);
      opacity: 0.5;
    }
  }
  @keyframes pen {
    from {
      transform: rotate(-25deg);
    }
    to {
      transform: rotate(20deg);
    }
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }
  .chip {
    border: 0;
    border-radius: 999px;
    background: rgba(47, 143, 166, 0.12);
    color: #22717f;
    font: 600 13px var(--font-title);
    padding: 7px 12px;
    cursor: pointer;
  }
  .chip:disabled {
    opacity: 0.5;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row input {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    border: 2px solid #e6dccb;
    border-radius: 14px;
    padding: 0 14px;
    font: 16px var(--font-body);
    background: #fff;
    color: var(--ink);
  }
  .row input:focus {
    outline: 3px solid var(--sun);
    border-color: transparent;
  }
  .send {
    flex: none;
    width: 52px;
    min-height: 48px;
    border: 0;
    border-radius: 14px;
    background: var(--sun);
    color: var(--ink);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .send:disabled {
    opacity: 0.5;
  }
  .privacy {
    font-size: 12px;
    margin-top: 8px;
  }
  @media (prefers-reduced-motion: reduce) {
    .book i,
    .pen {
      animation: none;
    }
  }
</style>
