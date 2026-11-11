<script lang="ts">
  /** Bagian bawah paspor: 34 achievement (rahasia tampil "???") dan pemilih skin pesawat. */
  import { ACHIEVEMENTS } from '../game/Achievements';
  import { progress } from '../game/Progress';
  import { SKINS, equipSkin } from '../game/Skins';
  import { t } from '../i18n';
  import { actions } from './bridge';
  import Icon from './Icon.svelte';

  let got = $derived($progress.achievements);
  let n = $derived(ACHIEVEMENTS.filter((a) => got[a.id]).length);
  let span = $derived.by(() => {
    const p = $progress;
    if (!p.completedAt || !p.startedAt) return '';
    const m = Math.round((p.completedAt - p.startedAt) / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`;
  });
  const key = (id: string, f: 'name' | 'desc'): Parameters<typeof $t>[0] => `achievements.${id}.${f}` as Parameters<typeof $t>[0];
  const skinKey = (id: string): Parameters<typeof $t>[0] => `skins.${id}` as Parameters<typeof $t>[0];
</script>

<h3 class="p-section">{$t('achievements.title')}</h3>
<p class="p-muted">{$t('achievements.count', { n, total: ACHIEVEMENTS.length })}{span ? ` · ${$t('achievements.time', { time: span })}` : ''}</p>
<ul class="ach" data-testid="achievements">
  {#each ACHIEVEMENTS as a (a.id)}
    {@const on = !!got[a.id]}
    <li class:on title={on || !a.secret ? $t(key(a.id, 'desc')) : $t('achievements.secret')}>
      <span class="medal" aria-hidden="true"><Icon name={on ? 'trophy' : a.secret ? 'info' : 'star'} size={18} /></span>
      <span class="txt">
        <b>{on || !a.secret ? $t(key(a.id, 'name')) : '???'}</b>
        <small>{on || !a.secret ? $t(key(a.id, 'desc')) : $t('achievements.secret')}</small>
      </span>
    </li>
  {/each}
</ul>

<h3 class="p-section">{$t('skins.title')}</h3>
<ul class="skins">
  {#each SKINS.filter((s) => !s.secret || $progress.unlockedSkins.includes(s.id)) as s (s.id)}
    {@const open = $progress.unlockedSkins.includes(s.id)}
    {@const worn = $progress.skin === s.id}
    <li class:open class:worn>
      <span class="swatch" aria-hidden="true" style:--b={s.paint?.body ?? '#F4E7CD'} style:--a={s.paint?.accent ?? '#E5484D'} style:--t={s.paint?.trim ?? '#2F8FA6'}><i></i><i></i><i></i></span>
      <b>{$t(skinKey(s.id))}</b>
      {#if worn}
        <span class="tag">{$t('skins.equipped')}</span>
      {:else if open}
        <button
          class="p-btn ghost"
          onclick={() => {
            actions.click();
            equipSkin(s.id);
          }}>{$t('skins.equip')}</button
        >
      {:else}
        <span class="tag lock" title={s.unlock ? $t(key(s.unlock, 'name')) : ''}><Icon name="info" size={14} /> {$t('skins.locked')}</span>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .ach {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px;
  }
  .ach li {
    display: flex;
    gap: 10px;
    align-items: center;
    background: #fff;
    border-radius: 14px;
    padding: 8px 10px;
    opacity: 0.55;
  }
  .ach li.on {
    opacity: 1;
    box-shadow: inset 0 0 0 2px var(--sun);
  }
  .medal {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(43, 45, 66, 0.08);
    color: var(--panel-ink);
  }
  .on .medal {
    background: var(--sun);
    color: var(--ink);
  }
  .txt {
    display: grid;
    min-width: 0;
  }
  .txt b {
    font: 700 calc(14px * var(--text-scale, 1)) var(--font-title);
  }
  .txt small {
    font-size: calc(12px * var(--text-scale, 1));
    color: var(--panel-ink);
    line-height: 1.3;
  }
  .skins {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .skins li {
    background: #fff;
    border-radius: 14px;
    padding: 10px;
    display: grid;
    justify-items: center;
    gap: 6px;
    text-align: center;
    opacity: 0.6;
  }
  .skins li.open {
    opacity: 1;
  }
  .skins li.worn {
    box-shadow: inset 0 0 0 2px #2f8fa6;
  }
  .swatch {
    display: flex;
    width: 64px;
    height: 22px;
    border-radius: 999px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(43, 45, 66, 0.15);
  }
  .swatch i {
    flex: 1;
  }
  .swatch i:nth-child(1) {
    background: var(--b);
    flex: 2;
  }
  .swatch i:nth-child(2) {
    background: var(--a);
  }
  .swatch i:nth-child(3) {
    background: var(--t);
  }
  .tag {
    font: 600 calc(12px * var(--text-scale, 1)) var(--font-title);
    color: #2f8fa6;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .tag.lock {
    color: var(--panel-ink);
  }
  .skins .p-btn {
    min-height: 36px;
    padding: 4px 12px;
  }
</style>
