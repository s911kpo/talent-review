// Manager PIN login with server-side lockout (SPEC 3).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';
import {
  isValidEmployeeId, isValidPinFormat, lockedUntil, normalizePin, syntheticEmail, LOCK_MS, WINDOW_MS,
} from '../_shared/pin.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// One message for every failure, so a caller cannot tell which half was wrong.
const invalid = () => json({ code: 'invalid_credentials' }, 401);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);

  let payload: { employeeId?: unknown; pin?: unknown };
  try {
    payload = await req.json();
  } catch {
    return invalid();
  }

  const employeeId = payload.employeeId;
  if (!isValidEmployeeId(employeeId) || typeof payload.pin !== 'string') return invalid();
  const pin = normalizePin(payload.pin);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const now = Date.now();
  const since = new Date(now - WINDOW_MS - LOCK_MS).toISOString();

  const { data: rows, error: readError } = await admin
    .from('login_attempts')
    .select('success, created_at')
    .eq('employee_id', employeeId)
    .gte('created_at', since);
  if (readError) return json({ code: 'unavailable' }, 503);

  const attempts = (rows ?? []).map((r) => ({ success: r.success, at: Date.parse(r.created_at) }));
  if (lockedUntil(attempts, now) !== null) return json({ code: 'locked' }, 429);

  const record = (success: boolean) =>
    admin.from('login_attempts').insert({ employee_id: employeeId, success });

  if (!isValidPinFormat(pin)) {
    await record(false);
    return invalid();
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: syntheticEmail(employeeId),
    password: pin,
  });

  if (error || !data.session) {
    await record(false);
    return invalid();
  }

  await record(true);
  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
