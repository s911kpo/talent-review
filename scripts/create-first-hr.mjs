// Creates the first HR login on an empty system (after that, HR adds HR accounts in the console).
// Run it yourself in your own terminal; the password is shown once on your screen and stored nowhere.
//   TR_TARGET=production node scripts/create-first-hr.mjs --email you@company.com --name "Your Name" --employee-id 123456
// --employee-id is your own ID when you are also in the namelist, so the system can exclude your own record.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { announce, loadEnv } from './lib/env.mjs';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const email = arg('email');
const name = arg('name');
const employeeId = arg('employee-id') ? Number(arg('employee-id')) : null;
if (!email || !name || (employeeId !== null && !Number.isInteger(employeeId))) {
  console.error('Usage: node scripts/create-first-hr.mjs --email <email> --name "<name>" [--employee-id <id>]');
  process.exit(1);
}

const env = loadEnv();
announce('create HR login');
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// 18 characters from a set without look-alikes (0/O, 1/l/I).
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const password = [...randomBytes(18)].map((b) => alphabet[b % alphabet.length]).join('');

const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const { error: e2 } = await admin.from('app_users').insert({
  user_id: data.user.id, employee_id: employeeId, role: 'hr', display_name: name, is_active: true,
});
if (e2) { await admin.auth.admin.deleteUser(data.user.id); throw e2; }
console.log(`HR login created for ${email}.`);
console.log(`Password (shown once, save it in your password manager now): ${password}`);
