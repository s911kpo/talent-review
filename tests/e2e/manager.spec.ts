import { expect, test, type Page } from '@playwright/test';
import { goNav } from './nav';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('工號').fill('900002');
  await page.getByLabel('PIN').fill('ABCD2345');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
}

async function selectFirstKeyTalent(page: Page) {
  await page.getByRole('button', { name: '略過' }).click();
  await page.getByRole('link', { name: '開始選出關鍵人才' }).click();
  await page.getByRole('checkbox', { name: /列為關鍵人才/ }).first().check();
  await expect(page.getByText('已選 1 / 10 位')).toBeVisible();
  await expect(page.getByRole('button', { name: '儲存並開始填寫' })).toBeDisabled();
  await expect(page.getByText('請至少選一個原因。', { exact: true })).toBeVisible();
  await page.getByLabel('績效貢獻突出').check();
  await page.getByRole('button', { name: '儲存並開始填寫' }).click();
  await expect(page).toHaveURL(/\/team\/review\//);
}

const next = (page: Page) => page.getByRole('button', { name: '儲存並下一題' }).click();

async function expectNoPlaceholders(page: Page) {
  await expect(page.locator('[placeholder]')).toHaveCount(0);
}

async function answerAll(page: Page) {
  await expect(page.getByText('第 1 / 12 題')).toBeVisible();
  await page.getByRole('radio', { name: '是', exact: true }).check({ force: true });
  await expectNoPlaceholders(page);
  await next(page);

  await page.getByRole('textbox').fill('製程問題分析：三週內把不良率從 2.1% 降到 0.6%');
  await next(page);

  await page.getByLabel('核心價值').selectOption('Knowledge');
  await page.getByLabel('行為證據').fill('每次異常處理後都整理成 one-page lesson');
  await next(page);

  await page.getByLabel('核心價值').selectOption('Transformation');
  await page.getByLabel('行為證據').fill('主動試用 MES 新功能可以帶動組內數位化');
  await next(page);

  await page.getByLabel('發展領域 1').fill('帶領跨部門專案的經驗');
  await next(page);

  await page.getByRole('textbox').fill('希望往技術專家發展');
  await next(page);

  await page.getByLabel('職務名稱').fill('Sr. Process Engineer');
  await page.getByLabel('準備度').selectOption('1-2 years');
  await next(page);

  await page.getByRole('radio', { name: '目前不考慮' }).check({ force: true });
  await next(page);

  await page.getByRole('radio', { name: '中', exact: true }).check({ force: true });
  await page.getByLabel('市場競爭').check();
  await next(page);

  await page.getByLabel('類型', { exact: true }).selectOption('tbh');
  await expect(page.getByText('目前組織內沒有接班人選，需要外部招募')).toBeVisible();
  await next(page);

  await page.getByLabel('發展目標／成功樣貌').fill('2027/6 前獨立主導一個跨部門改善專案');
  await page.getByLabel('類型（70/20/10）').selectOption('Experience (70%)');
  await page.getByLabel('具體行動（每行一項，至少 2 項）').fill('擔任換線改善專案 PM\n每兩週主持專案會議');
  await page.getByLabel('負責人').fill('員工本人');
  await page.getByLabel('開始日').fill('2026-12-01');
  await page.getByLabel('目標日').fill('2027-06-30');
  await page.getByLabel('評核機制（怎麼確認做到、誰確認、何時檢視）').fill('2027/6 以結案報告確認，由 PE 副理確認');
  await expectNoPlaceholders(page);
  await next(page);

  await page.getByRole('button', { name: '儲存並查看摘要' }).click();
  await expect(page.getByText('這位員工的必填題都完成了')).toBeVisible();
}

test('manager completes a review, survives reload, and submits', async ({ page }) => {
  await login(page);
  await selectFirstKeyTalent(page);
  await answerAll(page);

  await expect(page.getByText(/^已儲存 ·/)).toBeVisible({ timeout: 10_000 });
  const url = page.url();
  await page.reload();
  await expect(page.getByText('這位員工的必填題都完成了')).toBeVisible();

  await page.goto(url.replace('step=summary', 'step=PERF_STRENGTHS'));
  await expect(page.getByRole('textbox')).toHaveValue(/三週內/);

  await page.goto('/team/check');
  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  // Critical role with only TBH is a soft warning: it must be confirmed, then submission is allowed.
  await expect(page.getByText(/關鍵職位的接班人只有 TBH/)).toBeVisible();
  await expect(page.getByRole('button', { name: '提交給 HR' })).toBeDisabled();
  await page.getByLabel('我已確認').check();
  await page.getByRole('button', { name: '提交給 HR' }).click();
  await expect(page).toHaveURL(/\/team\/submitted$/);
  await expect(page.getByRole('heading', { name: '已提交', exact: true })).toBeVisible();
  await expect(page.getByText('關鍵人才名單')).toBeVisible();

  await page.goto(url.replace('step=summary', 'step=PERF_STRENGTHS'));
  await expect(page.getByText('此內容已提交，目前僅供檢視。')).toBeVisible();
  await expect(page.getByRole('textbox')).toBeDisabled();
});

test('full cycle: submit, HR returns, manager fixes, HR confirms, locks and exports', async ({ page }) => {
  await login(page);
  await selectFirstKeyTalent(page);
  await answerAll(page);
  await expect(page.getByText(/^已儲存 ·/)).toBeVisible({ timeout: 10_000 });
  const reviewUrl = page.url().replace('step=summary', 'step=COMMENTS');

  await page.goto('/team/check');
  await page.getByLabel('我已確認').check();
  await page.getByRole('button', { name: '提交給 HR' }).click();
  await expect(page).toHaveURL(/\/team\/submitted$/);

  const switchToHr = async () => {
    await page.getByRole('button', { name: '登出' }).click();
    await page.goto('/hr/login');
    await page.getByLabel('Email').fill('demo-hr@talentreview.local');
    await page.getByLabel('密碼').fill('demo-password');
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await expect(page).toHaveURL(/\/hr$/);
  };
  const openQueue = async () => {
    await goNav(page, '審核佇列');
    await page.getByLabel('選擇團隊').selectOption('900002');
  };

  await switchToHr();
  await openQueue();
  await page.getByLabel(/^給 .* 的留言$/).fill('請補上具體數字');
  await page.getByRole('button', { name: /退回有留言的人/ }).click();
  await expect(page.locator('.tag', { hasText: '已退回' })).toBeVisible();

  await page.getByRole('button', { name: '登出' }).click();
  await login(page);
  await page.goto(reviewUrl);
  await expect(page.getByText('請補上具體數字')).toBeVisible();
  await page.getByRole('textbox').fill('已補充');
  await expect(page.getByText(/^已儲存 ·/)).toBeVisible({ timeout: 10_000 });
  await page.goto('/team/check');
  await page.getByLabel('我已確認').check();
  await page.getByRole('button', { name: '提交給 HR' }).click();
  await expect(page).toHaveURL(/\/team\/submitted$/);

  await switchToHr();
  await openQueue();
  await page.getByRole('button', { name: '確認整個團隊' }).click();
  await expect(page.getByRole('button', { name: '鎖定' })).toBeVisible();
  await page.getByRole('button', { name: '鎖定' }).click();
  await expect(page.getByRole('button', { name: '解鎖回草稿' })).toBeVisible();

  await goNav(page, '匯出');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '匯出', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^TalentReview_Q4-2026_All_\d{8}-\d{4}\.xlsx$/);
});

test('dashboards show data, drill down, and manager AI stays read-only', async ({ page }) => {
  await login(page);
  await selectFirstKeyTalent(page);
  await answerAll(page);
  await expect(page.getByText(/^已儲存 ·/)).toBeVisible({ timeout: 10_000 });
  await page.goto('/team');
  await goNav(page, '儀表板');
  await expect(page.getByText('參考，非目標', { exact: false })).toBeVisible();
  await expect(page.getByText(/^全廠 /).first()).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/九宮格|配額|排名|強制/);

  await page.getByRole('tab', { name: '留任風險' }).click();
  await page.getByRole('button', { name: /中 × 關鍵職位/ }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Lin, Cedar')).toBeVisible();
  await drawer.getByText('Lin, Cedar').click();
  await expect(drawer.getByText('對話準備')).toBeVisible();
  await drawer.getByRole('button', { name: '展開完整內容' }).click();
  await expect(drawer.getByText(/三週內/)).toBeVisible();
  await drawer.getByRole('button', { name: '返回' }).click();
  await expect(drawer.getByText('Lin, Cedar')).toBeVisible();
  await page.getByRole('button', { name: '關閉', exact: true }).click();

  for (const name of ['接班梯隊', '職涯與發展', '組織畫像']) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tab', { name, selected: true })).toBeVisible();
  }

  await goNav(page, '團隊發展建議');
  await expect(page.getByText('AI 分析會將盤點內容傳送至 Anthropic API 處理')).toBeVisible();
  await expect(page.getByLabel('分析類型')).toHaveCount(0);
  await page.getByRole('button', { name: '生成' }).click();
  await expect(page.getByText('示範模式不會呼叫 AI')).toBeVisible();
});

test('guidance opens from the lightbulb and leaves inputs empty', async ({ page }) => {
  await login(page);
  await selectFirstKeyTalent(page);
  await next(page);
  await page.getByRole('button', { name: '查看引導與範例' }).click();
  await expect(page.getByRole('heading', { name: '好範例' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '弱範例' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('');
  await expectNoPlaceholders(page);
  await page.getByRole('button', { name: '關閉引導' }).click();
  await expect(page.getByRole('heading', { name: '好範例' })).toBeHidden();
});

test('no forced-distribution language and no horizontal scroll', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '略過' }).click();
  await page.getByRole('link', { name: '開始選出關鍵人才' }).click();
  await expect(page.getByText('已選 0 / 10 位')).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/九宮格|配額|排名|強制/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('choosing nobody requires a reason', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '略過' }).click();
  await page.getByRole('link', { name: '開始選出關鍵人才' }).click();
  await page.getByRole('button', { name: '儲存並開始填寫' }).click();
  const confirm = page.getByRole('button', { name: '儲存原因並繼續' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('原因', { exact: true }).fill('團隊都是新人');
  await confirm.click();
  await expect(page).toHaveURL(/\/team\/check$/);
  await expect(page.getByText('你本次未選出關鍵人才，原因已記錄。')).toBeVisible();
});

test('language and font size can be changed', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '略過' }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Start selecting key talent' })).toBeVisible();
  await page.getByRole('button', { name: 'Increase text size' }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18px');
});
