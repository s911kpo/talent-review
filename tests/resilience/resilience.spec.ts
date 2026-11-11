// Fault injection against the real backend, using only the fictional demo accounts on the
// fictional seed. Network faults are injected in the browser with page.route; nothing is
// changed on the server except one temporary review, removed afterwards.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m![1], m![2].trim()]),
);
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const accounts = JSON.parse(readFileSync('supabase/seed/demo_accounts.json', 'utf8'));
const MGR = 900002;
const REPORT = 900030;
const CYCLE = '11111111-1111-4111-8111-111111111111';
const PIN = accounts.managers.find((m: { employeeId: number }) => m.employeeId === MGR).pin as string;

let manager: SupabaseClient;
let hr: SupabaseClient;
let reviewId = '';

async function apiLogin(): Promise<SupabaseClient> {
  const res = await fetch(`${URL_}/functions/v1/auth-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ employeeId: String(MGR), pin: PIN }),
  });
  const body = await res.json();
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  return client;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  manager = await apiLogin();
  hr = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await hr.auth.signInWithPassword({ email: accounts.hr.email, password: accounts.hr.password });
  const { error } = await manager.rpc('set_key_talent', { p_cycle_id: CYCLE, p_employee_id: REPORT, p_selected: true, p_reasons: ['Successor Candidate'], p_note: null });
  if (error) throw error;
  const { data } = await manager.from('reviews').select('id').eq('cycle_id', CYCLE).eq('employee_id', REPORT).single();
  reviewId = data!.id;
});

test.afterAll(async () => {
  await hr.from('reviews').delete().eq('cycle_id', CYCLE).eq('employee_id', REPORT);
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('工號').fill(String(MGR));
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
}

async function openWizard(page: Page) {
  await page.goto(`/team/review/${REPORT}`);
  await expect(page.getByText(/第 \d+ \/ 12 題/)).toBeVisible();
}

/** Toggles the critical-role answer, which triggers an autosave. */
async function change(page: Page) {
  const yes = page.getByRole('radio', { name: '是', exact: true });
  const target = (await yes.isChecked()) ? page.getByRole('radio', { name: '否', exact: true }) : yes;
  await target.check({ force: true });
}

const noTechnicalText = async (page: Page) => {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/TypeError|stack|undefined|null is not|at \w+ \(|PGRST|JWT|42501/);
};

test('login service down shows a plain retry message', async ({ page }) => {
  await page.route('**/functions/v1/auth-pin', (r) => r.fulfill({ status: 500, body: '{"error":"boom"}' }));
  await page.goto('/login');
  await page.getByLabel('工號').fill(String(MGR));
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('目前無法登入');
  await noTechnicalText(page);
  await page.unroute('**/functions/v1/auth-pin');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
});

test('autosave failure retries, then saves once the server is back', async ({ page }) => {
  await login(page);
  await openWizard(page);
  await page.route('**/rest/v1/rpc/save_review', (r) => r.fulfill({ status: 503, body: '{"message":"unavailable"}' }));
  await change(page);
  await expect(page.getByText('儲存失敗，正在重試')).toBeVisible({ timeout: 10_000 });
  await noTechnicalText(page);
  await page.unroute('**/rest/v1/rpc/save_review');
  await expect(page.getByText(/已儲存 ·/)).toBeVisible({ timeout: 15_000 });
});

test('offline work is held and sent when the connection returns', async ({ page, context }) => {
  await login(page);
  await openWizard(page);
  await context.setOffline(true);
  await change(page);
  await expect(page.getByText('目前離線，內容暫存在此裝置')).toBeVisible({ timeout: 10_000 });
  const pending = await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('pending.')));
  expect(pending).toBe(true);
  await context.setOffline(false);
  await expect(page.getByText(/已儲存 ·/)).toBeVisible({ timeout: 15_000 });
});

test('a save from another device is detected, not overwritten', async ({ page }) => {
  await login(page);
  await openWizard(page);
  const { data } = await manager.from('reviews').select('rev').eq('id', reviewId).single();
  const other = await manager.rpc('save_review', { p_review_id: reviewId, p_expected_rev: data!.rev, p_fields: { additional_comments: 'from another device' } });
  expect(other.error).toBeNull();
  await change(page);
  await expect(page.getByText('這筆資料已在其他地方更新')).toBeVisible({ timeout: 10_000 });
});

test('an expired session tells the manager to sign in again instead of retrying forever', async ({ page }) => {
  await login(page);
  await openWizard(page);
  await page.route('**/rest/v1/rpc/save_review', (r) => r.fulfill({
    status: 401, contentType: 'application/json', body: '{"code":"PGRST301","message":"JWT expired"}',
  }));
  await change(page);
  await expect(page.getByText(/登入已逾時/)).toBeVisible({ timeout: 10_000 });
  await noTechnicalText(page);
});

test('a team locked by HR while the page is open stops retrying and says why', async ({ page }) => {
  await login(page);
  await openWizard(page);
  await page.route('**/rest/v1/rpc/save_review', (r) => r.fulfill({
    status: 400, contentType: 'application/json', body: '{"code":"P0001","message":"review_not_editable"}',
  }));
  await change(page);
  await expect(page.getByText(/已提交或鎖定/)).toBeVisible({ timeout: 10_000 });
  await noTechnicalText(page);
});

test('dashboard failure shows a retry button and recovers', async ({ page }) => {
  await login(page);
  // The first-visit tour may open a moment after the page; dismiss it if it does.
  await page.getByRole('button', { name: '略過' }).click({ timeout: 5000 }).catch(() => undefined);
  await expect(page.getByRole('tab', { name: '儀表板' })).toBeVisible();
  // Fail only the dashboard's own requests, after the home page has loaded.
  let fail = true;
  await page.route(/\/rest\/v1\/(reviews|cycle_population)\?/, (r) => (fail ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"internal"}' }) : r.fallback()));
  await page.getByRole('tab', { name: '儀表板' }).click();
  // supabase-js retries transient failures on its own first, so allow for that.
  await expect(page.getByRole('alert').first()).toContainText('發生錯誤', { timeout: 30_000 });
  await noTechnicalText(page);
  fail = false;
  await page.getByRole('button', { name: '重試' }).first().click();
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 15_000 });
});

test('a slow network shows saving and never double-saves', async ({ page }) => {
  await login(page);
  await openWizard(page);
  let calls = 0;
  await page.route('**/rest/v1/rpc/save_review', async (r) => {
    calls += 1;
    await new Promise((res) => setTimeout(res, 4000));
    await r.fallback();
  });
  await change(page);
  await expect(page.getByText('儲存中…')).toBeVisible();
  await expect(page.getByText(/已儲存 ·/)).toBeVisible({ timeout: 20_000 });
  expect(calls).toBe(1);
});
