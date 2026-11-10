import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { id } from '../../src/i18n/id';
import { en } from '../../src/i18n/en';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('kunci bahasa Indonesia dan Inggris identik', () => {
    expect(keys(en).sort()).toEqual(keys(id).sort());
  });

  it('tidak ada teks kosong', () => {
    for (const dict of [id, en]) {
      for (const k of keys(dict)) {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict);
        expect(typeof v === 'string' && v.trim().length > 0, `${k} kosong`).toBe(true);
      }
    }
  });

  it('placeholder {n} sama di kedua bahasa', () => {
    for (const k of keys(id)) {
      const get = (d: unknown): string => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], d) as string;
      const ph = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(get(en)), k).toEqual(ph(get(id)));
    }
  });

  it('semua kunci yang dipakai kode ada di kamus', () => {
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|svelte)$/.test(n) ? [p] : [];
      });
    const used = new Set<string>();
    for (const f of walk(resolve(import.meta.dirname, '../../src'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:\$t|\btr|\bt)\(\s*'([a-zA-Z0-9.-]+)'/g)) used.add(m[1]!);
      for (const m of src.matchAll(/label: '([a-z]+\.[a-zA-Z0-9.-]+)'/g)) used.add(m[1]!);
    }
    const has = (k: string): boolean => typeof k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], id) === 'string';
    const missing = [...used].filter((k) => k.includes('.') && !has(k));
    expect(missing).toEqual([]);
  });
});
