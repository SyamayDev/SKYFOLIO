/**
 * Aksi Piko (docs/06 bagian 5). Klien HANYA menjalankan aksi dari daftar ini, dan semua argumen
 * divalidasi ulang terhadap konten (id zona/proyek/landmark/tautan yang benar-benar ada).
 * `open_link` tidak pernah menerima URL bebas, hanya `linkId` dari socials.json.
 */
import { z } from 'zod';
import type { SiteContent } from '../content/schema';

export const TOOL_NAMES = [
  'fly_to_zone',
  'fly_to_project',
  'fly_to_landmark',
  'show_panel',
  'open_link',
  'open_cv',
  'start_tour',
  'set_weather',
  'set_time',
  'go_to_space',
  'go_to_moon',
  'change_skin',
  'play_radio',
  'emote',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const PANELS = ['profile', 'projects', 'skills', 'timeline', 'contact', 'certificates', 'passport', 'settings', 'map'] as const;
const STATIONS = ['syamay', 'funkot', 'timur', 'gurun', 'energi'] as const;

export interface ValidAction {
  tool: ToolName;
  args: Record<string, string>;
}

/** Validasi satu aksi mentah (dari router atau AI). Mengembalikan null bila tidak sah. */
export function validateAction(raw: unknown, c: SiteContent, unlockedSkins: string[] = []): ValidAction | null {
  const base = z.object({ tool: z.enum(TOOL_NAMES), args: z.record(z.string(), z.unknown()).optional() }).safeParse(raw);
  if (!base.success) return null;
  const { tool } = base.data;
  const a = base.data.args ?? {};
  const str = (k: string): string | null => (typeof a[k] === 'string' ? (a[k] as string).slice(0, 64) : null);
  const ok = (args: Record<string, string> = {}): ValidAction => ({ tool, args });
  switch (tool) {
    case 'fly_to_zone': {
      const id = str('zoneId');
      return id && c.zones.zones.some((z) => z.id === id) ? ok({ zoneId: id }) : null;
    }
    case 'fly_to_project': {
      const id = str('projectId');
      if (!id) return null;
      const m = /^featured:([1-9])$/.exec(id);
      if (m) return c.projects.filter((p) => p.featured).length >= Number(m[1]) ? ok({ projectId: id }) : null;
      return c.projects.some((p) => p.id === id) ? ok({ projectId: id }) : null;
    }
    case 'fly_to_landmark': {
      const id = str('landmarkId');
      return id && c.landmarks.landmarks.some((l) => l.id === id) ? ok({ landmarkId: id }) : null;
    }
    case 'show_panel': {
      const p = str('panel');
      return p && (PANELS as readonly string[]).includes(p) ? ok({ panel: p }) : null;
    }
    case 'open_link': {
      const id = str('linkId');
      return id && c.socials.links.some((l) => l.id === id && l.public) ? ok({ linkId: id }) : null;
    }
    case 'open_cv': {
      const lang = str('lang');
      return ok({ lang: lang === 'en' ? 'en' : lang === 'id' ? 'id' : '' });
    }
    case 'start_tour': {
      const k = str('kind') ?? 'recruiter';
      return k === 'recruiter' || k === 'world' ? ok({ kind: k }) : null;
    }
    case 'set_weather': {
      const k = str('kind');
      return k && ['real', 'clear', 'rain', 'storm', 'snow'].includes(k) ? ok({ kind: k }) : null;
    }
    case 'set_time': {
      const m = str('mode');
      return m && ['real', 'day', 'sunset', 'night'].includes(m) ? ok({ mode: m }) : null;
    }
    case 'go_to_space':
    case 'go_to_moon':
      return ok();
    case 'change_skin': {
      const id = str('skinId');
      return id && unlockedSkins.includes(id) ? ok({ skinId: id }) : null;
    }
    case 'play_radio': {
      const id = str('stationId');
      return id && (STATIONS as readonly string[]).includes(id) ? ok({ stationId: id }) : null;
    }
    case 'emote': {
      const t = str('type');
      return t && ['wave', 'cheer', 'think', 'sleepy', 'wow'].includes(t) ? ok({ type: t }) : null;
    }
  }
}

/** Validasi daftar aksi: maks. 2 (aturan prompt), duplikat dibuang. */
export function validateActions(raw: unknown, c: SiteContent, unlockedSkins: string[] = []): ValidAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidAction[] = [];
  for (const r of raw.slice(0, 4)) {
    const v = validateAction(r, c, unlockedSkins);
    if (v && !out.some((x) => x.tool === v.tool)) out.push(v);
    if (out.length >= 2) break;
  }
  return out;
}

/** Apakah aksi ini memindahkan pesawat (panel obrolan ditutup supaya pemain melihat penerbangannya). */
export function isFlight(a: ValidAction): boolean {
  return a.tool.startsWith('fly_to') || a.tool === 'go_to_space' || a.tool === 'go_to_moon' || a.tool === 'start_tour';
}
