// Runs a command with .env.local loaded into its environment, without printing any value.
// Usage: node scripts/with-env.mjs <command> [args...]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const env = { ...process.env };
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && m[2].trim() !== '') env[m[1]] = m[2].trim();
}
const [cmd, ...args] = process.argv.slice(2);
const result = spawnSync(cmd, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
