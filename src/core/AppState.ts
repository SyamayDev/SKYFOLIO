/**
 * State bersama antara dunia 3D dan UI Svelte.
 * HUD diperbarui ±15× per detik (bukan tiap frame) supaya Svelte tidak membebani loop.
 */
import type { InputDevice, PreflightItemId } from './EventBus';
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

export type TutorialStep = 'gas' | 'climb' | 'turn' | 'boost' | 'done';
export const tutorialStep = store<TutorialStep>('gas');

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warn';
  icon?: string;
}
export const toasts = store<Toast[]>([]);
