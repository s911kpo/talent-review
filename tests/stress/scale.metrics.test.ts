// Dashboard metrics run in the browser over every review in scope. This checks they stay
// interactive at 5,000 employees. Timings go to test-results/stress-metrics.json.
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateOrg } from '../../src/lib/mock/orgGenerator';
import * as m from '../../src/lib/metrics';

const SIZE = Number(process.env.STRESS_SIZE ?? 5000);
const today = new Date('2026-11-11T00:00:00Z');
const org = generateOrg({ size: SIZE, seed: 99, today });
const ds: m.Dataset = {
  people: org.people.filter((p) => p.supervisor !== 0).map((p) => ({
    employee_id: p.employeeId, name: p.fullName, dept: p.dept, reviewer_id: p.supervisor, start_date: p.startDate, gender: p.gender,
  })),
  reviews: org.reviews,
};
const timings: Record<string, number> = {};

afterAll(() => {
  mkdirSync(join(__dirname, '..', '..', 'test-results'), { recursive: true });
  writeFileSync(join(__dirname, '..', '..', 'test-results', 'stress-metrics.json'), JSON.stringify({ size: SIZE, reviews: org.reviews.length, timings }, null, 2));
});

describe(`dashboard metrics at ${SIZE} employees`, () => {
  const fns: Record<string, () => unknown> = {
    kpis: () => m.kpis(ds),
    deptStats: () => m.deptStats(ds, today),
    tenureDistribution: () => m.tenureDistribution(ds, today),
    genderByDept: () => m.genderByDept(ds),
    riskMatrix: () => m.riskMatrix(ds),
    reasonPareto: () => m.reasonPareto(ds),
    benchByDept: () => m.benchByDept(ds),
    singlePoints: () => m.singlePoints(ds),
    successorConcentration: () => m.successorConcentration(ds),
    successionLinks: () => m.successionLinks(ds),
    externalDependencyPct: () => m.externalDependencyPct(ds),
    mobilityDistribution: () => m.mobilityDistribution(ds),
    devMix: () => m.devMix(ds),
    planTimeline: () => m.planTimeline(ds),
    ownerLoad: () => m.ownerLoad(ds),
    pbmDistribution: () => m.pbmDistribution(ds),
    applyFilters: () => m.applyFilters(ds, { ...m.NO_FILTERS, dept: 'Manufacturing' }, today),
  };

  for (const [name, fn] of Object.entries(fns)) {
    it(`${name} finishes in under 250 ms`, () => {
      fn();
      const t0 = performance.now();
      fn();
      timings[name] = Math.round((performance.now() - t0) * 10) / 10;
      expect(timings[name]).toBeLessThan(250);
    });
  }

  it('all tabs together stay under one second', () => {
    const total = Object.values(timings).reduce((a, b) => a + b, 0);
    timings.total = Math.round(total);
    expect(total).toBeLessThan(1000);
  });
});
