<script lang="ts">
  import Icon from './Icon.svelte';
  /**
   * Form kontak (docs/10 bagian 4): Web3Forms langsung dari browser bila VITE_WEB3FORMS_ACCESS_KEY diisi,
   * dengan honeypot `botcheck`. Tanpa key (atau gagal) → fallback membuka email dengan isi siap kirim.
   */
  import { content } from '../content';
  import { t } from '../i18n';
  import { actions } from './bridge';
  import { visitor } from './visitor';

  const KEY = (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY as string | undefined)?.trim() ?? '';
  let name = $state($visitor.name);
  let email = $state('');
  let message = $state('');
  let botcheck = $state('');
  let status = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
  let valid = $derived(name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && message.trim().length >= 5);

  function mailto(): string {
    const to = $content.socials.contactEmail;
    const subject = encodeURIComponent($t('contact.subject'));
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function send(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (!valid || status === 'sending' || botcheck) return;
    if (!KEY) {
      window.location.href = mailto();
      status = 'sent';
      actions.paperPlane();
      return;
    }
    status = 'sending';
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: KEY, name: name.slice(0, 80), email: email.slice(0, 120), message: message.slice(0, 3000), subject: $t('contact.subject'), botcheck: '' }),
        signal: AbortSignal.timeout(10000),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean };
      status = res.ok && json.success !== false ? 'sent' : 'error';
      if (status === 'sent') actions.paperPlane();
    } catch {
      status = 'error';
    }
  }
</script>

<p class="p-kicker">{$t('panels.contact')}</p>
<h2 class="p-title">{$t('contact.title')}</h2>
{#if status === 'sent'}
  <p class="p-card p-icon"><Icon name="mail" size={18} /> {$t('contact.sent')}</p>
{:else}
  <form onsubmit={send} novalidate>
    <label class="p-field">{$t('contact.name')}<input bind:value={name} maxlength="80" autocomplete="name" required data-autofocus /></label>
    <label class="p-field">{$t('contact.email')}<input type="email" bind:value={email} maxlength="120" autocomplete="email" required /></label>
    <label class="p-field">{$t('contact.message')}<textarea bind:value={message} rows="5" maxlength="3000" required></textarea></label>
    <input class="hp" tabindex="-1" autocomplete="off" bind:value={botcheck} aria-hidden="true" name="botcheck" />
    {#if status === 'error'}<p class="p-card err p-icon"><Icon name="warn" size={18} /> <span>{$t('contact.error')} <a href={mailto()}>{$content.socials.contactEmail}</a></span></p>{/if}
    <div class="p-row">
      <button class="p-btn" type="submit" disabled={!valid || status === 'sending'}>{#if status !== 'sending'}<Icon name="mail" size={18} />{/if} {status === 'sending' ? $t('contact.sending') : $t('contact.send')}</button>
    </div>
    <p class="p-muted">{KEY ? $t('contact.privacy') : $t('contact.fallback')}</p>
  </form>
{/if}

<style>
  .hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
  }
  .err a {
    color: #2f8fa6;
  }
</style>
