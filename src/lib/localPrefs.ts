// Per-browser conveniences for screens shown before sign-in. Storage may be unavailable.
const PREFIX = 'talent-review.';

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Preferences simply will not persist.
  }
}
