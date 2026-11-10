// HR-only account administration. Plain-text PINs exist only in this response (SPEC 3, 7.6).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';
import { generateHrPassword, generatePin, syntheticEmail } from '../_shared/pin.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const NEVER = '876000h';

async function audit(admin: SupabaseClient, actor: string, action: string, entityId: string, detail: unknown) {
  await admin.from('audit_log').insert({ actor, action, entity: 'account', entity_id: entityId, detail });
}

async function provision(admin: SupabaseClient, actor: string, employeeIds: number[]) {
  const results: { employeeId: number; name: string; pin: string; created: boolean }[] = [];
  const failures: { employeeId: number; code: string }[] = [];

  for (const employeeId of employeeIds) {
    const pin = generatePin();
    const { data: employee } = await admin
      .from('employees')
      .select('full_name, local_name')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (!employee) {
      failures.push({ employeeId, code: 'employee_not_found' });
      continue;
    }

    const { data: existing } = await admin
      .from('app_users')
      .select('user_id')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.user_id, { password: pin });
      if (error) {
        failures.push({ employeeId, code: 'reset_failed' });
        continue;
      }
      // A reset also clears the lockout history for this person.
      await admin.from('login_attempts').delete().eq('employee_id', employeeId);
      await audit(admin, actor, 'pin_reset', String(employeeId), null);
      results.push({ employeeId, name: employee.full_name, pin, created: false });
      continue;
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: syntheticEmail(employeeId),
      password: pin,
      email_confirm: true,
    });
    if (error || !created.user) {
      failures.push({ employeeId, code: 'create_failed' });
      continue;
    }
    const { error: linkError } = await admin.from('app_users').insert({
      user_id: created.user.id,
      employee_id: employeeId,
      role: 'manager',
      display_name: employee.full_name,
    });
    if (linkError) {
      await admin.auth.admin.deleteUser(created.user.id);
      failures.push({ employeeId, code: 'link_failed' });
      continue;
    }
    await audit(admin, actor, 'account_created', String(employeeId), null);
    results.push({ employeeId, name: employee.full_name, pin, created: true });
  }
  return { results, failures };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json({ code: 'unauthorized' }, 401);

  const { data: me } = await admin
    .from('app_users')
    .select('role, is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!me || me.role !== 'hr' || !me.is_active) return json({ code: 'forbidden' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ code: 'bad_request' }, 400);
  }

  switch (body.action) {
    case 'provision': {
      const ids = body.employeeIds;
      if (!Array.isArray(ids) || ids.some((i) => !Number.isSafeInteger(i) || i <= 0)) {
        return json({ code: 'bad_request' }, 400);
      }
      return json(await provision(admin, auth.user.id, ids as number[]));
    }

    case 'set_active': {
      const userId = body.userId;
      const active = body.active;
      if (typeof userId !== 'string' || typeof active !== 'boolean') return json({ code: 'bad_request' }, 400);
      if (userId === auth.user.id) return json({ code: 'cannot_disable_self' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: active ? 'none' : NEVER,
      });
      if (error) return json({ code: 'update_failed' }, 500);
      await admin.from('app_users').update({ is_active: active }).eq('user_id', userId);
      await audit(admin, auth.user.id, active ? 'account_enabled' : 'account_disabled', userId, null);
      return json({ ok: true });
    }

    case 'create_hr': {
      const email = body.email;
      const displayName = body.displayName;
      const employeeId = body.employeeId ?? null;
      if (typeof email !== 'string' || !email.includes('@') || typeof displayName !== 'string') {
        return json({ code: 'bad_request' }, 400);
      }
      if (employeeId !== null && !Number.isSafeInteger(employeeId)) return json({ code: 'bad_request' }, 400);
      const password = generateHrPassword();
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !created.user) return json({ code: 'create_failed' }, 500);
      const { error: linkError } = await admin.from('app_users').insert({
        user_id: created.user.id,
        employee_id: employeeId,
        role: 'hr',
        display_name: displayName,
      });
      if (linkError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ code: 'link_failed' }, 500);
      }
      await audit(admin, auth.user.id, 'hr_account_created', created.user.id, { email });
      return json({ email, password });
    }

    default:
      return json({ code: 'unknown_action' }, 400);
  }
});
