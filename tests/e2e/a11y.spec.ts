import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { goNav } from './nav';

async function scan(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = violations.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`);
  expect(summary).toEqual([]);
}

const seed = (user: number) => {
  const r = {
    id: 'demo-900030', cycle_id: 'demo-cycle', employee_id: 900030, reviewer_id: 900002, status: 'draft', is_key_talent: true,
    key_talent_reasons: ['Successor Candidate'], key_talent_note: null, is_critical_role: true, performance_strengths: 'x',
    pbm_strengths: [], pbm_improvements: [], development_areas: [{ idx: 1, text: 'area' }], personal_aspirations: null,
    aspirations_not_discussed: false, retention_risk: 'Medium', retention_reasons: ['Career Move'], mobility_status: null, desired_locations: null,
    additional_comments: null, completed_steps: [], version: 1, rev: 1, updated_at: new Date().toISOString(), next_roles: [],
    successors: [], dev_plan: [],
  };
  localStorage.setItem('talent-review.demo', JSON.stringify({ user, reviews: [r], teams: {} }));
  localStorage.setItem('talent-review.tourSeen.demo-900002', '1');
  localStorage.setItem('talent-review.mobileBannerSeen', '1');
};

test('login pages have no WCAG A or AA violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '登入人才盤點' })).toBeVisible();
  await scan(page, 'login');
  await page.goto('/hr/login');
  await expect(page.getByRole('heading', { name: 'HR 登入' })).toBeVisible();
  await scan(page, 'hr-login');
});

test('manager pages have no WCAG A or AA violations', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(seed, 900002);
  await page.goto('/team');
  await expect(page.getByText('整體進度')).toBeVisible();
  await scan(page, 'team');

  await page.goto('/team/select');
  await expect(page.getByText(/已選 1 \/ 10 位/)).toBeVisible();
  await scan(page, 'select');

  for (const step of ['CRITICAL_ROLE', 'PBM_STRENGTHS', 'RETENTION', 'SUCCESSORS', 'DEV_PLAN', 'summary']) {
    await page.goto(`/team/review/900030?step=${step}`);
    await expect(page.getByRole('button', { name: '回到我的團隊' })).toBeVisible();
    await scan(page, `wizard-${step}`);
  }

  await page.goto('/team/review/900030?step=PERF_STRENGTHS');
  await page.getByRole('button', { name: '查看引導與範例' }).click();
  await expect(page.getByRole('heading', { name: '好範例' })).toBeVisible();
  await scan(page, 'guide');

  await page.goto('/team/check');
  await expect(page.getByRole('heading', { name: '檢查並提交' })).toBeVisible();
  await scan(page, 'check');
});

test('HR console has no WCAG A or AA violations', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(seed, -1);
  await page.goto('/hr');
  await expect(page.getByRole('heading', { name: '盤點進度總覽' })).toBeVisible();
  for (const name of ['首頁', '審核佇列', '戰略儀表板', '匯出', 'AI 工作室', '以 Supervisor 身分預覽', '週期管理', '名單上傳', '帳號與 PIN', '下拉選項', '題庫', '稽核紀錄']) {
    await goNav(page, name);
    await page.waitForTimeout(800);
    await scan(page, name);
  }
});

test('executive view: both looks pass WCAG, presentation mode steps through chapters, a number opens its list', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(seed, -1);
  await page.goto('/hr/exec');
  await expect(page.getByRole('heading', { name: '人才盤點全貌' })).toBeVisible();
  await scan(page, 'exec-command');
  await page.getByRole('button', { name: '雙層' }).click();
  await expect(page).toHaveURL(/theme=hybrid/);
  await scan(page, 'exec-hybrid');
  await page.getByRole('button', { name: '定義與管理意義' }).first().click();
  await expect(page.getByText('定義與公式').first()).toBeVisible();
  await page.getByRole('button', { name: '簡報模式' }).click();
  await expect(page.getByRole('heading', { name: '留任風險' })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: '留任風險' })).toBeVisible();
  await expect(page.getByText('管理價值')).toBeVisible();
  await page.getByRole('button', { name: '離開簡報' }).click();
  await page.locator('#ch-whole').getByRole('button', { name: /查看名單|看名單/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
