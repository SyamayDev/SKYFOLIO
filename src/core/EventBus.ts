/**
 * Event bus bertipe. Sistem saling berkomunikasi lewat sini supaya tidak saling bergantung langsung.
 */
import type { SurfaceMaterial } from '../physics/PhysicsWorld';
import type { QualityTier } from '../config/quality';

export type InputDevice = 'keyboard' | 'touch' | 'gamepad';

/** Lapisan langit tempat pesawat berada (docs/03 bagian 8–10). */
export type FlightRegime = 'ground' | 'water' | 'air' | 'stratosphere' | 'space' | 'moon';

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
  'weather:thunder': { delay: number; strength: number };
  'weather:home': { code: number; temperature: number };
  'canopy': { closed: boolean };
  'wiper': Record<string, never>;
  'flight:regime': { regime: FlightRegime; prev: FlightRegime };
  'rocket': { deployed: boolean };
  'reentry': { active: boolean };
  'moon:landed': { smooth: boolean };
  'zone:enter': { id: string; first: boolean };
  'zone:exit': { id: string };
  'stamp': { id: string; kind: 'zone' | 'landmark' | 'project' };
  'landmark:visit': { id: string; first: boolean };
  'project:land': { id: string };
  'project:open': { id: string };
  'panel:open': { kind: PanelKind; id?: string };
  'piko:say': { text: string; mood?: 'happy' | 'wow' | 'think' | 'sleepy' | 'cheer'; priority?: number; radio?: boolean };
  'interact': { zone: string; action: string };
  'balloon:hit': { linkId: string };
  'parcel:delivered': Record<string, never>;
  'achievement': { id: string };
  'autopilot': { active: boolean; target?: string };
  'piko:said': { text: string; ms: number; radio?: boolean };
}

export type PanelKind =
  | 'zone'
  | 'project'
  | 'passport'
  | 'map'
  | 'contact'
  | 'link'
  | 'bts'
  | 'settings'
  | 'chat'
  | 'arrival'
  | 'photo';

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
