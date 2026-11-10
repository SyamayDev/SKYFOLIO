/**
 * Jembatan antara UI Svelte dan Experience. UI memanggil aksi lewat sini tanpa mengimpor dunia 3D.
 */
export interface UiActions {
  board(): void;
  respawn(): void;
  resume(): void;
  restartTutorial(): void;
  skipTutorial(): void;
  click(): void;
  requestGyro(): Promise<'granted' | 'denied' | 'unavailable'>;
  addLook(dx: number, dy: number): void;
  /** Autopilot ke tujuan (lihat Experience.flyTo). */
  flyTo(dest: string, opts?: { openPanel?: boolean; hold?: boolean; boost?: boolean }): boolean;
  /** Status autopilot untuk tur: aktif & sudah tiba di tujuan. */
  autopilotInfo(): { active: boolean; arrived: boolean };
  cancelAutopilot(): void;
  /** Lepas lampion (animasi lokal; API di Fase 4). */
  releaseLantern(text: string): void;
  paperPlane(): void;
  /** Pesawat melayang mengitari saat panel terbuka di HP (docs/07 bagian 4). */
  hover(on: boolean): void;
  /** Mode Rekruter (Fase 3). */
  startTour(): void;
  /** Cuaca sementara: real = kembali ke cuaca nyata. */
  setWeather(kind: 'real' | 'clear' | 'rain' | 'storm' | 'snow'): void;
  /** Waktu sementara: real = kembali ke jam dunia. */
  setTime(mode: 'real' | 'day' | 'sunset' | 'night'): void;
  /** Animasi reaksi Piko. */
  emote(type: 'wave' | 'cheer' | 'think' | 'sleepy' | 'wow'): void;
  /** Kamera sinematik (Mode Rekruter). */
  cinematic(on: boolean): void;
}

const noop = (): void => undefined;

export const actions: UiActions = {
  board: noop,
  respawn: noop,
  resume: noop,
  restartTutorial: noop,
  skipTutorial: noop,
  click: noop,
  requestGyro: async () => 'unavailable',
  addLook: noop,
  flyTo: () => false,
  autopilotInfo: () => ({ active: false, arrived: false }),
  cancelAutopilot: noop,
  releaseLantern: noop,
  paperPlane: noop,
  hover: noop,
  startTour: noop,
  setWeather: noop,
  setTime: noop,
  emote: noop,
  cinematic: noop,
};

export function bindActions(a: Partial<UiActions>): void {
  Object.assign(actions, a);
}
