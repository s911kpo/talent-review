// Empties the production database after the pre-launch acceptance run, so real data starts clean.
// Removes every fictional row and every login; keeps the schema, drop-down options and question bank.
//
//   TR_TARGET=production node scripts/prelaunch-reset.mjs            show what would be removed
//   TR_TARGET=production node scripts/prelaunch-reset.mjs --confirm  remove it, then verify empty
//
// Safety: refuses unless every employee ID is in the fictional range (900001–900999). Once a real
// namelist has been uploaded, this script will not run, so it can never erase real data.
import { createClient } from '@supabase/supabase-js';
import { IS_PRODUCTION, announce, loadEnv } from './lib/env.mjs';

if (!IS_PRODUCTION) throw new Error('Run with TR_TARGET=production. Staging keeps its fictional data.');
const env = loadEnv();
for (const k of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[k]) throw new Error(`.env.production.local is missing ${k}`);
}
announce('pre-launch reset');
const confirm = process.argv.includes('--confirm');

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: false }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : [];
}

// Children first. option_lists and question_bank are configuration and stay.
const DATA_TABLES = [
  'review_comments', 'review_versions', 'dev_plan_items', 'successors', 'next_roles', 'ai_outputs', 'reviews',
  'team_submissions', 'audit_log', 'login_attempts', 'app_users', 'cycle_population', 'employees', 'cycles',
];
const counts = async () => (await sql(DATA_TABLES.map((t) => `select '${t}' as t, count(*)::int as n from public.${t}`).join(' union all ')))
  .map((r) => `${r.t}=${r.n}`).join(' ');

const [{ real }] = await sql('select count(*)::int as real from public.employees where employee_id not between 900001 and 900999');
if (real > 0) {
  console.error(`Stopped: ${real} employee IDs are outside the fictional range. Real data is already loaded; nothing was removed.`);
  process.exit(1);
}

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
console.log('before:', await counts(), `logins=${list.users.length}`);
if (!confirm) {
  console.log('Dry run. Add --confirm to remove all of the above.');
  process.exit(0);
}

await sql(`begin; ${DATA_TABLES.map((t) => `delete from public.${t};`).join(' ')} commit;`);
for (const u of list.users) {
  const { error: e } = await admin.auth.admin.deleteUser(u.id);
  if (e) throw e;
}
const { data: after } = await admin.auth.admin.listUsers({ perPage: 1000 });
const now = await counts();
console.log('after:', now, `logins=${after.users.length}`);
const [{ options }] = await sql('select count(*)::int as options from public.option_lists');
const [{ questions }] = await sql('select count(*)::int as questions from public.question_bank');
console.log(`kept: option_lists=${options} question_bank=${questions}`);
if (/=[1-9]/.test(now) || after.users.length > 0) {
  console.error('Not empty. Check the counts above before loading real data.');
  process.exit(1);
}
console.log('Production is empty and ready for the real namelist.');
