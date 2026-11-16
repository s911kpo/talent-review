// Captures the real app screens used by the launch and training videos.
// Fictional data only: demo mode (empty team, port 5173) for the step-by-step review,
// showcase mode (600 fictional employees, port 5174) for dashboards. Never point this at real data.
//
// Usage: node scripts/video/capture.mjs   (both dev servers must be running)
// Output: video-build/shots/*.png at 1920x1080 plus video-build/shots/manifest.json with target boxes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'video-build/shots';
mkdirSync(OUT, { recursive: true });
const DEMO = 'http://localhost:5173';
const SHOW = 'http://localhost:5174';
const SCALE = 4 / 3; // 1440x810 CSS pixels -> 1920x1080 image
const manifest = {};

const browser = await chromium.launch();

async function newPage(viewport = { width: 1440, height: 810 }, scale = SCALE) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: 'zh-TW' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  return page;
}

/** Screenshot plus the boxes (in image pixels) of the named elements, for highlights and the cursor. */
async function shot(page, id, targets = {}, scale = SCALE) {
  await page.waitForTimeout(350);
  // AI is switched off in the live system (VITE_AI_ENABLED=false); hide its menu item so the video matches what managers will see.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, a')) {
      if (el.textContent?.trim() === '團隊發展建議' || el.textContent?.trim() === 'AI 工作室') (el.closest('li') ?? el).remove();
    }
  });
  await page.screenshot({ path: `${OUT}/${id}.png` });
  const boxes = {};
  for (const [name, loc] of Object.entries(targets)) {
    const b = await loc.first().boundingBox().catch(() => null);
    if (b) boxes[name] = { x: b.x * scale, y: b.y * scale, w: b.width * scale, h: b.height * scale };
    else console.warn(`no box: ${id}.${name}`);
  }
  manifest[id] = { file: `${id}.png`, boxes };
  console.log('shot', id, Object.keys(boxes).join(','));
}

const next = (page) => page.getByRole('button', { name: '儲存並下一題' });

/* ------------------------------------------------------------------ step-by-step review (demo mode) */
{
  const page = await newPage();
  await page.goto(`${DEMO}/login`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('talent-review.mobileBannerSeen', '1'); });
  await page.goto(`${DEMO}/login`);
  await page.getByLabel('工號').waitFor();
  // The demo shortcut cards exist only on the demo site; managers will see just the sign-in form.
  await page.evaluate(() => document.querySelector('section[aria-labelledby="demo-entry"]')?.remove());
  await shot(page, 't01-login', { id: page.getByLabel('工號'), pin: page.getByLabel('PIN') });
  await page.getByLabel('工號').fill('900002');
  await page.getByLabel('PIN').fill('ABCD2345');
  await shot(page, 't02-login-filled', { button: page.getByRole('button', { name: '登入', exact: true }) });
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await page.waitForURL(/\/team$/);
  await page.getByRole('button', { name: '略過' }).waitFor();
  await shot(page, 't03-tour', { card: page.getByRole('dialog') });
  await page.getByRole('button', { name: '略過' }).click();
  await shot(page, 't04-home', {
    deadline: page.getByText(/距離截止/), progress: page.getByText('整体進度').or(page.getByText('整體進度')),
    start: page.getByRole('link', { name: '開始選出關鍵人才' }), hint: page.getByText(/15 分鐘/),
  });

  await page.getByRole('link', { name: '開始選出關鍵人才' }).click();
  await page.getByRole('checkbox', { name: /列為關鍵人才/ }).first().waitFor();
  await shot(page, 't05-select', { first: page.getByRole('checkbox', { name: /列為關鍵人才/ }), counter: page.getByText(/已選 \d+ \/ \d+ 位/) });
  await page.getByRole('checkbox', { name: /列為關鍵人才/ }).first().check();
  await page.getByLabel('績效貢獻突出').check();
  await shot(page, 't06-select-reason', {
    reasons: page.getByText('原因（至少一項）'), reason: page.getByLabel('績效貢獻突出'),
    continue: page.getByRole('button', { name: '儲存並開始填寫' }), counter: page.getByText(/已選 \d+ \/ \d+ 位/),
  });
  await page.getByRole('button', { name: '儲存並開始填寫' }).click();
  await page.waitForURL(/\/team\/review\//);
  await page.getByText('第 1 / 12 題').waitFor();

  const step = async (n, fill, targets = () => ({})) => {
    await page.getByText(`第 ${n} / 12 題`).waitFor();
    await fill();
    await shot(page, `t1${String(n).padStart(2, '0')}-q${n}`, { next: next(page).or(page.getByRole('button', { name: '儲存並查看摘要' })), title: page.locator('main h1, main h2').first(), ...targets() });
  };

  await step(1, () => page.getByRole('radio', { name: '是', exact: true }).check({ force: true }), () => ({ field: page.getByRole('radio', { name: '是', exact: true }) }));
  await next(page).click();
  await step(2, async () => {
    await page.getByRole('textbox').fill('製程問題分析：三週內把不良率從 2.1% 降到 0.6%，並整理成標準作業。');
    await page.getByRole('button', { name: /查看引導與範例/ }).first().click().catch(() => {});
  }, () => ({ field: page.getByRole('textbox'), guide: page.getByText('好範例').first() }));
  await page.getByRole('button', { name: /關閉引導/ }).first().click().catch(() => {});
  await next(page).click();
  await step(3, async () => {
    await page.getByLabel('核心價值').selectOption('Knowledge');
    await page.getByLabel('行為證據').fill('每次異常處理後都整理成 one-page lesson，分享給全組');
  }, () => ({ field: page.getByLabel('核心價值') }));
  await next(page).click();
  await step(4, async () => {
    await page.getByLabel('核心價值').selectOption('Transformation');
    await page.getByLabel('行為證據').fill('面對新系統傾向沿用舊的 Excel 流程，可以更主動試用並回饋');
  }, () => ({ field: page.getByLabel('核心價值') }));
  await next(page).click();
  await step(5, () => page.getByLabel('發展領域 1').fill('帶領跨部門專案的經驗'), () => ({ field: page.getByLabel('發展領域 1') }));
  await next(page).click();
  await step(6, () => page.getByRole('textbox').first().fill('希望三年內往製程技術專家發展，也想有海外支援的經驗'), () => ({ field: page.getByRole('textbox').first(), notDiscussed: page.getByText('尚未與本人討論') }));
  await next(page).click();
  await step(7, async () => {
    await page.getByLabel('職務名稱').fill('Sr. Process Engineer');
    await page.getByLabel('準備度').selectOption('1-2 years');
  }, () => ({ field: page.getByLabel('職務名稱'), readiness: page.getByLabel('準備度') }));
  await next(page).click();
  await step(8, () => page.getByRole('radio', { name: '目前不考慮' }).check({ force: true }), () => ({ field: page.getByRole('radio', { name: '目前不考慮' }) }));
  await next(page).click();
  await step(9, async () => {
    await page.getByRole('radio', { name: '中', exact: true }).check({ force: true });
    await page.getByLabel('市場競爭').check();
  }, () => ({ field: page.getByRole('radio', { name: '中', exact: true }), reason: page.getByLabel('市場競爭') }));
  await next(page).click();
  await step(10, async () => {
    await page.getByLabel('類型', { exact: true }).selectOption('tbh');
    await page.getByText('目前組織內沒有接班人選，需要外部招募').waitFor();
  }, () => ({ field: page.getByLabel('類型', { exact: true }), note: page.getByText('目前組織內沒有接班人選，需要外部招募') }));
  await next(page).click();
  await step(11, async () => {
    await page.getByLabel('發展目標／成功樣貌').fill('2027/6 前獨立主導一個跨部門改善專案');
    await page.getByLabel('類型（70/20/10）').selectOption('Experience (70%)');
    await page.getByLabel('具體行動（每行一項，至少 2 項）').fill('擔任換線改善專案 PM\n每兩週主持專案會議');
    await page.getByLabel('負責人').fill('員工本人');
    await page.getByLabel('開始日').fill('2026-12-01');
    await page.getByLabel('目標日').fill('2027-06-30');
    await page.getByLabel('評核機制（怎麼確認做到、誰確認、何時檢視）').fill('2027/6 以結案報告確認，由 Supervisor 確認');
    await page.getByLabel('發展目標／成功樣貌').scrollIntoViewIfNeeded();
  }, () => ({ field: page.getByLabel('發展目標／成功樣貌'), type: page.getByLabel('類型（70/20/10）') }));
  await next(page).click();
  await step(12, () => page.getByRole('textbox').first().fill('本人對技術深度很有熱情，下一季安排參與新產品導入。'), () => ({ field: page.getByRole('textbox').first() }));
  await page.getByRole('button', { name: '儲存並查看摘要' }).click();
  await page.getByText('這位員工的必填題都完成了').waitFor();
  await page.getByText(/^已儲存 ·/).waitFor({ timeout: 10_000 }).catch(() => {});
  await shot(page, 't20-summary', { done: page.getByText('這位員工的必填題都完成了'), saved: page.getByText(/^已儲存 ·/), check: page.getByRole('link', { name: '檢查並提交' }).or(page.getByRole('button', { name: '檢查並提交' })) });

  await page.goto(`${DEMO}/team/check`);
  await page.getByText(/關鍵職位的接班人只有 TBH/).waitFor();
  await shot(page, 't21-check', { complete: page.getByText('完整度'), warning: page.getByText(/關鍵職位的接班人只有 TBH/), ack: page.getByLabel('我已確認'), submit: page.getByRole('button', { name: '提交給 HR' }) });
  await page.getByLabel('我已確認').check();
  await shot(page, 't22-check-ack', { submit: page.getByRole('button', { name: '提交給 HR' }) });
  await page.getByRole('button', { name: '提交給 HR' }).click();
  await page.waitForURL(/\/team\/submitted$/);
  await page.getByRole('heading', { name: '已提交', exact: true }).waitFor();
  await shot(page, 't23-submitted', { focus: page.getByText('建議討論的焦點'), date: page.getByLabel('討論日期'), keyList: page.getByText('關鍵人才名單') });
  await page.context().close();
}

/* ------------------------------------------------------------------ data use (showcase mode) */
{
  const page = await newPage();
  await page.goto(`${SHOW}/login`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('talent-review.mobileBannerSeen', '1'); });
  await page.goto(`${SHOW}/login`);
  await page.getByRole('button', { name: /^Supervisor（帶領其他 Supervisor）/ }).click();
  await page.waitForURL(/\/team/);
  await page.getByRole('button', { name: '略過' }).click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'd01-team', { nav: page.getByRole('tablist').first() });
  await page.goto(`${SHOW}/team?tab=line`);
  await page.waitForTimeout(1200);
  await shot(page, 'd02-line', {});
  await page.goto(`${SHOW}/team?tab=dash`);
  await page.getByRole('tab', { name: '總覽' }).waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'd03-dash-overview', { kpis: page.locator('main .grid').first(), headlines: page.getByText('本期重點').first() });
  await page.getByRole('button', { name: '引導提問' }).first().click().catch(() => {});
  await shot(page, 'd04-probes', {
    probe: page.getByRole('button', { name: '引導提問' }).first(),
    panel: page.getByRole('button', { name: '引導提問' }).first().locator('xpath=ancestor::section[1]'),
  });
  for (const [tab, id] of [['留任風險', 'd05-risk'], ['接班梯隊', 'd07-bench'], ['職涯與發展', 'd09-growth'], ['組織畫像', 'd10-org']]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(1500);
    await shot(page, id, { tabs: page.getByRole('tab', { name: tab, exact: true }) });
    if (tab === '留任風險') {
      const cell = page.getByRole('button', { name: /高 × 關鍵職位/ }).first();
      await shot(page, 'd05b-risk-cell', { cell });
      await cell.click();
      await page.getByRole('dialog').waitFor();
      await shot(page, 'd06-drill-list', { list: page.getByRole('dialog').getByRole('listitem').first() });
      await page.getByRole('dialog').getByRole('button', { name: /開啟 .* 的檔案/ }).first().click();
      await page.getByText('對話準備').waitFor();
      await shot(page, 'd06b-profile', { prep: page.getByText('對話準備'), back: page.getByRole('button', { name: '返回' }) });
      await page.getByRole('button', { name: '關閉', exact: true }).click();
    }
    if (tab === '接班梯隊') {
      await page.getByText('關鍵職位風險矩陣').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await shot(page, 'd08-matrix', { matrix: page.getByText('關鍵職位風險矩陣').first() });
    }
  }
  await page.context().close();
}

/* ------------------------------------------------------------------ plant-wide view for the trailer (showcase, plant manager) */
{
  const page = await newPage();
  await page.goto(`${SHOW}/login`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('talent-review.mobileBannerSeen', '1'); });
  await page.goto(`${SHOW}/login`);
  await page.getByRole('button', { name: /^廠長/ }).click();
  await page.waitForURL(/\/team/);
  await page.getByRole('button', { name: '略過' }).click({ timeout: 4000 }).catch(() => {});
  await page.goto(`${SHOW}/team?tab=dash`);
  await page.getByRole('tab', { name: '總覽' }).waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'g01-overview', {});
  await page.getByRole('tab', { name: '留任風險', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'g02-risk', { map: page.getByText('留任風險地圖').first() });
  await page.getByRole('button', { name: /高 × 關鍵職位/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /開啟 .* 的檔案/ }).first().click();
  await page.getByText('對話準備').waitFor();
  await shot(page, 'g03-profile', {});
  await page.getByRole('button', { name: '關閉', exact: true }).click();
  await page.getByRole('tab', { name: '接班梯隊', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByText('關鍵職位風險矩陣').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot(page, 'g04-matrix', { matrix: page.getByText('關鍵職位風險矩陣').first() });
  await page.getByRole('tab', { name: '組織畫像', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'g05-org', {});
  await page.getByRole('tab', { name: '職涯與發展', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'g06-growth', {});
  await page.context().close();
}

/* ------------------------------------------------------------------ phone (showcase) */
{
  const page = await newPage({ width: 390, height: 844 }, 3);
  await page.goto(`${SHOW}/login`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('talent-review.mobileBannerSeen', '1'); });
  await page.goto(`${SHOW}/login`);
  await page.getByRole('button', { name: /^Supervisor$/ }).or(page.getByRole('button', { name: /^Supervisor\s/ })).last().click();
  await page.waitForURL(/\/team/);
  await page.getByRole('button', { name: '略過' }).click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'm01-home', {}, 3);
  await page.context().close();
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
await browser.close();
console.log('done', Object.keys(manifest).length);
