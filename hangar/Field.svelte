<script lang="ts">
  /**
   * Editor generik untuk nilai JSON (rekursif): teks, angka, boolean, daftar, objek, dan teks dua bahasa {id, en}.
   * Dipakai untuk semua file content/*.json supaya Aril tidak perlu mengedit JSON dengan tangan.
   */
  import Field from './Field.svelte';

  type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

  interface Props {
    value: Json;
    label?: string;
    path?: string;
    /** Field yang masih butuh konfirmasi Aril (diberi lencana). */
    pending?: string[];
    onchange: (v: Json) => void;
    onconfirm?: (field: string) => void;
    depth?: number;
  }
  let { value, label = '', path = '', pending = [], onchange, onconfirm, depth = 0 }: Props = $props();

  /** Nama field yang lebih ramah untuk Aril (kunci aslinya tetap dipakai di file). */
  const LABELS: Record<string, string> = {
    title: 'Judul', fullTitle: 'Judul lengkap', summary: 'Ringkasan', year: 'Tahun', role: 'Peran', team: 'Tim',
    course: 'Mata kuliah', tech: 'Teknologi', links: 'Tautan', demo: 'Demo', repo: 'Repo kode', media: 'Media',
    cover: 'Sampul', gallery: 'Galeri', video: 'Video', featured: 'Unggulan', featuredRank: 'Urutan unggulan',
    tags: 'Tag', island: 'Pulau', diorama: 'Diorama', size: 'Ukuran', minigame: 'Mini-game', name: 'Nama',
    nickname: 'Panggilan', tagline: 'Tagline', bio: 'Bio', hometown: 'Kota asal', education: 'Pendidikan',
    program: 'Program studi', campus: 'Kampus', level: 'Level (1–5)', label: 'Label', groups: 'Kelompok',
    skills: 'Skill', items: 'Item', start: 'Mulai', end: 'Selesai', description: 'Deskripsi', question: 'Pertanyaan',
    answer: 'Jawaban', message: 'Pesan', links_: 'Tautan', url: 'Alamat (URL)', public: 'Tampil publik',
    issuer: 'Penerbit', date: 'Tanggal', email: 'Email',
  };
  const shown = (k: string): string => (LABELS[k] ? `${LABELS[k]} · ${k}` : k);

  const isObj = (v: Json): v is { [k: string]: Json } => typeof v === 'object' && v !== null && !Array.isArray(v);
  const isLText = (v: Json): boolean => isObj(v) && Object.keys(v).length === 2 && 'id' in v && 'en' in v;
  const long = (s: string): boolean => s.length > 70 || s.includes('\n');
  const key = $derived(path.split('.').pop() ?? '');
  const isPending = $derived(pending.includes(key));
  const isLevel = $derived(key === 'level' && typeof value === 'number');

  function setKey(k: string, v: Json): void {
    if (!isObj(value)) return;
    onchange({ ...value, [k]: v });
  }
  function setItem(i: number, v: Json): void {
    if (!Array.isArray(value)) return;
    const copy = [...value];
    copy[i] = v;
    onchange(copy);
  }
  function addItem(): void {
    if (!Array.isArray(value)) return;
    const last = value[value.length - 1];
    // Item baru meniru bentuk item terakhir (nilai dikosongkan).
    const blank = (v: Json | undefined): Json =>
      v === undefined ? '' : typeof v === 'string' ? '' : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : Array.isArray(v) ? [] : v === null ? null : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'id' && typeof x === 'string' && !isLText(v) ? `baru-${Date.now().toString(36)}` : blank(x)]));
    onchange([...value, blank(last)]);
  }
  function removeItem(i: number): void {
    if (!Array.isArray(value)) return;
    if (!confirm('Hapus item ini?')) return;
    onchange(value.filter((_, j) => j !== i));
  }
  function move(i: number, d: number): void {
    if (!Array.isArray(value)) return;
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const copy = [...value];
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    onchange(copy);
  }
  function itemTitle(v: Json, i: number): string {
    if (isObj(v)) {
      for (const k of ['title', 'name', 'label', 'id']) {
        const x = v[k] ?? null;
        if (typeof x === 'string' && x) return x;
        if (isObj(x) && typeof x.id === 'string' && x.id) return x.id;
      }
    }
    return typeof v === 'string' && v ? v : `#${i + 1}`;
  }
</script>

{#if isLText(value) && isObj(value)}
  <div class="field" class:pending={isPending}>
    {#if label}<span class="lbl">{shown(label)}{#if isPending}<button class="confirm" onclick={() => onconfirm?.(key)}>✔ Konfirmasi</button>{/if}</span>{/if}
    <div class="pair">
      {#each ['id', 'en'] as lang (lang)}
        {@const s = (value[lang] as string | null) ?? ''}
        <label class="lang">
          <span>{lang.toUpperCase()}</span>
          {#if long(s) || key === 'bio' || key === 'description' || key === 'answer'}
            <textarea rows="4" value={s} oninput={(e) => setKey(lang, e.currentTarget.value || null)}></textarea>
          {:else}
            <input value={s} oninput={(e) => setKey(lang, e.currentTarget.value || null)} />
          {/if}
        </label>
      {/each}
    </div>
  </div>
{:else if isObj(value)}
  {@const nc = value.needsConfirmation}
  {@const childPending = Array.isArray(nc) ? (nc.filter((x) => typeof x === 'string') as string[]) : depth === 0 ? pending : []}
  <fieldset class="obj" class:root={depth === 0} class:pending={isPending || nc === true}>
    {#if label}<legend>{shown(label)}{#if isPending}<button class="confirm" onclick={() => onconfirm?.(key)}>✔ Konfirmasi</button>{/if}</legend>{/if}
    {#if nc === true}
      <!-- Seluruh item (mis. skill hasil sinkron GitHub) menunggu konfirmasi. -->
      <p class="wait">⚠️ Item ini disembunyikan di situs sampai dikonfirmasi. <button class="confirm" onclick={() => setKey('needsConfirmation', false)}>✔ Konfirmasi</button></p>
    {/if}
    {#each Object.entries(value) as [k, v] (k)}
      {#if k !== 'needsConfirmation' && k !== 'note'}
        <Field value={v} label={k} path={path ? `${path}.${k}` : k} pending={childPending} onchange={(x) => setKey(k, x)} onconfirm={(f) => {
            const nc = value.needsConfirmation;
            if (Array.isArray(nc)) setKey('needsConfirmation', nc.filter((x) => x !== f));
            else onconfirm?.(f);
          }} depth={depth + 1} />
      {:else if k === 'note'}
        <p class="note">💡 {v}</p>
      {/if}
    {/each}
  </fieldset>
{:else if Array.isArray(value)}
  <div class="arr" class:pending={isPending}>
    <span class="lbl">{shown(label)} <small>({value.length})</small>{#if isPending}<button class="confirm" onclick={() => onconfirm?.(key)}>✔ Konfirmasi</button>{/if}</span>
    {#if value.every((x) => typeof x === 'string')}
      <input value={value.join(', ')} placeholder="pisahkan dengan koma" onchange={(e) => onchange(e.currentTarget.value.split(',').map((x) => x.trim()).filter(Boolean))} />
    {:else}
      {#each value as item, i (i)}
        <details class="item" open={value.length <= 3}>
          <summary>
            <span>{itemTitle(item, i)}</span>
            <span class="tools">
              <button title="Naik" onclick={(e) => (e.preventDefault(), move(i, -1))}>↑</button>
              <button title="Turun" onclick={(e) => (e.preventDefault(), move(i, 1))}>↓</button>
              <button title="Hapus" class="danger" onclick={(e) => (e.preventDefault(), removeItem(i))}>✕</button>
            </span>
          </summary>
          <Field value={item} path={`${path}.${i}`} onchange={(x) => setItem(i, x)} {onconfirm} depth={depth + 1} />
        </details>
      {/each}
      <button class="add" onclick={addItem}>＋ Tambah</button>
    {/if}
  </div>
{:else}
  <label class="field" class:pending={isPending}>
    <span class="lbl">{shown(label)}{#if isPending}<button class="confirm" onclick={(e) => (e.preventDefault(), onconfirm?.(key))}>✔ Konfirmasi</button>{/if}</span>
    {#if typeof value === 'boolean'}
      <input type="checkbox" checked={value} onchange={(e) => onchange(e.currentTarget.checked)} />
    {:else if isLevel}
      <span class="level">
        <input type="range" min="1" max="5" step="1" value={value as number} oninput={(e) => onchange(Number(e.currentTarget.value))} />
        <b>{value}</b>
      </span>
    {:else if typeof value === 'number'}
      <input type="number" value={value} oninput={(e) => onchange(e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} />
    {:else if typeof value === 'string' && long(value)}
      <textarea rows="4" {value} oninput={(e) => onchange(e.currentTarget.value)}></textarea>
    {:else}
      <input value={value ?? ''} placeholder={value === null ? '(kosong)' : ''} oninput={(e) => onchange(e.currentTarget.value === '' ? null : e.currentTarget.value)} />
    {/if}
  </label>
{/if}

<style>
  .field,
  .arr {
    display: grid;
    gap: 4px;
    margin: 8px 0;
  }
  .lbl,
  legend {
    font: 700 13px var(--font-title);
    color: #5d6178;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  fieldset.obj {
    border: 1px solid #eadfcd;
    border-radius: 14px;
    padding: 6px 14px 10px;
    margin: 10px 0;
    background: rgba(255, 255, 255, 0.5);
  }
  fieldset.root {
    border: none;
    padding: 0;
    background: none;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  @media (max-width: 640px) {
    .pair {
      grid-template-columns: 1fr;
    }
  }
  .lang {
    display: grid;
    grid-template-columns: 28px 1fr;
    align-items: start;
    gap: 6px;
  }
  .lang span {
    font: 700 11px var(--font-title);
    color: #2f8fa6;
    padding-top: 9px;
  }
  input:not([type='checkbox']):not([type='range']),
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #ddd2bf;
    border-radius: 10px;
    padding: 8px 10px;
    font: 15px var(--font-body);
    background: #fff;
    color: #2b2d42;
  }
  input:focus,
  textarea:focus {
    outline: 2px solid #ffc93c;
    border-color: #e8a33d;
  }
  .pending > .lbl,
  .pending > legend {
    color: #c2410c;
  }
  .pending input,
  .pending textarea {
    background: #fff4e5;
  }
  .confirm {
    font: 700 11px var(--font-body);
    border: none;
    background: #3dcb7a;
    color: #fff;
    border-radius: 999px;
    padding: 2px 10px;
    cursor: pointer;
  }
  .item {
    border: 1px solid #eadfcd;
    border-radius: 12px;
    padding: 4px 12px;
    margin: 6px 0;
    background: #fffdf8;
  }
  summary {
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
    padding: 6px 0;
  }
  .tools button,
  .add {
    border: 1px solid #ddd2bf;
    background: #fff;
    border-radius: 8px;
    padding: 2px 8px;
    cursor: pointer;
    font: 600 13px var(--font-body);
    margin-left: 4px;
  }
  .add {
    justify-self: start;
    padding: 6px 14px;
  }
  .danger {
    color: #e5484d;
  }
  .level {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .level input {
    flex: 1;
    accent-color: #2f8fa6;
  }
  .wait {
    font-size: 13px;
    color: #c2410c;
    margin: 6px 0;
  }
  .note {
    font-size: 13px;
    color: #7a7f95;
    background: #fff8e6;
    border-radius: 10px;
    padding: 6px 10px;
  }
</style>
