import { describe, expect, it } from 'vitest';
import * as s from '../../src/lib/metrics/story';
import type { Dataset, Person } from '../../src/lib/metrics';
import type { Review, Successor } from '../../src/lib/review/types';
import { emptyReview } from '../../src/lib/review/steps';
import { generateOrg } from '../../src/lib/mock/orgGenerator';

const person = (id: number, dept = 'PE', gender = 'M'): Person => ({ employee_id: id, name: `P${id}`, dept, reviewer_id: 1, start_date: '2020-01-01', gender });
const review = (id: number, patch: Partial<Review> = {}): Review => ({
  ...emptyReview({ id: `r${id}`, cycle_id: 'c', employee_id: id, reviewer_id: 1 }), ...patch,
});
const succ = (readiness: string, type: Successor['successor_type'] = 'internal'): Successor =>
  ({ rank: 1, successor_type: type, successor_employee_id: type === 'internal' ? 99 : null, external_name: null, readiness });

describe('dashboard v2 measures', () => {
  it('department health: risk, ready-now coverage and conversation gap as shares', () => {
    const ds: Dataset = { people: [1, 2, 3, 4].map((i) => person(i, i < 4 ? 'PE' : 'QA')), reviews: [
      review(1, { retention_risk: 'High', is_critical_role: true, successors: [succ('Ready Now')] }),
      review(2, { retention_risk: 'Low', is_critical_role: true, successors: [succ('3+ years')], aspirations_not_discussed: true }),
    ] };
    const pe = s.deptHealth(ds).find((d) => d.dept === 'PE')!;
    expect(pe).toMatchObject({ scope: 3, key: 2, critical: 2, riskPct: 50, readyPct: 50, talkGapPct: 50 });
    expect(s.deptHealth(ds).find((d) => d.dept === 'QA')).toMatchObject({ key: 0, riskPct: null, readyPct: null });
  });

  it('a TBH row never counts as a ready-now successor', () => {
    const ds: Dataset = { people: [person(1)], reviews: [review(1, { is_critical_role: true, successors: [succ('Ready Now', 'tbh')] })] };
    expect(s.overallHealth(ds).readyPct).toBe(0);
    expect(s.uncoveredByDept(ds)).toEqual([{ dept: 'PE', ids: [1] }]);
  });

  it('gender view is hidden below five people', () => {
    const few: Dataset = { people: [1, 2, 3, 4].map((i) => person(i, 'PE', 'F')), reviews: [review(1)] };
    expect(s.genderView(few)).toMatchObject({ scopeFemalePct: null, keyFemalePct: null });
    const many: Dataset = { people: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => person(i, 'PE', i <= 4 ? 'F' : 'M')), reviews: [1, 2, 5, 6, 7].map((i) => review(i)) };
    expect(s.genderView(many)).toMatchObject({ scopeFemalePct: 40, keyFemalePct: 40 });
  });

  it('next-step readiness counts each person once, at their nearest readiness', () => {
    const ds: Dataset = { people: [person(1), person(2)], reviews: [
      review(1, { next_roles: [{ rank: 1, role_title: 'a', readiness: '3+ years' }, { rank: 2, role_title: 'b', readiness: '1-2 years' }] }),
      review(2, { next_roles: [] }),
    ] };
    expect(s.nextStepReadiness(ds).map((g) => g.ids.length)).toEqual([0, 1, 0, 0]);
  });

  it('headlines only flag a department 15 points above overall, and cross-team names only for HR', () => {
    const org = generateOrg({ size: 600, today: new Date('2026-11-11') });
    const ds: Dataset = {
      people: org.people.map((p) => ({ employee_id: p.employeeId, name: p.fullName, dept: p.dept, reviewer_id: p.supervisor, start_date: p.startDate, gender: p.gender })),
      reviews: org.reviews,
    };
    const hr = s.headlines(ds, true);
    expect(hr.length).toBeLessThanOrEqual(3);
    const hot = hr.find((h) => h.kind === 'riskHotspot');
    if (hot && hot.kind === 'riskHotspot') expect(hot.pct - hot.overall).toBeGreaterThanOrEqual(15);
    expect(s.headlines(ds, false).some((h) => h.kind === 'concentration')).toBe(false);
  });
});

describe('dashboard v2.1 measures', () => {
  const crit = (id: number, risk: string, successors: Successor[], patch: Partial<Review> = {}) =>
    review(id, { is_critical_role: true, retention_risk: risk, successors, ...patch });

  it('role risk matrix places critical roles by holder risk and successor readiness', () => {
    const ds: Dataset = { people: [1, 2, 3].map((i) => person(i)), reviews: [
      crit(1, 'High', []),
      crit(2, 'High', [succ('Ready Now')]),
      crit(3, 'Low', [succ('3+ years')]),
    ] };
    const cell = (bench: string, risk: string) => s.roleRiskMatrix(ds).find((r) => r.bench === bench)!.cells.find((c) => c.risk === risk)!.ids;
    expect(cell('gap', 'High')).toEqual([1]);
    expect(cell('strong', 'High')).toEqual([2]);
    expect(cell('thin', 'Low')).toEqual([3]);
  });

  it('bench depth ignores TBH rows', () => {
    const ds: Dataset = { people: [1, 2, 3].map((i) => person(i)), reviews: [
      crit(1, 'Low', [succ('Ready Now', 'tbh')]),
      crit(2, 'Low', [succ('Ready Now')]),
      crit(3, 'Low', [succ('Ready Now'), succ('1-2 years', 'external')]),
    ] };
    expect(s.benchDepth(ds).map((d) => d.ids)).toEqual([[1], [2], [3]]);
  });

  it('gender pipeline hides steps under five people', () => {
    const ds: Dataset = { people: [1, 2, 3, 4, 5, 6].map((i) => person(i, 'PE', i <= 3 ? 'F' : 'M')), reviews: [1, 2, 4, 5, 6].map((i) => review(i)) };
    const p = s.genderPipeline(ds);
    expect(p[0]).toMatchObject({ stage: 'scope', femalePct: 50 });
    expect(p[1]).toMatchObject({ stage: 'key', femalePct: 40 });
    expect(p[2]).toMatchObject({ stage: 'critical', n: 0, femalePct: null });
  });

  it('mobility pool needs both near readiness and near mobility', () => {
    const near = [{ rank: 1, role_title: 'x', readiness: '1-2 years' }];
    const ds: Dataset = { people: [1, 2, 3].map((i) => person(i)), reviews: [
      review(1, { mobility_status: 'Now', next_roles: near }),
      review(2, { mobility_status: 'Not Now', next_roles: near }),
      review(3, { mobility_status: '1-2 years', next_roles: [{ rank: 1, role_title: 'x', readiness: '3+ years' }] }),
    ] };
    expect(s.mobilityPool(ds)).toEqual([1]);
  });

  it('person prompts are questions drawn from what was entered, at most four', () => {
    const r = review(1, {
      aspirations_not_discussed: true, retention_risk: 'High', retention_reasons: ['Compensation Reasons', 'Career Move', 'Hybrid Work'],
      next_roles: [{ rank: 1, role_title: 'Lead', readiness: 'Ready Now' }], is_critical_role: true, successors: [],
    });
    const keys = s.personProbes(r).map((p) => p.key);
    expect(keys).toEqual(['aspirations', 'reason.Compensation Reasons', 'reason.Career Move', 'readyNow']);
    expect(s.personProbes(review(2, { retention_risk: 'Low' })).map((p) => p.key)).toEqual(['plan']);
  });
});
