/**
 * Skema zod untuk semua file di content/ (docs/08 bagian 2). Dipakai oleh loader (plugin Vite),
 * `npm run validate:content`, Mode Ringkas, CV, dan paket pengetahuan AI.
 */
import { z } from 'zod';

const nstr = z.string().nullable().optional();
/** Teks dua bahasa. Nilai null/kosong = belum diisi (disembunyikan). */
export const LText = z.object({ id: nstr, en: nstr });
export type LText = z.infer<typeof LText>;
const url = z.union([z.url({ message: 'harus berupa URL (https://…)' }), z.string().regex(/^mailto:/, 'harus berupa URL')]);
const needs = z.array(z.string()).optional();

export const ProfileSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().min(1),
  siteName: z.string().min(1),
  tagline: LText,
  education: z.object({
    campus: z.string(),
    campusShort: z.string().optional(),
    program: LText,
    currentSemester: z.number().int().nullable().optional(),
    startYear: z.number().int().nullable().optional(),
  }),
  hometown: z.object({
    city: z.string(),
    province: z.string().optional(),
    country: z.string().optional(),
    lat: z.number(),
    lon: z.number(),
    timezone: z.string().optional(),
  }),
  bio: LText,
  interests: z.object({ id: z.array(z.string()), en: z.array(z.string()) }),
  avatar: z.object({ description: z.string().optional(), photo: z.string().nullable().optional(), photoAlt: LText.optional() }),
  cv: z.object({ id: z.string(), en: z.string() }),
  languages: z.object({ default: z.enum(['id', 'en']), available: z.array(z.enum(['id', 'en'])) }),
  needsConfirmation: needs,
});

export const SocialsSchema = z.object({
  contactEmail: z.email({ message: 'harus berupa alamat email' }),
  contactFormDeliversTo: z.string().optional(),
  links: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/, 'id hanya huruf kecil, angka, dan tanda minus'),
      label: z.string(),
      value: z.string(),
      url,
      balloonColor: z.string().optional(),
      public: z.boolean().default(true),
    }),
  ),
  githubUsername: z.string().optional(),
});

const SkillName = z.union([z.string(), LText]);
export const SkillsSchema = z.object({
  levelScale: z.record(z.string(), LText),
  note: z.string().optional(),
  groups: z.array(
    z.object({
      id: z.string(),
      label: LText,
      skills: z.array(
        z.object({
          id: z.string(),
          name: SkillName,
          level: z.number().int().min(1, 'level minimal 1').max(5, 'level maksimal 5'),
          source: z.string().optional(),
          needsConfirmation: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

export const TimelineSchema = z.object({
  note: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['education', 'competition', 'internship', 'organization', 'work', 'award', 'volunteer', 'other']),
      title: LText,
      org: z.string().optional(),
      orgUrl: url.optional(),
      orgDescription: LText.optional(),
      location: z.string().optional(),
      start: z.string().nullable().optional(),
      end: z.string().nullable().optional(),
      summary: LText.optional(),
      result: z.string().nullable().optional(),
      major: z.string().nullable().optional(),
      needsConfirmation: needs,
      checkpointIcon: z.string().optional(),
    }),
  ),
});

export const CertificatesSchema = z.object({
  note: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.union([z.string(), LText]),
      issuer: z.string().nullable().optional(),
      date: z.string().nullable().optional(),
      category: z.enum(['competition', 'course', 'seminar', 'organization', 'other']).optional(),
      pdf: z.string().optional(),
      thumb: z.string().nullable().optional(),
      needsConfirmation: needs,
    }),
  ),
});

export const CopilotSchema = z.object({
  name: z.string().min(1),
  character: z.record(z.string(), z.unknown()).optional(),
  personality: LText,
  voice: z.object({
    engine: z.string(),
    pitch: z.number(),
    rate: z.number(),
    volume: z.number().optional(),
    preferredVoices: z.object({ id: z.array(z.string()), en: z.array(z.string()) }),
    fallback: z.string().optional(),
  }),
  defaultLanguage: z.enum(['id', 'en']).optional(),
  greeting: LText,
  rules: z.object({
    answerOnlyFromContent: z.boolean().optional(),
    unknownAnswer: LText,
    offTopicPolicy: z.string().optional(),
    mayShare: z.array(z.string()).optional(),
    neverShare: z.array(z.string()).optional(),
  }),
  limits: z.object({
    messagesPerVisitorPerHour: z.number(),
    globalLlmCallsPerDay: z.number(),
    maxReplyChars: z.number(),
  }),
});

export const EasterEggsSchema = z.object({
  note: z.string().optional(),
  hobbies: z.array(
    z.object({ id: z.string(), label: LText, worldFeature: z.union([z.string(), z.array(z.string())]), idea: z.string().optional() }),
  ),
  favorites: z.object({
    food: LText.optional(),
    games: LText.optional(),
    musicTaste: LText.optional(),
    favoriteArtistsMentionOnly: z.array(z.string()).optional(),
    favoriteArtistsNote: z.string().optional(),
  }),
  radioStations: z.array(z.object({ id: z.string(), label: z.string(), style: z.string().optional() })),
});

export const ActionSchema = z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()).default({}) });
export const FaqSchema = z.object({
  note: z.string().optional(),
  entries: z.array(
    z.object({
      id: z.string(),
      patterns: z.object({ id: z.array(z.string()), en: z.array(z.string()) }),
      answer: LText,
      action: ActionSchema.optional(),
    }),
  ),
});

export const ZonesSchema = z.object({
  note: z.string().optional(),
  zones: z.array(
    z.object({
      id: z.string(),
      name: LText,
      lat: z.number().optional(),
      lon: z.number().optional(),
      radiusDeg: z.number().optional(),
      altitude: z.number().optional(),
      distance: z.number().optional(),
      radius: z.number().optional(),
      path: z.string().optional(),
      content: z.string(),
      music: z.string(),
      features: z.array(z.string()),
    }),
  ),
});

export const LandmarksSchema = z.object({
  note: z.string().optional(),
  landmarks: z.array(
    z.object({
      id: z.string(),
      name: z.union([z.string(), LText]),
      lat: z.number(),
      lon: z.number(),
      region: z.string(),
      scale: z.number().default(1),
      flyUnder: z.boolean().optional(),
    }),
  ),
  ambientLife: z.array(z.object({ id: z.string(), count: z.number(), behavior: z.string().optional() })).optional(),
});

export const SecretMessageSchema = z.object({ note: z.string().optional(), message: LText, needsConfirmation: needs });

export const DIORAMAS = ['compass', 'laundry', 'books', 'robot', 'shop', 'school', 'rocket', 'garden', 'lab', 'stage', 'generic'] as const;
export type Diorama = (typeof DIORAMAS)[number];

export const ProjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id hanya huruf kecil, angka, dan tanda minus'),
  title: z.string().min(1),
  fullTitle: LText.optional(),
  summary: LText,
  year: z.number().int().nullable().optional(),
  role: LText.nullable().optional(),
  team: z.string().nullable().optional(),
  course: LText.optional(),
  tech: z.array(z.string()).default([]),
  links: z.object({ demo: url.nullable().optional(), repo: url.nullable().optional() }).default({ demo: null, repo: null }),
  media: z
    .object({ cover: z.string().nullable().optional(), gallery: z.array(z.string()).default([]), video: z.string().nullable().optional() })
    .default({ cover: null, gallery: [] }),
  featured: z.boolean().default(false),
  featuredRank: z.number().int().nullable().optional(),
  tags: z.array(z.string()).default([]),
  island: z
    .object({
      diorama: z.string().default('generic'),
      lat: z.number().nullable().optional(),
      lon: z.number().nullable().optional(),
      size: z.enum(['large', 'medium', 'small']).default('medium'),
    })
    .default({ diorama: 'generic', size: 'medium' }),
  minigame: z
    .object({ id: z.string(), title: z.string(), description: LText.optional() })
    .optional(),
  needsConfirmation: needs,
});
export type ProjectFront = z.infer<typeof ProjectSchema>;

export const SettingsDefaultsSchema = z.record(z.string(), z.unknown());

/** Peta file → skema (relatif terhadap content/). */
export const CONTENT_FILES = {
  profile: ['profile.json', ProfileSchema],
  socials: ['socials.json', SocialsSchema],
  skills: ['skills.json', SkillsSchema],
  timeline: ['timeline.json', TimelineSchema],
  certificates: ['certificates.json', CertificatesSchema],
  copilot: ['copilot.json', CopilotSchema],
  easterEggs: ['easter-eggs.json', EasterEggsSchema],
  faq: ['faq.json', FaqSchema],
  zones: ['world/zones.json', ZonesSchema],
  landmarks: ['world/landmarks.json', LandmarksSchema],
  secretMessage: ['secret-message.json', SecretMessageSchema],
} as const;

export type Profile = z.infer<typeof ProfileSchema>;
export type Socials = z.infer<typeof SocialsSchema>;
export type Skills = z.infer<typeof SkillsSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type Certificates = z.infer<typeof CertificatesSchema>;
export type Copilot = z.infer<typeof CopilotSchema>;
export type EasterEggs = z.infer<typeof EasterEggsSchema>;
export type Faq = z.infer<typeof FaqSchema>;
export type Zones = z.infer<typeof ZonesSchema>;
export type Landmarks = z.infer<typeof LandmarksSchema>;
export type SecretMessage = z.infer<typeof SecretMessageSchema>;

export interface MediaImage {
  /** URL webp terbesar yang tersedia. */
  src: string;
  /** srcset webp (480/960/1600). */
  srcset: string;
  avifSrcset: string;
  width: number;
  height: number;
  /** Placeholder blur kecil (data URL). */
  blur: string;
}

export interface Project extends ProjectFront {
  story: { id: string; en: string };
  storyText: { id: string; en: string };
  cover: MediaImage | null;
  galleryImages: MediaImage[];
  /** Nama file sumber (untuk Hangar). */
  file: string;
}

export interface SiteContent {
  profile: Profile;
  socials: Socials;
  skills: Skills;
  timeline: Timeline;
  certificates: Certificates;
  copilot: Copilot;
  easterEggs: EasterEggs;
  faq: Faq;
  zones: Zones;
  landmarks: Landmarks;
  secretMessage: SecretMessage;
  projects: Project[];
  profilePhoto: MediaImage | null;
  gallery: MediaImage[];
  generatedAt: string;
}

export interface ContentIssue {
  file: string;
  path: string;
  message: string;
  level: 'error' | 'warn';
}
