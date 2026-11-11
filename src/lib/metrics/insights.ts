// Cross-team insights for HR. Following SPEC section 0, nothing here scores, ranks or sets quotas.
// Each function turns what managers already entered into a conversation to have, not a score.
// Lists are returned grouped or alphabetical, never ordered by "how good" someone is.
import { benchScore, type Dataset } from './index';
import type { Review } from '../review/types';

const READY_SOON = ['Ready Now', '1-2 years'];
const filled = (s: string | null | undefined) => (s ?? '').trim() !== '';

/** Medium/High retention risk where nobody has asked the person about their career yet. Talk to these people first. */
export function conversationPriorities({ reviews }: Dataset): { high: number[]; medium: number[] } {
  const gap = reviews.filter((r) => r.aspirations_not_discussed);
  return {
    high: gap.filter((r) => r.retention_risk === 'High').map((r) => r.employee_id),
    medium: gap.filter((r) => r.retention_risk === 'Medium').map((r) => r.employee_id),
  };
}

export interface UnlistedSuccessor { id: number; namedFor: number[]; readiness: string[] }

/**
 * People other managers name as near-ready successors, but who are not on their own manager's
 * key talent list. A calibration question for HR: is their own manager seeing what others see?
 */
export function unlistedSuccessors({ people, reviews }: Dataset): UnlistedSuccessor[] {
  const keyed = new Set(reviews.map((r) => r.employee_id));
  const inScope = new Set(people.map((p) => p.employee_id));
  const found = new Map<number, UnlistedSuccessor>();
  for (const r of reviews) {
    for (const s of r.successors) {
      const id = s.successor_employee_id;
      if (s.successor_type !== 'internal' || id === null || keyed.has(id) || !inScope.has(id)) continue;
      if (!READY_SOON.includes(s.readiness ?? '')) continue;
      const e = found.get(id) ?? { id, namedFor: [], readiness: [] };
      e.namedFor.push(r.employee_id);
      e.readiness.push(s.readiness!);
      found.set(id, e);
    }
  }
  return [...found.values()].sort((a, b) => a.id - b.id);
}

export interface FragileCover { holderId: number; successorId: number; successorRisk: string }

/**
 * Critical roles whose near-ready internal successor is themselves at Medium/High retention risk.
 * On paper the role is covered; in practice both people could leave together.
 */
export function fragileCoverage({ reviews }: Dataset): FragileCover[] {
  const riskOf = new Map(reviews.map((r) => [r.employee_id, r.retention_risk]));
  const out: FragileCover[] = [];
  for (const r of reviews) {
    if (!r.is_critical_role) continue;
    for (const s of r.successors) {
      if (s.successor_type !== 'internal' || s.successor_employee_id === null || !READY_SOON.includes(s.readiness ?? '')) continue;
      const risk = riskOf.get(s.successor_employee_id);
      if (risk === 'High' || risk === 'Medium') out.push({ holderId: r.employee_id, successorId: s.successor_employee_id, successorRisk: risk });
    }
  }
  return out;
}

export interface InternalMatch { holderId: number; role: string; candidates: { id: number; readiness: string }[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, ' ').trim();

/**
 * Critical roles with a thin bench (TBH, none, or only long-range successors) matched to people
 * elsewhere whose own stated next role is that job. Internal moves to consider before hiring outside.
 */
export function internalMatches({ people, reviews }: Dataset, limit = 3): InternalMatch[] {
  const position = new Map(people.map((p) => [p.employee_id, p.position ?? '']));
  const out: InternalMatch[] = [];
  for (const r of reviews) {
    if (!r.is_critical_role || benchScore(r) > 1) continue;
    const role = position.get(r.employee_id) ?? '';
    if (!filled(role)) continue;
    const already = new Set(r.successors.map((s) => s.successor_employee_id));
    const candidates = reviews
      .filter((c) => c.employee_id !== r.employee_id && !already.has(c.employee_id))
      .flatMap((c) => c.next_roles
        .filter((n) => READY_SOON.includes(n.readiness) && filled(n.role_title) && norm(n.role_title) === norm(role))
        .map((n) => ({ id: c.employee_id, readiness: n.readiness })))
      .slice(0, limit);
    if (candidates.length) out.push({ holderId: r.employee_id, role, candidates });
  }
  return out;
}

export type CalibrationSignal = 'allLowRisk' | 'sameReadiness' | 'vaguePlans' | 'noTbhAllReady';

export interface TeamCalibration { reviewerId: number; keyCount: number; signals: CalibrationSignal[] }

const VAGUE_CHECKPOINT = /看表現|see performance|視情況|再看/i;

/**
 * Patterns in a team's entries that are worth a calibration conversation with the HRBP.
 * They describe how the form was filled in, not how good anyone is. Teams under 4 key talents are skipped.
 */
export function calibrationSignals({ reviews }: Dataset, minTeam = 4): TeamCalibration[] {
  const byReviewer = new Map<number, Review[]>();
  for (const r of reviews) byReviewer.set(r.reviewer_id, [...(byReviewer.get(r.reviewer_id) ?? []), r]);
  const out: TeamCalibration[] = [];
  for (const [reviewerId, team] of byReviewer) {
    if (team.length < minTeam) continue;
    const signals: CalibrationSignal[] = [];
    const risks = team.map((r) => r.retention_risk).filter(filled);
    if (risks.length === team.length && risks.every((x) => x === 'Low')) signals.push('allLowRisk');
    const firstReadiness = team.map((r) => r.next_roles[0]?.readiness).filter(filled);
    if (firstReadiness.length === team.length && new Set(firstReadiness).size === 1) signals.push('sameReadiness');
    const plans = team.flatMap((r) => r.dev_plan);
    const vague = plans.filter((p) => (p.checkpoint ?? '').trim().length < 10 || VAGUE_CHECKPOINT.test(p.checkpoint ?? ''));
    if (plans.length >= 3 && vague.length / plans.length >= 0.5) signals.push('vaguePlans');
    const succ = team.flatMap((r) => r.successors);
    if (succ.length >= minTeam && succ.every((s) => s.successor_type !== 'tbh' && s.readiness === 'Ready Now')) signals.push('noTbhAllReady');
    if (signals.length) out.push({ reviewerId, keyCount: team.length, signals });
  }
  return out.sort((a, b) => a.reviewerId - b.reviewerId);
}

/** Per department: people open to moving soon versus roles that need an outside hire. Internal supply against TBH demand. */
export function mobilitySupply({ people, reviews }: Dataset): { dept: string; mobile: number; tbhRoles: number }[] {
  const deptOf = new Map(people.map((p) => [p.employee_id, p.dept]));
  const rows = new Map<string, { dept: string; mobile: number; tbhRoles: number }>();
  const row = (dept: string) => rows.get(dept) ?? rows.set(dept, { dept, mobile: 0, tbhRoles: 0 }).get(dept)!;
  for (const r of reviews) {
    const dept = deptOf.get(r.employee_id) ?? '';
    if (r.mobility_status === 'Now' || r.mobility_status === '1-2 years') row(dept).mobile += 1;
    if (r.is_critical_role && r.successors.some((s) => s.successor_type === 'tbh')) row(dept).tbhRoles += 1;
  }
  return [...rows.values()].filter((x) => x.mobile + x.tbhRoles > 0).sort((a, b) => a.dept.localeCompare(b.dept));
}
