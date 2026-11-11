// Weekly local backup of all business data from Supabase into a local git repository, so every
// backup is a version that can be compared or restored. Values from .env.local are never printed.
// Usage: node scripts/backup-remote.mjs [--dir <backup folder>]
// The backup folder holds real employee data once the review starts: it lives outside this repo
// and has no remote. Never push it anywhere.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES } from './lib/backup-format.mjs';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const dir = dirArg >= 0 ? args[dirArg + 1] : 'C:\\dev\\talent-review-backups';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('.env.local is missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function getJson(path) {
  const res = await fetch(`${url}${path}`, { headers });
  if (!res.ok) throw new Error(`${path.split('?')[0]} -> HTTP ${res.status}`);
  return res.json();
}

async function readTable({ name, key: pk }) {
  const rows = [];
  const order = pk.map((k) => `${k}.asc`).join(',');
  for (let offset = 0; ; offset += 1000) {
    const page = await getJson(`/rest/v1/${name}?select=*&order=${order}&limit=1000&offset=${offset}`);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function readAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const body = await getJson(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const batch = body.users ?? [];
    users.push(...batch.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })));
    if (batch.length < 1000) return users.sort((a, b) => a.id.localeCompare(b.id));
  }
}

const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();

// Read everything first, so a network failure never leaves a half-written backup.
const data = {};
for (const t of TABLES) data[t.name] = await readTable(t);
const authUsers = await readAuthUsers();

if (!existsSync(join(dir, '.git'))) {
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q', dir]);
  git('config', 'user.name', 'Talent Review Backup');
  git('config', 'user.email', 'backup@talentreview.local');
  git('config', 'core.autocrlf', 'false');
  writeFileSync(join(dir, '.gitignore'), 'backup.log\nrestore/\n');
  writeFileSync(join(dir, 'README.txt'), [
    'Talent Review 本機備份。內含員工資料，請勿上傳、勿加 remote、勿放進雲端同步資料夾。',
    '每次備份是一個 git commit；還原方式見程式 repo 的 README「備份與還原」。',
    '',
  ].join('\n'));
}

const previous = existsSync(join(dir, 'manifest.json'))
  ? JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) : null;

mkdirSync(join(dir, 'data'), { recursive: true });
for (const t of TABLES) writeFileSync(join(dir, 'data', `${t.name}.json`), `${JSON.stringify(data[t.name], null, 2)}\n`);
writeFileSync(join(dir, 'data', 'auth_users.json'), `${JSON.stringify(authUsers, null, 2)}\n`);

const counts = Object.fromEntries(TABLES.map((t) => [t.name, data[t.name].length]));
const takenAt = new Date().toISOString();
writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({
  taken_at: takenAt,
  project_ref: new URL(url).hostname.split('.')[0],
  tables: counts,
  auth_users: authUsers.length,
}, null, 2)}\n`);

// A sharp drop is recorded anyway (history keeps the earlier version) but called out.
const warnings = previous
  ? TABLES.filter((t) => (previous.tables[t.name] ?? 0) > 0 && counts[t.name] < previous.tables[t.name] * 0.5)
    .map((t) => `${t.name} ${previous.tables[t.name]} -> ${counts[t.name]}`)
  : [];

git('add', '-A');
const summary = `employees ${counts.employees}, reviews ${counts.reviews}, versions ${counts.review_versions}`;
git('commit', '-q', '-m', `Backup ${takenAt.slice(0, 10)} (${summary})${warnings.length ? `\n\nSharp drop: ${warnings.join('; ')}` : ''}`);
const tag = `backup-${takenAt.slice(0, 19).replace(/[:T]/g, '-')}`;
git('tag', tag);

console.log(`Backup saved as ${tag}: ${summary}, accounts ${authUsers.length}.`);
if (warnings.length) {
  console.log(`WARNING sharp drop since last backup: ${warnings.join('; ')}`);
  process.exitCode = 2;
}
