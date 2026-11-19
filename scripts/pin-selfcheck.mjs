// PIN self-check: tries each row of a PIN list (the PIN_list_*.xlsx downloaded from the HR back office)
// against the real login, then signs straight out again. Meant to be run by HR on their own computer.
//
//   PowerShell:  $env:TR_TARGET='production'; node scripts/pin-selfcheck.mjs "C:\path\PIN_list.xlsx"
//
// Output names rows only by their position (#1, #2 ...). Employee IDs, names and PINs are never printed,
// logged or written anywhere. Nothing in the database is changed apart from the normal login record
// that every sign-in leaves. Rows are tried one at a time, a second apart; a wrong PIN costs one failed
// attempt (the lock is 5), and the script stops early if three rows in a row fail, so a wrong file can't
// pile up failures.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { loadEnv, announce } from './lib/env.mjs';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Usage: node scripts/pin-selfcheck.mjs "<PIN_list.xlsx>"');
  process.exit(2);
}

const env = loadEnv();
announce('PIN self-check');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, opts);

// Read rows by header name, so column order does not matter.
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];
const header = {};
ws.getRow(1).eachCell((c, col) => { header[String(c.text).trim().toLowerCase()] = col; });
const idCol = header['employee id'], pinCol = header['pin'];
if (!idCol || !pinCol) {
  console.error('The first sheet needs the columns "Employee ID" and "PIN" (as in the downloaded PIN list).');
  process.exit(2);
}
const rows = [];
for (let r = 2; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const id = String(row.getCell(idCol).text ?? '').trim();
  const pin = String(row.getCell(pinCol).text ?? '').trim();
  if (id || pin) rows.push({ id, pin });
}
console.log(`Rows in file: ${rows.length}\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failStreak = 0;
for (let i = 0; i < rows.length; i++) {
  const tag = `#${i + 1}`.padEnd(4);
  const { id, pin } = rows[i];
  if (!/^[1-9]\d{0,14}$/.test(id) || !pin) {
    console.log(`${tag} SKIP   row is missing an employee ID or PIN`);
    results.push('skip');
    continue;
  }
  const { data, error } = await anon.functions.invoke('auth-pin', { body: { employeeId: id, pin } });
  if (error || !data?.access_token) {
    let code = 'invalid';
    try { code = (await error?.context?.json())?.code ?? code; } catch { /* keep default */ }
    const why = code === 'locked' ? 'account is locked for 15 minutes (too many wrong PINs)'
      : code === 'unavailable' ? 'login service unavailable, try again later'
      : 'employee ID and PIN do not match';
    console.log(`${tag} FAIL   ${why}`);
    results.push('fail');
    if (++failStreak >= 3) { console.log('\nStopped: three rows in a row failed. Check that this is the latest PIN list.'); break; }
  } else {
    failStreak = 0;
    // Signed in: see what this supervisor's account can read, then sign out (revokes the session).
    const user = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, opts);
    await user.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    const { data: me } = await user.auth.getUser();
    const { data: prof } = await user.from('app_users').select('role,is_active').eq('user_id', me.user.id).single();
    const { count } = await user.from('cycle_population').select('*', { count: 'exact', head: true }).eq('in_scope', true);
    await user.auth.signOut();
    const role = prof?.role ?? '?';
    const ok = role === 'manager' && prof?.is_active && (count ?? 0) > 0;
    console.log(`${tag} ${ok ? 'OK    ' : 'CHECK '} signed in · role ${role} · sees ${count ?? 0} in-scope employees`);
    results.push(ok ? 'ok' : 'check');
  }
  await sleep(1000);
}

const n = (k) => results.filter((r) => r === k).length;
console.log(`\nOK ${n('ok')} · CHECK ${n('check')} · FAIL ${n('fail')} · SKIP ${n('skip')} (of ${rows.length})`);
if (n('fail') || n('check')) {
  console.log('For a FAIL row: reset that person\'s PIN in the back office (帳號與 PIN) and send them the new one.');
}
process.exit(n('fail') || n('check') ? 1 : 0);
