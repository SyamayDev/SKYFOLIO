/**
 * Tutorial bertahap yang menyesuaikan perangkat (docs/07 bagian 5).
 * Setiap langkah selesai sendiri saat pengunjung melakukannya.
 */
import { bus } from '../core/EventBus';
import { tutorialStep, type TutorialStep } from '../core/AppState';

const KEY = 'skyfolio.tutorial.done';

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // abaikan
  }
}

export class TutorialController {
  private airTime = 0;
  private stepTime = 0;
  private readonly unsubs: (() => void)[] = [];

  constructor() {
    tutorialStep.set(tutorialDone() ? 'done' : 'gas');
    this.unsubs.push(
      bus.on('plane:takeoff', () => this.advanceFrom('gas')),
      bus.on('ring:passed', (e) => {
        if (e.index >= 1) this.advanceFrom('turn');
      }),
      bus.on('plane:boost', (e) => {
        if (e.active) this.advanceFrom('boost');
      }),
    );
  }

  private advanceFrom(step: TutorialStep): void {
    if (tutorialStep.get() !== step) return;
    const order: TutorialStep[] = ['gas', 'climb', 'turn', 'boost', 'done'];
    const next = order[order.indexOf(step) + 1] ?? 'done';
    tutorialStep.set(next);
    this.stepTime = 0;
    if (next === 'done') markDone();
  }

  skip(): void {
    tutorialStep.set('done');
    markDone();
  }

  restart(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // abaikan
    }
    tutorialStep.set('gas');
    this.stepTime = 0;
  }

  update(dt: number, airborne: boolean, altitude: number): void {
    const step = tutorialStep.get();
    if (step === 'done') return;
    this.stepTime += dt;
    if (airborne) this.airTime += dt;
    if (step === 'climb' && (altitude > 12 || this.stepTime > 9)) this.advanceFrom('climb');
    if (step === 'turn' && this.stepTime > 16) this.advanceFrom('turn');
    if (step === 'boost' && this.stepTime > 14) this.advanceFrom('boost');
  }

  dispose(): void {
    for (const u of this.unsubs) u();
  }
}
