// Checks the Supabase login settings the app relies on; --apply sets them.
//   node scripts/check-auth-config.mjs                     staging
//   TR_TARGET=production node scripts/check-auth-config.mjs --apply
// Public sign-up must be off: accounts are created only by HR (admin-users function) or scripts.
import { announce, loadEnv } from './lib/env.mjs';

const env = loadEnv();
const base = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`;
const headers = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
const REQUIRED = { disable_signup: true };

announce('login settings');
const current = await (await fetch(base, { headers })).json();
const wrong = Object.entries(REQUIRED).filter(([k, v]) => current[k] !== v);
for (const [k, v] of Object.entries(REQUIRED)) console.log(`${current[k] === v ? 'ok ' : 'FIX'} ${k} = ${current[k]} (need ${v})`);
if (wrong.length && process.argv.includes('--apply')) {
  const res = await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(Object.fromEntries(wrong)) });
  console.log(res.ok ? 'applied' : `failed: HTTP ${res.status}`);
  if (!res.ok) process.exit(1);
} else if (wrong.length) {
  process.exit(1);
}
