import { expect, test, type Page } from '@playwright/test';
import { board, openExperience, state, watchConsole } from './helpers';

/** Kirim event pointer sentuh sintetis ke elemen (Playwright belum punya drag multi-sentuh). */
async function pointer(page: Page, testId: string, type: string, x: number, y: number, id = 7): Promise<void> {
  await page.evaluate(
    ({ testId, type, x, y, id }) => {
      const el = document.querySelector(`[data-testid=${testId}]`);
      el?.dispatchEvent(
        new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }),
      );
    },
    { testId, type, x, y, id },
  );
}

for (const vp of [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
]) {
  test.describe(`kontrol sentuh ${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });

    test('joystick, boost, dan tombol aksi bekerja', async ({ page }) => {
      const con = watchConsole(page);
      await openExperience(page);
      await board(page, true);
      // Kontrol sentuh tampil, ukurannya ramah jempol (≥ 56 px) dan di dalam layar.
      for (const id of ['btn-boost', 'btn-brake', 'btn-action']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, id).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(56);
        expect(box!.height).toBeGreaterThanOrEqual(56);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
      }
      // Joystick dinamis: sentuh sisi kiri lalu dorong ke atas = melaju.
      const zone = await page.getByTestId('stick-zone').boundingBox();
      const sx = zone!.x + zone!.width * 0.4;
      const sy = zone!.y + zone!.height * 0.6;
      await pointer(page, 'stick-zone', 'pointerdown', sx, sy);
      await pointer(page, 'stick-zone', 'pointermove', sx, sy - 70);
      await page.waitForTimeout(3500);
      let s = await state(page);
      expect(s.speed).toBeGreaterThan(6);
      await pointer(page, 'stick-zone', 'pointerup', sx, sy - 70);
      // Boost ditahan → throttle penuh.
      await pointer(page, 'btn-boost', 'pointerdown', 0, 0, 9);
      await page.waitForTimeout(1200);
      s = await state(page);
      expect(s.throttle).toBeGreaterThan(0.9);
      await pointer(page, 'btn-boost', 'pointerup', 0, 0, 9);
      // Tombol aksi (lompat/barrel roll) tidak menimbulkan error.
      await page.getByTestId('btn-action').dispatchEvent('pointerdown');
      await page.waitForTimeout(500);
      expect(con.problems).toEqual([]);
    });
  });
}
