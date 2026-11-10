/**
 * State bersama antara dunia 3D dan UI Svelte.
 * HUD diperbarui ±15× per detik (bukan tiap frame) supaya Svelte tidak membebani loop.
 */
import type { InputDevice, PanelKind, PreflightItemId } from './EventBus';
import type { QualityTier } from '../config/quality';
import { store } from './Store';

export type AppPhase = 'loading' | 'ready' | 'flying' | 'error';

export const appPhase = store<AppPhase>('loading');
export const paused = store(false);
export const fatalError = store<string | null>(null);

export const preflight = store<Record<PreflightItemId, boolean>>({
  fuel: false,
  propeller: false,
  map: false,
  radio: false,
  copilot: false,
  weather: false,
});

export interface HudState {
  speed: number;
  altitude: number;
  heading: number;
  verticalSpeed: number;
  throttle: number;
  grounded: boolean;
  inWater: boolean;
  stalled: boolean;
  boosting: boolean;
  fps: number;
  backend: string;
  drawCalls: number;
  triangles: number;
  physicsMs: number;
  tier: QualityTier;
  /** Aksi kontekstual tombol Aksi (kunci i18n), null = sembunyikan. */
  action: string | null;
}

export const hud = store<HudState>({
  speed: 0,
  altitude: 0,
  heading: 0,
  verticalSpeed: 0,
  throttle: 0,
  grounded: true,
  inWater: false,
  stalled: false,
  boosting: false,
  fps: 0,
  backend: '',
  drawCalls: 0,
  triangles: 0,
  physicsMs: 0,
  tier: 'high',
  action: null,
});

export const inputDevice = store<InputDevice>('keyboard');
export const isPortrait = store(false);
export const fade = store(0);
/** Warna layar fade (krem untuk respawn biasa, putih untuk kawah). */
export const fadeColor = store('#FFF6E6');

export type TutorialStep = 'gas' | 'climb' | 'turn' | 'boost' | 'done';
export const tutorialStep = store<TutorialStep>('gas');

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warn';
  icon?: string;
}
export const toasts = store<Toast[]>([]);

/** Zona tempat pesawat berada (null = di luar zona). */
export const currentZone = store<string | null>(null);
/** Judul besar zona yang sedang dianimasikan masuk. */
export const zoneBanner = store<{ id: string; title: string; subtitle: string; n: number } | null>(null);

export interface PanelState {
  kind: PanelKind;
  id?: string;
  /** Data tambahan (mis. linkId untuk LinkConfirm). */
  data?: Record<string, string>;
}
export const panel = store<PanelState | null>(null);

/** Subtitle besar untuk suara Piko / ATC (docs/07). */
export const subtitle = store<{ speaker: string; text: string; n: number } | null>(null);

/** Status autopilot untuk HUD. */
export const autopilotState = store<{ active: boolean; target: string | null }>({ active: false, target: null });

/** Data radar/peta (diperbarui ±4×/dtk): posisi zona relatif pesawat. */
export interface RadarBlip {
  id: string;
  icon: string;
  color: string;
  /** Sudut relatif arah pesawat (rad, 0 = depan, + = kanan). */
  bearing: number;
  /** Jarak (unit busur). */
  distance: number;
  visited: boolean;
}
export const radar = store<RadarBlip[]>([]);
/** Posisi pesawat (lat/lon) untuk peta. */
export const planeGeo = store<{ lat: number; lon: number; heading: number }>({ lat: 0, lon: 0, heading: 0 });
