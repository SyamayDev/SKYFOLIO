<script lang="ts">
  /** Ikon SVG SKYFOLIO (lihat icons.ts). Dekoratif kecuali `label` diisi. */
  import { ICONS, type IconName, type IconPart } from './icons';

  interface Props {
    name: IconName;
    size?: number;
    label?: string;
    class?: string;
  }
  let { name, size = 22, label, class: cls = '' }: Props = $props();
  const parts = $derived(ICONS[name] as IconPart[]);
</script>

<svg
  class="icon {cls}"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each parts as p, i (i)}
    {#if p.fill}
      <path d={p.d} fill="currentColor" />
    {:else}
      <path d={p.d} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    {/if}
  {/each}
</svg>

<style>
  .icon {
    display: inline-block;
    flex: none;
    vertical-align: -0.2em;
  }
</style>
