// Concurrency check against the real Supabase project, using only the fictional demo accounts.
// Simulates the busiest realistic moment: every manager autosaving at once while HR refreshes
// the dashboard. Removes the reviews it creates. Usage:
//   NODE_USE_ENV_PROXY=1 node scripts/load-remote.mjs [--saves 20] [--hr 20]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const SAVES = opt('--saves', 20);
const HR_READS = opt('--hr', 20);

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const { managers, hr } = JSON.parse(readFileSync('supabase/seed/demo_accounts.json', 'utf8'));
const CYCLE = '11111111-1111-4111-8111-111111111111';
const fresh = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const lat = { login: [], save: [], hrDashboard: [] };
const errors = [];
const timed = async (bucket, fn) => {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    lat[bucket].push(performance.now() - t0);
  }
};
const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

async function login(employeeId, pin) {
  const res = await timed('login', () => fetch(`${url}/functions/v1/auth-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ employeeId: String(employeeId), pin }),
  }));
  if (res.status !== 200) throw new Error(`login ${employeeId}: HTTP ${res.status}`);
  const body = await res.json();
  const client = fresh();
  await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  return client;
}

const touched = [];

async function managerSession({ employeeId, pin }) {
  const client = await login(employeeId, pin);
  const { data: team } = await client.from('cycle_population').select('employee_id')
    .eq('cycle_id', CYCLE).eq('supervisor_id', employeeId).eq('in_scope', true).limit(2);
  for (const { employee_id: emp } of team ?? []) {
    const sel = await client.rpc('set_key_talent', { p_cycle_id: CYCLE, p_employee_id: emp, p_selected: true, p_reasons: ['Successor Candidate'], p_note: null });
    if (sel.error) { errors.push(`set_key_talent ${emp}: ${sel.error.message}`); continue; }
    touched.push(emp);
    const { data: row } = await client.from('reviews').select('id, rev').eq('cycle_id', CYCLE).eq('employee_id', emp).single();
    let rev = row.rev;
    for (let i = 0; i < SAVES; i++) {
      const res = await timed('save', () => client.rpc('save_review', {
        p_review_id: row.id, p_expected_rev: rev,
        p_fields: { performance_strengths: `load test ${i}`, is_critical_role: i % 2 === 0 },
      }));
      if (res.error) { errors.push(`save ${emp}: ${res.error.message}`); break; }
      rev = res.data[0].rev;
    }
  }
}

async function hrSession() {
  const client = fresh();
  const { error } = await client.auth.signInWithPassword({ email: hr.email, password: hr.password });
  if (error) throw error;
  await Promise.all(Array.from({ length: HR_READS }, () => timed('hrDashboard', async () => {
    const [pop, rev] = await Promise.all([
      client.from('cycle_population').select('employee_id, dept, supervisor_id, employees(full_name, start_date, gender)').eq('cycle_id', CYCLE).eq('in_scope', true),
      client.from('reviews').select('*, next_roles(*), successors(*), dev_plan_items(*)').eq('cycle_id', CYCLE).eq('is_key_talent', true),
    ]);
    if (pop.error || rev.error) errors.push(`hr dashboard: ${(pop.error ?? rev.error).message}`);
  })));
  return client;
}

const started = performance.now();
let hrClient;
try {
  const results = await Promise.allSettled([...managers.map(managerSession), hrSession().then((c) => { hrClient = c; })]);
  for (const r of results) if (r.status === 'rejected') errors.push(String(r.reason?.message ?? r.reason));
} finally {
  const cleaner = hrClient ?? fresh();
  if (!hrClient) await cleaner.auth.signInWithPassword({ email: hr.email, password: hr.password });
  if (touched.length) {
    const { error } = await cleaner.from('reviews').delete().eq('cycle_id', CYCLE).in('employee_id', touched);
    if (error) errors.push(`cleanup: ${error.message}`);
  }
}

const report = {
  managers: managers.length,
  savesPerReview: SAVES,
  totalSaves: lat.save.length,
  wallSeconds: Math.round((performance.now() - started) / 100) / 10,
  ms: Object.fromEntries(Object.entries(lat).map(([k, xs]) => [k, { n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: pct(xs, 100) }])),
  errors,
  cleanedUp: touched.length,
};
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/load-remote.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
