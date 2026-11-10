// The 12 questions and what counts as answered (SPEC 6.4).
// supabase function review_missing_steps enforces the same rules on submit.
import type { DevPlanItem, Review, Successor } from './types';

export const STEP_KEYS = [
  'CRITICAL_ROLE', 'PERF_STRENGTHS', 'PBM_STRENGTHS', 'PBM_IMPROVE', 'DEV_AREAS', 'ASPIRATIONS',
  'NEXT_ROLES', 'MOBILITY', 'RETENTION', 'SUCCESSORS', 'DEV_PLAN', 'COMMENTS',
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

const filled = (s: string | null | undefined) => (s ?? '').trim() !== '';

export function isSuccessorComplete(s: Successor): boolean {
  if (s.successor_type === 'tbh') return true;
  if (!filled(s.readiness)) return false;
  return s.successor_type === 'internal' ? s.successor_employee_id !== null : filled(s.external_name);
}

export function isPlanComplete(p: DevPlanItem): boolean {
  return filled(p.goal) && filled(p.dev_type) && filled(p.actions) && filled(p.owner)
    && p.start_date !== null && p.start_date !== '' && p.target_date !== null && p.target_date !== ''
    && filled(p.checkpoint);
}

export const activeAreas = (r: Review) => r.development_areas.filter((a) => filled(a.text));

export function isStepComplete(key: StepKey, r: Review): boolean {
  switch (key) {
    case 'CRITICAL_ROLE': return r.is_critical_role !== null;
    case 'PERF_STRENGTHS': return filled(r.performance_strengths);
    case 'PBM_STRENGTHS': return r.pbm_strengths.some((e) => filled(e.principle) && filled(e.evidence));
    case 'PBM_IMPROVE': return r.pbm_improvements.some((e) => filled(e.principle) && filled(e.evidence));
    case 'DEV_AREAS': return activeAreas(r).length > 0;
    case 'ASPIRATIONS': return r.aspirations_not_discussed || filled(r.personal_aspirations);
    case 'NEXT_ROLES': return r.next_roles.some((n) => filled(n.role_title) && filled(n.readiness));
    case 'MOBILITY': return filled(r.mobility_status);
    case 'RETENTION':
      if (!filled(r.retention_risk)) return false;
      return !['Medium', 'High'].includes(r.retention_risk!) || r.retention_reasons.length > 0;
    case 'SUCCESSORS': return r.successors.some(isSuccessorComplete);
    case 'DEV_PLAN': return activeAreas(r).every((a) => r.dev_plan.some((p) => p.area_idx === a.idx && isPlanComplete(p)));
    case 'COMMENTS': return true;
  }
}

const REQUIRED = STEP_KEYS.filter((k) => k !== 'COMMENTS');

export const missingSteps = (r: Review): StepKey[] => REQUIRED.filter((k) => !isStepComplete(k, r));

/** Answered questions, counting COMMENTS only once the manager has visited or written it. */
export function answeredCount(r: Review): number {
  const required = REQUIRED.filter((k) => isStepComplete(k, r) && (k !== 'DEV_PLAN' || activeAreas(r).length > 0)).length;
  const comments = filled(r.additional_comments) || r.completed_steps.includes('COMMENTS');
  return required + (comments ? 1 : 0);
}

export function emptyReview(partial: Pick<Review, 'id' | 'cycle_id' | 'employee_id' | 'reviewer_id'>): Review {
  return {
    ...partial,
    status: 'draft',
    is_key_talent: true,
    key_talent_reasons: [],
    key_talent_note: null,
    is_critical_role: null,
    performance_strengths: null,
    pbm_strengths: [],
    pbm_improvements: [],
    development_areas: [],
    personal_aspirations: null,
    aspirations_not_discussed: false,
    retention_risk: null,
    retention_reasons: [],
    mobility_status: null,
    desired_locations: null,
    additional_comments: null,
    completed_steps: [],
    version: 1,
    rev: 0,
    updated_at: new Date().toISOString(),
    next_roles: [],
    successors: [],
    dev_plan: [],
  };
}

export function isEditable(status: Review['status']): boolean {
  return status === 'not_selected' || status === 'draft' || status === 'returned';
}
