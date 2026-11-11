// Manager workflow data access. Permissions live in the database; this layer only moves data.
import type {
  DirectoryEntry, LineTeam, OptionItem, Question, Review, ReviewComment, TeamSubmission,
} from '../lib/review/types';
import { isDemoMode, supabase } from './client';
import { ConflictError, classifySaveError } from './conflict';
import { demo } from './demo';

export { ConflictError };

export interface SaveResult {
  rev: number;
  version: number;
  updated_at: string;
}

export const EMPTY_TEAM: TeamSubmission = {
  status: 'draft', submitted_at: null, reopen_requested_at: null, reopen_reason: null,
  hr_comment: null, discussion_status: 'not_scheduled', discussion_date: null,
};

export async function listOptions(): Promise<OptionItem[]> {
  if (isDemoMode) return demo.options;
  const { data, error } = await supabase()
    .from('option_lists')
    .select('list_key, value, label_zh, label_en, sort')
    .eq('is_active', true)
    .order('sort');
  if (error) throw error;
  return data ?? [];
}

export async function listQuestions(): Promise<Question[]> {
  if (isDemoMode) return demo.questions;
  const { data, error } = await supabase()
    .from('question_bank')
    .select('*')
    .eq('is_active', true)
    .order('step_order');
  if (error) throw error;
  return data ?? [];
}

export type ReviewRow = Omit<Review, 'next_roles' | 'successors' | 'dev_plan'> & {
  next_roles: Review['next_roles'] | null;
  successors: Review['successors'] | null;
  dev_plan: Review['dev_plan'] | null;
};

export async function hydrate(rows: ReviewRow[]): Promise<Review[]> {
  const ids = [...new Set(rows.flatMap((r) => (r.successors ?? []).map((s) => s.successor_employee_id)).filter((v) => v !== null))];
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const { data, error } = await supabase().rpc('successor_names', { p_ids: ids });
    if (error) throw error;
    for (const n of data ?? []) names.set(n.employee_id, n.full_name);
  }
  return rows.map((r) => ({
    ...r,
    next_roles: [...(r.next_roles ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .map((n) => ({ ...n, role_title: n.role_title ?? '', readiness: n.readiness ?? '' })),
    // The form works with plain strings; the database may hold nulls.
    dev_plan: [...(r.dev_plan ?? [])]
      .sort((a, b) => a.area_idx - b.area_idx)
      .map((p) => ({
        ...p,
        goal: p.goal ?? '', dev_type: p.dev_type ?? '', actions: p.actions ?? '', support: p.support ?? '',
        owner: p.owner ?? '', checkpoint: p.checkpoint ?? '', progress_notes: p.progress_notes ?? '',
      })),
    successors: [...(r.successors ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .map((s) => ({ ...s, display_name: s.successor_employee_id ? names.get(s.successor_employee_id) : undefined })),
  }));
}

export const SELECT_REVIEW = '*, next_roles(*), successors(*), dev_plan:dev_plan_items(*)';

export async function listReviewsByReviewer(cycleId: string, reviewerId: number): Promise<Review[]> {
  if (isDemoMode) return demo.reviews(reviewerId);
  const { data, error } = await supabase()
    .from('reviews')
    .select(SELECT_REVIEW)
    .eq('cycle_id', cycleId)
    .eq('reviewer_id', reviewerId);
  if (error) throw error;
  return hydrate((data ?? []) as ReviewRow[]);
}

export async function getTeamSubmission(cycleId: string, reviewerId: number): Promise<TeamSubmission> {
  if (isDemoMode) return demo.teamSubmission(reviewerId);
  const { data, error } = await supabase()
    .from('team_submissions')
    .select('status, submitted_at, reopen_requested_at, reopen_reason, hr_comment, discussion_status, discussion_date')
    .eq('cycle_id', cycleId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();
  if (error) throw error;
  return data ?? EMPTY_TEAM;
}

export async function setKeyTalent(
  cycleId: string, employeeId: number, selected: boolean, reasons: string[], note: string | null,
): Promise<void> {
  if (isDemoMode) return demo.setKeyTalent(employeeId, selected, reasons, note);
  const { error } = await supabase().rpc('set_key_talent', {
    p_cycle_id: cycleId, p_employee_id: employeeId, p_selected: selected, p_reasons: reasons, p_note: note,
  });
  if (error) throw error;
}

const CONTENT_FIELDS = [
  'is_critical_role', 'performance_strengths', 'pbm_strengths', 'pbm_improvements', 'development_areas',
  'personal_aspirations', 'aspirations_not_discussed', 'retention_risk', 'retention_reasons',
  'mobility_status', 'desired_locations', 'additional_comments', 'completed_steps',
] as const;

const blank = (s: string | null | undefined) => (s ?? '').trim() === '';

export async function saveReview(review: Review): Promise<SaveResult> {
  const fields = Object.fromEntries(CONTENT_FIELDS.map((k) => [k, review[k]]));
  const nextRoles = review.next_roles
    .filter((n) => !blank(n.role_title) || !blank(n.readiness))
    .map((n, i) => ({ ...n, rank: i + 1 }));
  const successors = review.successors.map(({ display_name: _omit, ...s }, i) => ({
    ...s,
    rank: i + 1,
    readiness: s.successor_type === 'tbh' ? null : s.readiness,
  }));
  const devPlan = review.dev_plan.map((p) => ({
    ...p,
    start_date: p.start_date || null,
    target_date: p.target_date || null,
  }));

  if (isDemoMode) return demo.saveReview(review, nextRoles, successors, devPlan);

  const { data, error } = await supabase().rpc('save_review', {
    p_review_id: review.id,
    p_expected_rev: review.rev,
    p_fields: fields,
    p_next_roles: nextRoles,
    p_successors: successors,
    p_dev_plan: devPlan,
  });
  if (error) throw classifySaveError(error);
  return data[0] as SaveResult;
}

export async function snapshotReview(reviewId: string): Promise<number> {
  if (isDemoMode) return demo.snapshot(reviewId);
  const { data, error } = await supabase().rpc('snapshot_review', { p_review_id: reviewId });
  if (error) throw error;
  return data as number;
}

export async function setNoKeyTalent(cycleId: string, reason: string): Promise<void> {
  if (isDemoMode) return demo.setNoKeyTalent(reason);
  const { error } = await supabase().rpc('set_no_key_talent', { p_cycle_id: cycleId, p_reason: reason });
  if (error) throw error;
}

export async function submitTeam(cycleId: string): Promise<void> {
  if (isDemoMode) return demo.submitTeam();
  const { error } = await supabase().rpc('submit_team', { p_cycle_id: cycleId });
  if (error) throw error;
}

export async function requestReopen(cycleId: string, reason: string): Promise<void> {
  if (isDemoMode) return demo.requestReopen(reason);
  const { error } = await supabase().rpc('request_reopen', { p_cycle_id: cycleId, p_reason: reason });
  if (error) throw error;
}

export async function setDiscussionDate(cycleId: string, date: string): Promise<void> {
  if (isDemoMode) return demo.setDiscussion(date);
  const { error } = await supabase().rpc('set_discussion', { p_cycle_id: cycleId, p_date: date });
  if (error) throw error;
}

export async function listComments(reviewIds: string[]): Promise<ReviewComment[]> {
  if (isDemoMode) return demo.comments(reviewIds);
  if (reviewIds.length === 0) return [];
  const { data, error } = await supabase()
    .from('review_comments')
    .select('id, review_id, body, created_at')
    .in('review_id', reviewIds)
    .eq('resolved', false)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function searchDirectory(cycleId: string, query: string): Promise<DirectoryEntry[]> {
  if (isDemoMode) return demo.directory(query);
  const { data, error } = await supabase().rpc('employee_directory', {
    p_cycle_id: cycleId, p_query: query, p_limit: 20,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listLineTeams(cycleId: string): Promise<LineTeam[]> {
  if (isDemoMode) return demo.lineTeams();
  const { data, error } = await supabase().rpc('line_team_status', { p_cycle_id: cycleId });
  if (error) throw error;
  return data ?? [];
}
