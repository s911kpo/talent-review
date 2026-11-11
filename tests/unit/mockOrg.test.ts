import { describe, expect, it } from 'vitest';
import { generateOrg, DEPTS } from '../../src/lib/mock/orgGenerator';
import { missingSteps } from '../../src/lib/review/steps';
import * as m from '../../src/lib/metrics';

const today = new Date('2026-11-11T00:00:00Z');
const toDataset = (org: ReturnType<typeof generateOrg>): m.Dataset => ({
  people: org.people.filter((p) => p.supervisor !== 0).map((p) => ({
    employee_id: p.employeeId, name: p.fullName, dept: p.dept, reviewer_id: p.supervisor, start_date: p.startDate, gender: p.gender,
  })),
  reviews: org.reviews,
});

describe('fictional organization generator', () => {
  const org = generateOrg({ size: 600, today });

  it('builds a plant close to the requested size with a single GM', () => {
    expect(org.people.length).toBeGreaterThan(560);
    expect(org.people.length).toBeLessThan(640);
    expect(org.people.filter((p) => p.supervisor === 0)).toHaveLength(1);
    expect(new Set(org.people.map((p) => p.dept)).size).toBe(DEPTS.length + 1);
  });

  it('is deterministic for the same seed', () => {
    const again = generateOrg({ size: 600, today });
    expect(again.reviews.map((r) => r.retention_risk)).toEqual(org.reviews.map((r) => r.retention_risk));
  });

  it('only submitted-and-later reviews are guaranteed complete; drafts may be partial', () => {
    const later = org.reviews.filter((r) => ['submitted', 'confirmed', 'locked', 'returned'].includes(r.status));
    expect(later.length).toBeGreaterThan(50);
    for (const r of later) expect(missingSteps(r)).toEqual([]);
    expect(org.reviews.some((r) => r.status === 'draft' && missingSteps(r).length > 0)).toBe(true);
  });

  it('every reviewer has a team record and every review belongs to a direct report', () => {
    const byId = new Map(org.people.map((p) => [p.employeeId, p]));
    for (const r of org.reviews) expect(byId.get(r.employee_id)!.supervisor).toBe(r.reviewer_id);
    for (const id of org.reviewers) expect(org.teams[id]).toBeDefined();
  });

  it('never names someone as their own successor', () => {
    for (const r of org.reviews) for (const s of r.successors) expect(s.successor_employee_id).not.toBe(r.employee_id);
  });

  it('carries the intended patterns so the dashboards have stories to show', () => {
    const ds = toDataset(org);
    const risky = (dept: string) => {
      const rs = org.reviews.filter((r) => org.people.find((p) => p.employeeId === r.employee_id)!.dept === dept && r.retention_risk);
      return rs.filter((r) => r.retention_risk !== 'Low').length / rs.length;
    };
    expect(risky('NPI & Optical Design')).toBeGreaterThan(risky('Manufacturing'));
    const conc = m.successorConcentration(ds) as { count?: number; roles?: unknown[] }[];
    expect(conc.length).toBeGreaterThan(0);
    const k = m.kpis(ds);
    expect(k).toBeTruthy();
  });

  it('scales to 5,000 people quickly', () => {
    const t0 = performance.now();
    const big = generateOrg({ size: 5000, today, seed: 7 });
    expect(big.people.length).toBeGreaterThan(4800);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
