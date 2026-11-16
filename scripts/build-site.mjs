// Netlify build for one site. DEPLOY_TARGET (set in the Netlify site's environment) picks the backend:
//   staging (default) → test site: staging database, test-environment notice, showcase at /demo/
//   production        → live site: production database, no showcase, no fictional data in the bundle
// Public values come from deploy/targets.json. The build fails rather than guess.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const target = process.env.DEPLOY_TARGET || 'staging';
const targets = JSON.parse(readFileSync('deploy/targets.json', 'utf8'));
const t = targets[target];
if (!t) throw new Error(`Unknown DEPLOY_TARGET "${target}"`);
if (!t.supabaseUrl || !t.anonKey) throw new Error(`deploy/targets.json has no Supabase values for "${target}" yet.`);
const role = JSON.parse(Buffer.from(t.anonKey.split('.')[1], 'base64url').toString()).role;
if (role !== 'anon') throw new Error(`The "${target}" key is not an anon key (role: ${role}). Refusing to ship it.`);

const env = { ...process.env, VITE_SUPABASE_URL: t.supabaseUrl, VITE_SUPABASE_ANON_KEY: t.anonKey, VITE_ENV_TARGET: target };
delete env.VITE_DATA_MODE;
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
console.log(`Building the ${target} site → ${new URL(t.supabaseUrl).host}`);
run('npm run build');
if (t.showcase) run('npm run build:showcase');

// Guard: a production bundle must not point at another backend or carry the test notice.
if (target === 'production') {
  const others = Object.entries(targets).filter(([k, v]) => k !== target && k !== '_comment' && v.supabaseUrl).map(([, v]) => new URL(v.supabaseUrl).host);
  const files = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(join('dist/assets', f), 'utf8'));
  for (const host of others) if (files.some((s) => s.includes(host))) throw new Error(`Production bundle contains ${host}`);
}
console.log('build ok');
