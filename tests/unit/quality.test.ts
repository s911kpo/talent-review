import { describe, expect, it } from 'vitest';
import { allEducation, discussionPoints, planWarnings, teamWarnings } from '../../src/lib/review/quality';
import { answeredCount, emptyReview, isStepComplete, missingSteps } from '../../src/lib/review/steps';
import type { DevPlanItem, Review, Successor } from '../../src/lib/review/types';

const today = new Date(2026, 10, 15);

const plan = (over: Partial<DevPlanItem> = {}): DevPlanItem => ({
  area_idx: 1, goal: 'Lead one cross-functional project by June 2027', dev_type: 'Experience (70%)',
  actions: 'Serve as project PM\nChair bi-weekly meetings', support: '', owner: 'Employee',
  start_date: '2026-12-01', target_date: '2027-06-30', checkpoint: 'Close-out report reviewed in June', status: 'Not Started',
  progress_notes: '', ...over,
});

const review = (over: Partial<Review> = {}): Review => ({
  ...emptyReview({ id: 'r', cycle_id: 'c', employee_id: 1, reviewer_id: 9 }), ...over,
});
const tbh: Successor = { rank: 1, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null };
const internal = (id: number, rank = 1): Successor => ({ rank, successor_type: 'internal', successor_employee_id: id, external_name: null, readiness: 'Ready Now' });

describe('plan warnings', () => {
  it('passes a concrete plan', () => {
    expect(planWarnings(plan(), today)).toEqual([]);
  });
  it('flags one action only', () => {
    expect(planWarnings(plan({ actions: 'Only one' }), today)).toContain('too_few_actions');
  });
  it('flags a past target', () => {
    expect(planWarnings(plan({ target_date: '2026-11-14' }), today)).toContain('target_past');
    expect(planWarnings(plan({ target_date: '2026-11-15' }), today)).not.toContain('target_past');
  });
  it('flags a target beyond 12 months', () => {
    expect(planWarnings(plan({ target_date: '2027-11-16' }), today)).toContain('target_too_far');
    expect(planWarnings(plan({ target_date: '2027-11-15' }), today)).not.toContain('target_too_far');
  });
  it('flags a short checkpoint', () => {
    expect(planWarnings(plan({ checkpoint: '看表現' }), today)).toContain('weak_checkpoint');
  });
  it('flags vague wording without something measurable', () => {
    expect(planWarnings(plan({ goal: '加強管理能力' }), today)).toContain('vague_wording');
    expect(planWarnings(plan({ goal: '加強簡報能力，完成 3 次英文報告' }), today)).not.toContain('vague_wording');
    expect(planWarnings(plan({ actions: 'improve communication\nchair the meeting' }), today)).toContain('vague_wording');
  });
  it('notices when every card is education', () => {
    const edu = plan({ dev_type: 'Education (10%)' });
    expect(allEducation([edu, edu, edu])).toBe(true);
    expect(allEducation([edu, edu])).toBe(false);
    expect(allEducation([edu, edu, plan()])).toBe(false);
  });
});

describe('team warnings', () => {
  const starts = new Map<number, string | null>([[1, '2020-01-01'], [2, '2026-09-01']]);
  const codes = (rs: Review[]) => teamWarnings(rs, starts, today).map((w) => w.code);

  it('flags high risk without plan or successor', () => {
    expect(codes([review({ retention_risk: 'High' })])).toContain('high_risk_no_plan');
    expect(codes([review({ retention_risk: 'High', dev_plan: [plan()], successors: [tbh] })])).not.toContain('high_risk_no_plan');
  });
  it('flags a critical role with only TBH', () => {
    expect(codes([review({ is_critical_role: true, successors: [tbh] })])).toContain('critical_only_tbh');
    expect(codes([review({ is_critical_role: true, successors: [tbh, internal(5, 2)] })])).not.toContain('critical_only_tbh');
  });
  it('flags one successor named three or more times', () => {
    const rs = [1, 2, 3].map((e) => review({ employee_id: e, successors: [internal(7)] }));
    expect(codes(rs)).toContain('successor_overused');
    expect(codes(rs.slice(0, 2))).not.toContain('successor_overused');
  });
  it('flags Ready Now with no development area', () => {
    const r = review({ next_roles: [{ rank: 1, role_title: 'X', readiness: 'Ready Now' }] });
    expect(codes([r])).toContain('ready_now_no_dev_area');
  });
  it('flags a new hire rated Ready Now', () => {
    const r = review({ employee_id: 2, next_roles: [{ rank: 1, role_title: 'X', readiness: 'Ready Now' }] });
    expect(codes([r])).toContain('new_hire_ready_now');
  });
});

describe('completeness', () => {
  it('starts with ten questions open, since the plan depends on development areas', () => {
    expect(missingSteps(review())).toHaveLength(10);
    expect(missingSteps(review())).not.toContain('DEV_PLAN');
    expect(missingSteps(review({ development_areas: [{ idx: 1, text: 'a' }] }))).toContain('DEV_PLAN');
  });
  it('treats the not-discussed checkbox as an answer', () => {
    expect(isStepComplete('ASPIRATIONS', review({ aspirations_not_discussed: true }))).toBe(true);
  });
  it('needs reasons only for Medium and High', () => {
    expect(isStepComplete('RETENTION', review({ retention_risk: 'Low' }))).toBe(true);
    expect(isStepComplete('RETENTION', review({ retention_risk: 'High' }))).toBe(false);
  });
  it('needs a complete plan for every active area', () => {
    const areas = [{ idx: 1, text: 'a' }, { idx: 2, text: 'b' }];
    expect(isStepComplete('DEV_PLAN', review({ development_areas: areas, dev_plan: [plan()] }))).toBe(false);
    expect(isStepComplete('DEV_PLAN', review({ development_areas: areas, dev_plan: [plan(), plan({ area_idx: 2 })] }))).toBe(true);
  });
  it('counts comments only once visited or written', () => {
    expect(answeredCount(review())).toBe(0);
    expect(answeredCount(review({ completed_steps: ['COMMENTS'] }))).toBe(1);
    expect(answeredCount(review({ additional_comments: 'note' }))).toBe(1);
  });
});

describe('discussion points', () => {
  it('leads with succession gaps and stops at three', () => {
    const points = discussionPoints([
      review({ is_critical_role: true, retention_risk: 'High', aspirations_not_discussed: true }),
    ]);
    expect(points.map((p) => p.key)).toEqual(['gap_critical', 'high_risk', 'not_discussed']);
  });
});
