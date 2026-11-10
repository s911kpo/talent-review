// AI analysis (SPEC 10). The API key stays here; output is stored and never written back to forms.
import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';
import {
  THEME_SCHEMA, isAllowed, isOutputType, languageInstruction, needsTeamScope, parseThemeTagging, type OutputType,
} from '../_shared/ai.ts';
import { PROMPTS } from './prompts.generated.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const model = Deno.env.get('ANTHROPIC_MODEL');

const SELECT = '*, next_roles(rank, role_title, readiness), successors(rank, successor_type, successor_employee_id, external_name, readiness), dev_plan:dev_plan_items(area_idx, goal, dev_type, actions, support, owner, start_date, target_date, checkpoint, status)';

async function loadData(admin: SupabaseClient, cycleId: string, reviewerId: number | null, excludeEmployee: number | null) {
  let query = admin.from('reviews').select(SELECT).eq('cycle_id', cycleId).eq('is_key_talent', true).neq('status', 'not_selected');
  if (reviewerId !== null) query = query.eq('reviewer_id', reviewerId);
  if (excludeEmployee !== null) query = query.neq('employee_id', excludeEmployee);
  const { data: reviews, error } = await query;
  if (error) throw error;

  const { data: population, error: popError } = await admin
    .from('cycle_population')
    .select('employee_id, dept, position, employees(full_name, local_name)')
    .eq('cycle_id', cycleId);
  if (popError) throw popError;
  const people = new Map((population ?? []).map((p) => [p.employee_id, p]));
  const nameOf = (id: number | null) => {
    const e = id === null ? undefined : people.get(id)?.employees as unknown as { full_name: string } | undefined;
    return e?.full_name ?? null;
  };

  return (reviews ?? []).map((r) => {
    const p = people.get(r.employee_id);
    return {
      employee_id: r.employee_id,
      name: nameOf(r.employee_id),
      reviewer: nameOf(r.reviewer_id),
      dept: p?.dept,
      position: p?.position,
      key_talent_reasons: r.key_talent_reasons,
      is_critical_role: r.is_critical_role,
      retention_risk: r.retention_risk,
      retention_reasons: r.retention_reasons,
      mobility_status: r.mobility_status,
      desired_locations: r.desired_locations,
      performance_strengths: r.performance_strengths,
      pbm_strengths: r.pbm_strengths,
      pbm_improvements: r.pbm_improvements,
      development_areas: r.development_areas,
      personal_aspirations: r.aspirations_not_discussed ? '(not yet discussed with employee)' : r.personal_aspirations,
      additional_comments: r.additional_comments,
      next_roles: r.next_roles,
      successors: (r.successors ?? []).map((s: { successor_employee_id: number | null }) => ({
        ...s, successor_name: nameOf(s.successor_employee_id),
      })),
      development_plan: r.dev_plan,
    };
  });
}

async function callClaude(client: Anthropic, type: OutputType, system: string, data: string): Promise<string> {
  const message = await client.messages.stream({
    model: model!,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: `<talent_review_data>\n${data}\n</talent_review_data>` }],
    ...(type === 'dev_theme_tagging'
      ? { output_config: { format: { type: 'json_schema', schema: THEME_SCHEMA } } }
      : {}),
  } as Parameters<typeof client.messages.stream>[0]).finalMessage();

  if (message.stop_reason === 'refusal') throw new Error('model_refused');
  if (message.stop_reason === 'max_tokens') throw new Error('output_truncated');
  return message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);
  if (!apiKey || !model) return json({ code: 'ai_not_configured' }, 503);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json({ code: 'unauthorized' }, 401);

  const { data: me } = await admin.from('app_users').select('role, employee_id, is_active').eq('user_id', auth.user.id).maybeSingle();
  if (!me?.is_active) return json({ code: 'forbidden' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ code: 'bad_request' }, 400);
  }

  const { type, cycleId, scopeRef } = body;
  if (!isOutputType(type) || typeof cycleId !== 'string') return json({ code: 'bad_request' }, 400);
  if (!isAllowed(me.role, type)) return json({ code: 'forbidden' }, 403);

  // A manager's scope is always their own team, whatever the request says.
  let reviewerId: number | null = null;
  if (me.role === 'manager') {
    reviewerId = me.employee_id;
  } else if (needsTeamScope(type)) {
    if (!Number.isSafeInteger(scopeRef)) return json({ code: 'scope_required' }, 400);
    reviewerId = scopeRef as number;
  }

  try {
    const data = await loadData(admin, cycleId, reviewerId, me.employee_id ?? null);
    if (data.length === 0) return json({ code: 'no_data' }, 422);

    const locale = typeof body.locale === 'string' ? body.locale : 'zh-TW';
    const language = languageInstruction(locale, me.role === 'hr' && body.bilingual === true);
    const system = `${PROMPTS._common}\n\n${PROMPTS[type]}\n\n${language}`;
    const payload = JSON.stringify(data);
    const client = new Anthropic({ apiKey });

    let content = await callClaude(client, type, system, payload);
    if (type === 'dev_theme_tagging') {
      const known = new Set(data.map((d) => d.employee_id));
      if (!parseThemeTagging(content, known)) {
        content = await callClaude(client, type, system, payload);
        if (!parseThemeTagging(content, known)) return json({ code: 'invalid_output' }, 502);
      }
    }

    const inputHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(system + payload))))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    const { data: saved, error } = await admin.from('ai_outputs').insert({
      cycle_id: cycleId,
      scope_type: reviewerId === null ? 'site' : 'team',
      scope_ref: reviewerId === null ? null : String(reviewerId),
      output_type: type,
      model,
      input_hash: inputHash,
      content_md: content,
      created_by: auth.user.id,
    }).select('id, output_type, model, content_md, created_at').single();
    if (error) throw error;

    await admin.from('audit_log').insert({
      actor: auth.user.id, action: 'ai_generated', entity: 'ai_output', entity_id: saved.id,
      detail: { type, people: data.length },
    });
    return json(saved);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ code: 'rate_limited' }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ code: 'ai_not_configured' }, 503);
    if (err instanceof Error && err.message === 'model_refused') return json({ code: 'model_refused' }, 422);
    if (err instanceof Error && err.message === 'output_truncated') return json({ code: 'output_truncated' }, 502);
    return json({ code: 'ai_failed' }, 502);
  }
});
