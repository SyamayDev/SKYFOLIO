/**
 * Pengaturan pengunjung. Nilai bawaan dari content/settings.defaults.json, disimpan di localStorage.
 * Semua akses localStorage dibungkus try/catch (mode privat, cookie diblokir, dll.).
 */
import defaults from '../../content/settings.defaults.json';
import type { AssistLevel } from '../config/flight';
import type { QualitySetting } from '../config/quality';
import { store } from './Store';

export type LanguageSetting = 'auto' | 'id' | 'en';
export type CameraModeSetting = 'chase' | 'cockpit' | 'cinematic';

export interface Settings {
  language: LanguageSetting;
  world: {
    realTimeDayNight: boolean;
    manualTimeOfDay: number;
    realHometownWeather: boolean;
    manualWeather: string;
    uiThemeFollowsDayNight: boolean;
    seasons: boolean;
    ambientLife: boolean;
  };
  graphics: {
    quality: QualitySetting;
    renderer: 'auto' | 'webgpu' | 'webgl2';
    fpsCap: number;
    shadows: string;
    postProcessing: string;
    depthOfField: boolean;
    showFps: boolean;
  };
  audio: {
    master: number;
    music: number;
    engine: number;
    wind: number;
    sfx: number;
    ambient: number;
    voice: number;
    ui: number;
    radioStation: string;
    muteWhenTabHidden: boolean;
  };
  controls: {
    invertPitch: boolean;
    gyroSteering: boolean;
    gyroSensitivity: number;
    touchJoystickSide: 'left' | 'right';
    assistLevel: AssistLevel;
    vibration: boolean;
    cameraShake: boolean;
  };
  camera: {
    mode: CameraModeSetting;
    fovBoost: boolean;
    speedLines: boolean;
  };
  copilot: {
    enabled: boolean;
    voice: boolean;
    subtitles: boolean;
    chatterLevel: 'quiet' | 'normal' | 'chatty';
  };
  accessibility: {
    reducedMotion: 'auto' | 'on' | 'off';
    highContrastUi: boolean;
    largeText: boolean;
    colorblindFriendlyMarkers: boolean;
  };
}

const STORAGE_KEY = 'skyfolio.settings.v1';

function buildDefaults(): Settings {
  const d = defaults as unknown as Record<string, Record<string, unknown>>;
  const pick = <T extends object>(src: Record<string, unknown> | undefined, keys: T): T => {
    const out = { ...keys } as Record<string, unknown>;
    if (src) for (const k of Object.keys(out)) if (k in src) out[k] = src[k];
    return out as T;
  };
  return {
    language: ((defaults as { language?: string }).language as LanguageSetting) ?? 'auto',
    world: pick(d.world, {
      realTimeDayNight: true,
      manualTimeOfDay: 10,
      realHometownWeather: true,
      manualWeather: 'clear',
      uiThemeFollowsDayNight: true,
      seasons: true,
      ambientLife: true,
    }),
    graphics: pick(d.graphics, {
      quality: 'auto' as QualitySetting,
      renderer: 'auto' as 'auto' | 'webgpu' | 'webgl2',
      fpsCap: 60,
      shadows: 'auto',
      postProcessing: 'auto',
      depthOfField: false,
      showFps: false,
    }),
    audio: pick(d.audio, {
      master: 0.9,
      music: 0.7,
      engine: 0.8,
      wind: 0.6,
      sfx: 0.8,
      ambient: 0.7,
      voice: 1,
      ui: 0.6,
      radioStation: 'syamay-fm',
      muteWhenTabHidden: true,
    }),
    controls: pick(d.controls, {
      invertPitch: false,
      gyroSteering: false,
      gyroSensitivity: 1,
      touchJoystickSide: 'left' as 'left' | 'right',
      assistLevel: 'normal' as AssistLevel,
      vibration: true,
      cameraShake: true,
    }),
    camera: pick(d.camera, { mode: 'chase' as CameraModeSetting, fovBoost: true, speedLines: true }),
    copilot: pick(d.copilot, {
      enabled: true,
      voice: true,
      subtitles: true,
      chatterLevel: 'normal' as 'quiet' | 'normal' | 'chatty',
    }),
    accessibility: pick(d.accessibility, {
      reducedMotion: 'auto' as 'auto' | 'on' | 'off',
      highContrastUi: false,
      largeText: false,
      colorblindFriendlyMarkers: false,
    }),
  };
}

export const DEFAULT_SETTINGS: Settings = buildDefaults();

function deepMerge<T>(base: T, over: unknown): T {
  if (typeof base !== 'object' || base === null || typeof over !== 'object' || over === null) {
    return (over === undefined || typeof over !== typeof base ? base : over) as T;
  }
  const out = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(out)) {
    out[k] = deepMerge(out[k], (over as Record<string, unknown>)[k]);
  }
  return out as T;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    return deepMerge(structuredClone(DEFAULT_SETTINGS), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export const settings = store<Settings>(typeof window === 'undefined' ? structuredClone(DEFAULT_SETTINGS) : load());

settings.subscribe((s) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Penyimpanan tidak tersedia (mode privat) — pengaturan tetap berlaku selama sesi.
  }
});

/** Ubah satu bagian pengaturan, misalnya `updateSettings('controls', { invertPitch: true })`. */
export function updateSettings<K extends keyof Settings>(section: K, patch: Partial<Settings[K]> | Settings[K]): void {
  settings.update((s) => {
    const current = s[section];
    const next = typeof current === 'object' && current !== null ? { ...current, ...(patch as object) } : patch;
    return { ...s, [section]: next };
  });
}

export function resetSettings(): void {
  settings.set(structuredClone(DEFAULT_SETTINGS));
}

/** "Kurangi gerakan" aktif? (otomatis mengikuti preferensi sistem) */
export function reducedMotionActive(s: Settings = settings.get()): boolean {
  if (s.accessibility.reducedMotion === 'on') return true;
  if (s.accessibility.reducedMotion === 'off') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
