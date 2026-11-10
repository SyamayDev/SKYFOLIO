/**
 * Progres pengunjung (docs/09 bagian 1 & 7): stempel paspor, achievement, skin, asap, lap terbaik, statistik.
 * Disimpan di localStorage `skyfolio:v1:progress` dengan nomor versi + migrasi; semua akses dibungkus
 * try/catch. Jika localStorage tidak bisa dipakai, progres disimpan di memori saja (diberi tahu pelan).
 */
import { store } from '../core/Store';

export const PROGRESS_KEY = 'skyfolio:v1:progress';
export const PROGRESS_VERSION = 2;

export interface StampRecord {
  /** ISO date kunjungan pertama. */
  date: string;
  /** Rotasi acak supaya terlihat dicap tangan (derajat). */
  rot: number;
}

export interface ProgressData {
  version: number;
  stamps: Record<string, StampRecord>;
  achievements: Record<string, string>;
  /** Waktu (ms) pertama kali terbang — untuk mencatat lama menyelesaikan semua achievement. */
  startedAt: number | null;
  completedAt: number | null;
  skin: string;
  smoke: string;
  unlockedSkins: string[];
  unlockedSmoke: string[];
  bestLap: number | null;
  ghost: string | null;
  counters: Record<string, number>;
  stats: { distance: number; flightTime: number; crashes: number; maxAltitude: number; flights: number };
  /** Skor mini-game lokal. */
  scores: Record<string, number>;
}

export function defaultProgress(): ProgressData {
  return {
    version: PROGRESS_VERSION,
    stamps: {},
    achievements: {},
    startedAt: null,
    completedAt: null,
    skin: 'toyplane',
    smoke: 'white',
    unlockedSkins: ['toyplane'],
    unlockedSmoke: ['white'],
    bestLap: null,
    ghost: null,
    counters: {},
    stats: { distance: 0, flightTime: 0, crashes: 0, maxAltitude: 0, flights: 0 },
    scores: {},
  };
}

/** Migrasi data lama ke versi terbaru (tidak pernah melempar). */
export function migrateProgress(raw: unknown): ProgressData {
  const base = defaultProgress();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ProgressData> & { version?: number; stamps?: Record<string, StampRecord | string> };
  // v1 menyimpan stempel sebagai string tanggal saja.
  const stamps: Record<string, StampRecord> = {};
  for (const [k, v] of Object.entries(r.stamps ?? {})) {
    stamps[k] = typeof v === 'string' ? { date: v, rot: 0 } : { date: String(v?.date ?? ''), rot: Number(v?.rot ?? 0) };
  }
  return {
    ...base,
    ...r,
    version: PROGRESS_VERSION,
    stamps,
    achievements: { ...(r.achievements ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    counters: { ...(r.counters ?? {}) },
    scores: { ...(r.scores ?? {}) },
    unlockedSkins: Array.from(new Set([...base.unlockedSkins, ...(r.unlockedSkins ?? [])])),
    unlockedSmoke: Array.from(new Set([...base.unlockedSmoke, ...(r.unlockedSmoke ?? [])])),
  };
}

let persistent = true;

function load(): ProgressData {
  try {
    if (typeof localStorage === 'undefined') return defaultProgress();
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? migrateProgress(JSON.parse(raw)) : defaultProgress();
  } catch {
    persistent = false;
    return defaultProgress();
  }
}

export const progress = store<ProgressData>(load());
/** false = localStorage tidak tersedia (mode privat) → UI memberi tahu pelan bahwa progres tidak tersimpan. */
export const progressPersistent = store(persistent);

let saveTimer: ReturnType<typeof setTimeout> | null = null;
progress.subscribe((p) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
      progressPersistent.set(true);
    } catch {
      progressPersistent.set(false);
    }
  }, 250);
});

export function patchProgress(fn: (p: ProgressData) => void): void {
  const next = structuredClone(progress.get());
  fn(next);
  progress.set(next);
}

/** Cap stempel; mengembalikan true jika ini kunjungan pertama. */
export function addStamp(id: string): boolean {
  if (progress.get().stamps[id]) return false;
  patchProgress((p) => {
    p.stamps[id] = { date: new Date().toISOString(), rot: Math.round((Math.random() - 0.5) * 24) };
  });
  return true;
}

export function resetProgress(): void {
  progress.set(defaultProgress());
}
