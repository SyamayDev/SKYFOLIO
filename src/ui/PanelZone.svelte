<script lang="ts">
  /** Isi panel per zona (docs/07 bagian 4). Semua fakta dari content/. */
  import { content, L, skillName, secretMessage } from '../content';
  import { panel } from '../core/AppState';
  import { progress } from '../game/Progress';
  import { locale, t } from '../i18n';
  import { circuit, fmt } from '../world/Zones/SkyCircuit';
  import { sampleLanterns, flag } from '../world/Zones/LanternValley';
  import { actions } from './bridge';
  import { visitor } from './visitor';

  let { id }: { id: string } = $props();
  let c = $derived($content);
  let zone = $derived(c.zones.zones.find((z) => z.id === id));
  let lanternText = $state('');
  let lanternSent = $state(false);
  let pr = $derived($progress.counters['gym-pr'] ?? 0);

  function years(a?: string | null, b?: string | null): string {
    if (a && b) return a === b ? a : `${a} – ${b}`;
    if (a) return `${a} – ${$t('common.now')}`;
    return b ?? '';
  }
  function openLink(linkId: string): void {
    panel.set({ kind: 'link', id: linkId });
  }
  function release(): void {
    const txt = lanternText.trim().slice(0, 30);
    if (!txt || /https?:|www\.|\d{6,}/i.test(txt)) return;
    actions.releaseLantern(txt);
    lanternSent = true;
  }
  const hobbyFor: Record<string, string> = { 'mc-stage': 'mc', 'aril-kitchen': 'cooking', 'gym-island': 'gym', 'fort-village': 'games', 'block-park': 'games' };
</script>

<p class="p-kicker">{$t('panels.zoneKicker')}</p>
<h2 class="p-title">{zone ? L(zone.name, $locale) : id}</h2>

{#if id === 'control-tower' || id === 'home-airport'}
  {#if id === 'home-airport'}
    <p class="p-text">{$t('panels.about.intro', { name: c.profile.nickname })}</p>
    <div class="p-row">
      <a class="p-btn ghost" href="/ringkas/">{$t('preflight.ringkas')}</a>
      <button class="p-btn ghost" onclick={() => panel.set({ kind: 'bts' })}>{$t('panels.bts')}</button>
    </div>
  {/if}
  <div class="profile">
    {#if c.profilePhoto}
      <img src={c.profilePhoto.src} srcset={c.profilePhoto.srcset} sizes="120px" alt={L(c.profile.avatar.photoAlt, $locale) || c.profile.name} width="120" height="120" />
    {:else}
      <div class="avatar" aria-hidden="true">✈</div>
    {/if}
    <div>
      <h3 class="p-section" style="margin-top:0">{c.profile.name} ({c.profile.nickname})</h3>
      <p class="p-muted">{L(c.profile.tagline, $locale)} · {L(c.profile.education.program, $locale)} · {c.profile.education.campus} · {c.profile.hometown.city}</p>
    </div>
  </div>
  <p class="p-text">{L(c.profile.bio, $locale)}</p>
  <ul class="p-chips">{#each c.profile.interests[$locale] as i (i)}<li>{i}</li>{/each}</ul>
  <div class="p-row">
    <a class="p-btn" href={c.profile.cv[$locale]} target="_blank" rel="noopener">📄 {$t('panels.cv')}</a>
    <button class="p-btn ghost" onclick={() => actions.flyTo('zone:post-office')}>📮 {$t('panels.contactAril')}</button>
  </div>
{:else if id === 'post-office'}
  <p class="p-text">{$t('panels.post.intro')}</p>
  <ul class="p-list">
    {#each c.socials.links.filter((l) => l.public) as l (l.id)}
      <li><button class="p-card" onclick={() => openLink(l.id)}><b>{l.label}</b><br /><span class="p-muted">{l.value}</span></button></li>
    {/each}
  </ul>
  <div class="p-row"><button class="p-btn" onclick={() => panel.set({ kind: 'contact' })} data-testid="open-contact">✉️ {$t('actions.contact')}</button></div>
{:else if id === 'lantern-valley'}
  <p class="p-text">{$t('panels.lantern.intro')}</p>
  {#if !lanternSent}
    <label class="p-field">{$t('panels.lantern.label')}
      <input maxlength="30" bind:value={lanternText} placeholder={$t('panels.lantern.placeholder')} />
    </label>
    <div class="p-row"><button class="p-btn" onclick={release} disabled={!lanternText.trim()}>🏮 {$t('actions.releaseLantern')}</button></div>
    <p class="p-muted">{$t('panels.lantern.rules')}</p>
  {:else}
    <p class="p-card">🏮 {$t('panels.lantern.sent', { name: $visitor.name || $t('boarding.mystery') })}</p>
  {/if}
  <h3 class="p-section">{$t('panels.lantern.recent')}</h3>
  <ul class="p-list">{#each sampleLanterns() as l (l.id)}<li class="p-card">{flag(l.country)} {l.text} <span class="p-muted">· {$t('zones.lantern.sample')}</span></li>{/each}</ul>
{:else if id === 'project-archipelago'}
  <p class="p-text">{$t('panels.projects.intro')}</p>
  <ul class="p-list">
    {#each c.projects as p (p.id)}
      <li class="p-card">
        <b>{p.featured ? '★ ' : ''}{p.title}</b>
        <p class="p-muted" style="margin:4px 0">{L(p.summary, $locale)}</p>
        <div class="p-row" style="margin:6px 0 0">
          <button class="p-btn ghost" onclick={() => panel.set({ kind: 'project', id: p.id })} data-testid="project-{p.id}">{$t('actions.viewProject')}</button>
          <button class="p-btn ghost" onclick={() => actions.flyTo(`project:${p.id}`)}>🧭 {$t('map.flyHere')}</button>
        </div>
      </li>
    {/each}
  </ul>
{:else if id === 'skill-peaks'}
  {#each c.skills.groups.filter((g) => g.skills.length) as g (g.id)}
    <h3 class="p-section">{L(g.label, $locale)}</h3>
    <ul class="p-list">
      {#each g.skills as s (s.id)}
        <li class="skill p-card">
          <span>{skillName(s.name, $locale)}</span>
          <span class="lvl" aria-label="{s.level}/5">{'▲'.repeat(s.level)}<span class="off">{'▲'.repeat(5 - s.level)}</span> {L(c.skills.levelScale[String(s.level)], $locale)}</span>
        </li>
      {/each}
    </ul>
  {/each}
{:else if id === 'journey-stream'}
  <ol class="p-list">
    {#each [...c.timeline.items].reverse() as it (it.id)}
      <li class="p-card">
        {#if years(it.start, it.end)}<span class="p-kicker">{years(it.start, it.end)}</span>{/if}
        <b>{L(it.title, $locale)}</b>
        {#if it.org}<div class="p-muted">{it.org}{it.location ? ` · ${it.location}` : ''}</div>{/if}
        {#if L(it.summary, $locale)}<p class="p-text" style="margin:6px 0 0">{L(it.summary, $locale)}</p>{/if}
      </li>
    {/each}
  </ol>
{:else if id === 'contribution-city'}
  <p class="p-text">{$t('zones.city.construction')}</p>
  <a class="p-btn ghost" href={c.socials.links.find((l) => l.id === 'github')?.url} target="_blank" rel="noopener">GitHub · {c.socials.githubUsername}</a>
{:else if id === 'hangar-lab'}
  <p class="p-text">{$t('panels.lab.intro')}</p>
  {#each c.projects.filter((p) => p.tags.includes('experiment')) as p (p.id)}<p class="p-card">{p.title}</p>{/each}
{:else if hobbyFor[id]}
  {@const hobby = c.easterEggs.hobbies.find((h) => h.id === hobbyFor[id])}
  {#if hobby}<p class="p-kicker">{$t('panels.hobby')}</p><h3 class="p-section" style="margin-top:0">{L(hobby.label, $locale)}</h3>{/if}
  <p class="p-text">{$t(`zones.${id === 'mc-stage' ? 'mc' : id === 'aril-kitchen' ? 'kitchen' : id === 'gym-island' ? 'gym' : id === 'fort-village' ? 'fort' : 'blocks'}.body` as never)}</p>
  {#if id === 'aril-kitchen' && c.easterEggs.favorites.food}<p class="p-card">🍖 {L(c.easterEggs.favorites.food, $locale)}</p>{/if}
  {#if id === 'gym-island'}<p class="p-card">💪 {$t('zones.gym.prCount', { n: pr })}</p>{/if}
  {#if (id === 'fort-village' || id === 'block-park') && c.easterEggs.favorites.games}<p class="p-card">🎮 {L(c.easterEggs.favorites.games, $locale)}</p>{/if}
{:else if id === 'sky-circuit'}
  <p class="p-text">{$t('panels.circuit.intro')}</p>
  <p class="p-card">🏆 {$t('panels.circuit.best')}: <b>{fmt($circuit.best)}</b></p>
{:else if id === 'orbit'}
  {#if c.certificates.items.length}
    <ul class="p-list">{#each c.certificates.items as ct (ct.id)}<li class="p-card"><b>{L(ct.title as never, $locale) || String(ct.title)}</b><div class="p-muted">{ct.issuer ?? ''} {ct.date ?? ''}</div></li>{/each}</ul>
  {:else}
    <p class="p-text">{$t('panels.orbit.empty')}</p>
  {/if}
{:else if id === 'moon'}
  {@const msg = secretMessage($locale)}
  <p class="p-text">{msg.fromAril ? msg.text : $t('panels.moon.neutral')}</p>
  <p class="p-muted">{$t('panels.moon.howto')}</p>
{/if}

<style>
  .profile {
    display: flex;
    gap: 14px;
    align-items: center;
    margin: 6px 0 10px;
  }
  .profile img,
  .avatar {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .avatar {
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #2f8fa6, #3aa0ff);
    color: #fff;
    font-size: 40px;
  }
  .skill {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }
  .lvl {
    color: #e8a33d;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .lvl .off {
    color: rgba(43, 45, 66, 0.18);
  }
</style>
