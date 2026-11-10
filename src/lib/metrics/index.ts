// Dashboard metrics (SPEC section 8) as pure functions over reviews.
// These describe what managers entered; none of them compare people or set targets.
import { actionLines } from '../review/quality';
import { activeAreas, isStepComplete } from '../review/steps';
import type { Review } from '../review/types';
import { isUnderSixMonths, tenure } from '../tenure';

export interface Person {
  employee_id: number;
  name: string;
  dept: string;
  reviewer_id: number;
  start_date: string | null;
  gender: string | null;
}

export interface Dataset {
  people: Person[];
  reviews: Review[];
}

export const AFTER_SUBMIT = ['submitted', 'confirmed', 'locked'];

export const pct = (part: number, whole: number): number | null => (whole === 0 ? null : (part / whole) * 100);

export const TENURE_BANDS = ['lt6m', '6to12m', '1to3y', '3to5y', '5to10y', '10yplus'] as const;
export type TenureBand = (typeof TENURE_BANDS)[number];

export function tenureBand(start: string | null, today: Date = new Date()): TenureBand | null {
  const t = tenure(start, today);
  if (!t) return null;
  const m = t.totalMonths;
  if (m < 6) return 'lt6m';
  if (m < 12) return '6to12m';
  if (m < 36) return '1to3y';
  if (m < 60) return '3to5y';
  if (m < 120) return '5to10y';
  return '10yplus';
}

export interface Filters {
  dept: string;
  reviewer: number | null;
  critical: '' | 'yes' | 'no';
  tenure: TenureBand | '';
  submittedOnly: boolean;
}

export const NO_FILTERS: Filters = { dept: '', reviewer: null, critical: '', tenure: '', submittedOnly: false };

export function applyFilters(ds: Dataset, f: Filters, today: Date = new Date()): Dataset {
  const people = ds.people.filter((p) =>
    (!f.dept || p.dept === f.dept)
    && (f.reviewer === null || p.reviewer_id === f.reviewer)
    && (!f.tenure || tenureBand(p.start_date, today) === f.tenure));
  const ids = new Set(people.map((p) => p.employee_id));
  const reviews = ds.reviews.filter((r) =>
    ids.has(r.employee_id)
    && (!f.submittedOnly || AFTER_SUBMIT.includes(r.status))
    && (!f.critical || (f.critical === 'yes') === Boolean(r.is_critical_role)));
  return {
    people: f.critical ? people.filter((p) => reviews.some((r) => r.employee_id === p.employee_id)) : people,
    reviews,
  };
}

const READINESS_SCORE: Record<string, number> = {
  'Ready Now': 3, '1-2 years': 2, '3+ years': 1, 'Emergency Cover': 1, 'Too New to Rate (TNTR)': 0,
};

export function benchScore(r: Review): number {
  return r.successors.reduce((best, s) => {
    if (s.successor_type === 'tbh') return best;
    return Math.max(best, READINESS_SCORE[s.readiness ?? ''] ?? 0);
  }, 0);
}

export type BenchClass = 'strong' | 'developing' | 'thin' | 'gap';
export const BENCH_CLASSES: BenchClass[] = ['strong', 'developing', 'thin', 'gap'];
export const benchClass = (score: number): BenchClass =>
  score >= 3 ? 'strong' : score === 2 ? 'developing' : score === 1 ? 'thin' : 'gap';

const hasCompletePlan = (r: Review) => activeAreas(r).length > 0 && isStepComplete('DEV_PLAN', r);
const isMedHigh = (r: Review) => r.retention_risk === 'Medium' || r.retention_risk === 'High';

export interface Kpis {
  scopeCount: number;
  keyCount: number;
  keyPct: number | null;
  completionPct: number | null;
  criticalCount: number;
  criticalHighRisk: number;
  coveragePct: number | null;
  tbhRoles: number;
  planCompletePct: number | null;
  medHighPct: number | null;
  notDiscussedPct: number | null;
}

export function kpis({ people, reviews }: Dataset): Kpis {
  const critical = reviews.filter((r) => r.is_critical_role);
  return {
    scopeCount: people.length,
    keyCount: reviews.length,
    keyPct: pct(reviews.length, people.length),
    completionPct: pct(reviews.filter((r) => AFTER_SUBMIT.includes(r.status)).length, reviews.length),
    criticalCount: critical.length,
    criticalHighRisk: critical.filter((r) => r.retention_risk === 'High').length,
    coveragePct: pct(critical.filter((r) => r.successors.some((s) => s.readiness === 'Ready Now')).length, critical.length),
    tbhRoles: reviews.filter((r) => r.successors.some((s) => s.successor_type === 'tbh')).length,
    planCompletePct: pct(reviews.filter(hasCompletePlan).length, reviews.length),
    medHighPct: pct(reviews.filter(isMedHigh).length, reviews.length),
    notDiscussedPct: pct(reviews.filter((r) => r.aspirations_not_discussed).length, reviews.length),
  };
}

export interface DeptStat {
  dept: string;
  scope: number;
  key: number;
  keyPct: number;
  avgTenureYears: number | null;
  medHighPct: number | null;
  benchAvg: number | null;
  planCompletePct: number | null;
  tntr: number;
}

export function deptStats({ people, reviews }: Dataset, today: Date = new Date()): DeptStat[] {
  const deptOf = new Map(people.map((p) => [p.employee_id, p.dept]));
  return [...new Set(people.map((p) => p.dept))].sort((a, b) => a.localeCompare(b, 'en')).map((dept) => {
    const members = people.filter((p) => p.dept === dept);
    const rs = reviews.filter((r) => deptOf.get(r.employee_id) === dept);
    const tenures = members.map((p) => tenure(p.start_date, today)).filter((t) => t !== null);
    const critical = rs.filter((r) => r.is_critical_role);
    return {
      dept,
      scope: members.length,
      key: rs.length,
      keyPct: (rs.length / members.length) * 100,
      avgTenureYears: tenures.length ? tenures.reduce((n, t) => n + t!.totalMonths, 0) / tenures.length / 12 : null,
      medHighPct: pct(rs.filter(isMedHigh).length, rs.length),
      benchAvg: critical.length ? critical.reduce((n, r) => n + benchScore(r), 0) / critical.length : null,
      planCompletePct: pct(rs.filter(hasCompletePlan).length, rs.length),
      tntr: members.filter((p) => isUnderSixMonths(p.start_date, today)).length,
    };
  });
}

export function tenureDistribution({ people, reviews }: Dataset, today: Date = new Date()) {
  const key = new Set(reviews.map((r) => r.employee_id));
  return TENURE_BANDS.map((band) => {
    const inBand = people.filter((p) => tenureBand(p.start_date, today) === band);
    return { band, scope: inBand.length, key: inBand.filter((p) => key.has(p.employee_id)).length };
  });
}

export const GENDER_MIN_GROUP = 5;

/** Department-level only, and hidden for small groups so no individual can be identified. */
export function genderByDept({ people }: Dataset) {
  return [...new Set(people.map((p) => p.dept))].sort((a, b) => a.localeCompare(b, 'en')).map((dept) => {
    const members = people.filter((p) => p.dept === dept);
    if (members.length < GENDER_MIN_GROUP) return { dept, suppressed: true as const };
    const female = members.filter((p) => p.gender === 'F').length;
    return { dept, suppressed: false as const, femalePct: (female / members.length) * 100, malePct: ((members.length - female) / members.length) * 100 };
  });
}

export type RiskLevel = 'Low' | 'Medium' | 'High';
export const RISK_LEVELS: RiskLevel[] = ['High', 'Medium', 'Low'];

export function riskMatrix({ reviews }: Dataset) {
  return RISK_LEVELS.map((risk) => ({
    risk,
    critical: reviews.filter((r) => r.retention_risk === risk && r.is_critical_role).map((r) => r.employee_id),
    other: reviews.filter((r) => r.retention_risk === risk && !r.is_critical_role).map((r) => r.employee_id),
  }));
}

export function reasonPareto({ reviews }: Dataset) {
  const counts = new Map<string, number[]>();
  for (const r of reviews.filter(isMedHigh)) {
    for (const reason of r.retention_reasons) counts.set(reason, [...(counts.get(reason) ?? []), r.employee_id]);
  }
  return [...counts].map(([reason, ids]) => ({ reason, count: ids.length, ids }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'en'));
}

export const flightRisk = ({ reviews }: Dataset): number[] =>
  reviews.filter((r) => r.retention_risk === 'High' && r.next_roles.some((n) => n.readiness === 'Ready Now')).map((r) => r.employee_id);

export function benchByDept(ds: Dataset) {
  const deptOf = new Map(ds.people.map((p) => [p.employee_id, p.dept]));
  const critical = ds.reviews.filter((r) => r.is_critical_role);
  return [...new Set(critical.map((r) => deptOf.get(r.employee_id) ?? ''))].sort((a, b) => a.localeCompare(b, 'en')).map((dept) => {
    const rs = critical.filter((r) => deptOf.get(r.employee_id) === dept);
    const ids = (c: BenchClass) => rs.filter((r) => benchClass(benchScore(r)) === c).map((r) => r.employee_id);
    return { dept, strong: ids('strong'), developing: ids('developing'), thin: ids('thin'), gap: ids('gap') };
  });
}

export const singlePoints = ({ reviews }: Dataset): number[] =>
  reviews.filter((r) => r.is_critical_role && benchScore(r) <= 1).map((r) => r.employee_id);

export function successorConcentration({ reviews }: Dataset) {
  const seen = new Map<number, { name: string; holders: number[] }>();
  for (const r of reviews) {
    for (const s of r.successors) {
      if (s.successor_type === 'internal' && s.successor_employee_id !== null) {
        const e = seen.get(s.successor_employee_id) ?? { name: s.display_name ?? String(s.successor_employee_id), holders: [] };
        e.holders.push(r.employee_id);
        seen.set(s.successor_employee_id, e);
      }
    }
  }
  return [...seen].filter(([, e]) => e.holders.length >= 2)
    .map(([id, e]) => ({ id, name: e.name, holders: e.holders }))
    .sort((a, b) => b.holders.length - a.holders.length);
}

export interface NetworkLink { holderId: number; successor: string; type: 'internal' | 'external' | 'tbh'; readiness: string | null; }

export const successionLinks = ({ reviews }: Dataset): NetworkLink[] =>
  reviews.flatMap((r) => r.successors.map((s) => ({
    holderId: r.employee_id,
    successor: s.successor_type === 'tbh' ? 'TBH' : (s.display_name ?? s.external_name ?? String(s.successor_employee_id ?? '')),
    type: s.successor_type,
    readiness: s.readiness,
  })));

export function externalDependencyPct({ reviews }: Dataset): number | null {
  const all = reviews.flatMap((r) => r.successors);
  return pct(all.filter((s) => s.successor_type !== 'internal').length, all.length);
}

export const FUNNEL_STAGES = ['Ready Now', '1-2 years', '3+ years', 'Too New to Rate (TNTR)'];

export const readinessFunnel = ({ reviews }: Dataset) =>
  FUNNEL_STAGES.map((stage) => {
    const ids = reviews.filter((r) => r.next_roles.some((n) => n.readiness === stage)).map((r) => r.employee_id);
    return { stage, count: ids.length, ids };
  });

export function mobilityDistribution({ reviews }: Dataset) {
  const counts = new Map<string, number[]>();
  for (const r of reviews) {
    if (r.mobility_status) counts.set(r.mobility_status, [...(counts.get(r.mobility_status) ?? []), r.employee_id]);
  }
  return [...counts].map(([status, ids]) => ({ status, count: ids.length, ids }));
}

export const desiredLocations = ({ reviews }: Dataset): string[] =>
  [...new Set(reviews.map((r) => (r.desired_locations ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));

export const notDiscussed = ({ reviews }: Dataset): number[] =>
  reviews.filter((r) => r.aspirations_not_discussed).map((r) => r.employee_id);

export function devMix({ reviews }: Dataset) {
  const plans = reviews.flatMap((r) => r.dev_plan);
  return ['Experience (70%)', 'Exposure (20%)', 'Education (10%)'].map((type, i) => {
    const count = plans.filter((p) => p.dev_type === type).length;
    return { type, count, pct: pct(count, plans.filter((p) => p.dev_type).length), reference: [70, 20, 10][i] };
  });
}

export function planTimeline({ reviews }: Dataset) {
  const months = new Map<string, number[]>();
  for (const r of reviews) {
    for (const p of r.dev_plan) {
      if (p.target_date) {
        const key = p.target_date.slice(0, 7);
        months.set(key, [...(months.get(key) ?? []), r.employee_id]);
      }
    }
  }
  return [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, ids]) => ({ month, count: ids.length, ids }));
}

export function ownerLoad({ reviews }: Dataset) {
  const load = new Map<string, number>();
  for (const p of reviews.flatMap((r) => r.dev_plan)) {
    const owner = p.owner.trim();
    if (owner) load.set(owner, (load.get(owner) ?? 0) + actionLines(p.actions).length);
  }
  return [...load].map(([owner, actions]) => ({ owner, actions })).sort((a, b) => b.actions - a.actions);
}

export function pbmDistribution({ reviews }: Dataset) {
  const out = new Map<string, { strengths: number; improvements: number }>();
  const add = (principle: string, field: 'strengths' | 'improvements') => {
    if (!principle) return;
    const e = out.get(principle) ?? { strengths: 0, improvements: 0 };
    e[field] += 1;
    out.set(principle, e);
  };
  for (const r of reviews) {
    r.pbm_strengths.forEach((p) => add(p.principle, 'strengths'));
    r.pbm_improvements.forEach((p) => add(p.principle, 'improvements'));
  }
  return [...out].map(([principle, c]) => ({ principle, ...c }));
}

export interface ThemeTag { employee_id: number; area_idx: number; theme: string; }

export function themeMatrix(tags: ThemeTag[], ds: Dataset) {
  const deptOf = new Map(ds.people.map((p) => [p.employee_id, p.dept]));
  const known = tags.filter((t) => deptOf.has(t.employee_id));
  const themes = [...new Set(known.map((t) => t.theme))].sort((a, b) => a.localeCompare(b));
  const depts = [...new Set(known.map((t) => deptOf.get(t.employee_id)!))].sort((a, b) => a.localeCompare(b, 'en'));
  const cells = themes.map((theme) => depts.map((dept) => known.filter((t) => t.theme === theme && deptOf.get(t.employee_id) === dept).length));
  return { themes, depts, cells };
}
