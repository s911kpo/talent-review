import { describe, expect, it } from 'vitest';
import { isUnderSixMonths, tenure } from '../../src/lib/tenure';

const today = new Date(2026, 10, 10); // 2026-11-10

describe('tenure', () => {
  it('counts complete years and months', () => {
    expect(tenure('2020-03-05', today)).toEqual({ years: 6, months: 8, totalMonths: 80 });
  });

  it('does not count a month until the day has passed', () => {
    expect(tenure('2026-10-11', today)?.totalMonths).toBe(0);
    expect(tenure('2026-10-10', today)?.totalMonths).toBe(1);
  });

  it('returns null for missing or future dates', () => {
    expect(tenure(null, today)).toBeNull();
    expect(tenure('', today)).toBeNull();
    expect(tenure('2027-01-01', today)).toBeNull();
  });

  it('applies the six-month boundary', () => {
    expect(isUnderSixMonths('2026-05-11', today)).toBe(true);
    expect(isUnderSixMonths('2026-05-10', today)).toBe(false);
    expect(isUnderSixMonths(null, today)).toBe(false);
  });
});
