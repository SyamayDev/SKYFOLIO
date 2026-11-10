<script lang="ts">
  /** Konfirmasi sebelum membuka tautan keluar (docs/07): "Buka Instagram?" — tidak pernah langsung membuka tab. */
  import { content } from '../content';
  import { t } from '../i18n';

  let { id, data, onclose }: { id: string; data?: Record<string, string> | undefined; onclose: () => void } = $props();
  let link = $derived(id === 'url' ? { label: data?.label ?? '', url: data?.url ?? '', value: data?.url ?? '' } : $content.socials.links.find((l) => l.id === id && l.public));
  let safe = $derived(!!link && /^(https?:\/\/|mailto:)/i.test(link.url));

  function open(): void {
    if (!link || !safe) return;
    window.open(link.url, '_blank', 'noopener,noreferrer');
    onclose();
  }
</script>

{#if link}
  <p class="p-kicker">{$t('panels.link')}</p>
  <h2 class="p-title">{$t('link.title', { name: link.label })}</h2>
  <p class="p-muted break">{link.value}</p>
  <div class="p-row">
    <button class="p-btn" onclick={open} disabled={!safe} data-autofocus data-testid="link-open">{$t('link.open')}</button>
    <button class="p-btn ghost" onclick={onclose}>{$t('link.cancel')}</button>
  </div>
{/if}

<style>
  .break {
    word-break: break-all;
  }
</style>
