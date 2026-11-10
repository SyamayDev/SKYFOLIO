/**
 * Panel debug (lil-gui) — hanya dimuat (dynamic import) bila URL berisi #debug,
 * jadi tidak ikut terbundel di jalur produksi biasa.
 */
import type GUI from 'lil-gui';
import { FLIGHT, GROUND, WATER, CRASH } from '../config/flight';
import { CAMERA } from '../config/camera';
import { QUALITY_TIERS } from '../config/quality';
import { hud } from './AppState';
import { updateSettings } from './Settings';

export interface DebugHooks {
  setHour(hour: number): void;
  getHour(): number;
  respawn(): void;
  teleport(lat: number, lon: number, alt: number, heading: number, speed: number): void;
  returnLetters(): void;
}

export function isDebugEnabled(): boolean {
  return typeof location !== 'undefined' && location.hash.includes('debug');
}

export async function createDebugPanel(hooks: DebugHooks): Promise<GUI | null> {
  if (!isDebugEnabled()) return null;
  const { default: GUIClass } = await import('lil-gui');
  const gui = new GUIClass({ title: 'SKYFOLIO debug' });
  gui.domElement.style.zIndex = '60';

  const info = { backend: '', fps: 0, drawCalls: 0, triangles: 0, physicsMs: 0, tier: '' };
  const infoF = gui.addFolder('Info');
  for (const k of Object.keys(info) as (keyof typeof info)[]) infoF.add(info, k).listen().disable();
  setInterval(() => {
    const h = hud.get();
    info.backend = h.backend;
    info.fps = Math.round(h.fps);
    info.drawCalls = h.drawCalls;
    info.triangles = h.triangles;
    info.physicsMs = Math.round(h.physicsMs * 100) / 100;
    info.tier = h.tier;
  }, 500);

  const world = { hour: hooks.getHour() };
  const w = gui.addFolder('Dunia');
  w.add(world, 'hour', 0, 24, 0.1).name('Jam (WIB)').onChange((v: number) => hooks.setHour(v));
  const quality = { tier: hud.get().tier };
  w.add(quality, 'tier', ['auto', ...QUALITY_TIERS])
    .name('Kualitas')
    .onChange((v: string) => updateSettings('graphics', { quality: v as 'auto' }));

  const actions = {
    respawn: () => hooks.respawn(),
    returnLetters: () => hooks.returnLetters(),
    kutubUtara: () => hooks.teleport(84, 98, 40, 0, 36),
    angkasa: () => hooks.teleport(4, 99, 160, 150, 50),
    laut: () => hooks.teleport(-5, 80, 6, 90, 30),
  };
  const a = gui.addFolder('Aksi');
  for (const k of Object.keys(actions) as (keyof typeof actions)[]) a.add(actions, k);

  const addAll = (title: string, obj: Record<string, number | number[]>, closed = true): void => {
    const f = gui.addFolder(title);
    for (const [k, v] of Object.entries(obj)) if (typeof v === 'number') f.add(obj, k);
    if (closed) f.close();
  };
  addAll('Terbang (config/flight.ts)', FLIGHT);
  addAll('Darat', GROUND);
  addAll('Air', WATER);
  addAll('Tabrakan', CRASH);
  addAll('Kamera', CAMERA);
  return gui;
}
