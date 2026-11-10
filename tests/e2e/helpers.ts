import { expect, type Page } from '@playwright/test';

export interface SkyState {
  altitude: number;
  speed: number;
  airspeed: number;
  grounded: boolean;
  stalled: boolean;
  throttle: number;
  bank: number;
  pitch: number;
  position: { x: number; y: number; z: number };
  lettersScattered: number;
  ringsPassed: number;
  backend: string;
  fps: number;
  tier: string;
}

/** Pesan console yang wajar di lingkungan tes (renderer software), bukan bug aplikasi. */
const BENIGN = [/GL Driver Message/i, /\[vite\]/i, /Download the Svelte DevTools/i];

export interface ConsoleWatcher {
  problems: string[];
}

export function watchConsole(page: Page): ConsoleWatcher {
  const w: ConsoleWatcher = { problems: [] };
  page.on('console', (m) => {
    const type = m.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = m.text();
    if (BENIGN.some((r) => r.test(text))) return;
    w.problems.push(`[${type}] ${text}`);
  });
  page.on('pageerror', (e) => w.problems.push(`[pageerror] ${e.message}`));
  return w;
}

export async function openExperience(page: Page, quality = 'low'): Promise<void> {
  await page.goto(`/?test&renderer=webgl&quality=${quality}`);
  await page.waitForFunction(() => (window as unknown as { __skyfolio?: { ready?: boolean } }).__skyfolio?.ready === true, null, {
    timeout: 120_000,
  });
  await expect(page.getByTestId('board')).toBeEnabled();
}

export async function board(page: Page, tap = false): Promise<void> {
  if (tap) await page.getByTestId('board').tap();
  else await page.getByTestId('board').click();
  await page.waitForFunction(() => document.querySelector('[data-testid=board]') === null, null, { timeout: 15_000 });
}

export async function state(page: Page): Promise<SkyState> {
  return page.evaluate(() => (window as unknown as { __skyfolio: { state: () => SkyState } }).__skyfolio.state());
}
