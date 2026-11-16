// Rehearsal of launch-day setup on an EMPTY system, exactly as HR will do it, with a fictional namelist:
// first HR login (scripts/create-first-hr.mjs) → create and open the cycle → upload the namelist →
// create supervisor PINs and download the list → add a second HR account → a supervisor signs in with a
// downloaded PIN, picks a key talent and the answer is saved → the second HR signs in.
//
//   TR_TARGET=production GOLIVE_BASE_URL=https://molex-talent-review.netlify.app npm run test:rehearsal
// Afterwards: TR_TARGET=production node scripts/prelaunch-reset.mjs --confirm
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { goNav } from '../e2e/nav';
import { env } from '../golive/env';

const HR1 = { email: 'rehearsal-hr1@talentreview.local', name: 'Rehearsal HR One' };
const HR2 = { email: 'rehearsal-hr2@talentreview.local', name: 'Rehearsal HR Two', employeeId: '900519' };
const CODE = 'Q4-2026';
const QUARTER = 'Q4 2026';
let admin: SupabaseClient;
let hr1Password = '';
let hr2Password = '';
let pins: Map<number, string>;

// Fictional plant: a GM outside the review (Supervisor ID 0), three supervisors, five people each,
// plus one person outside the review. IDs 900501+ are fictional.
const HEADERS = ['Talent Review', 'ID', 'LocalName', 'Full Name', 'Supervisor ID', 'Supervisor', 'Dept.', 'Dept. No.', 'Position', 'Gender', 'Birth month', 'Start Date'];
type Row = (string | number)[];
function namelist(): Row[] {
  const rows: Row[] = [['N', 900501, '林廠長', 'Lin, Rehearsal GM', 0, '', 'Plant', '5000', 'Plant Manager', 'M', 3, '2010-03-01']];
  const sups = [[900502, '王主管', 'Wang, Rehearsal Sup2'], [900503, '陳主管', 'Chen, Rehearsal Sup3'], [900504, '張主管', 'Chang, Rehearsal Sup4']] as const;
  sups.forEach(([id, local, full], s) => {
    rows.push(['Y', id, local, full, 900501, 'Lin, Rehearsal GM', `Dept ${s + 1}`, `510${s + 1}`, 'Supervisor', 'F', 5, '2015-06-01']);
    for (let k = 0; k < 5; k++) {
      const eid = 900510 + s * 5 + k;
      rows.push(['Y', eid, `員工${eid}`, `Doe, Rehearsal ${eid}`, id, full, `Dept ${s + 1}`, `510${s + 1}`, k === 0 ? 'Process Engineer' : 'Technician', k % 2 ? 'F' : 'M', 7, '2021-01-04']);
    }
  });
  rows.push(['N', 900599, '外部人員', 'Out, Rehearsal Scope', 900502, 'Wang, Rehearsal Sup2', 'Dept 1', '5101', 'Intern', 'M', 9, '2026-07-01']);
  return rows;
}

async function writeNamelist(path: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Namelist');
  ws.addRow(HEADERS);
  namelist().forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(path);
}

async function loginHr(page: Page, email: string, password: string) {
  await page.goto('/hr/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('密碼').fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/hr$/, { timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { count } = await admin.from('employees').select('*', { count: 'exact', head: true });
  const { count: cycles } = await admin.from('cycles').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0 || (cycles ?? 0) > 0) throw new Error('The rehearsal needs an empty system (run prelaunch-reset first).');
});

test('1. the first HR login is created with the script, and the password works', async ({ page }) => {
  const out = execFileSync(process.execPath, ['scripts/create-first-hr.mjs', '--email', HR1.email, '--name', HR1.name], { encoding: 'utf8', env: process.env });
  hr1Password = out.match(/Password .*: (\S+)$/m)?.[1] ?? '';
  expect(hr1Password).toHaveLength(18);
  await loginHr(page, HR1.email, hr1Password);
});

test('2. HR creates and opens the cycle', async ({ page }) => {
  await loginHr(page, HR1.email, hr1Password);
  await goNav(page, '週期管理');
  await page.getByLabel('週期代碼（例如 Q4-2026）').fill(CODE);
  await page.getByLabel('季度標籤（匯出 A 欄，例如 Q4 2026）').fill(QUARTER);
  await page.getByLabel('截止日').fill('2026-12-11');
  await page.getByRole('button', { name: '建立週期' }).click();
  const row = page.getByRole('row', { name: new RegExp(CODE) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '開啟' }).click();
  await expect(row.getByText('進行中')).toBeVisible();
  const { data } = await admin.from('cycles').select('code, quarter_label, status, due_at').single();
  expect([data!.code, data!.quarter_label, data!.status]).toEqual([CODE, QUARTER, 'open']);
  expect(new Date(data!.due_at).toISOString()).toBe('2026-12-11T15:59:59.000Z'); // 23:59:59 Taipei
});

test('3. HR uploads the namelist; Birth month is dropped and the people land in the cycle', async ({ page }) => {
  const file = test.info().outputPath('Rehearsal_namelist.xlsx');
  await writeNamelist(file);
  await loginHr(page, HR1.email, hr1Password);
  await goNav(page, '名單上傳');
  await page.getByLabel('名單檔案（xlsx）').setInputFiles(file);
  await expect(page.getByText('共 20 人，盤點範圍 18 人，Supervisor 4 位。')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '確認寫入' }).click();
  await expect(page.getByText(/已寫入 20 人/)).toBeVisible({ timeout: 30_000 });

  const { data: pop } = await admin.from('cycle_population').select('employee_id, in_scope, supervisor_id, position');
  expect(pop).toHaveLength(20);
  expect(pop!.filter((p) => p.in_scope)).toHaveLength(18);
  expect(pop!.find((p) => p.employee_id === 900510)).toMatchObject({ supervisor_id: 900502, position: 'Process Engineer' });
  const { data: emp } = await admin.from('employees').select('*').eq('employee_id', 900510).single();
  expect(JSON.stringify(emp)).not.toMatch(/birth/i);
  expect(emp).toMatchObject({ full_name: 'Doe, Rehearsal 900510', local_name: '員工900510' });
});

test('4. HR creates supervisor PINs and downloads the list once', async ({ page }) => {
  await loginHr(page, HR1.email, hr1Password);
  await goNav(page, '帳號與 PIN');
  await page.getByLabel('全選 Supervisor').check();
  await page.getByRole('button', { name: /建立或重設 PIN（4 位）/ }).click();
  await expect(page.getByText('PIN 清單已產生，只能下載一次')).toBeVisible({ timeout: 30_000 });
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 PIN 清單' }).click();
  const d = await wait;
  const path = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(path);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  expect(ws.getRow(1).values).toEqual([undefined, 'Employee ID', 'Name', 'PIN']);
  pins = new Map();
  ws.eachRow((r, i) => { if (i > 1) pins.set(Number(r.getCell(1).value), String(r.getCell(3).value)); });
  expect([...pins.keys()].sort()).toEqual([900501, 900502, 900503, 900504]);
  for (const pin of pins.values()) expect(pin).toMatch(/^[A-Z0-9]{8}$/);
});

test('5. HR adds a second HR account (with an employee ID) and its password works', async ({ page, browser }) => {
  await loginHr(page, HR1.email, hr1Password);
  await goNav(page, '帳號與 PIN');
  await page.getByLabel('Email').fill(HR2.email);
  await page.getByLabel('顯示名稱').fill(HR2.name);
  await page.getByLabel('工號（本人也在名單內時必填）').fill(HR2.employeeId);
  await page.getByRole('button', { name: '建立 HR 帳號' }).click();
  await expect(page.getByText('請立即複製這組密碼，之後無法再次查看')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`${HR2.email} 的密碼`)).toBeVisible();
  hr2Password = ((await page.locator('code.select-all').textContent()) ?? '').trim();
  expect(hr2Password.length).toBeGreaterThan(8);
  const other = await (await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'zh-TW' })).newPage();
  await loginHr(other, HR2.email, hr2Password);
  await other.context().close();
});

test('6. a supervisor signs in with the downloaded PIN, picks a key talent, and the answer is saved', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('工號').fill('900502');
  await page.getByLabel('PIN').fill(pins.get(900502)!);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/, { timeout: 30_000 });
  await page.getByRole('button', { name: '略過' }).click();
  await page.getByRole('link', { name: '開始選出關鍵人才' }).click();
  await expect(page.getByRole('checkbox', { name: /列為關鍵人才/ })).toHaveCount(5);
  await page.getByRole('checkbox', { name: /列為關鍵人才/ }).first().check();
  await page.getByLabel('績效貢獻突出').check();
  await page.getByRole('button', { name: '儲存並開始填寫' }).click();
  await expect(page).toHaveURL(/\/team\/review\//);
  await page.getByRole('radio', { name: '是', exact: true }).check({ force: true });
  await expect(page.getByText(/^已儲存 ·/)).toBeVisible({ timeout: 15_000 });
  const { data } = await admin.from('reviews').select('reviewer_id, is_key_talent, key_talent_reasons, is_critical_role, status');
  expect(data).toEqual([{ reviewer_id: 900502, is_key_talent: true, key_talent_reasons: ['Strong Performance Impact'], is_critical_role: true, status: 'draft' }]);
});

test('7. a wrong PIN is refused and HR sees the supervisor\'s progress', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('工號').fill('900503');
  await page.getByLabel('PIN').fill('WRONG123');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/login$/);
  await loginHr(page, HR1.email, hr1Password);
  await expect(page.getByText('Wang, Rehearsal Sup2').first()).toBeVisible({ timeout: 20_000 });
});
