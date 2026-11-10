/**
 * Paket pengetahuan Piko (docs/06 bagian 3): ringkasan fakta dari content/ yang SUDAH dikonfirmasi
 * (field `needsConfirmation` dibuang lewat toPublicContent). Dipakai router lokal (kamus entitas),
 * FAQ, dan prompt AI di server — satu sumber supaya Piko tidak pernah mengarang.
 */
import type { SiteContent } from '../content/schema';
import { toPublicContent } from '../content/public';

type T2 = { id: string; en: string };

export interface Knowledge {
  profile: { name: string; nickname: string; tagline: T2; campus: string; campusShort?: string; program: T2; semester?: number; city: string; province?: string; country?: string; bio: T2; interests: { id: string[]; en: string[] }; cv: T2 };
  skills: { id: string; name: string; level: number | null; levelLabel: T2 | null; group: T2 }[];
  timeline: { id: string; title: T2; org: string; start: string | null; end: string | null; summary: T2 }[];
  projects: { id: string; title: string; fullTitle: T2 | null; summary: T2; tech: string[]; demo: string | null; repo: string | null; featuredRank: number | null; year: number | null; tags: string[] }[];
  contacts: { id: string; label: string; value: string }[];
  favorites: { food: T2 | null; games: T2 | null; music: T2 | null; artists: string[] };
  hobbies: { id: string; label: T2; zone: string | null }[];
  zones: { id: string; name: T2 }[];
  landmarks: { id: string; name: T2 }[];
  stations: string[];
}

const t2 = (v: unknown): T2 | null => {
  if (!v) return null;
  if (typeof v === 'string') return v ? { id: v, en: v } : null;
  const o = v as { id?: string | null; en?: string | null };
  if (!o.id && !o.en) return null;
  return { id: o.id || o.en || '', en: o.en || o.id || '' };
};

export function buildKnowledge(raw: SiteContent): Knowledge {
  const c = toPublicContent(raw).content;
  const p = c.profile;
  const scale = c.skills.levelScale as Record<string, { id: string; en: string }> | undefined;
  const ee = c.easterEggs as unknown as {
    favorites?: { food?: unknown; games?: unknown; musicTaste?: unknown; favoriteArtistsMentionOnly?: string[] };
    hobbies?: { id: string; label: unknown; worldFeature?: string | string[] }[];
    radioStations?: { id?: string; name?: string }[];
  };
  return {
    profile: {
      name: p.name,
      nickname: p.nickname,
      tagline: t2(p.tagline) ?? { id: '', en: '' },
      campus: p.education.campus,
      campusShort: (p.education as { campusShort?: string }).campusShort,
      program: t2(p.education.program) ?? { id: '', en: '' },
      semester: (p.education as { currentSemester?: number }).currentSemester,
      city: p.hometown.city,
      province: (p.hometown as { province?: string }).province,
      country: (p.hometown as { country?: string }).country,
      bio: t2(p.bio) ?? { id: '', en: '' },
      interests: (p as unknown as { interests?: { id: string[]; en: string[] } }).interests ?? { id: [], en: [] },
      cv: (p as unknown as { cv?: T2 }).cv ?? { id: '/cv/', en: '/cv/' },
    },
    skills: c.skills.groups.flatMap((g) =>
      g.skills.map((s) => ({
        id: s.id,
        name: typeof s.name === 'string' ? s.name : s.name.en || s.name.id || s.id,
        level: typeof s.level === 'number' ? s.level : null,
        levelLabel: typeof s.level === 'number' && scale?.[String(s.level)] ? scale[String(s.level)]! : null,
        group: t2(g.label) ?? { id: g.id, en: g.id },
      })),
    ),
    timeline: c.timeline.items
      .map((it) => ({
        id: it.id,
        title: t2(it.title) ?? { id: '', en: '' },
        org: (it as { org?: string }).org ?? '',
        start: (it as { start?: string | null }).start ?? null,
        end: (it as { end?: string | null }).end ?? null,
        summary: t2(it.summary) ?? { id: '', en: '' },
      }))
      .filter((it) => it.title.id),
    projects: c.projects.map((pr) => ({
      id: pr.id,
      title: pr.title,
      fullTitle: t2(pr.fullTitle),
      summary: t2(pr.summary) ?? { id: '', en: '' },
      tech: pr.tech,
      demo: pr.links.demo ?? null,
      repo: pr.links.repo ?? null,
      featuredRank: pr.featured ? (pr.featuredRank ?? null) : null,
      year: pr.year ?? null,
      tags: pr.tags,
    })),
    contacts: c.socials.links.filter((l) => l.public).map((l) => ({ id: l.id, label: l.label, value: (l as { value?: string }).value ?? '' })),
    favorites: {
      food: t2(ee.favorites?.food),
      games: t2(ee.favorites?.games),
      music: t2(ee.favorites?.musicTaste),
      artists: ee.favorites?.favoriteArtistsMentionOnly ?? [],
    },
    hobbies: (ee.hobbies ?? []).map((h) => ({ id: h.id, label: t2(h.label) ?? { id: h.id, en: h.id }, zone: Array.isArray(h.worldFeature) ? (h.worldFeature[0] ?? null) : (h.worldFeature ?? null) })),
    zones: c.zones.zones.map((z) => ({ id: z.id, name: t2(z.name) ?? { id: z.id, en: z.id } })),
    landmarks: c.landmarks.landmarks.map((l) => ({ id: l.id, name: t2(l.name) ?? { id: l.id, en: l.id } })),
    stations: ['syamay', 'funkot', 'timur', 'gurun', 'energi'],
  };
}
