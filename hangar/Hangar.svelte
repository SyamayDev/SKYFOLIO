<script lang="ts">
  /**
   * Hangar (docs/08 bagian 8): editor konten lokal untuk Aril. Semua perubahan ditulis ke content/ lewat
   * API dev server; dunia 3D yang terbuka di tab lain ikut berubah otomatis (HMR virtual:content).
   */
  import { onMount } from 'svelte';
  import type { SiteContent } from '../src/content/schema';
  import { toPublicContent, type HiddenField } from '../src/content/public';
  import { splitFrontmatter, stringifyYaml, type YamlValue } from '../src/content/yaml';
  import Field from './Field.svelte';
  import { api, type Issue } from './api';

  type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
  type Tab = 'home' | 'json' | 'projects' | 'drafts' | 'publish';

  const JSON_FILES: { path: string; label: string; icon: string }[] = [
    { path: 'profile.json', label: 'Profil', icon: '🧑‍✈️' },
    { path: 'socials.json', label: 'Kontak & sosial media', icon: '📮' },
    { path: 'skills.json', label: 'Skill', icon: '⛰️' },
    { path: 'timeline.json', label: 'Perjalanan', icon: '🌊' },
    { path: 'certificates.json', label: 'Sertifikat', icon: '🛰️' },
    { path: 'faq.json', label: 'FAQ Piko', icon: '💬' },
    { path: 'copilot.json', label: 'Piko', icon: '🧒' },
    { path: 'secret-message.json', label: 'Pesan rahasia Bulan', icon: '🌙' },
  ];

  let tab = $state<Tab>('home');
  let content = $state<SiteContent | null>(null);
  let issues = $state<Issue[]>([]);
  let hidden = $state<HiddenField[]>([]);
  let drafts = $state<string[]>([]);
  let toast = $state('');
  let busy = $state(false);

  // Editor JSON
  let jsonPath = $state('');
  let jsonData = $state<Json>(null);
  let jsonDirty = $state(false);

  // Editor proyek
  let projFile = $state('');
  let projData = $state<Json>(null);
  let projBody = $state('');
  let projDirty = $state(false);
  let dragOver = $state(false);

  // Publikasi
  let diff = $state<{ status: string; diff: string; patch: string } | null>(null);
  let message = $state('');
  let log = $state('');

  function flash(t: string): void {
    toast = t;
    setTimeout(() => {
      if (toast === t) toast = '';
    }, 3500);
  }

  async function refresh(): Promise<void> {
    const r = await api.content();
    content = r.content;
    issues = r.issues;
    drafts = r.drafts;
    hidden = toPublicContent(r.content).hidden;
  }

  function guard(): boolean {
    if ((jsonDirty || projDirty) && !confirm('Ada perubahan yang belum disimpan. Tinggalkan?')) return false;
    jsonDirty = projDirty = false;
    return true;
  }

  async function openJson(path: string): Promise<void> {
    if (!guard()) return;
    const { text } = await api.read(path);
    jsonData = JSON.parse(text) as Json;
    jsonPath = path;
    tab = 'json';
  }

  async function saveJson(): Promise<void> {
    busy = true;
    try {
      const r = await api.write(jsonPath, JSON.stringify(jsonData, null, 2));
      issues = r.issues;
      jsonDirty = false;
      await refresh();
      flash('✅ Tersimpan. Dunia 3D di tab lain sudah ikut berubah.');
    } catch (e) {
      flash(`❌ ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  async function openProject(file: string): Promise<void> {
    if (!guard()) return;
    const { text } = await api.read(`projects/${file}`);
    const { data, body } = splitFrontmatter(text);
    projData = data as Json;
    projBody = body.replace(/^\n+/, '');
    projFile = file;
    tab = 'projects';
  }

  function newProject(): void {
    if (!guard()) return;
    const id = (prompt('ID proyek baru (huruf kecil, angka, tanda minus), misalnya "si-keren":') ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(id)) {
      if (id) flash('❌ ID hanya boleh huruf kecil, angka, dan tanda minus.');
      return;
    }
    if (content?.projects.some((p) => p.id === id)) {
      flash('❌ ID itu sudah dipakai.');
      return;
    }
    projFile = `${id}.md`;
    projData = {
      id,
      title: id.toUpperCase(),
      summary: { id: '', en: '' },
      year: null,
      role: { id: null, en: null },
      tech: [],
      links: { demo: null, repo: null },
      media: { cover: null, gallery: [] },
      featured: false,
      tags: [],
      island: { diorama: 'generic', size: 'medium' },
      needsConfirmation: ['year', 'role'],
    } as Json;
    projBody = '## Cerita (ID)\n\nTulis cerita proyek di sini.\n\n## Story (EN)\n\nWrite the project story here.\n';
    projDirty = true;
    tab = 'projects';
  }

  async function saveProject(): Promise<void> {
    busy = true;
    try {
      const text = `---\n${stringifyYaml(projData as Record<string, YamlValue>)}---\n\n${projBody.trim()}\n`;
      const r = await api.write(`projects/${projFile}`, text);
      issues = r.issues;
      projDirty = false;
      await refresh();
      const bad = r.issues.filter((i) => i.level === 'error' && i.file.includes(projFile));
      flash(bad.length ? `⚠️ Tersimpan, tapi ada error: ${bad[0]!.message}` : '✅ Proyek tersimpan. Pulaunya langsung muncul/berubah di dunia 3D.');
    } catch (e) {
      flash(`❌ ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  async function dropFiles(files: FileList | null): Promise<void> {
    dragOver = false;
    if (!files?.length || !projData || typeof projData !== 'object' || Array.isArray(projData)) return;
    const id = String(projData.id ?? projFile.replace(/\.md$/, ''));
    busy = true;
    try {
      const media = (projData.media ?? { cover: null, gallery: [] }) as { cover: string | null; gallery: string[] };
      const gallery = [...(media.gallery ?? [])];
      let cover = media.cover;
      for (const f of Array.from(files)) {
        if (!/\.(jpe?g|png|webp|avif)$/i.test(f.name)) continue;
        const safe = f.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
        const rel = `media/projects/${id}/${safe}`;
        await api.upload(rel, f);
        if (!cover) cover = rel;
        else if (!gallery.includes(rel)) gallery.push(rel);
      }
      projData = { ...projData, media: { ...media, cover, gallery } } as Json;
      projDirty = true;
      flash('🖼️ Foto disalin & dioptimalkan. Jangan lupa Simpan.');
    } catch (e) {
      flash(`❌ ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  async function promote(name: string): Promise<void> {
    await api.promote(name);
    await refresh();
    flash(`✅ ${name} sekarang tampil sebagai pulau di Kepulauan Proyek.`);
  }

  async function loadDiff(): Promise<void> {
    diff = await api.diff();
  }

  async function validate(): Promise<void> {
    issues = (await api.validate()).issues;
    flash(issues.some((i) => i.level === 'error') ? '❌ Masih ada error, cek daftar.' : '✅ Semua konten valid.');
  }

  async function publish(): Promise<void> {
    if (!confirm('Simpan ke git dan push ke GitHub? Vercel akan otomatis deploy.')) return;
    busy = true;
    try {
      log = (await api.publish(message || 'update konten dari Hangar')).log;
      flash('🚀 Selesai. Cek log di bawah.');
      await loadDiff();
    } catch (e) {
      log = (e as Error).message;
      flash(`❌ ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  function preview(dest: string): void {
    window.open(`/?fly=${encodeURIComponent(dest)}`, 'skyfolio-preview');
  }

  function patchLines(p: string): { t: string; c: string }[] {
    return p.split('\n').map((t) => ({ t, c: t.startsWith('+') && !t.startsWith('+++') ? 'add' : t.startsWith('-') && !t.startsWith('---') ? 'del' : t.startsWith('@@') ? 'hunk' : '' }));
  }

  const errorCount = $derived(issues.filter((i) => i.level === 'error').length);
  const pendingFor = (data: Json): string[] => (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.needsConfirmation) ? (data.needsConfirmation as string[]) : []);

  onMount(() => {
    void refresh().catch((e: Error) => flash(`❌ ${e.message}`));
    const before = (e: BeforeUnloadEvent): void => {
      if (jsonDirty || projDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  });
</script>

<div class="app">
  <aside>
    <h1>🛠️ Hangar</h1>
    <p class="sub">Editor konten SKYFOLIO · hanya di komputermu</p>
    <nav>
      <button class:on={tab === 'home'} onclick={() => guard() && (tab = 'home')}>🏠 Ringkasan {#if errorCount}<em class="bad">{errorCount}</em>{/if}</button>
      {#each JSON_FILES as f (f.path)}
        <button class:on={tab === 'json' && jsonPath === f.path} onclick={() => openJson(f.path)}>{f.icon} {f.label}</button>
      {/each}
      <button class:on={tab === 'projects'} onclick={() => guard() && ((tab = 'projects'), (projFile = ''))}>🏝️ Proyek <em>{content?.projects.length ?? 0}</em></button>
      <button class:on={tab === 'drafts'} onclick={() => guard() && (tab = 'drafts')}>📥 Draf GitHub <em>{drafts.length}</em></button>
      <button class:on={tab === 'publish'} onclick={() => guard() && ((tab = 'publish'), void loadDiff())}>🚀 Simpan & Publikasikan</button>
    </nav>
    <a class="back" href="/" target="skyfolio-preview">✈️ Buka dunia 3D</a>
  </aside>

  <main>
    {#if !content}
      <p>Memuat konten…</p>
    {:else if tab === 'home'}
      <h2>Halo, Kak {content.profile.nickname ?? content.profile.name}! 👋</h2>
      <p>Semua isi portofolio ada di folder <code>content/</code>. Ubah lewat menu kiri, tekan <b>Simpan</b>, dan dunia 3D di tab lain langsung ikut berubah.</p>
      <div class="cards">
        <div class="card"><b>{content.projects.length}</b> proyek</div>
        <div class="card"><b>{content.skills.groups.reduce((n, g) => n + g.skills.length, 0)}</b> skill</div>
        <div class="card"><b>{content.timeline.items.length}</b> perjalanan</div>
        <div class="card"><b>{content.certificates.items.length}</b> sertifikat</div>
      </div>
      <h3>⚠️ Butuh konfirmasi ({hidden.length})</h3>
      <p class="muted">Field ini disembunyikan di situs sampai Kakak mengisinya lalu menekan <b>✔ Konfirmasi</b> di formulirnya.</p>
      <ul class="list">
        {#each hidden as h, hi (hi)}
          {@const proj = h.where.startsWith('projects/') ? h.where.slice(9) : ''}
          {@const file = JSON_FILES.find((f) => h.where.startsWith(f.path))}
          <li>
            <span><code>{h.where}</code> › <b>{h.field}</b></span>
            {#if proj}<button onclick={() => openProject(proj)}>Buka</button>{:else if file}<button onclick={() => openJson(file.path)}>Buka</button>{/if}
          </li>
        {/each}
      </ul>
      <h3>Validasi <button class="small" onclick={validate}>Validasi ulang</button></h3>
      <ul class="list">
        {#each issues as i, ii (ii)}
          <li class={i.level}><span>{i.level === 'error' ? '❌' : '⚠️'} <code>{i.file}</code>{#if i.path} › {i.path}{/if} — {i.message}</span></li>
        {:else}
          <li><span>✅ Semua konten valid.</span></li>
        {/each}
      </ul>
    {:else if tab === 'json'}
      {@const f = JSON_FILES.find((x) => x.path === jsonPath)}
      <header class="bar">
        <h2>{f?.icon} {f?.label} <small><code>content/{jsonPath}</code></small></h2>
        <button class="primary" disabled={busy || !jsonDirty} onclick={saveJson}>💾 Simpan</button>
      </header>
      <Field
        value={jsonData}
        pending={pendingFor(jsonData)}
        onchange={(v) => {
          jsonData = v;
          jsonDirty = true;
        }}
      />
    {:else if tab === 'projects'}
      {#if !projFile}
        <header class="bar">
          <h2>🏝️ Proyek</h2>
          <button class="primary" onclick={newProject}>＋ Tambah proyek</button>
        </header>
        <ul class="list">
          {#each content.projects as p (p.id)}
            <li>
              <span>{p.featured ? '⭐' : '🏝️'} <b>{p.title}</b> <span class="muted">{p.summary.id ?? ''}</span></span>
              <span>
                <button onclick={() => openProject(p.file)}>Edit</button>
                <button onclick={() => preview(`project:${p.id}`)}>👀 Pratinjau</button>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <header class="bar">
          <h2>🏝️ <code>projects/{projFile}</code></h2>
          <span>
            <button onclick={() => guard() && (projFile = '')}>← Daftar</button>
            {#if projData && typeof projData === 'object' && !Array.isArray(projData)}<button onclick={() => preview(`project:${String((projData as { id?: string }).id)}`)}>👀 Pratinjau</button>{/if}
            <button class="primary" disabled={busy || !projDirty} onclick={saveProject}>💾 Simpan</button>
          </span>
        </header>
        <div
          class="drop"
          class:over={dragOver}
          role="region"
          aria-label="Seret foto ke sini"
          ondragover={(e) => {
            e.preventDefault();
            dragOver = true;
          }}
          ondragleave={() => (dragOver = false)}
          ondrop={(e) => {
            e.preventDefault();
            void dropFiles(e.dataTransfer?.files ?? null);
          }}
        >
          🖼️ Seret foto ke sini (foto pertama jadi sampul, berikutnya masuk galeri)
          <label class="pick">atau pilih file<input type="file" accept="image/*" multiple onchange={(e) => dropFiles(e.currentTarget.files)} /></label>
        </div>
        <Field
          value={projData}
          pending={pendingFor(projData)}
          onchange={(v) => {
            projData = v;
            projDirty = true;
          }}
        />
        <label class="story">
          <span>Cerita (markdown, bagian <code>## Cerita (ID)</code> dan <code>## Story (EN)</code>)</span>
          <textarea rows="16" bind:value={projBody} oninput={() => (projDirty = true)}></textarea>
        </label>
        <p class="muted">Catatan: komentar <code># …</code> di frontmatter tidak ikut tersimpan saat menyimpan dari Hangar.</p>
      {/if}
    {:else if tab === 'drafts'}
      <h2>📥 Draf dari sinkron GitHub</h2>
      <p class="muted">Dibuat oleh <code>npm run sync:github</code> dari repo publik. Periksa isinya, lalu tampilkan yang ingin jadi pulau.</p>
      <ul class="list">
        {#each drafts as d (d)}
          <li><span><code>{d}</code></span><button onclick={() => promote(d)}>Tampilkan di situs</button></li>
        {:else}
          <li><span>Tidak ada draf.</span></li>
        {/each}
      </ul>
    {:else if tab === 'publish'}
      <h2>🚀 Simpan & Publikasikan</h2>
      <p class="muted">Menjalankan <code>git add content public/media</code>, <code>git commit</code>, lalu <code>git push</code>. Vercel otomatis deploy sekitar satu menit kemudian.</p>
      <button class="small" onclick={loadDiff}>🔄 Muat ulang perubahan</button>
      {#if diff}
        {#if !diff.status.trim()}
          <p>✅ Tidak ada perubahan konten.</p>
        {:else}
          <h3>File berubah</h3>
          <pre class="status">{diff.status}</pre>
          <h3>Detail</h3>
          <pre class="patch">{#each patchLines(diff.patch) as l, i (i)}<span class={l.c}>{l.t}
</span>{/each}</pre>
        {/if}
      {/if}
      <label class="story">
        <span>Pesan perubahan</span>
        <input bind:value={message} placeholder="misalnya: tambah foto SI-RAJU" maxlength="120" />
      </label>
      <button class="primary" disabled={busy || errorCount > 0 || !diff?.status.trim()} onclick={publish}>🚀 Simpan & Publikasikan</button>
      {#if errorCount}<p class="bad-text">Perbaiki {errorCount} error validasi dulu (lihat Ringkasan).</p>{/if}
      {#if log}<pre class="status">{log}</pre>{/if}
    {/if}
  </main>
</div>

{#if toast}<div class="toast" role="status">{toast}</div>{/if}

<style>
  :global(:root) {
    --font-title: Fredoka, 'Nunito Sans', system-ui, sans-serif;
    --font-body: 'Nunito Sans', system-ui, sans-serif;
  }
  :global(body) {
    margin: 0;
    background: #fff6e6;
    color: #2b2d42;
    font: 15px/1.5 var(--font-body);
  }
  .app {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 100vh;
  }
  @media (max-width: 800px) {
    .app {
      grid-template-columns: 1fr;
    }
    aside {
      position: static !important;
      height: auto !important;
    }
  }
  aside {
    background: #2b2d42;
    color: #fff6e6;
    padding: 18px 14px;
    position: sticky;
    top: 0;
    height: 100vh;
    box-sizing: border-box;
    overflow-y: auto;
  }
  h1 {
    font: 700 26px var(--font-title);
    margin: 0;
  }
  .sub {
    margin: 2px 0 16px;
    font-size: 12px;
    opacity: 0.7;
  }
  nav {
    display: grid;
    gap: 4px;
  }
  nav button {
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    font: 600 15px var(--font-body);
    padding: 9px 12px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
  }
  nav button:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  nav button.on {
    background: #ffc93c;
    color: #2b2d42;
  }
  nav em {
    font-style: normal;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    padding: 0 8px;
  }
  nav em.bad {
    background: #e5484d;
    color: #fff;
  }
  .back {
    display: block;
    margin-top: 18px;
    color: #9fd8f5;
  }
  main {
    padding: 22px clamp(16px, 4vw, 44px) 80px;
    max-width: 980px;
  }
  h2 {
    font: 700 24px var(--font-title);
    margin: 0 0 8px;
  }
  h2 small {
    font: 400 13px var(--font-body);
    color: #7a7f95;
  }
  h3 {
    font: 700 18px var(--font-title);
    margin: 22px 0 6px;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    background: #fff6e6;
    padding: 8px 0;
    z-index: 2;
  }
  button {
    font: 600 14px var(--font-body);
    border: 1px solid #ddd2bf;
    background: #fff;
    border-radius: 10px;
    padding: 7px 14px;
    cursor: pointer;
    color: #2b2d42;
  }
  button.primary {
    background: #ffc93c;
    border-color: #e8a33d;
    font-weight: 700;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button.small {
    font-size: 12px;
    padding: 3px 10px;
    margin-left: 8px;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .card {
    background: #fff;
    border-radius: 14px;
    padding: 12px 18px;
    box-shadow: 0 2px 0 #eadfcd;
  }
  .card b {
    font: 700 24px var(--font-title);
    color: #2f8fa6;
    margin-right: 4px;
  }
  .list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .list li {
    background: #fff;
    border-radius: 12px;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .list li.error {
    background: #ffe8e8;
  }
  .muted {
    color: #7a7f95;
    font-size: 13px;
  }
  .drop {
    border: 2px dashed #e8a33d;
    border-radius: 14px;
    padding: 16px;
    text-align: center;
    background: #fffaf0;
    margin: 10px 0;
  }
  .drop.over {
    background: #fff0c8;
  }
  .pick {
    display: block;
    margin-top: 6px;
    color: #2f8fa6;
    cursor: pointer;
    font-size: 13px;
  }
  .pick input {
    display: none;
  }
  .story {
    display: grid;
    gap: 6px;
    margin: 14px 0;
    font: 700 13px var(--font-title);
    color: #5d6178;
  }
  .story textarea,
  .story input {
    font: 14px/1.5 ui-monospace, monospace;
    border: 1px solid #ddd2bf;
    border-radius: 10px;
    padding: 10px;
    box-sizing: border-box;
    width: 100%;
  }
  pre {
    background: #2b2d42;
    color: #fff6e6;
    padding: 12px;
    border-radius: 12px;
    overflow: auto;
    max-height: 420px;
    font-size: 12px;
  }
  pre .add {
    color: #7ee2a8;
  }
  pre .del {
    color: #ff9a9e;
  }
  pre .hunk {
    color: #9fd8f5;
  }
  .bad-text {
    color: #e5484d;
  }
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #2b2d42;
    color: #fff;
    padding: 10px 18px;
    border-radius: 14px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    max-width: 92vw;
  }
</style>
