// Dashboard v2: a few clearly defined measures and the plain-language takeaways built from them.
// SPEC section 0 still holds: departments and roles may be compared, people are never scored or ranked.
// Every measure here is documented (definition, formula, how to use it) in docs/METRICS.md.
import { AFTER_SUBMIT, benchScore, hasCompletePlan, pct, type Dataset } from './index';
import type { Review } from '../review/types';

const isMedHigh = (r: Review) => r.retention_risk === 'Medium' || r.retention_risk === 'High';
const hasReadyNow = (r: Review) => r.successors.some((s) => s.successor_type !== 'tbh' && s.readiness === 'Ready Now');
/** No successor who could step in within two years: TBH, none, or only 3+ years / emergency cover. */
export const isUncovered = (r: Review) => r.is_critical_role && benchScore(r) <= 1;

export interface DeptHealth {
  dept: string;
  scope: number;
  key: number;
  /** Key talents as a share of everyone in scope. Reference only, never a target. */
  keyPct: number | null;
  /** Share of key talents rated Medium or High retention risk. */
  riskPct: number | null;
  critical: number;
  /** Share of critical roles with at least one Ready Now successor. */
  readyPct: number | null;
  /** Share of key talents whose manager has not yet discussed career goals with them. */
  talkGapPct: number | null;
}

export function deptHealth({ people, reviews }: Dataset): DeptHealth[] {
  const deptOf = new Map(people.map((p) => [p.employee_id, p.dept]));
  return [...new Set(people.map((p) => p.dept))].sort((a, b) => a.localeCompare(b, 'en')).map((dept) => {
    const scope = people.filter((p) => p.dept === dept).length;
    const rs = reviews.filter((r) => deptOf.get(r.employee_id) === dept);
    const critical = rs.filter((r) => r.is_critical_role);
    return {
      dept, scope, key: rs.length, critical: critical.length,
      keyPct: pct(rs.length, scope),
      riskPct: pct(rs.filter(isMedHigh).length, rs.length),
      readyPct: pct(critical.filter(hasReadyNow).length, critical.length),
      talkGapPct: pct(rs.filter((r) => r.aspirations_not_discussed).length, rs.length),
    };
  });
}

/** The same four measures for the whole filtered population, used as the comparison line. */
export function overallHealth(ds: Dataset): Omit<DeptHealth, 'dept'> {
  const { reviews, people } = ds;
  const critical = reviews.filter((r) => r.is_critical_role);
  return {
    scope: people.length, key: reviews.length, critical: critical.length,
    keyPct: pct(reviews.length, people.length),
    riskPct: pct(reviews.filter(isMedHigh).length, reviews.length),
    readyPct: pct(critical.filter(hasReadyNow).length, critical.length),
    talkGapPct: pct(reviews.filter((r) => r.aspirations_not_discussed).length, reviews.length),
  };
}

export const GENDER_MIN = 5;

export interface GenderView { scopeFemalePct: number | null; keyFemalePct: number | null; scope: number; key: number }

/** Female share of everyone in scope versus of key talents. Hidden (null) below five people so nobody can be identified. */
export function genderView({ people, reviews }: Dataset): GenderView {
  const key = new Set(reviews.map((r) => r.employee_id));
  const keyed = people.filter((p) => key.has(p.employee_id));
  const share = (xs: typeof people) => (xs.length < GENDER_MIN ? null : pct(xs.filter((p) => p.gender === 'F').length, xs.length));
  return { scopeFemalePct: share(people), keyFemalePct: share(keyed), scope: people.length, key: keyed.length };
}

export interface Headcount { dept: string; scope: number; key: number }
export const headcountByDept = ({ people, reviews }: Dataset): Headcount[] => {
  const key = new Set(reviews.map((r) => r.employee_id));
  return [...new Set(people.map((p) => p.dept))].map((dept) => {
    const members = people.filter((p) => p.dept === dept);
    return { dept, scope: members.length, key: members.filter((p) => key.has(p.employee_id)).length };
  }).sort((a, b) => b.scope - a.scope || a.dept.localeCompare(b.dept, 'en'));
};

export interface Progress { total: number; submitted: number; pct: number | null }
export const reviewProgress = ({ reviews }: Dataset): Progress => {
  const submitted = reviews.filter((r) => AFTER_SUBMIT.includes(r.status)).length;
  return { total: reviews.length, submitted, pct: pct(submitted, reviews.length) };
};

/** Critical roles without a successor ready within two years, grouped by department (most first). */
export function uncoveredByDept({ people, reviews }: Dataset) {
  const deptOf = new Map(people.map((p) => [p.employee_id, p.dept]));
  const out = new Map<string, number[]>();
  for (const r of reviews.filter(isUncovered)) {
    const d = deptOf.get(r.employee_id) ?? '';
    out.set(d, [...(out.get(d) ?? []), r.employee_id]);
  }
  return [...out].map(([dept, ids]) => ({ dept, ids })).sort((a, b) => b.ids.length - a.ids.length || a.dept.localeCompare(b.dept, 'en'));
}

export type Headline =
  | { kind: 'riskHotspot'; dept: string; pct: number; overall: number; ids: number[] }
  | { kind: 'uncovered'; count: number; critical: number; ids: number[] }
  | { kind: 'concentration'; name: string; roles: number; ids: number[] }
  | { kind: 'talkGap'; count: number; ids: number[] }
  | { kind: 'fragile'; count: number; ids: number[] };

/**
 * Up to three plain-language takeaways, in a fixed order of business impact
 * (losing people, then empty roles, then the conversations that prevent both).
 * `crossTeam` adds the HR-only takeaway about one person named for many roles.
 */
export function headlines(ds: Dataset, crossTeam: boolean, max = 3): Headline[] {
  const out: Headline[] = [];
  const all = overallHealth(ds);
  const depts = deptHealth(ds).filter((d) => d.key >= 5 && d.riskPct !== null);
  const hot = depts.slice().sort((a, b) => (b.riskPct ?? 0) - (a.riskPct ?? 0))[0];
  const deptOf = new Map(ds.people.map((p) => [p.employee_id, p.dept]));
  if (hot && all.riskPct !== null && (hot.riskPct ?? 0) >= all.riskPct + 15) {
    out.push({
      kind: 'riskHotspot', dept: hot.dept, pct: hot.riskPct!, overall: all.riskPct,
      ids: ds.reviews.filter((r) => deptOf.get(r.employee_id) === hot.dept && isMedHigh(r)).map((r) => r.employee_id),
    });
  }
  const uncovered = ds.reviews.filter(isUncovered);
  if (uncovered.length) out.push({ kind: 'uncovered', count: uncovered.length, critical: all.critical, ids: uncovered.map((r) => r.employee_id) });
  if (crossTeam) {
    const named = new Map<number, { name: string; ids: number[] }>();
    for (const r of ds.reviews) {
      for (const s of r.successors) {
        if (s.successor_type !== 'internal' || s.successor_employee_id === null) continue;
        const e = named.get(s.successor_employee_id) ?? { name: s.display_name ?? String(s.successor_employee_id), ids: [] };
        e.ids.push(r.employee_id);
        named.set(s.successor_employee_id, e);
      }
    }
    const top = [...named.values()].sort((a, b) => b.ids.length - a.ids.length)[0];
    if (top && top.ids.length >= 3) out.push({ kind: 'concentration', name: top.name, roles: top.ids.length, ids: top.ids });
  }
  const talk = ds.reviews.filter((r) => isMedHigh(r) && r.aspirations_not_discussed);
  if (talk.length) out.push({ kind: 'talkGap', count: talk.length, ids: talk.map((r) => r.employee_id) });
  return out.slice(0, max);
}

export const READINESS_ORDER = ['Ready Now', '1-2 years', '3+ years', 'Too New to Rate (TNTR)'];

/** Each key talent counted once, at the nearest readiness among their next roles. */
export function nextStepReadiness({ reviews }: Dataset) {
  const groups = READINESS_ORDER.map((stage) => ({ stage, ids: [] as number[] }));
  for (const r of reviews) {
    const idx = Math.min(...r.next_roles.map((n) => READINESS_ORDER.indexOf(n.readiness)).filter((i) => i >= 0));
    if (Number.isFinite(idx)) groups[idx].ids.push(r.employee_id);
  }
  return groups;
}

/** Share of each tenure band within everyone in scope and within key talent. */
export function tenureShares(bands: { band: string; scope: number; key: number }[]) {
  const all = bands.reduce((n, b) => n + b.scope, 0);
  const key = bands.reduce((n, b) => n + b.key, 0);
  return bands.map((b) => ({ band: b.band, allPct: pct(b.scope, all), keyPct: pct(b.key, key), key: b.key }));
}

/* ---------------------------------------------------------------- v2.1 measures (2026-11-12) */

const femaleShare = (genders: (string | null)[]) =>
  (genders.length < GENDER_MIN ? null : pct(genders.filter((g) => g === 'F').length, genders.length));

export interface PipelineStage { stage: 'scope' | 'key' | 'critical' | 'ready'; n: number; femalePct: number | null }

/**
 * Share of women at each step from review scope to ready-now talent: where does representation drop?
 * Each step hides below five people so nobody can be identified.
 */
export function genderPipeline({ people, reviews }: Dataset): PipelineStage[] {
  const gender = new Map(people.map((p) => [p.employee_id, p.gender]));
  const of = (ids: number[]) => ids.map((id) => gender.get(id) ?? null);
  const key = reviews.map((r) => r.employee_id);
  const critical = reviews.filter((r) => r.is_critical_role).map((r) => r.employee_id);
  const ready = nextStepReadiness({ people, reviews })[0].ids;
  return ([['scope', people.map((p) => p.employee_id)], ['key', key], ['critical', critical], ['ready', ready]] as const)
    .map(([stage, ids]) => ({ stage, n: ids.length, femalePct: femaleShare(of([...ids])) }));
}

/** Per department: women's share of everyone in scope versus of key talent (each hidden below five). */
export function genderDeptGap({ people, reviews }: Dataset) {
  const key = new Set(reviews.map((r) => r.employee_id));
  return [...new Set(people.map((p) => p.dept))].sort((a, b) => a.localeCompare(b, 'en')).map((dept) => {
    const members = people.filter((p) => p.dept === dept);
    return {
      dept,
      scopePct: femaleShare(members.map((p) => p.gender)),
      keyPct: femaleShare(members.filter((p) => key.has(p.employee_id)).map((p) => p.gender)),
    };
  });
}

export const MATRIX_BENCH = ['gap', 'thin', 'developing', 'strong'] as const;
export const MATRIX_RISK = ['High', 'Medium', 'Low'] as const;

/**
 * Critical roles placed by the holder's retention risk and the best successor's readiness.
 * Roles, not people, are being compared: "this seat may empty soon and nobody is ready".
 */
export function roleRiskMatrix({ reviews }: Dataset) {
  const critical = reviews.filter((r) => r.is_critical_role && r.retention_risk);
  return MATRIX_BENCH.map((bench) => ({
    bench,
    cells: MATRIX_RISK.map((risk) => ({
      risk,
      ids: critical.filter((r) => r.retention_risk === risk && benchClassOf(r) === bench).map((r) => r.employee_id),
    })),
  }));
}
const benchClassOf = (r: Review) => { const s = benchScore(r); return s >= 3 ? 'strong' : s === 2 ? 'developing' : s === 1 ? 'thin' : 'gap'; };

/** Critical roles by how many named internal or external candidates they have (TBH does not count). */
export function benchDepth({ reviews }: Dataset) {
  const critical = reviews.filter((r) => r.is_critical_role);
  const n = (r: Review) => r.successors.filter((s) => s.successor_type !== 'tbh').length;
  return [
    { depth: '0', ids: critical.filter((r) => n(r) === 0).map((r) => r.employee_id) },
    { depth: '1', ids: critical.filter((r) => n(r) === 1).map((r) => r.employee_id) },
    { depth: '2+', ids: critical.filter((r) => n(r) >= 2).map((r) => r.employee_id) },
  ];
}

/** Why people were named key talent (several reasons allowed). */
export function keyTalentReasons({ reviews }: Dataset) {
  const out = new Map<string, number[]>();
  for (const r of reviews) for (const reason of r.key_talent_reasons) out.set(reason, [...(out.get(reason) ?? []), r.employee_id]);
  return [...out].map(([reason, ids]) => ({ reason, ids })).sort((a, b) => b.ids.length - a.ids.length);
}

export const PLAN_STATUSES = ['Not Started', 'On Track', 'At Risk', 'Completed'];
/** Development goals by execution status; the people behind each status. */
export function planExecution({ reviews }: Dataset) {
  return PLAN_STATUSES.map((status) => {
    const owners = reviews.filter((r) => r.dev_plan.some((p) => p.goal.trim() && (p.status || 'Not Started') === status));
    const goals = reviews.flatMap((r) => r.dev_plan).filter((p) => p.goal.trim() && (p.status || 'Not Started') === status).length;
    return { status, goals, ids: owners.map((r) => r.employee_id) };
  });
}

/** Ready within two years for a next role and open to moving within two years: the internal bench for openings. */
export const mobilityPool = ({ reviews }: Dataset): number[] =>
  reviews.filter((r) => ['Now', '1-2 years'].includes(r.mobility_status ?? '')
    && r.next_roles.some((n) => ['Ready Now', '1-2 years'].includes(n.readiness))).map((r) => r.employee_id);

/** Medium or high retention risk, but no complete development plan: retention without a development answer. */
export const riskWithoutPlan = ({ reviews }: Dataset): number[] =>
  reviews.filter((r) => (r.retention_risk === 'High' || r.retention_risk === 'Medium') && !hasCompletePlan(r)).map((r) => r.employee_id);

export type Probe = { key: string; params?: Record<string, string> };

/**
 * Conversation prompts for one person, chosen from what their Supervisor entered.
 * They are questions to ask, never conclusions about the person. At most four, most urgent first.
 */
export function personProbes(r: Review): Probe[] {
  const out: Probe[] = [];
  if (r.aspirations_not_discussed) out.push({ key: 'aspirations' });
  if (r.retention_risk === 'High' || r.retention_risk === 'Medium') {
    for (const reason of r.retention_reasons.slice(0, 2)) out.push({ key: `reason.${reason}` });
    if (!r.retention_reasons.length) out.push({ key: 'riskNoReason' });
  }
  const ready = r.next_roles.find((n) => n.readiness === 'Ready Now');
  if (ready) out.push({ key: 'readyNow', params: { role: ready.role_title } });
  if (r.is_critical_role && benchScore(r) <= 1) out.push({ key: 'noSuccessor' });
  if (r.mobility_status === 'Now') out.push({ key: 'mobileNow' });
  if (!hasCompletePlan(r)) out.push({ key: 'plan' });
  else if (r.dev_plan.some((p) => p.status === 'At Risk')) out.push({ key: 'planAtRisk' });
  return out.slice(0, 4);
}
