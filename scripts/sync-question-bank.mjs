// Copies the question bank (guidance text, examples) from production to staging, so the practice site
// shows the same wording supervisors will see on launch. Configuration only: no people, no reviews.
// Approved by Tim on 2026-11-16 ("可以在一起更新…測試網址的題目引導文字").
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const read = (f) => Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.+)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const c = (f) => { const e = read(f); return createClient(e.VITE_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }); };
const prod = c('.env.production.local');
const stg = c('.env.local');
const { data, error } = await prod.from('question_bank').select('*');
if (error) throw error;
const rows = data.map(({ created_at, updated_at, updated_by, ...r }) => r);
const { error: e2 } = await stg.from('question_bank').upsert(rows, { onConflict: 'key' });
if (e2) throw e2;
console.log(`staging question_bank updated: ${rows.length} questions`);
