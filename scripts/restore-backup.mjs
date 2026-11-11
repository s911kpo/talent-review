// Turns one backup version into a restore SQL file. It does not touch the database by itself:
// review the file, then run it in the Supabase SQL Editor (it replaces all business data).
// Usage: node scripts/restore-backup.mjs [--dir <backup folder>] [--at <tag or commit>]
//   --at defaults to the latest backup. List versions with: git -C <backup folder> tag
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES, buildRestoreSql } from './lib/backup-format.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dir = opt('--dir', 'C:\\dev\\talent-review-backups');
const at = opt('--at', 'HEAD');

const show = (path) => execFileSync('git', ['-C', dir, 'show', `${at}:${path}`], { encoding: 'utf8', maxBuffer: 1 << 30 });
const data = Object.fromEntries(TABLES.map((t) => [t.name, JSON.parse(show(`data/${t.name}.json`))]));
const manifest = JSON.parse(show('manifest.json'));

const outDir = join(dir, 'restore');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `restore-${manifest.taken_at.slice(0, 10)}.sql`);
writeFileSync(out, buildRestoreSql(data));
console.log(`Restore SQL for the backup taken ${manifest.taken_at} written to ${out}`);
console.log('Accounts are restored only for sign-in users that still exist; others need new PINs from HR.');
