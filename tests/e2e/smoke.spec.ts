import { expect, test } from '@playwright/test';
import { board, openExperience, state, watchConsole } from './helpers';

test.describe('pengalaman 3D', () => {
  test('halaman terbuka tanpa error console dan bisa naik pesawat', async ({ page }) => {
    const con = watchConsole(page);
    await openExperience(page);
    await expect(page.locator('canvas#scene')).toBeVisible();
    await board(page);
    await page.waitForTimeout(1500);
    const s = await state(page);
    expect(s.grounded).toBe(true);
    expect(Number.isFinite(s.altitude)).toBe(true);
    expect(s.backend).toBe('WebGL2');
    await expect(page.getByTestId('pause')).toBeVisible();
    expect(con.problems).toEqual([]);
  });

  test('terbang 20 detik dengan keyboard', async ({ page }) => {
    const con = watchConsole(page);
    await openExperience(page);
    await board(page);
    await page.waitForTimeout(500);
    // Lepas landas: tahan W/↑.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(4500);
    await page.keyboard.up('KeyW');
    let s = await state(page);
    expect(s.grounded).toBe(false);
    // Belok kiri-kanan, boost, lalu terbang lurus.
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyA');
    await page.waitForTimeout(1500);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyD');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2500);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.press('Space'); // barrel roll
    await page.waitForTimeout(9000);
    s = await state(page);
    expect(s.grounded).toBe(false);
    expect(s.altitude).toBeGreaterThan(8);
    expect(s.airspeed).toBeGreaterThan(15);
    expect(Number.isFinite(s.position.x + s.position.y + s.position.z)).toBe(true);
    expect(con.problems).toEqual([]);
  });

  test('bahasa bisa diganti di layar pra-terbang tanpa reload', async ({ page }) => {
    await openExperience(page);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByTestId('board')).toHaveText('Board the Plane');
    await page.getByRole('button', { name: 'ID', exact: true }).click();
    await expect(page.getByTestId('board')).toHaveText('Naik Pesawat');
  });

  test('menu jeda: buka, respawn, lanjut', async ({ page }) => {
    const con = watchConsole(page);
    await openExperience(page);
    await board(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('resume')).toBeVisible();
    await page.getByTestId('open-settings').click();
    await expect(page.locator('.settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('resume')).toBeHidden();
    await page.getByTestId('pause').click();
    await page.getByTestId('respawn').click();
    await page.waitForTimeout(1200);
    const s = await state(page);
    expect(s.grounded).toBe(true);
    expect(con.problems).toEqual([]);
  });
});
