/** Pemanggil API lokal Hangar (scripts/hangar-api.ts). Header X-Hangar wajib untuk perubahan (anti-CSRF). */
import type { SiteContent } from '../src/content/schema';

export interface Issue {
  level: 'error' | 'warn';
  file: string;
  path?: string;
  message: string;
}

async function call<T>(method: string, path: string, body?: BodyInit, json = true): Promise<T> {
  const headers: Record<string, string> = { 'X-Hangar': '1' };
  if (body && json) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/__hangar${path}`, { method, body, headers });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  content: () => call<{ content: SiteContent; issues: Issue[]; drafts: string[] }>('GET', '/content'),
  read: (path: string) => call<{ text: string }>('GET', `/file?path=${encodeURIComponent(path)}`),
  write: (path: string, text: string) => call<{ ok: boolean; issues: Issue[] }>('PUT', '/file', JSON.stringify({ path, text })),
  upload: (path: string, file: Blob) => call<{ ok: boolean; log: string }>('POST', `/upload?path=${encodeURIComponent(path)}`, file, false),
  promote: (name: string) => call<{ ok: boolean }>('POST', '/promote', JSON.stringify({ name })),
  validate: () => call<{ issues: Issue[] }>('GET', '/validate'),
  diff: () => call<{ status: string; diff: string; patch: string }>('GET', '/diff'),
  publish: (message: string) => call<{ ok: boolean; log: string }>('POST', '/publish', JSON.stringify({ message })),
};
