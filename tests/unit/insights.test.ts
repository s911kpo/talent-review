import { describe, expect, it } from 'vitest';
import * as ins from '../../src/lib/metrics/insights';
import type { Dataset, Person } from '../../src/lib/metrics';
import type { Review, Successor } from '../../src/lib/review/types';
import { emptyReview } from '../../src/lib/review/steps';
import { generateOrg } from '../../src/lib/mock/orgGenerator';

const person = (id: number, dept = 'PE', position = 'Engineer'): Person => ({ employee_id: id, name: `P${id}`, dept, reviewer_id: 1, start_date: '2020-01-01', gender: 'F', position });
const review = (id: number, patch: Partial<Review> = {}): Review => ({
  ...emptyReview({ id: `r${id}`, cycle_id: 'c', employee_id: id, reviewer_id: patch.reviewer_id ?? 1 }), ...patch,
});
const internal = (id: number, readiness: string): Successor => ({ rank: 1, successor_type: 'internal', successor_employee_id: id, external_name: null, readiness });
const tbh: Successor = { rank: 1, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null };

describe('management insights', () => {
  it('conversation priorities: Medium/High risk with no career conversation yet', () => {
    const ds: Dataset = { people: [1, 2, 3, 4].map((i) => person(i)), reviews: [
      review(1, { retention_risk: 'High', aspirations_not_discussed: true }),
      review(2, { retention_risk: 'Medium', aspirations_not_discussed: true }),
      review(3, { retention_risk: 'High', aspirations_not_discussed: false, personal_aspirations: 'x' }),
      review(4, { retention_risk: 'Low', aspirations_not_discussed: true }),
    ] };
    expect(ins.conversationPriorities(ds)).toEqual({ high: [1], medium: [2] });
  });

  it('unlisted successors: named near-ready by others but not a key talent themselves', () => {
    const ds: Dataset = { people: [1, 2, 3, 9].map((i) => person(i)), reviews: [
      review(1, { successors: [internal(9, 'Ready Now')] }),
      review(2, { successors: [internal(9, '1-2 years'), internal(3, '3+ years')] }),
      review(3, { successors: [internal(1, 'Ready Now')] }),
    ] };
    expect(ins.unlistedSuccessors(ds)).toEqual([{ id: 9, namedFor: [1, 2], readiness: ['Ready Now', '1-2 years'] }]);
  });

  it('fragile coverage: critical role whose ready successor is also at risk', () => {
    const ds: Dataset = { people: [1, 2].map((i) => person(i)), reviews: [
      review(1, { is_critical_role: true, successors: [internal(2, 'Ready Now')] }),
      review(2, { retention_risk: 'High' }),
    ] };
    expect(ins.fragileCoverage(ds)).toEqual([{ holderId: 1, successorId: 2, successorRisk: 'High' }]);
  });

  it('internal matches: thin-bench critical role and someone whose next role is that job', () => {
    const ds: Dataset = { people: [person(1, 'PE', 'Sr. Process Engineer'), person(2, 'QA', 'Quality Engineer'), person(3, 'QA', 'QC')], reviews: [
      review(1, { is_critical_role: true, successors: [tbh] }),
      review(2, { next_roles: [{ rank: 1, role_title: 'sr. process engineer', readiness: '1-2 years' }] }),
      review(3, { next_roles: [{ rank: 1, role_title: 'Sr. Process Engineer', readiness: '3+ years' }] }),
    ] };
    expect(ins.internalMatches(ds)).toEqual([{ holderId: 1, role: 'Sr. Process Engineer', candidates: [{ id: 2, readiness: '1-2 years' }] }]);
  });

  it('calibration signals describe patterns, only for teams of 4 or more', () => {
    const team = [1, 2, 3, 4].map((i) => review(i, {
      reviewer_id: 7, retention_risk: 'Low', next_roles: [{ rank: 1, role_title: 'X', readiness: 'Ready Now' }],
      successors: [internal(50 + i, 'Ready Now')],
      dev_plan: [{ area_idx: 1, goal: 'g', dev_type: 'Education (10%)', actions: 'a\nb', support: '', owner: 'o', start_date: '2026-12-01', target_date: '2027-03-01', checkpoint: '看表現', status: 'Not Started', progress_notes: '' }],
    }));
    const small = [review(10, { reviewer_id: 8, retention_risk: 'Low' })];
    const r = ins.calibrationSignals({ people: [], reviews: [...team, ...small] });
    expect(r).toEqual([{ reviewerId: 7, keyCount: 4, signals: ['allLowRisk', 'sameReadiness', 'vaguePlans', 'noTbhAllReady'] }]);
  });

  it('mobility supply versus TBH demand by department', () => {
    const ds: Dataset = { people: [person(1, 'PE'), person(2, 'PE'), person(3, 'QA')], reviews: [
      review(1, { mobility_status: 'Now' }),
      review(2, { is_critical_role: true, successors: [tbh] }),
      review(3, { mobility_status: 'Not Now' }),
    ] };
    expect(ins.mobilitySupply(ds)).toEqual([{ dept: 'PE', mobile: 1, tbhRoles: 1 }]);
  });

  it('finds every kind of insight in the showcase plant', () => {
    const org = generateOrg({ size: 600, today: new Date('2026-11-11') });
    const ds: Dataset = {
      people: org.people.filter((p) => p.supervisor !== 0).map((p) => ({ employee_id: p.employeeId, name: p.fullName, dept: p.dept, reviewer_id: p.supervisor, start_date: p.startDate, gender: p.gender, position: p.position })),
      reviews: org.reviews,
    };
    const conv = ins.conversationPriorities(ds);
    expect(conv.high.length + conv.medium.length).toBeGreaterThan(0);
    expect(ins.unlistedSuccessors(ds).length).toBeGreaterThan(0);
    expect(ins.fragileCoverage(ds).length).toBeGreaterThan(0);
    expect(ins.internalMatches(ds).length).toBeGreaterThan(0);
    expect(ins.mobilitySupply(ds).length).toBeGreaterThan(0);
  });
});
