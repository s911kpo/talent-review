// HR console data access and export assembly.
import type { ExportRow } from '../lib/export/planningTool';
import type { OptionItem, Question, Review } from '../lib/review/types';
import { isDemoMode, supabase } from './client';
import { demo } from './demo';
import { hydrate, SELECT_REVIEW, type ReviewRow } from './review';

export interface TeamOverview {
  reviewer_id: number;
  full_name: string;
  local_name: string;
  direct_count: number;
  key_count: number;
  complete_count: number;
  status: Review['status'];
  last_updated: string | null;
  discussion_status: string;
  discussion_date: string | null;
  reopen_requested_at: string | null;
  reopen_reason: string | null;
}

export interface VersionRow {
  id: string;
  version: number;
  action: string;
  comment: string | null;
  created_at: string;
  snapshot: Record<string, unknown>;
}

export interface AuditRow {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: unknown;
  created_at: string;
}

export interface EditableOption extends OptionItem {
  id?: string;
  is_active: boolean;
}

export async function hrOverview(cycleId: string): Promise<TeamOverview[]> {
  if (isDemoMode) return demo.hrOverview();
  const { data, error } = await supabase().rpc('hr_team_overview', { p_cycle_id: cycleId });
  if (error) throw error;
  return data ?? [];
}

const rpc = async (name: string, args: Record<string, unknown>): Promise<void> => {
  const { error } = await supabase().rpc(name, args);
  if (error) throw error;
};

export async function returnReviews(cycleId: string, reviewerId: number, items: { review_id: string; comment: string }[]) {
  if (isDemoMode) return demo.hrReturn(reviewerId, items);
  return rpc('hr_return_reviews', { p_cycle_id: cycleId, p_reviewer_id: reviewerId, p_items: items });
}

export async function confirmTeam(cycleId: string, reviewerId: number) {
  if (isDemoMode) return demo.hrSetTeam(reviewerId, 'submitted', 'confirmed');
  return rpc('hr_confirm_team', { p_cycle_id: cycleId, p_reviewer_id: reviewerId });
}

export async function lockTeam(cycleId: string, reviewerId: number) {
  if (isDemoMode) return demo.hrSetTeam(reviewerId, 'confirmed', 'locked');
  return rpc('hr_lock_team', { p_cycle_id: cycleId, p_reviewer_id: reviewerId });
}

export async function unlockTeam(cycleId: string, reviewerId: number, target: 'confirmed' | 'draft') {
  if (isDemoMode) return demo.hrSetTeam(reviewerId, 'locked', target);
  return rpc('hr_unlock_team', { p_cycle_id: cycleId, p_reviewer_id: reviewerId, p_target: target });
}

export async function decideReopen(cycleId: string, reviewerId: number, approve: boolean, employeeIds: number[] | null) {
  if (isDemoMode) return demo.hrDecideReopen(reviewerId, approve, employeeIds);
  return rpc('hr_decide_reopen', {
    p_cycle_id: cycleId, p_reviewer_id: reviewerId, p_approve: approve, p_employee_ids: employeeIds,
  });
}

export async function listVersions(reviewId: string): Promise<VersionRow[]> {
  if (isDemoMode) return [];
  const { data, error } = await supabase()
    .from('review_versions')
    .select('id, version, action, comment, created_at, snapshot')
    .eq('review_id', reviewId)
    .order('version', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAllOptions(): Promise<EditableOption[]> {
  if (isDemoMode) return demo.options.map((o) => ({ ...o, is_active: true }));
  const { data, error } = await supabase()
    .from('option_lists')
    .select('id, list_key, value, label_zh, label_en, sort, is_active')
    .order('list_key')
    .order('sort');
  if (error) throw error;
  return data ?? [];
}

export async function saveOption(option: EditableOption): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase().from('option_lists').upsert(option, { onConflict: 'list_key,value' });
  if (error) throw error;
}

export async function listAllQuestions(): Promise<Question[]> {
  if (isDemoMode) return demo.questions;
  const { data, error } = await supabase().from('question_bank').select('*').order('step_order');
  if (error) throw error;
  return data ?? [];
}

export async function saveQuestion(q: Question): Promise<void> {
  if (isDemoMode) return;
  const { key, ...rest } = q;
  const { error } = await supabase().from('question_bank').update(rest).eq('key', key);
  if (error) throw error;
}

export async function listAudit(action: string): Promise<AuditRow[]> {
  if (isDemoMode) return [];
  let query = supabase().from('audit_log').select('id, action, entity, entity_id, detail, created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (action.trim()) query = query.ilike('action', `%${action.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

const PAGE = 1000;

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

interface PopulationJoin {
  employee_id: number;
  dept: string | null;
  position: string | null;
  employees: { full_name: string; local_name: string | null };
}

/** Everything the caller may export. RLS limits managers to their own team. */
export async function fetchExportRows(cycleId: string, reviewerId: number | null): Promise<ExportRow[]> {
  if (isDemoMode) return demo.exportRows(reviewerId);

  const reviewRows = await pageAll<ReviewRow>((from, to) => {
    let q = supabase().from('reviews').select(SELECT_REVIEW).eq('cycle_id', cycleId).eq('is_key_talent', true)
      .neq('status', 'not_selected').order('employee_id').range(from, to);
    if (reviewerId !== null) q = q.eq('reviewer_id', reviewerId);
    return q;
  });
  const reviews = await hydrate(reviewRows);

  const population = await pageAll<PopulationJoin>((from, to) =>
    supabase().from('cycle_population')
      .select('employee_id, dept, position, employees(full_name, local_name)')
      .eq('cycle_id', cycleId).order('employee_id').range(from, to));
  const people = new Map(population.map((p) => [p.employee_id, p]));

  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  const names = new Map<number, string>();
  if (reviewerIds.length > 0) {
    const { data, error } = await supabase().rpc('successor_names', { p_ids: reviewerIds });
    if (error) throw error;
    for (const n of data ?? []) names.set(n.employee_id, n.full_name);
  }

  return reviews
    .filter((r) => people.has(r.employee_id))
    .map((review) => {
      const p = people.get(review.employee_id)!;
      return {
        review,
        employee: {
          fullName: p.employees.full_name,
          localName: p.employees.local_name ?? '',
          position: p.position ?? '',
          dept: p.dept ?? '',
        },
        supervisorName: names.get(review.reviewer_id) ?? String(review.reviewer_id),
      };
    });
}
