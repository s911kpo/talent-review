// Expected values below are worked out by hand from the fixture.
import { describe, expect, it } from 'vitest';
import * as m from '../../src/lib/metrics';
import { emptyReview } from '../../src/lib/review/steps';
import type { DevPlanItem, Review, Successor } from '../../src/lib/review/types';

const today = new Date(2026, 10, 15);

const person = (employee_id: number, dept: string, start: string, gender = 'M', reviewer_id = 90): m.Person => ({
  employee_id, name: `P${employee_id}`, dept, reviewer_id, start_date: start, gender,
});
const internal = (id: number, readiness: string, name = `S${id}`): Successor => ({ rank: 1, successor_type: 'internal', successor_employee_id: id, external_name: null, readiness, display_name: name });
const external = (readiness: string): Successor => ({ rank: 2, successor_type: 'external', successor_employee_id: null, external_name: 'Out', readiness });
const tbh: Successor = { rank: 3, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null };
const plan = (over: Partial<DevPlanItem>): DevPlanItem => ({
  area_idx: 1, goal: 'g', dev_type: 'Experience (70%)', actions: 'a\nb', support: '', owner: 'Amy',
  start_date: '2026-12-01', target_date: '2027-03-15', checkpoint: 'c', status: 'Not Started', progress_notes: '', ...over,
});
const review = (employee_id: number, over: Partial<Review>): Review => ({
  ...emptyReview({ id: `r${employee_id}`, cycle_id: 'c', employee_id, reviewer_id: 90 }), ...over,
});

// PE: 1, 2, 3, 4, 5 (5 people). QA: 6, 7 (2 people).
const people = [
  person(1, 'PE', '2026-10-01', 'F'), person(2, 'PE', '2026-01-15'), person(3, 'PE', '2024-11-15', 'F'),
  person(4, 'PE', '2022-11-15'), person(5, 'PE', '2010-01-01'), person(6, 'QA', '2020-11-15', 'F'), person(7, 'QA', '2020-11-15'),
];

const reviews = [
  review(1, {
    status: 'submitted', is_critical_role: true, retention_risk: 'High', retention_reasons: ['Career Move', 'Competitive Market'],
    successors: [internal(50, 'Ready Now'), tbh], next_roles: [{ rank: 1, role_title: 'X', readiness: 'Ready Now' }],
    development_areas: [{ idx: 1, text: 'a' }], dev_plan: [plan({})],
    pbm_strengths: [{ principle: 'Integrity', evidence: 'e' }], pbm_improvements: [{ principle: 'Humility', evidence: 'e' }],
    mobility_status: 'Now', desired_locations: 'Penang',
  }),
  review(2, {
    status: 'draft', is_critical_role: true, retention_risk: 'Medium', retention_reasons: ['Career Move'],
    successors: [internal(50, '1-2 years')], next_roles: [{ rank: 1, role_title: 'Y', readiness: '1-2 years' }],
    development_areas: [{ idx: 1, text: 'a' }], dev_plan: [plan({ dev_type: 'Education (10%)', owner: 'Amy', target_date: '2027-03-20', actions: 'one' })],
    aspirations_not_discussed: true, mobility_status: 'Not Now',
  }),
  review(6, {
    status: 'locked', is_critical_role: true, retention_risk: 'Low',
    successors: [external('3+ years')], pbm_strengths: [{ principle: 'Integrity', evidence: 'e' }],
    development_areas: [{ idx: 1, text: 'a' }], dev_plan: [],
  }),
  review(7, { status: 'submitted', is_critical_role: false, retention_risk: 'High', retention_reasons: ['Family Reasons'], successors: [tbh] }),
];

const ds: m.Dataset = { people, reviews };

describe('KPIs', () => {
  const k = m.kpis(ds);
  it('counts people and key talent', () => {
    expect(k.scopeCount).toBe(7);
    expect(k.keyCount).toBe(4);
    expect(k.keyPct).toBeCloseTo((4 / 7) * 100);
  });
  it('counts completion from submitted onward', () => {
    expect(k.completionPct).toBe(75);
  });
  it('counts critical roles and their high risk', () => {
    expect(k.criticalCount).toBe(3);
    expect(k.criticalHighRisk).toBe(1);
  });
  it('computes succession coverage over critical roles only', () => {
    expect(k.coveragePct).toBeCloseTo((1 / 3) * 100);
  });
  it('counts roles with a TBH row', () => {
    expect(k.tbhRoles).toBe(2);
  });
  it('computes plan completeness', () => {
    expect(k.planCompletePct).toBe(50);
  });
  it('returns null rather than a false zero when nothing applies', () => {
    expect(m.kpis({ people: [], reviews: [] }).keyPct).toBeNull();
  });
});

describe('bench strength', () => {
  it('scores by the best successor', () => {
    expect(m.benchScore(reviews[0])).toBe(3);
    expect(m.benchScore(reviews[1])).toBe(2);
    expect(m.benchScore(reviews[2])).toBe(1);
    expect(m.benchScore(reviews[3])).toBe(0);
    expect(m.benchScore(review(9, {}))).toBe(0);
  });
  it('treats Emergency Cover as 1 and TNTR as 0', () => {
    expect(m.benchScore(review(9, { successors: [internal(1, 'Emergency Cover')] }))).toBe(1);
    expect(m.benchScore(review(9, { successors: [internal(1, 'Too New to Rate (TNTR)')] }))).toBe(0);
  });
  it('groups critical roles by department', () => {
    expect(m.benchByDept(ds)).toEqual([
      { dept: 'PE', strong: [1], developing: [2], thin: [], gap: [] },
      { dept: 'QA', strong: [], developing: [], thin: [6], gap: [] },
    ]);
  });
  it('lists single points of failure', () => {
    expect(m.singlePoints(ds)).toEqual([6]);
  });
  it('finds successors named for two or more roles', () => {
    expect(m.successorConcentration(ds)).toEqual([{ id: 50, name: 'S50', holders: [1, 2] }]);
  });
  it('measures external dependency', () => {
    expect(m.externalDependencyPct(ds)).toBe(60); // tbh, external, tbh of 5 rows... 3 of 5
  });
});

describe('organization', () => {
  it('summarizes each department', () => {
    const [pe, qa] = m.deptStats(ds, today);
    expect(pe).toMatchObject({ dept: 'PE', scope: 5, key: 2, keyPct: 40, tntr: 1, benchAvg: 2.5, medHighPct: 100, planCompletePct: 100 });
    expect(qa).toMatchObject({ dept: 'QA', scope: 2, key: 2, keyPct: 100, tntr: 0, benchAvg: 1, medHighPct: 50, planCompletePct: 0 });
    expect(qa.avgTenureYears).toBe(6);
  });
  it('bands tenure at the documented boundaries', () => {
    expect(m.tenureBand('2026-05-16', today)).toBe('lt6m');
    expect(m.tenureBand('2026-05-15', today)).toBe('6to12m');
    expect(m.tenureBand('2025-11-15', today)).toBe('1to3y');
    expect(m.tenureBand('2023-11-15', today)).toBe('3to5y');
    expect(m.tenureBand('2021-11-15', today)).toBe('5to10y');
    expect(m.tenureBand('2016-11-15', today)).toBe('10yplus');
    expect(m.tenureBand(null, today)).toBeNull();
  });
  it('compares tenure for key talent against scope', () => {
    const d = m.tenureDistribution(ds, today);
    expect(d.find((x) => x.band === 'lt6m')).toEqual({ band: 'lt6m', scope: 1, key: 1 });
    expect(d.find((x) => x.band === '6to12m')).toEqual({ band: '6to12m', scope: 1, key: 1 });
  });
  it('hides gender for groups under five', () => {
    const [pe, qa] = m.genderByDept(ds);
    expect(pe).toEqual({ dept: 'PE', suppressed: false, femalePct: 40, malePct: 60 });
    expect(qa).toEqual({ dept: 'QA', suppressed: true });
  });
});

describe('retention', () => {
  it('builds the risk by critical-role matrix', () => {
    expect(m.riskMatrix(ds)).toEqual([
      { risk: 'High', critical: [1], other: [7] },
      { risk: 'Medium', critical: [2], other: [] },
      { risk: 'Low', critical: [6], other: [] },
    ]);
  });
  it('orders reasons by count, Medium and High only', () => {
    expect(m.reasonPareto(ds).map((r) => [r.reason, r.count])).toEqual([
      ['Career Move', 2], ['Competitive Market', 1], ['Family Reasons', 1],
    ]);
  });
  it('flags high risk people who are Ready Now', () => {
    expect(m.flightRisk(ds)).toEqual([1]);
  });
});

describe('mobility and careers', () => {
  it('builds the readiness funnel', () => {
    expect(m.readinessFunnel(ds).map((s) => s.count)).toEqual([1, 1, 0, 0]);
  });
  it('counts career conversation gaps', () => {
    expect(m.notDiscussed(ds)).toEqual([2]);
  });
  it('lists desired locations', () => {
    expect(m.desiredLocations(ds)).toEqual(['Penang']);
  });
  it('counts mobility', () => {
    expect(m.mobilityDistribution(ds).map((x) => [x.status, x.count])).toEqual([['Now', 1], ['Not Now', 1]]);
  });
});

describe('development map', () => {
  it('reports the actual 70/20/10 mix with reference values', () => {
    expect(m.devMix(ds)).toEqual([
      { type: 'Experience (70%)', count: 1, pct: 50, reference: 70 },
      { type: 'Exposure (20%)', count: 0, pct: 0, reference: 20 },
      { type: 'Education (10%)', count: 1, pct: 50, reference: 10 },
    ]);
  });
  it('groups target dates by month', () => {
    expect(m.planTimeline(ds)).toEqual([{ month: '2027-03', count: 2, ids: [1, 2] }]);
  });
  it('sums actions by owner', () => {
    expect(m.ownerLoad(ds)).toEqual([{ owner: 'Amy', actions: 3 }]);
  });
  it('counts PBM principles on both sides', () => {
    expect(m.pbmDistribution(ds)).toEqual(expect.arrayContaining([
      { principle: 'Integrity', strengths: 2, improvements: 0 },
      { principle: 'Humility', strengths: 0, improvements: 1 },
    ]));
  });
  it('builds the theme matrix', () => {
    const r = m.themeMatrix([{ employee_id: 1, area_idx: 1, theme: 'Leadership' }, { employee_id: 6, area_idx: 1, theme: 'Leadership' }, { employee_id: 999, area_idx: 1, theme: 'Ghost' }], ds);
    expect(r).toEqual({ themes: ['Leadership'], depts: ['PE', 'QA'], cells: [[1, 1]] });
  });
});

describe('filters', () => {
  it('filters by department', () => {
    const f = m.applyFilters(ds, { ...m.NO_FILTERS, dept: 'QA' }, today);
    expect(f.people).toHaveLength(2);
    expect(f.reviews.map((r) => r.employee_id)).toEqual([6, 7]);
  });
  it('can exclude drafts', () => {
    const f = m.applyFilters(ds, { ...m.NO_FILTERS, submittedOnly: true }, today);
    expect(f.reviews.map((r) => r.employee_id)).toEqual([1, 6, 7]);
  });
  it('filters by critical role', () => {
    expect(m.applyFilters(ds, { ...m.NO_FILTERS, critical: 'no' }, today).reviews.map((r) => r.employee_id)).toEqual([7]);
  });
  it('filters by tenure band', () => {
    expect(m.applyFilters(ds, { ...m.NO_FILTERS, tenure: 'lt6m' }, today).people.map((p) => p.employee_id)).toEqual([1]);
  });
});
