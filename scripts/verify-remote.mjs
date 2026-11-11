// Checks permissions and PIN login against the real Supabase project using the fictional demo
// accounts. Leaves no data behind. Usage: NODE_USE_ENV_PROXY=1 node scripts/verify-remote.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const { managers, hr } = JSON.parse(readFileSync('supabase/seed/demo_accounts.json', 'utf8'));
const pinOf = (id) => managers.find((m) => m.employeeId === id).pin;
const CYCLE = '11111111-1111-4111-8111-111111111111';
const GM = 900001;
const MGR_A = 900002;
const A_REPORT = 900030;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const fresh = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function pinLogin(employeeId, pin) {
  const res = await fetch(`${url}/functions/v1/auth-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ employeeId: String(employeeId), pin }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function asManager(employeeId) {
  const { status, body } = await pinLogin(employeeId, pinOf(employeeId));
  if (status !== 200) throw new Error(`login ${employeeId} -> ${status}`);
  const client = fresh();
  await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  return client;
}

const count = async (q) => {
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { n: (data ?? []).length };
};

// Anonymous callers get nothing.
{
  const anon = fresh();
  const { data, error } = await anon.from('employees').select('employee_id').limit(1);
  check('anonymous cannot read employees', Boolean(error) || (data ?? []).length === 0, error?.message ?? `${data?.length} rows`);
}

// PIN login rules.
{
  const ok = await pinLogin(MGR_A, pinOf(MGR_A));
  check('correct PIN signs in', ok.status === 200 && Boolean(ok.body.access_token));
  const bad = await pinLogin(MGR_A, 'ZZZZ2222');
  check('wrong PIN is refused with the generic message', bad.status === 401 && bad.body.code === 'invalid_credentials');
  const ghost = await pinLogin(999999, 'ZZZZ2222');
  check('unknown ID gets the same answer as a wrong PIN', ghost.status === 401 && ghost.body.code === 'invalid_credentials');
  for (let i = 0; i < 4; i++) await pinLogin(999998, 'ZZZZ2222');
  const fifth = await pinLogin(999998, 'ZZZZ2222');
  const sixth = await pinLogin(999998, 'ZZZZ2222');
  check('five failures lock the ID', fifth.status === 401 && sixth.status === 429, `${fifth.status}, ${sixth.status}`);
}

const a = await asManager(MGR_A);
const gm = await asManager(GM);
const b = await asManager(900003);

// Scope.
{
  const own = await count(a.from('cycle_population').select('employee_id').eq('cycle_id', CYCLE));
  check('manager A sees exactly 10 people', own.n === 10, JSON.stringify(own));
  const other = await count(a.from('employees').select('employee_id').eq('employee_id', 900040));
  check('manager A cannot see manager B team', other.n === 0, JSON.stringify(other));
  const { data: line } = await gm.rpc('line_scope', { p_cycle_id: CYCLE });
  check('GM line scope covers the five sub-teams', (line ?? []).length === 48, `${line?.length}`);
  const dir = await a.rpc('employee_directory', { p_cycle_id: CYCLE, p_query: '', p_limit: 5 });
  check('directory exposes name, title and department only',
    !dir.error && Object.keys(dir.data[0]).sort().join() === 'dept,employee_id,full_name,local_name,position');
}

// Self-exclusion and draft visibility, using temporary reviews removed at the end.
const hrClient = fresh();
await hrClient.auth.signInWithPassword({ email: hr.email, password: hr.password });
try {
  const aboutA = await gm.rpc('set_key_talent', { p_cycle_id: CYCLE, p_employee_id: MGR_A, p_selected: true, p_reasons: ['Successor Candidate'], p_note: null });
  check('GM can select manager A as key talent', !aboutA.error, aboutA.error?.message);
  const selfView = await count(a.from('reviews').select('id').eq('employee_id', MGR_A));
  check('manager A cannot see the review about themselves', selfView.n === 0, JSON.stringify(selfView));

  const draft = await a.rpc('set_key_talent', { p_cycle_id: CYCLE, p_employee_id: A_REPORT, p_selected: true, p_reasons: ['Successor Candidate'], p_note: null });
  check('manager A can select a direct report', !draft.error, draft.error?.message);
  const gmDraft = await count(gm.from('reviews').select('id').eq('employee_id', A_REPORT));
  check('GM cannot see manager A draft', gmDraft.n === 0, JSON.stringify(gmDraft));
  const bDraft = await count(b.from('reviews').select('id').eq('employee_id', A_REPORT));
  check('manager B cannot see manager A draft', bDraft.n === 0, JSON.stringify(bDraft));
  const forged = await b.rpc('set_key_talent', { p_cycle_id: CYCLE, p_employee_id: A_REPORT, p_selected: false, p_reasons: [], p_note: null });
  check('manager B cannot change manager A review', Boolean(forged.error), forged.error?.message ?? 'no error');

  const hrReviewers = await hrClient.rpc('expected_reviewers', { p_cycle_id: CYCLE });
  check('HR sees all 11 reviewers', (hrReviewers.data ?? []).length === 11, `${hrReviewers.data?.length}`);
  const notHr = await a.rpc('expected_reviewers', { p_cycle_id: CYCLE });
  check('managers cannot call HR functions', Boolean(notHr.error));
  const loginLog = await count(hrClient.from('login_attempts').select('id'));
  check('login attempts are hidden even from HR', Boolean(loginLog.error));
} finally {
  const { error } = await hrClient.from('reviews').delete().eq('cycle_id', CYCLE).in('employee_id', [MGR_A, A_REPORT]);
  check('temporary test reviews removed', !error, error?.message);
}

console.log(failures === 0 ? '\nAll remote checks passed.' : `\n${failures} remote checks failed.`);
process.exit(failures === 0 ? 0 : 1);
