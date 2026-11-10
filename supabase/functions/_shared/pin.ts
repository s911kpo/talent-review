// Pure login rules shared by Edge Functions and unit tests. No Deno or Node APIs here.

/** Uppercase letters and digits without the look-alikes 0, O, 1, I and L (SPEC 3). */
export const PIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PIN_LENGTH = 8;

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

export function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length); // rejection sampling keeps every character equally likely
  const out: string[] = [];
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && out.length < length) out.push(alphabet[b % alphabet.length]);
    }
  }
  return out.join('');
}

export const generatePin = (): string => randomString(PIN_ALPHABET, PIN_LENGTH);

export const generateHrPassword = (): string =>
  randomString(`${PIN_ALPHABET}abcdefghjkmnpqrstuvwxyz`, 16);

export const syntheticEmail = (employeeId: number | string): string =>
  `${employeeId}@talentreview.local`;

export function isValidEmployeeId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value);
}

export const normalizePin = (pin: string): string => pin.trim().toUpperCase();

export function isValidPinFormat(pin: string): boolean {
  if (pin.length !== PIN_LENGTH) return false;
  return [...pin].every((c) => PIN_ALPHABET.includes(c));
}

export interface Attempt {
  success: boolean;
  at: number; // epoch milliseconds
}

/**
 * Returns when the lock ends, or null if not locked. Five failures inside 15 minutes lock
 * for 15 minutes counted from the fifth failure; a success clears earlier failures.
 * Attempts made during a lock are not recorded, so they cannot extend it.
 */
export function lockedUntil(attempts: Attempt[], now: number): number | null {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  let failures: number[] = [];
  let until: number | null = null;
  for (const attempt of sorted) {
    if (attempt.success) {
      failures = [];
      continue;
    }
    failures.push(attempt.at);
    if (failures.length >= MAX_FAILURES) {
      const fifthBack = failures[failures.length - MAX_FAILURES];
      if (attempt.at - fifthBack <= WINDOW_MS) {
        until = attempt.at + LOCK_MS;
        failures = [];
      }
    }
  }
  return until !== null && now < until ? until : null;
}
