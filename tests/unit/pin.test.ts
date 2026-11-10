import { describe, expect, it } from 'vitest';
import {
  generatePin, isValidEmployeeId, isValidPinFormat, lockedUntil, normalizePin, syntheticEmail,
  LOCK_MS, PIN_ALPHABET,
} from '../../supabase/functions/_shared/pin';

const MIN = 60_000;
const fail = (at: number) => ({ success: false, at });
const ok = (at: number) => ({ success: true, at });

describe('PIN generation', () => {
  it('produces 8 characters from the allowed alphabet', () => {
    for (let i = 0; i < 2000; i++) {
      const pin = generatePin();
      expect(pin).toMatch(/^[A-Z2-9]{8}$/);
      expect(pin).not.toMatch(/[01OIL]/);
    }
  });

  it('excludes look-alike characters from the alphabet', () => {
    expect(PIN_ALPHABET).not.toMatch(/[01OIL]/);
    expect(PIN_ALPHABET).toHaveLength(31);
  });

  it('does not repeat in practice', () => {
    expect(new Set(Array.from({ length: 2000 }, generatePin)).size).toBe(2000);
  });
});

describe('credential format', () => {
  it('builds the synthetic email', () => {
    expect(syntheticEmail(900001)).toBe('900001@talentreview.local');
  });

  it('accepts only plain numeric employee ids', () => {
    expect(isValidEmployeeId('900001')).toBe(true);
    for (const bad of ['0', '', 'abc', '1 OR 1=1', '12a', 900001, null]) {
      expect(isValidEmployeeId(bad)).toBe(false);
    }
  });

  it('normalizes case and whitespace before checking format', () => {
    expect(isValidPinFormat(normalizePin(' abcd2345 '))).toBe(true);
    expect(isValidPinFormat('ABCD234')).toBe(false);
    expect(isValidPinFormat('ABCD234O')).toBe(false);
  });
});

describe('lockout', () => {
  const t0 = 1_000_000_000;

  it('does not lock on four failures', () => {
    expect(lockedUntil([0, 1, 2, 3].map((i) => fail(t0 + i * MIN)), t0 + 4 * MIN)).toBeNull();
  });

  it('locks for 15 minutes from the fifth failure', () => {
    const attempts = [0, 1, 2, 3, 4].map((i) => fail(t0 + i * MIN));
    const fifth = t0 + 4 * MIN;
    expect(lockedUntil(attempts, fifth + 1)).toBe(fifth + LOCK_MS);
    expect(lockedUntil(attempts, fifth + LOCK_MS - 1)).toBe(fifth + LOCK_MS);
    expect(lockedUntil(attempts, fifth + LOCK_MS)).toBeNull();
  });

  it('holds the full lock even when failures were spread across the window', () => {
    const attempts = [0, 3, 6, 9, 12].map((i) => fail(t0 + i * MIN));
    expect(lockedUntil(attempts, t0 + 20 * MIN)).toBe(t0 + 27 * MIN);
  });

  it('ignores failures spread wider than 15 minutes', () => {
    const attempts = [0, 5, 10, 15, 20].map((i) => fail(t0 + i * MIN));
    expect(lockedUntil(attempts, t0 + 21 * MIN)).toBeNull();
  });

  it('clears the count after a success', () => {
    const attempts = [fail(t0), fail(t0 + MIN), fail(t0 + 2 * MIN), fail(t0 + 3 * MIN), ok(t0 + 4 * MIN), fail(t0 + 5 * MIN)];
    expect(lockedUntil(attempts, t0 + 6 * MIN)).toBeNull();
  });

  it('handles unsorted input', () => {
    const attempts = [4, 0, 2, 1, 3].map((i) => fail(t0 + i * MIN));
    expect(lockedUntil(attempts, t0 + 5 * MIN)).toBe(t0 + 4 * MIN + LOCK_MS);
  });
});
