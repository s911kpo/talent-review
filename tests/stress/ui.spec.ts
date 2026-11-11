import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const timings: Record<string, number> = {};
const time = async (name: string, fn: () => Promise<unknown>) => {
  const t0 = Date.now();
  await fn();
  timings[name] = Date.now() - t0;
};
const errors: string[] = [];

async function enterAsHr(page: Page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/login');
  await time('login_to_overview', async () => {
    await page.getByRole('button', { name: /^HR/ }).first().click();
    await expect(page.locator('tbody tr').nth(11)).toBeVisible();
  });
  await time('show_all_teams', async () => {
    await page.getByRole('button', { name: /顯示全部/ }).click();
    await expect(page.locator('tbody tr').nth(100)).toBeVisible();
  });
}

test('HR console and dashboards stay responsive with 5,000 employees', async ({ page }) => {
  await enterAsHr(page);
  timings.overview_rows = await page.locator('tbody tr').count();

  await time('open_dashboard', async () => {
    await page.getByRole('tab', { name: '戰略儀表板' }).click();
    await expect(page.getByText('本期重點')).toBeVisible();
  });
  for (const tab of ['組織畫像', '留任風險', '接班梯隊', '職涯與發展', '行動清單', '總覽']) {
    await time(`tab_${tab}`, async () => {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tab', { name: tab, exact: true, selected: true })).toBeVisible();
      await expect(page.getByRole('tabpanel').locator('section, article').first()).toBeVisible();
    });
  }
  await time('filter_department', async () => {
    await page.locator('select').first().selectOption('Manufacturing');
    await expect(page.getByText('本期重點')).toBeVisible();
  });
  await time('drill_down', async () => {
    await page.getByRole('tab', { name: '接班梯隊', exact: true }).click();
    await page.getByRole('button', { name: /查看全部|查看名單/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/stress-ui.json', JSON.stringify({ timings, errors }, null, 2));
  expect(errors).toEqual([]);
  for (const [k, v] of Object.entries(timings)) if (k !== 'overview_rows') expect(v, k).toBeLessThan(5000);
});
