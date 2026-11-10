import { expect, test } from '@playwright/test';
import { board, openExperience, state, watchConsole } from './helpers';

type Hooks = {
  openPanel: (kind: 'zone' | 'project', id: string) => void;
  autopilot: () => { active: boolean; target: string | null };
};

test.describe('UI Fase 1', () => {
  test('peta → "Antar ke sini" menyalakan autopilot dan pesawat lepas landas sendiri', async ({ page }) => {
    const con = watchConsole(page);
    await openExperience(page);
    await board(page);
    await page.getByTestId('open-map').click();
    await expect(page.getByTestId('panel')).toBeVisible();
    await page.getByTestId('map-zone-project-archipelago').click();
    await page.getByTestId('fly-here').click();
    await expect(page.getByTestId('panel')).toBeHidden();
    await expect(page.locator('.autopilot')).toBeVisible();
    const ap = await page.evaluate(() => (window as unknown as { __skyfolio: Hooks }).__skyfolio.autopilot());
    expect(ap).toEqual({ active: true, target: 'project-archipelago' });
    await page.waitForTimeout(12_000);
    const s = await state(page);
    expect(s.grounded).toBe(false);
    expect(s.altitude).toBeGreaterThan(6);
    // Input pemain mengambil alih kemudi.
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyA');
    await expect(page.locator('.autopilot')).toBeHidden();
    expect(con.problems).toEqual([]);
  });

  test('panel proyek tampil dan ikut berganti bahasa tanpa reload', async ({ page }) => {
    const con = watchConsole(page);
    await openExperience(page);
    await board(page);
    await page.evaluate(() => (window as unknown as { __skyfolio: Hooks }).__skyfolio.openPanel('zone', 'project-archipelago'));
    await expect(page.getByTestId('panel')).toBeVisible();
    await page.getByTestId('project-si-raju').click();
    await expect(page.getByTestId('project-title')).toContainText('SI-RAJU');
    await page.getByTestId('panel-close').click();
    await expect(page.getByTestId('panel')).toBeHidden();
    // Ganti bahasa lewat Pengaturan.
    await page.getByTestId('pause').click();
    await page.getByTestId('open-settings').click();
    await page.getByTestId('language-select').selectOption('en');
    await expect(page.locator('.settings h3').first()).toHaveText('General');
    await page.getByTestId('language-select').selectOption('id');
    await expect(page.locator('.settings h3').first()).toHaveText('Umum');
    expect(con.problems).toEqual([]);
  });

  test('paspor terbuka dan menampilkan stempel bandara', async ({ page }) => {
    await openExperience(page);
    await board(page);
    await page.waitForTimeout(1500);
    await page.getByTestId('open-passport').click();
    await expect(page.getByTestId('panel')).toBeVisible();
    await expect(page.getByTestId('panel')).toContainText(/Paspor|Passport/);
  });
});

test.describe('halaman statis', () => {
  test('Mode Ringkas memuat profil dan proyek tanpa error', async ({ page }) => {
    const con = watchConsole(page);
    await page.goto('/ringkas/');
    await expect(page.locator('h1')).toContainText('Syahril Maimubdy');
    await expect(page.locator('body')).toContainText('SI-RAJU');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    expect(con.problems).toEqual([]);
  });

  test('halaman CV siap cetak memuat nama dan pendidikan', async ({ page }) => {
    const con = watchConsole(page);
    await page.goto('/cv/');
    await expect(page.locator('body')).toContainText('Syahril Maimubdy');
    await expect(page.locator('body')).toContainText('Universitas Sumatera Utara');
    expect(con.problems).toEqual([]);
  });
});
