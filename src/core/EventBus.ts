/**
 * Event bus bertipe. Sistem saling berkomunikasi lewat sini supaya tidak saling bergantung langsung.
 */
import type { SurfaceMaterial } from '../physics/PhysicsWorld';
import type { QualityTier } from '../config/quality';

export type InputDevice = 'keyboard' | 'touch' | 'gamepad';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface GameEvents {
  'load:item': { id: PreflightItemId; done: boolean };
  'plane:crash': { tier: 0 | 1 | 2 | 3; speed: number; point: Vec3Like; material: SurfaceMaterial };
  'plane:landed': { smooth: boolean; verticalSpeed: number };
  'plane:takeoff': Record<string, never>;
  'plane:stall': { active: boolean };
  'plane:barrelRoll': { dir: number };
  'plane:jump': Record<string, never>;
  'plane:horn': Record<string, never>;
  'plane:respawn': { reason: 'manual' | 'fell' | 'outOfBounds' };
  'plane:splash': { speed: number; point: Vec3Like };
  'plane:boost': { active: boolean };
  'plane:upright': Record<string, never>;
  'ring:passed': { index: number; total: number; label: string };
  'prop:hit': { material: SurfaceMaterial; speed: number; point: Vec3Like };
  'letters:restored': { letter: string };
  'tree:brush': { point: Vec3Like; speed: number };
  'input:device': { device: InputDevice };
  'quality:changed': { tier: QualityTier };
  'camera:mode': { mode: 'chase' | 'cockpit' };
  'ui:pause': { paused: boolean };
  'toast': { text: string; kind?: 'info' | 'success' | 'warn'; icon?: string };
}

export type PreflightItemId = 'fuel' | 'propeller' | 'map' | 'radio' | 'copilot' | 'weather';

type Handler<T> = (payload: T) => void;

export class EventBus {
  private readonly handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(type: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  off<K extends keyof GameEvents>(type: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of set) (h as Handler<GameEvents[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Satu bus global untuk seluruh aplikasi (UI Svelte juga mendengarkan). */
export const bus = new EventBus();
