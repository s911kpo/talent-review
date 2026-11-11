// Applies supabase/migrations over HTTPS through the Management API, for networks that block
// direct Postgres connections. Records versions in supabase_migrations.schema_migrations exactly as
// `supabase db push` does, so the two methods can be mixed later.
// Usage: node scripts/apply-migrations.mjs [--seed] [--dry-run]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so fetch honors HTTPS_PROXY.
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required in .env.local');

const dryRun = process.argv.includes('--dry-run');
const withSeed = process.argv.includes('--seed');

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: false }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : [];
}

const quote = (s) => `'${s.replace(/'/g, "''")}'`;

await query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
`);
const applied = new Set((await query('select version from supabase_migrations.schema_migrations')).map((r) => r.version));

const dir = 'supabase/migrations';
const pending = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => ({ file: f, version: f.split('_')[0], name: f.replace(/^\d+_|\.sql$/g, '') }))
  .filter((m) => !applied.has(m.version));

console.log(`Already applied: ${applied.size}. Pending: ${pending.map((m) => m.file).join(', ') || 'none'}`);
if (dryRun) process.exit(0);

for (const m of pending) {
  const sql = readFileSync(join(dir, m.file), 'utf8');
  await query(`begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name, statements) values (${quote(m.version)}, ${quote(m.name)}, array[${quote(sql)}]);\ncommit;`);
  console.log(`Applied ${m.file}`);
}

if (withSeed) {
  await query(readFileSync('supabase/seed/fake_seed.sql', 'utf8'));
  console.log('Applied fake seed (fictional people only).');
}
