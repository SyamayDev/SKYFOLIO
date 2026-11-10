<script lang="ts">
  /** Panel proyek penuh (docs/07 bagian 2): galeri geser, cerita, tech chips, peran, tahun, tautan. */
  import { content, L } from '../content';
  import { panel } from '../core/AppState';
  import { bus } from '../core/EventBus';
  import { locale, t } from '../i18n';
  import { actions } from './bridge';

  let { id }: { id: string } = $props();
  let p = $derived($content.projects.find((x) => x.id === id));
  let images = $derived(p ? [p.cover, ...p.galleryImages].filter((x): x is NonNullable<typeof x> => !!x) : []);
  let role = $derived(p?.role ? L(p.role, $locale) : '');

  $effect(() => {
    if (p) bus.emit('project:open', { id: p.id });
  });

  function link(url: string, label: string): void {
    panel.set({ kind: 'link', id: 'url', data: { url, label } });
  }
</script>

{#if p}
  {#if images.length}
    <div class="gallery" role="list" aria-label={$t('panels.gallery')}>
      {#each images as img, i (img.src)}
        <picture role="listitem">
          <source type="image/avif" srcset={img.avifSrcset} sizes="(max-width: 600px) 90vw, 420px" />
          <img src={img.src} srcset={img.srcset} sizes="(max-width: 600px) 90vw, 420px" width={img.width} height={img.height} alt="{p.title} {i + 1}" loading="lazy" style:background-image={`url(${img.blur})`} />
        </picture>
      {/each}
    </div>
  {:else}
    <div class="cover" aria-hidden="true">{p.title.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 3)}</div>
  {/if}
  <p class="p-kicker">{p.featured ? `★ ${$t('zones.island.featured')} #${p.featuredRank ?? ''}` : $t('panels.project')}</p>
  <h2 class="p-title" data-testid="project-title">{p.title}</h2>
  {#if p.fullTitle}<p class="p-sub">{L(p.fullTitle, $locale)}</p>{/if}
  <p class="p-text"><b>{L(p.summary, $locale)}</b></p>
  <dl class="meta">
    {#if p.year}<div><dt>{$t('panels.year')}</dt><dd>{p.year}</dd></div>{/if}
    {#if role}<div><dt>{$t('panels.role')}</dt><dd>{role}</dd></div>{/if}
    {#if p.team}<div><dt>{$t('panels.team')}</dt><dd>{p.team}</dd></div>{/if}
    {#if p.course}<div><dt>{$t('panels.course')}</dt><dd>{L(p.course, $locale)}</dd></div>{/if}
  </dl>
  {#if p.tech.length}<ul class="p-chips">{#each p.tech as tech (tech)}<li>{tech}</li>{/each}</ul>{/if}
  <div class="p-row">
    {#if p.links.demo}<button class="p-btn" onclick={() => link(p.links.demo!, `${p.title} · ${$t('panels.demo')}`)}>🚀 {$t('panels.demo')}</button>{/if}
    {#if p.links.repo}<button class="p-btn ghost" onclick={() => link(p.links.repo!, `${p.title} · ${$t('panels.repo')}`)}>💻 {$t('panels.repo')}</button>{/if}
    <button class="p-btn ghost" onclick={() => actions.flyTo(`project:${p.id}`)}>🧭 {$t('map.flyHere')}</button>
  </div>
  <!-- Cerita dibuat dari markdown konten oleh konverter aman (semua teks di-escape, URL hanya http/mailto). -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <div class="p-text story">{@html p.story[$locale] || p.story.id || p.story.en}</div>
  {#if p.minigame}
    <p class="p-card">🎮 <b>{p.minigame.title}</b> — {L(p.minigame.description, $locale)}</p>
  {/if}
{:else}
  <p>{$t('panels.notFound')}</p>
{/if}

<style>
  .gallery {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    margin: 0 -4px 12px;
    padding: 0 4px 6px;
  }
  .gallery picture {
    flex: 0 0 88%;
    scroll-snap-align: start;
  }
  .gallery img {
    width: 100%;
    height: auto;
    border-radius: 16px;
    background-size: cover;
    aspect-ratio: 16/10;
    object-fit: cover;
  }
  .cover {
    height: 150px;
    border-radius: 18px;
    margin-bottom: 12px;
    display: grid;
    place-items: center;
    font: 700 54px var(--font-title);
    color: #fff;
    background: linear-gradient(135deg, #ffc93c, #e5484d 55%, #2f8fa6);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin: 8px 0;
  }
  .meta dt {
    font-size: 12px;
    color: var(--panel-ink);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .meta dd {
    margin: 0;
    font-weight: 700;
  }
  .story :global(ul) {
    padding-left: 18px;
  }
  .story :global(a) {
    color: #2f8fa6;
  }
</style>
