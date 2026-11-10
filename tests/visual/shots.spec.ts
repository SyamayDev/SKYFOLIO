/**
 * `npm run shots`: screenshot 4 viewport × beberapa posisi kamera penting (CLAUDE.md bagian 6).
 * Hasil di tests/shots/ — wajib dilihat sebelum fase dianggap selesai.
 */
import { test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'hp-portrait-390x844', width: 390, height: 844, mobile: true },
  { name: 'hp-landscape-844x390', width: 844, height: 390, mobile: true },
  { name: 'tablet-820x1180', width: 820, height: 1180, mobile: true },
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
];

type Hooks = {
  ready: boolean;
  teleport: (lat: number, lon: number, alt: number, heading: number, speed: number) => void;
  camera: (mode: 'chase' | 'cockpit') => void;
  freeze: (on: boolean) => void;
  openPanel: (kind: string, id?: string) => void;
};

async function hooks(page: Page, fn: (h: Hooks) => void): Promise<void> {
  await page.evaluate(`(${fn.toString()})(window.__skyfolio)`);
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, isMobile: vp.mobile });

    test(`screenshot ${vp.name}`, async ({ page }) => {
      const shot = (scene: string): Promise<Buffer> => page.screenshot({ path: `tests/shots/${vp.name}-${scene}.png` });
      await page.goto('/?test&renderer=webgl&quality=medium');
      await page.waitForFunction(() => (window as unknown as { __skyfolio?: Hooks }).__skyfolio?.ready === true, null, {
        timeout: 120_000,
      });
      await page.waitForTimeout(800);
      await shot('1-preflight');
      await page.getByTestId('board').click();
      await page.waitForTimeout(2000);
      await shot('2-landasan');
      // Lepas landas
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(3200);
      await shot('3-lepas-landas');
      await page.keyboard.up('KeyW');
      // Terbang rendah mendekati Danau Toba (planet kecil: 30 unit/dtk ≈ 4°/dtk, jadi foto cepat).
      await hooks(page, (h) => {
        h.teleport(3.0, 99.3, 16, 220, 30);
        h.freeze(true);
      });
      await page.waitForTimeout(600);
      await shot('4-terbang-toba');
      // Kokpit
      await hooks(page, (h) => h.camera('cockpit'));
      await page.waitForTimeout(1200);
      await shot('5-kokpit');
      await hooks(page, (h) => {
        h.camera('chase');
        h.freeze(false);
      });
      // Tinggi di atas Indonesia
      await hooks(page, (h) => {
        h.teleport(-6, 106, 120, 20, 45);
        h.freeze(true);
      });
      await page.waitForTimeout(800);
      await shot('6-tinggi');
      // Melewati kutub utara
      await hooks(page, (h) => {
        h.teleport(88, 30, 35, 0, 36);
        h.freeze(true);
      });
      await page.waitForTimeout(800);
      await shot('7-kutub');
      // Menu jeda + pengaturan
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await shot('8-jeda');
      await page.getByTestId('open-settings').click();
      await page.waitForTimeout(400);
      await shot('9-pengaturan');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      // Panel-panel isi portofolio (Fase 1).
      const panels: [string, string, string | undefined][] = [
        ['10-panel-tentang', 'zone', 'control-tower'],
        ['11-panel-proyek', 'project', 'si-raju'],
        ['12-panel-pulau', 'zone', 'project-archipelago'],
        ['13-panel-peta', 'map', undefined],
        ['14-panel-paspor', 'passport', undefined],
        ['15-panel-kontak', 'contact', undefined],
        ['16-panel-skill', 'zone', 'skill-peaks'],
        ['17-panel-bts', 'bts', undefined],
      ];
      for (const [name, kind, id] of panels) {
        await page.evaluate(([k, i]) => (window as unknown as { __skyfolio: Hooks }).__skyfolio.openPanel(k!, i), [kind, id]);
        await page.waitForTimeout(700);
        await shot(name);
      }
    });
  });
}
