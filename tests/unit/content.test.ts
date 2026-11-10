/**
 * Sistem konten (docs/08): parser YAML mini, markdown aman, validasi skema isi nyata, dan penyembunyian
 * field `needsConfirmation` (aturan "jangan mengarang fakta tentang Aril").
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../scripts/lib/content';
import { escapeHtml, markdownToHtml } from '../../src/content/markdown';
import { toPublicContent } from '../../src/content/public';
import { parseYaml, splitFrontmatter, stringifyYaml } from '../../src/content/yaml';

describe('yaml mini', () => {
  it('membaca skalar, daftar, dan objek bersarang', () => {
    const y = parseYaml(['title: SI-RAJU', 'year: 2025', 'featured: true', 'tech:', '  - Laravel', '  - MySQL', 'links:', '  demo: https://example.com', '  repo: null'].join('\n'));
    expect(y.title).toBe('SI-RAJU');
    expect(y.year).toBe(2025);
    expect(y.featured).toBe(true);
    expect(y.tech).toEqual(['Laravel', 'MySQL']);
    expect(y.links).toEqual({ demo: 'https://example.com', repo: null });
  });

  it('stringify → parse kembali ke data yang sama', () => {
    const data = { id: 'x', summary: { id: 'Halo: dunia', en: 'Hi "there"' }, tags: ['a', 'b'], rank: 2, ok: false };
    expect(parseYaml(stringifyYaml(data))).toEqual(data);
  });

  it('frontmatter dengan BOM tetap terbaca', () => {
    const { data, body } = splitFrontmatter('﻿---\nid: demo\n---\nIsi cerita.');
    expect(data.id).toBe('demo');
    expect(body.trim()).toBe('Isi cerita.');
  });
});

describe('markdown aman', () => {
  it('meng-escape HTML mentah', () => {
    const html = markdownToHtml('Halo <script>alert(1)</script> **tebal**');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<strong>tebal</strong>');
  });

  it('menolak tautan javascript:', () => {
    const html = markdownToHtml('[klik](javascript:alert(1)) dan [aman](https://example.com)');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="https://example.com"');
  });

  it('escapeHtml menangani kutip', () => {
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;');
  });
});

describe('isi content/ nyata', () => {
  const { content, issues } = loadContent();

  it('lolos validasi skema tanpa error', () => {
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('setiap proyek punya id unik dan judul', () => {
    const ids = content.projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of content.projects) expect(p.title.length).toBeGreaterThan(0);
  });

  it('field needsConfirmation disembunyikan di versi publik', () => {
    const { content: pub, hidden } = toPublicContent(content);
    for (const h of hidden) expect(h.field.length).toBeGreaterThan(0);
    for (const p of pub.projects) expect((p as { needsConfirmation?: unknown }).needsConfirmation).toBeUndefined();
    expect((pub.profile as { needsConfirmation?: unknown }).needsConfirmation).toBeUndefined();
  });
});
