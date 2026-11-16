// Which backend a script talks to. Default is staging (the test site with fictional data).
// Production is chosen only on purpose: TR_TARGET=production, which reads .env.production.local.
// Both files are git-ignored (.env.*); values are never printed.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TARGET = process.env.TR_TARGET === 'production' ? 'production' : 'staging';
export const IS_PRODUCTION = TARGET === 'production';
export const ENV_FILE = IS_PRODUCTION ? '.env.production.local' : '.env.local';
export const ENV_PATH = fileURLToPath(new URL(`../../${ENV_FILE}`, import.meta.url));

/** Key/value pairs from the target's env file (empty values skipped). */
export function loadEnv() {
  if (!existsSync(ENV_PATH)) throw new Error(`${ENV_FILE} not found (target: ${TARGET}).`);
  return Object.fromEntries(
    readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/))
      .filter((m) => m && m[2].trim() !== '')
      .map((m) => [m[1], m[2].trim()]),
  );
}

/** One line saying which backend is in use, without any secret. */
export function announce(what) {
  const host = (() => { try { return new URL(loadEnv().VITE_SUPABASE_URL).host; } catch { return '?'; } })();
  console.log(`[${TARGET}] ${what} → ${host}`);
}
