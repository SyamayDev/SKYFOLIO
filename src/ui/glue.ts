/**
 * Penghubung event dunia 3D → UI: toast, ucapan Piko (gelembung + subtitle), stempel, landmark, panel.
 * Obrolan otomatis Piko dibatasi: jeda minimal 12 detik (docs/06 bagian 6), kecuali prioritas tinggi.
 */
import { L, content } from '../content';
import { panel, subtitle } from '../core/AppState';
import { bus } from '../core/EventBus';
import { settings } from '../core/Settings';
import { store } from '../core/Store';
import { tr } from '../i18n';
import { pushToast } from './toasts';

export interface PikoLine {
  text: string;
  mood: 'happy' | 'wow' | 'think' | 'sleepy' | 'cheer';
  n: number;
}

/** Kalimat Piko yang sedang tampil di gelembung (null = diam). */
export const pikoLine = store<PikoLine | null>(null);

const CHATTER_GAP: Record<string, number> = { quiet: 30, normal: 12, chatty: 6 };
let lastSay = -1e9;
let n = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

export function sayPiko(text: string, mood: PikoLine['mood'] = 'happy', priority = 1, radio = false): void {
  const s = settings.get();
  if (!s.copilot.enabled || !text) return;
  const now = performance.now() / 1000;
  const gap = CHATTER_GAP[s.copilot.chatterLevel] ?? 12;
  if (priority < 3 && now - lastSay < gap) return;
  lastSay = now;
  n++;
  pikoLine.set({ text, mood, n });
  if (s.copilot.subtitles) subtitle.set({ speaker: content.get().copilot.name, text, n });
  if (hideTimer) clearTimeout(hideTimer);
  const ms = Math.min(9000, 2600 + text.length * 55);
  hideTimer = setTimeout(() => {
    pikoLine.set(null);
    subtitle.set(null);
  }, ms);
  bus.emit('piko:said', { text, ms, radio });
}

export function wireUi(): void {
  if (wired) return;
  wired = true;
  bus.on('toast', (e) => pushToast(e.text, e.kind ?? 'info', e.icon));
  bus.on('piko:say', (e) => sayPiko(e.text, e.mood, e.priority ?? 1, e.radio ?? false));
  bus.on('panel:open', (e) => panel.set({ kind: e.kind, ...(e.id ? { id: e.id } : {}) }));
  bus.on('stamp', (e) => {
    if (e.kind === 'landmark') return;
    pushToast(tr('passport.stamped'), 'success', 'passport');
  });
  bus.on('landmark:visit', (e) => {
    const lm = content.get().landmarks.landmarks.find((x) => x.id === e.id);
    if (lm && e.first) pushToast(tr('passport.landmark', { name: L(lm.name) }), 'success', 'camera');
  });
  // Perjalanan ke angkasa (docs/03 bagian 8–10): Piko memandu setiap lapisan.
  bus.on('rocket', (e) => {
    if (e.deployed) sayPiko(tr('space.rocket'), 'wow', 3);
  });
  bus.on('flight:regime', (e) => {
    if (e.regime === 'stratosphere' && e.prev === 'air') sayPiko(tr('space.strato'), 'wow', 2);
    else if (e.regime === 'space' && e.prev !== 'moon') sayPiko(tr('space.space'), 'wow', 3);
    else if (e.regime === 'moon') sayPiko(tr('space.moon'), 'happy', 3);
    else if (e.regime === 'air' && e.prev === 'stratosphere') sayPiko(tr('space.back'), 'happy', 2);
  });
  bus.on('reentry', (e) => {
    if (e.active) sayPiko(tr('space.reentry'), 'wow', 3);
  });
  bus.on('moon:landed', (e) => {
    sayPiko(tr(e.smooth ? 'space.moonLandedSmooth' : 'space.moonLandedHard'), e.smooth ? 'wow' : 'happy', 3);
    if (e.smooth) setTimeout(() => panel.set({ kind: 'zone', id: 'moon' }), 1600);
  });
  bus.on('canopy', (e) => {
    if (e.closed && settings.get().controls.canopy === 'auto') sayPiko(tr('canopy.closing'), 'happy', 1);
  });
  bus.on('weather:home', (e) => {
    homeWeather.set(e);
  });
}

/** Cuaca nyata Medan terakhir (untuk HUD/panel Menara & obrolan Piko). */
export const homeWeather = store<{ code: number; temperature: number } | null>(null);
