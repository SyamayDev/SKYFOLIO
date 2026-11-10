/**
 * i18n bertipe: `t('hud.speed')`. Bahasa bisa diganti kapan saja tanpa reload.
 * Bawaan Indonesia, deteksi otomatis dari browser (docs/07 bagian 8).
 */
import { id, type Dictionary } from './id';
import { en } from './en';
import { store, type Readable } from '../core/Store';
import { settings, type LanguageSetting } from '../core/Settings';

export type Locale = 'id' | 'en';
export const DICTIONARIES: Record<Locale, Dictionary> = { id, en };

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string ? never : { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type I18nKey = Paths<Dictionary> & string;

export function detectLocale(): Locale {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const code = l.toLowerCase();
      if (code.startsWith('id') || code.startsWith('ms')) return 'id';
      if (code.startsWith('en')) return 'en';
    }
  } catch {
    // abaikan
  }
  return 'id';
}

export function resolveLocale(setting: LanguageSetting): Locale {
  return setting === 'auto' ? detectLocale() : setting;
}

export function translate(locale: Locale, key: I18nKey, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let node: unknown = DICTIONARIES[locale];
  for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
  let text = typeof node === 'string' ? node : key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export const locale = store<Locale>(typeof window === 'undefined' ? 'id' : resolveLocale(settings.get().language));

if (typeof window !== 'undefined') {
  settings.subscribe((s) => locale.set(resolveLocale(s.language)));
  locale.subscribe((l) => {
    document.documentElement.lang = l;
    document.title = translate(l, 'meta.title');
  });
}

export type Translator = (key: I18nKey, params?: Record<string, string | number>) => string;

/** Store berisi fungsi terjemah — dipakai di Svelte sebagai `$t('kunci')`. */
export const t: Readable<Translator> = (() => {
  const s = store<Translator>((k, p) => translate(locale.get(), k, p));
  locale.subscribe((l) => s.set((k, p) => translate(l, k, p)));
  return s;
})();

/** Terjemah langsung (di luar Svelte). */
export function tr(key: I18nKey, params?: Record<string, string | number>): string {
  return translate(locale.get(), key, params);
}
