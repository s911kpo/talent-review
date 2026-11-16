// Backend values for the go-live test: .env.local (staging) or .env.production.local (TR_TARGET=production).
import { readFileSync } from 'node:fs';

const file = process.env.TR_TARGET === 'production' ? '.env.production.local' : '.env.local';
export const env: Record<string, string> = Object.fromEntries(
  readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m && m[2].trim() !== '')
    .map((m) => [m[1], m[2].trim()]),
);
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[k]) throw new Error(`${file} is missing ${k}`);
}
