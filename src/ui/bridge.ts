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
};

export function bindActions(a: Partial<UiActions>): void {
  Object.assign(actions, a);
}
