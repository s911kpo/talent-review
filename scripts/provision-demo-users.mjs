// Creates or removes the fictional demo logins in the linked Supabase project.
// Usage: npm run demo:provision | npm run demo:remove
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Fill VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const { managers, hr } = JSON.parse(readFileSync('supabase/seed/demo_accounts.json', 'utf8'));
const remove = process.argv.includes('--remove');

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const byEmail = new Map(list.users.map((u) => [u.email, u]));

const accounts = [
  ...managers.map((m) => ({
    email: `${m.employeeId}@talentreview.local`, password: m.pin, employee_id: m.employeeId,
    role: 'manager', display_name: m.name,
  })),
  { email: hr.email, password: hr.password, employee_id: null, role: 'hr', display_name: hr.displayName },
];

for (const a of accounts) {
  const existing = byEmail.get(a.email);
  if (remove) {
    if (existing) await admin.auth.admin.deleteUser(existing.id);
    continue;
  }
  let id = existing?.id;
  if (id) {
    await admin.auth.admin.updateUserById(id, { password: a.password });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: a.email, password: a.password, email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }
  const { error } = await admin.from('app_users').upsert({
    user_id: id, employee_id: a.employee_id, role: a.role, display_name: a.display_name, is_active: true,
  });
  if (error) throw error;
}

console.log(remove ? `Removed demo accounts.` : `Provisioned ${accounts.length} demo accounts.`);
