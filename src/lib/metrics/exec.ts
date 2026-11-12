// Executive story ("whole picture first, then risk, succession, development and the decisions to make").
// Plant and department level only: roles and departments may be compared, people are never scored or ranked (SPEC section 0).
// Every number here reuses a measure documented in docs/METRICS.md.
import { pct, reasonPareto, type Dataset } from './index';
import * as ins from './insights';
import * as s from './story';

export const EXEC_MEASURES = ['riskPct', 'readyPct', 'talkGapPct'] as const;
export type ExecMeasure = (typeof EXEC_MEASURES)[number];
/** A department needs attention when it is 10 points worse than the plant and has at least 3 people behind the share. */
export const ATTENTION_POINTS = 10;

const worse = (m: ExecMeasure, v: number, base: number) => (m === 'readyPct' ? base - v : v - base);

export interface DeptSignal { dept: string; measure: ExecMeasure; value: number; overall: number; gap: number }

/** Department × measure cells that are clearly worse than the plant, largest gap first. */
export function attentionSignals(ds: Dataset): DeptSignal[] {
  const all = s.overallHealth(ds);
  const out: DeptSignal[] = [];
  for (const d of s.deptHealth(ds)) {
    for (const m of EXEC_MEASURES) {
      const v = d[m];
      const base = all[m];
      const n = m === 'readyPct' ? d.critical : d.key;
      if (v === null || base === null || n < 3) continue;
      const gap = worse(m, v, base);
      if (gap >= ATTENTION_POINTS) out.push({ dept: d.dept, measure: m, value: v, overall: base, gap });
    }
  }
  return out.sort((a, b) => b.gap - a.gap);
}

/** The danger zone of the role risk matrix: high risk and nobody, medium risk and nobody, high risk and only long-term cover. */
export function dangerRoles(ds: Dataset) {
  const matrix = s.roleRiskMatrix(ds);
  const cell = (bench: string, risk: string) => matrix.find((r) => r.bench === bench)!.cells.find((c) => c.risk === risk)!.ids;
  const critical = cell('gap', 'High');
  const serious = [...cell('gap', 'Medium'), ...cell('thin', 'High')];
  return { critical, serious, all: [...critical, ...serious] };
}

export function execStory(ds: Dataset) {
  const health = s.overallHealth(ds);
  const progress = s.reviewProgress(ds);
  const reviews = ds.reviews;
  const critical = reviews.filter((r) => r.is_critical_role);
  const medHigh = reviews.filter((r) => r.retention_risk === 'High' || r.retention_risk === 'Medium').map((r) => r.employee_id);
  const highCritical = critical.filter((r) => r.retention_risk === 'High').map((r) => r.employee_id);
  const reasons = reasonPareto(ds);
  const conv = ins.conversationPriorities(ds);
  const danger = dangerRoles(ds);
  const depth = s.benchDepth(ds);
  const fragile = ins.fragileCoverage(ds);
  const plans = s.planExecution(ds);
  const pool = s.mobilityPool(ds);
  const readiness = s.nextStepReadiness(ds);
  const uncovered = critical.filter(s.isUncovered).map((r) => r.employee_id);
  return {
    health, progress,
    risk: {
      medHigh, highCritical, reasons,
      talkFirst: [...conv.high, ...conv.medium],
      topReason: reasons[0] ?? null,
      topReasonPct: reasons[0] ? pct(reasons[0].ids.length, medHigh.length) : null,
    },
    bench: {
      critical: critical.length,
      readyIds: critical.filter((r) => r.successors.some((x) => x.successor_type !== 'tbh' && x.readiness === 'Ready Now')).map((r) => r.employee_id),
      danger, depth, uncovered,
      thinPct: pct(depth[0].ids.length + depth[1].ids.length, critical.length),
      fragileHolders: [...new Set(fragile.map((f) => f.holderId))],
    },
    growth: {
      readiness, plans, pool,
      riskNoPlan: s.riskWithoutPlan(ds),
      stalledGoals: plans.filter((p) => p.status === 'At Risk' || p.status === 'Not Started').reduce((n, p) => n + p.goals, 0),
      totalGoals: plans.reduce((n, p) => n + p.goals, 0),
    },
    signals: attentionSignals(ds),
  };
}
export type ExecStory = ReturnType<typeof execStory>;

/**
 * PBM Our Values: for each value, the key talents whose Supervisor picked it as a strength (template column M)
 * or as an improvement area (column N). People, not mentions, so shares read as "x% of key talent".
 */
export function pbmView({ reviews }: Dataset, values: string[]) {
  const of = (field: 'pbm_strengths' | 'pbm_improvements', v: string) =>
    reviews.filter((r) => r[field].some((p) => p.principle === v)).map((r) => r.employee_id);
  const rows = values.map((principle) => ({ principle, strengthIds: of('pbm_strengths', principle), improveIds: of('pbm_improvements', principle) }));
  return {
    rows: rows.slice().sort((a, b) => b.improveIds.length - a.improveIds.length || a.principle.localeCompare(b.principle)),
    topImprove: rows.slice().sort((a, b) => b.improveIds.length - a.improveIds.length).slice(0, 2).filter((r) => r.improveIds.length > 0),
    topStrength: rows.slice().sort((a, b) => b.strengthIds.length - a.strengthIds.length).slice(0, 1).filter((r) => r.strengthIds.length > 0),
    keyCount: reviews.length,
  };
}
