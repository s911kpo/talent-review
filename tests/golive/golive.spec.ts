// Go-live acceptance: one supervisor's answers followed from the screen, through the real database,
// into the Excel file Diana receives, cell by cell. Runs against a real backend (staging by default,
// production before real data is loaded) with fictional accounts and fictional employees only.
//
//   npm run test:golive                        staging, local app
//   TR_TARGET=production npm run test:golive   production backend (pre-launch only, fictional seed)
//   GOLIVE_BASE_URL=https://… npm run test:golive   the deployed site instead of the local app
//
// Everything this test writes is removed before and after it runs.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { goNav } from '../e2e/nav';
import { env } from './env';

const accounts = JSON.parse(readFileSync('supabase/seed/demo_accounts.json', 'utf8'));
const MGR = 900003;
const PIN = accounts.managers.find((m: { employeeId: number }) => m.employeeId === MGR).pin as string;
const CYCLE = '11111111-1111-4111-8111-111111111111';
const QUARTER = 'Q4 2026';
const LOCATION = 'Xindian District / New Taipei City / Taiwan';

let admin: SupabaseClient;
let manager: SupabaseClient;
let A: Person; // full, tricky answers
let B: Person; // minimal answers, triggers a reminder
let S: Person; // internal successor named in A
interface Person { id: number; fullName: string; localName: string; position: string; dept: string }

/* ------------------------------------------------------------------ setup and cleanup */
async function cleanup() {
  await admin.from('reviews').delete().eq('cycle_id', CYCLE).eq('reviewer_id', MGR);
  await admin.from('team_submissions').delete().eq('cycle_id', CYCLE).eq('reviewer_id', MGR);
}

async function apiLogin(attempt = 1): Promise<SupabaseClient> {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/auth-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ employeeId: String(MGR), pin: PIN }),
  });
  // The login function can return a brief gateway error; retry like a person pressing the button again.
  if (!res.ok) {
    if (attempt >= 3) throw new Error(`auth-pin HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000));
    return apiLogin(attempt + 1);
  }
  const body = await res.json();
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  return client;
}

async function person(id: number): Promise<Person> {
  const { data: e } = await admin.from('employees').select('full_name, local_name').eq('employee_id', id).single();
  const { data: p } = await admin.from('cycle_population').select('position, dept').eq('cycle_id', CYCLE).eq('employee_id', id).single();
  return { id, fullName: e!.full_name, localName: e!.local_name ?? '', position: p!.position ?? '', dept: p!.dept ?? '' };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: reports } = await admin.from('cycle_population').select('employee_id')
    .eq('cycle_id', CYCLE).eq('supervisor_id', MGR).eq('in_scope', true).order('employee_id');
  if (!reports || reports.length < 3) throw new Error(`Fictional supervisor ${MGR} needs at least 3 reports in ${CYCLE}`);
  [A, B, S] = await Promise.all(reports.slice(0, 3).map((r) => person(r.employee_id)));
  await cleanup();
  manager = await apiLogin();
  for (const [p, reasons] of [[A, ['Strong Performance Impact', 'Successor Candidate']], [B, ['Critical Role Holder']]] as const) {
    const { error } = await manager.rpc('set_key_talent', { p_cycle_id: CYCLE, p_employee_id: p.id, p_selected: true, p_reasons: reasons, p_note: null });
    if (error) throw error;
  }
});

test.afterAll(async () => {
  await cleanup();
});

/* ------------------------------------------------------------------ helpers */
async function loginManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('工號').fill(String(MGR));
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/, { timeout: 30_000 });
  // First visit on a browser opens the short tour; close it like a supervisor would.
  const skip = page.getByRole('button', { name: '略過' });
  if (await skip.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) await skip.click();
}

async function loginHr(page: Page) {
  await page.goto('/hr/login');
  await page.getByLabel('Email').fill(accounts.hr.email);
  await page.getByLabel('密碼').fill(accounts.hr.password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/hr$/, { timeout: 30_000 });
}

const saved = (page: Page) => expect(page.getByText(/^已儲存 ·/)).toBeVisible({ timeout: 15_000 });
const next = async (page: Page) => { await page.getByRole('button', { name: '儲存並下一題' }).click(); };
const step = (page: Page, n: number) => expect(page.getByText(`第 ${n} / 12 題`)).toBeVisible();
const add = (page: Page) => page.getByRole('button', { name: '新增一項' }).click();

async function fillPlanCard(page: Page, i: number, plan: Plan) {
  await page.getByLabel('發展目標／成功樣貌').nth(i).fill(plan.goal);
  await page.getByLabel('類型（70/20/10）').nth(i).selectOption(plan.type);
  await page.getByLabel('具體行動（每行一項，至少 2 項）').nth(i).fill(plan.actions);
  await page.getByLabel('資源與支援').nth(i).fill(plan.support);
  await page.getByLabel('負責人').nth(i).fill(plan.owner);
  await page.getByLabel('開始日').nth(i).fill(plan.start);
  await page.getByLabel('目標日').nth(i).fill(plan.target);
  await page.getByLabel('評核機制（怎麼確認做到、誰確認、何時檢視）').nth(i).fill(plan.checkpoint);
}
interface Plan { goal: string; type: string; actions: string; support: string; owner: string; start: string; target: string; checkpoint: string }

/* ------------------------------------------------------------------ the answers (fictional) */
// Line breaks, tabs, quotes, ampersands, commas and padding on purpose: the export must keep one row per person.
const ANS_A = {
  perf: '製程問題分析：不良率 2.1% → 0.6%\n跨部門協調："NPI" 一次通過, 節省 3 天',
  pbmS: [['Knowledge', '每次異常處理後整理 one-page lesson'], ['Principled Entrepreneurship', '主動拜訪客戶 & 回報']],
  pbmI: [['Transformation', '可以更主動試用 MES 新功能']],
  areas: ['帶領跨部門專案', '向上簡報與溝通'],
  asp: '希望兩年內往技術專家發展\t並帶新人',
  roles: [['Sr. Process Engineer', '1-2 years'], ['PE Section Manager', '3+ years']],
  locations: 'Penang, Malaysia; Chengdu',
  plans: [
    { goal: '2027/6 前獨立主導一個跨部門改善專案', type: 'Experience (70%)', actions: '擔任換線改善專案 PM\n每兩週主持專案會議', support: '副理每月 1 對 1', owner: '員工本人', start: '2026-12-01', target: '2027-06-30', checkpoint: '2027/6 以結案報告確認，由 PE 副理確認' },
    { goal: '每季向廠長簡報一次專案進度', type: 'Exposure (20%)', actions: '跟副理旁聽兩次簡報\n自行準備並簡報一次', support: 'HRBP 簡報教練', owner: 'PE 副理', start: '2027-01-04', target: '2027-09-30', checkpoint: '每季簡報後由副理回饋並記錄' },
  ] as Plan[],
  comments: '  前後空白與 "引號" 測試  ',
  late: '關閉分頁前最後一刻打的字',
};
const ANS_B = {
  perf: 'B 的績效強項：產線良率穩定',
  pbmS: [['Integrity', 'B 誠信事例']],
  pbmI: [['Humility', 'B 改善點']],
  areas: ['B 發展領域'],
  roles: [['Line Leader', 'Ready Now']],
  plans: [{ goal: 'B 目標：半年內帶一條線', type: 'Education (10%)', actions: '完成班長課程\n跟班 4 週', support: '訓練預算', owner: '員工本人', start: '2026-12-01', target: '2027-05-31', checkpoint: '5 月由課長評估是否可獨立帶線' }] as Plan[],
};

/* ------------------------------------------------------------------ 1. fill every question */
test('a supervisor answers all 12 questions for two people and every save lands in the database', async ({ page }) => {
  await loginManager(page);

  // Person A: everything, with second entries and tricky text.
  await page.goto(`/team/review/${A.id}`);
  await step(page, 1);
  await page.getByRole('radio', { name: '是', exact: true }).check({ force: true });
  await next(page);
  await step(page, 2);
  await page.getByRole('textbox').fill(ANS_A.perf);
  await next(page);
  for (const [list, n] of [[ANS_A.pbmS, 3], [ANS_A.pbmI, 4]] as const) {
    await step(page, n);
    for (let i = 0; i < list.length; i++) {
      if (i > 0) await add(page);
      await page.getByLabel('核心價值').nth(i).selectOption(list[i][0]);
      await page.getByLabel('行為證據').nth(i).fill(list[i][1]);
    }
    await next(page);
  }
  await step(page, 5);
  for (let i = 0; i < ANS_A.areas.length; i++) {
    if (i > 0) await add(page);
    await page.getByLabel(`發展領域 ${i + 1}`).fill(ANS_A.areas[i]);
  }
  await next(page);
  await step(page, 6);
  await page.getByRole('textbox').fill(ANS_A.asp);
  await next(page);
  await step(page, 7);
  for (let i = 0; i < ANS_A.roles.length; i++) {
    if (i > 0) await add(page);
    await page.getByLabel('職務名稱').nth(i).fill(ANS_A.roles[i][0]);
    await page.getByLabel('準備度').nth(i).selectOption(ANS_A.roles[i][1]);
  }
  await next(page);
  await step(page, 8);
  await page.getByRole('radio', { name: '現在可以' }).check({ force: true });
  await page.getByLabel('期望地點').fill(ANS_A.locations);
  await next(page);
  await step(page, 9);
  await page.getByRole('radio', { name: '高', exact: true }).check({ force: true });
  await page.getByLabel('市場競爭').check();
  await page.getByLabel('職涯發展').check();
  await next(page);
  await step(page, 10);
  await page.getByLabel('搜尋姓名、職稱或部門').fill(S.fullName.split(',')[0]);
  await page.getByRole('button', { name: new RegExp(`^${S.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first().click();
  await page.getByLabel('準備度').first().selectOption('Ready Now');
  await add(page);
  await page.getByLabel('類型', { exact: true }).nth(1).selectOption('tbh');
  await next(page);
  await step(page, 11);
  for (let i = 0; i < ANS_A.plans.length; i++) await fillPlanCard(page, i, ANS_A.plans[i]);
  await next(page);
  await step(page, 12);
  await page.getByRole('textbox').fill(ANS_A.comments);
  await page.getByRole('button', { name: '儲存並查看摘要' }).click();
  await expect(page.getByText('這位員工的必填題都完成了')).toBeVisible();
  await saved(page);

  // Person B: the short path (Low risk, Not Now, not discussed, TBH only).
  await page.goto(`/team/review/${B.id}`);
  await step(page, 1);
  await page.getByRole('radio', { name: '是', exact: true }).check({ force: true });
  await next(page);
  await page.getByRole('textbox').fill(ANS_B.perf);
  await next(page);
  await page.getByLabel('核心價值').selectOption(ANS_B.pbmS[0][0]);
  await page.getByLabel('行為證據').fill(ANS_B.pbmS[0][1]);
  await next(page);
  await page.getByLabel('核心價值').selectOption(ANS_B.pbmI[0][0]);
  await page.getByLabel('行為證據').fill(ANS_B.pbmI[0][1]);
  await next(page);
  await page.getByLabel('發展領域 1').fill(ANS_B.areas[0]);
  await next(page);
  await page.getByLabel('尚未與本人討論').check();
  await next(page);
  await page.getByLabel('職務名稱').fill(ANS_B.roles[0][0]);
  await page.getByLabel('準備度').selectOption(ANS_B.roles[0][1]);
  await next(page);
  await page.getByRole('radio', { name: '目前不考慮' }).check({ force: true });
  await next(page);
  await page.getByRole('radio', { name: '低', exact: true }).check({ force: true });
  await next(page);
  await page.getByLabel('類型', { exact: true }).selectOption('tbh');
  await next(page);
  await fillPlanCard(page, 0, ANS_B.plans[0]);
  await next(page);
  await step(page, 12);
  await page.getByRole('button', { name: '儲存並查看摘要' }).click();
  await expect(page.getByText('這位員工的必填題都完成了')).toBeVisible();
  await saved(page);

  // Database truth, read with the service key (not through the screen).
  const { data: ra } = await admin.from('reviews').select('*, next_roles(*), successors(*), dev_plan_items(*)').eq('cycle_id', CYCLE).eq('employee_id', A.id).single();
  expect(ra.is_critical_role).toBe(true);
  expect(ra.performance_strengths).toBe(ANS_A.perf);
  expect(ra.pbm_strengths.map((p: { principle: string; evidence: string }) => [p.principle, p.evidence])).toEqual(ANS_A.pbmS);
  expect(ra.pbm_improvements.map((p: { principle: string; evidence: string }) => [p.principle, p.evidence])).toEqual(ANS_A.pbmI);
  expect(ra.development_areas.map((a: { text: string }) => a.text)).toEqual(ANS_A.areas);
  expect(ra.personal_aspirations).toBe(ANS_A.asp);
  expect(ra.mobility_status).toBe('Now');
  expect(ra.desired_locations).toBe(ANS_A.locations);
  expect(ra.retention_risk).toBe('High');
  expect(ra.retention_reasons).toEqual(['Competitive Market', 'Career Move']);
  expect(ra.additional_comments).toBe(ANS_A.comments);
  expect([...ra.next_roles].sort((x: { rank: number }, y: { rank: number }) => x.rank - y.rank).map((n: { role_title: string; readiness: string }) => [n.role_title, n.readiness])).toEqual(ANS_A.roles);
  const succ = [...ra.successors].sort((x: { rank: number }, y: { rank: number }) => x.rank - y.rank);
  expect(succ.map((s: { successor_type: string; successor_employee_id: number | null; readiness: string | null }) => [s.successor_type, s.successor_employee_id, s.readiness]))
    .toEqual([['internal', S.id, 'Ready Now'], ['tbh', null, null]]);
  expect(ra.dev_plan_items).toHaveLength(2);
  for (const plan of ANS_A.plans) {
    const row = ra.dev_plan_items.find((p: { goal: string }) => p.goal === plan.goal);
    expect(row, plan.goal).toBeTruthy();
    expect([row.dev_type, row.actions, row.support, row.owner, row.start_date, row.target_date, row.checkpoint])
      .toEqual([plan.type, plan.actions, plan.support, plan.owner, plan.start, plan.target, plan.checkpoint]);
  }
  expect(ra.status).toBe('draft');

  const { data: rb } = await admin.from('reviews').select('*, successors(*), dev_plan_items(*)').eq('cycle_id', CYCLE).eq('employee_id', B.id).single();
  expect(rb.aspirations_not_discussed).toBe(true);
  expect(rb.mobility_status).toBe('Not Now');
  expect(rb.retention_risk).toBe('Low');
  expect(rb.retention_reasons).toEqual([]);
  expect(rb.successors.map((s: { successor_type: string }) => s.successor_type)).toEqual(['tbh']);
  expect(rb.dev_plan_items).toHaveLength(1);
});

/* ------------------------------------------------------------------ 2. reload, re-login, close mid-typing */
test('answers come back after signing in again on a fresh browser', async ({ browser }) => {
  const page = await freshPage(browser);
  await loginManager(page);
  await page.goto(`/team/review/${A.id}?step=summary`);
  const body = page.locator('main');
  for (const text of [ANS_A.pbmS[1][1], ANS_A.areas[1], ANS_A.roles[1][0], ANS_A.locations, ANS_A.plans[1].goal]) {
    await expect(body.getByText(text, { exact: false }).first(), text).toBeVisible();
  }
  await page.goto(`/team/review/${A.id}?step=PERF_STRENGTHS`);
  await expect(page.getByRole('textbox')).toHaveValue(ANS_A.perf);
  await page.goto(`/team/review/${A.id}?step=DEV_PLAN`);
  await expect(page.getByLabel('具體行動（每行一項，至少 2 項）').nth(0)).toHaveValue(ANS_A.plans[0].actions);
  await expect(page.getByLabel('目標日').nth(1)).toHaveValue(ANS_A.plans[1].target);
  await page.context().close();
});

test('typing and leaving before the autosave fires: the browser warns, and the text is kept on this device and saved', async ({ browser }) => {
  const page = await freshPage(browser);
  const context = page.context();
  await loginManager(page);
  await page.goto(`/team/review/${A.id}?step=COMMENTS`);
  await expect(page.getByRole('textbox')).toHaveValue(ANS_A.comments);
  await page.getByRole('textbox').fill(ANS_A.late);
  // Leave at once (the autosave waits 1.5 s). The page must ask before closing.
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe('beforeunload');
  await d.accept();

  const again = await context.newPage();
  await again.goto(`/team/review/${A.id}?step=COMMENTS`);
  await expect(again.getByRole('textbox')).toHaveValue(ANS_A.late);
  await saved(again);
  await expect.poll(async () => (await admin.from('reviews').select('additional_comments').eq('cycle_id', CYCLE).eq('employee_id', A.id).single()).data?.additional_comments, { timeout: 15_000 }).toBe(ANS_A.late);
  // Put the original comment back for the export checks.
  await again.getByRole('textbox').fill(ANS_A.comments);
  await saved(again);
  await expect.poll(async () => (await admin.from('reviews').select('additional_comments').eq('cycle_id', CYCLE).eq('employee_id', A.id).single()).data?.additional_comments, { timeout: 15_000 }).toBe(ANS_A.comments);
  await context.close();
});

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: 'zh-TW', viewport: test.info().project.use.viewport ?? { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
  return context.newPage();
}

/* ------------------------------------------------------------------ 3. reminder, submit, export */
test('the supervisor sees the reminder, confirms it, submits, and the draft export says DRAFT', async ({ page }) => {
  await loginManager(page);
  // Supervisor's own draft export before submitting.
  await page.goto('/team');
  await expect(page.getByRole('button', { name: '匯出我的團隊' })).toBeVisible();
  const draftFile = await download(page, () => page.getByRole('button', { name: '匯出我的團隊' }).click());
  const draft = await load(draftFile);
  expect(String(draft.getWorksheet('Planning Tool ')!.getCell('A2').value)).toMatch(/DRAFT$/);

  await page.goto('/team/check');
  await expect(page.getByText(`${B.fullName}：關鍵職位的接班人只有 TBH`, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '提交給 HR' })).toBeDisabled();
  await page.getByLabel('我已確認').check();
  await page.getByRole('button', { name: '提交給 HR' }).click();
  await expect(page).toHaveURL(/\/team\/submitted$/);
  const { data } = await admin.from('reviews').select('employee_id, status').eq('cycle_id', CYCLE).eq('reviewer_id', MGR).eq('is_key_talent', true);
  expect(data!.map((r) => r.status)).toEqual(['submitted', 'submitted']);
});

test('HR confirms the team and the Excel for Diana matches the template and every answer, cell by cell', async ({ page }) => {
  await loginHr(page);
  await goNav(page, '審核佇列');
  await page.getByLabel('選擇團隊').selectOption(String(MGR));
  await page.getByRole('button', { name: '確認整個團隊' }).click();
  await expect(page.getByRole('button', { name: '鎖定' })).toBeVisible();

  await goNav(page, '匯出');
  await page.getByLabel('範圍').selectOption(String(MGR));
  const file = await download(page, () => page.getByRole('button', { name: '匯出', exact: true }).click());
  expect(file.name).toMatch(/^TalentReview_Q4-2026_.+_\d{8}-\d{4}\.xlsx$/);
  const wb = await load(file);
  // Keep a copy outside test-results (which every run clears) for opening in real Excel.
  mkdirSync('acceptance-samples', { recursive: true });
  copyFileSync(file.path, `acceptance-samples/Excel驗收樣本_虛構資料_${process.env.TR_TARGET === 'production' ? 'production' : 'staging'}.xlsx`);
  const template = new ExcelJS.Workbook();
  await template.xlsx.readFile('public/templates/template.xlsx');

  // Sheets and the header row, word for word.
  expect(wb.worksheets.map((w) => w.name)).toEqual([...template.worksheets.map((w) => w.name), 'Development Plan', 'Key Talent List']);
  const pt = wb.getWorksheet('Planning Tool ')!;
  const tpt = template.getWorksheet('Planning Tool ')!;
  for (let c = 1; c <= 19; c++) expect(pt.getRow(3).getCell(c).value, `header ${c}`).toEqual(tpt.getRow(3).getCell(c).value);
  expect(String(pt.getCell('A2').value)).not.toMatch(/DRAFT/);

  // Exactly two data rows, then nothing.
  const rowOf = (p: Person) => {
    for (let r = 4; r <= 10; r++) if (pt.getRow(r).getCell(3).value === `${p.fullName} ${p.localName}`.trim()) return pt.getRow(r);
    throw new Error(`no row for ${p.id}`);
  };
  const cells = (row: ExcelJS.Row) => Array.from({ length: 19 }, (_, i) => String(row.getCell(i + 1).value ?? ''));
  expect(String(pt.getRow(6).getCell(3).value ?? '')).toBe('');

  const supervisor = (await person(MGR)).fullName;
  expect(cells(rowOf(A))).toEqual([
    QUARTER, supervisor, `${A.fullName} ${A.localName}`.trim(), `${A.position} / ${LOCATION}`,
    'High', 'Competitive Market; Career Move', 'Now', ANS_A.locations,
    '1. Sr. Process Engineer; 2. PE Section Manager', '1. 1-2 years; 2. 3+ years',
    `1. ${S.fullName}; 2. TBH (To-Be-Hired)`, '1. Ready Now; 2. -',
    '1. Knowledge: 每次異常處理後整理 one-page lesson; 2. Principled Entrepreneurship: 主動拜訪客戶 & 回報',
    '1. Transformation: 可以更主動試用 MES 新功能',
    '製程問題分析：不良率 2.1% → 0.6%; 跨部門協調："NPI" 一次通過, 節省 3 天',
    '1. 帶領跨部門專案; 2. 向上簡報與溝通',
    '希望兩年內往技術專家發展 並帶新人',
    '前後空白與 "引號" 測試',
    'Yes--Check Box',
  ]);
  expect(cells(rowOf(B))).toEqual([
    QUARTER, supervisor, `${B.fullName} ${B.localName}`.trim(), `${B.position} / ${LOCATION}`,
    'Low', '', 'Not Now', '',
    '1. Line Leader', '1. Ready Now',
    '1. TBH (To-Be-Hired)', '1. -',
    '1. Integrity: B 誠信事例', '1. Humility: B 改善點',
    ANS_B.perf, '1. B 發展領域', 'Not yet discussed with employee', '',
    'Yes--Check Box',
  ]);
  for (let r = 4; r <= 5; r++) for (const v of cells(pt.getRow(r))) expect(v, `row ${r}`).not.toMatch(/[\r\n\t]/);

  // Drop-downs rebuilt on the data rows.
  for (const [col, sheetCol] of [['A', 'E'], ['E', 'A'], ['G', 'B'], ['S', 'F']]) {
    const v = pt.getCell(`${col}4`).dataValidation;
    expect(v?.type, `${col}4 validation`).toBe('list');
    expect(String(v?.formulae?.[0])).toContain(`'Drop Down Options '!$${sheetCol}$2`);
  }

  // Development Plan: one row per plan item, actions keep their line breaks.
  const dp = wb.getWorksheet('Development Plan')!;
  const dpRows = dp.getSheetValues().slice(2).filter(Boolean) as unknown[][];
  expect(dpRows).toHaveLength(3);
  const planA = dpRows.filter((r) => r[1] === A.id);
  expect(planA.map((r) => [r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[14], r[15]])).toEqual([
    [1, ANS_A.areas[0], ANS_A.plans[0].goal, ANS_A.plans[0].type, ANS_A.plans[0].actions, ANS_A.plans[0].support, ANS_A.plans[0].owner, ANS_A.plans[0].start, ANS_A.plans[0].target, ANS_A.plans[0].checkpoint, 'Not Started'],
    [2, ANS_A.areas[1], ANS_A.plans[1].goal, ANS_A.plans[1].type, ANS_A.plans[1].actions, ANS_A.plans[1].support, ANS_A.plans[1].owner, ANS_A.plans[1].start, ANS_A.plans[1].target, ANS_A.plans[1].checkpoint, 'Not Started'],
  ]);

  // Key Talent List: both people, confirmed, reasons in English values.
  const kt = wb.getWorksheet('Key Talent List')!;
  const ktRows = kt.getSheetValues().slice(2).filter(Boolean) as unknown[][];
  expect(ktRows.map((r) => [r[1], r[6], r[8]]).sort()).toEqual([
    [A.id, 'Strong Performance Impact; Successor Candidate', 'confirmed'],
    [B.id, 'Critical Role Holder', 'confirmed'],
  ].sort());
});

/* ------------------------------------------------------------------ 4. extending the deadline */
test('HR extends the due date on screen; the database and audit log record it; supervisors cannot', async ({ page }) => {
  const { data: before } = await admin.from('cycles').select('due_at').eq('id', CYCLE).single();
  const taipei = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const setOnScreen = async (date: string) => {
    await page.getByRole('button', { name: '修改截止日' }).first().click();
    await page.getByLabel(/的新截止日$/).fill(date);
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await expect(page.getByText(/的截止日已改為/)).toBeVisible({ timeout: 15_000 });
  };
  await loginHr(page);
  await goNav(page, '週期管理');
  await setOnScreen('2027-01-15');
  const { data: after } = await admin.from('cycles').select('due_at').eq('id', CYCLE).single();
  expect(new Date(after!.due_at).toISOString()).toBe('2027-01-15T15:59:59.000Z');
  const { data: audit } = await admin.from('audit_log').select('action, detail').eq('entity', 'cycle').eq('entity_id', CYCLE)
    .order('created_at', { ascending: false }).limit(1).single();
  expect(audit!.action).toBe('cycle_due_changed');
  expect(new Date(audit!.detail.to).toISOString()).toBe('2027-01-15T15:59:59.000Z');

  const { error } = await manager.rpc('hr_set_cycle_due', { p_cycle_id: CYCLE, p_due_at: '2030-01-01T00:00:00Z' });
  expect(error?.message).toMatch(/forbidden/);

  // The audit page says it in plain words: who, what, which cycle, from → to.
  await goNav(page, '稽核紀錄');
  const line = page.getByRole('row').filter({ hasText: '修改截止日' }).first();
  await expect(line).toContainText(accounts.hr.displayName);
  await expect(line).toContainText('週期 Q4-2026');
  await expect(line).toContainText(/→ 2027\/1\/15/);
  await goNav(page, '週期管理');

  if (before!.due_at) await setOnScreen(taipei(before!.due_at)); // put the original date back
  const { data: restored } = await admin.from('cycles').select('due_at').eq('id', CYCLE).single();
  expect(restored!.due_at === null ? null : new Date(restored!.due_at).getTime()).toBe(before!.due_at === null ? null : new Date(before!.due_at).getTime());
});

/* ------------------------------------------------------------------ file helpers */
interface Downloaded { name: string; path: string }
async function download(page: Page, click: () => Promise<unknown>): Promise<Downloaded> {
  const wait = page.waitForEvent('download', { timeout: 60_000 });
  await click();
  const d = await wait;
  const path = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(path);
  return { name: d.suggestedFilename(), path };
}
async function load(file: Downloaded) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file.path);
  return wb;
}
