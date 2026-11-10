// Soft warnings (SPEC 6.5, 6.6). They inform and never block a save.
import { isUnderSixMonths } from '../tenure';
import { activeAreas } from './steps';
import type { DevPlanItem, Review } from './types';

/** Vague wording that needs a measurable noun or number alongside it. Edit here to tune. */
export const VAGUE_TERMS = [
  '加強', '提升', '多學習', '增進', '強化',
  'improve', 'enhance', 'strengthen', 'learn more', 'better',
];

const MEASURABLE = /\d|％|%|專案|報告|認證|證照|課程|客戶|project|report|certif|course|customer|kpi|okr/i;
const MAX_MONTHS = 12;

export type PlanWarning = 'too_few_actions' | 'target_too_far' | 'target_past' | 'weak_checkpoint' | 'vague_wording';

export const actionLines = (actions: string): string[] =>
  actions.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function isVague(text: string): boolean {
  const lower = text.toLowerCase();
  return VAGUE_TERMS.some((term) => lower.includes(term)) && !MEASURABLE.test(text);
}

const toLocalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function planWarnings(p: DevPlanItem, today: Date = new Date()): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  if (actionLines(p.actions).length < 2) warnings.push('too_few_actions');
  if (p.target_date) {
    const target = toLocalDate(p.target_date);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const limit = new Date(startOfToday);
    limit.setMonth(limit.getMonth() + MAX_MONTHS);
    if (target < startOfToday) warnings.push('target_past');
    else if (target > limit) warnings.push('target_too_far');
  }
  if (p.checkpoint.trim().length < 10) warnings.push('weak_checkpoint');
  if (isVague(p.goal) || actionLines(p.actions).some(isVague)) warnings.push('vague_wording');
  return warnings;
}

export const allEducation = (plans: DevPlanItem[]): boolean =>
  plans.length >= 3 && plans.every((p) => p.dev_type === 'Education (10%)');

export type TeamWarningCode =
  | 'high_risk_no_plan' | 'critical_only_tbh' | 'successor_overused'
  | 'ready_now_no_dev_area' | 'new_hire_ready_now';

export interface TeamWarning {
  code: TeamWarningCode;
  employeeId?: number;
  successorId?: number;
  id: string;
}

export function teamWarnings(
  reviews: Review[],
  startDates: Map<number, string | null>,
  today: Date = new Date(),
): TeamWarning[] {
  const out: TeamWarning[] = [];
  const counts = new Map<number, number>();

  for (const r of reviews) {
    const employeeId = r.employee_id;
    const realSuccessors = r.successors.filter((s) => s.successor_type !== 'tbh');

    if (r.retention_risk === 'High' && (r.dev_plan.length === 0 || r.successors.length === 0)) {
      out.push({ code: 'high_risk_no_plan', employeeId, id: `high_risk_no_plan:${employeeId}` });
    }
    if (r.is_critical_role && r.successors.length > 0 && realSuccessors.length === 0) {
      out.push({ code: 'critical_only_tbh', employeeId, id: `critical_only_tbh:${employeeId}` });
    }
    const hasReadyNow = r.next_roles.some((n) => n.readiness === 'Ready Now');
    if (hasReadyNow && activeAreas(r).length === 0) {
      out.push({ code: 'ready_now_no_dev_area', employeeId, id: `ready_now_no_dev_area:${employeeId}` });
    }
    if (hasReadyNow && isUnderSixMonths(startDates.get(employeeId), today)) {
      out.push({ code: 'new_hire_ready_now', employeeId, id: `new_hire_ready_now:${employeeId}` });
    }
    for (const s of realSuccessors) {
      if (s.successor_employee_id !== null) {
        counts.set(s.successor_employee_id, (counts.get(s.successor_employee_id) ?? 0) + 1);
      }
    }
  }

  for (const [successorId, n] of counts) {
    if (n >= 3) out.push({ code: 'successor_overused', successorId, id: `successor_overused:${successorId}` });
  }
  return out;
}

export interface DiscussionPoint {
  key: 'gap_critical' | 'high_risk' | 'not_discussed' | 'plans_ready';
  count: number;
}

/** Up to three focus topics for the HRBP conversation, derived from the team's own data. */
export function discussionPoints(reviews: Review[]): DiscussionPoint[] {
  const gap = reviews.filter(
    (r) => r.is_critical_role && !r.successors.some((s) => s.readiness === 'Ready Now'),
  ).length;
  const risk = reviews.filter((r) => r.retention_risk === 'High' || r.retention_risk === 'Medium').length;
  const talk = reviews.filter((r) => r.aspirations_not_discussed).length;
  const points: DiscussionPoint[] = [];
  if (gap > 0) points.push({ key: 'gap_critical', count: gap });
  if (risk > 0) points.push({ key: 'high_risk', count: risk });
  if (talk > 0) points.push({ key: 'not_discussed', count: talk });
  if (points.length < 3) points.push({ key: 'plans_ready', count: reviews.reduce((n, r) => n + r.dev_plan.length, 0) });
  return points.slice(0, 3);
}
