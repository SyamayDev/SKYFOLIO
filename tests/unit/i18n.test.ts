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
});
