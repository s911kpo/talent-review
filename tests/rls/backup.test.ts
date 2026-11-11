import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES, buildRestoreSql } from '../../scripts/lib/backup-format.mjs';
import { CYCLE, MGR_A, A_REPORT, createDb, uid } from './harness';

const root = join(__dirname, '..', '..');

/** Reads every table the way PostgREST returns it: a JSON array of rows, ordered by key. */
async function dump(db: PGlite) {
  const out: Record<string, unknown[]> = {};
  for (const { name, key } of TABLES) {
    const res = await db.query<{ rows: unknown[] }>(
      `select coalesce(jsonb_agg(to_jsonb(t) order by ${key.map((k) => `t.${k}`).join(', ')}), '[]') as rows from public.${name} t`,
    );
    out[name] = res.rows[0].rows;
  }
  return out;
}

async function emptyDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  for (const f of readdirSync(join(root, 'supabase', 'migrations')).sort()) {
    await db.exec(readFileSync(join(root, 'supabase', 'migrations', f), 'utf8'));
  }
  return db;
}

describe('backup and restore', () => {
  it('restores every table exactly, including workflow state and history', async () => {
    const source = await createDb();
    // Put real workflow activity in: a selected person, a snapshot and a submitted team.
    // Committed on purpose (the harness helper always rolls back).
    await source.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid(MGR_A)]);
    await source.exec('set role authenticated');
    await source.query(`select public.set_key_talent($1, $2, true, array['Successor Candidate'], null)`, [CYCLE, A_REPORT]);
    await source.query(`select public.snapshot_review(id) from public.reviews where employee_id = $1`, [A_REPORT]);
    await source.exec('reset role');
    await source.exec(`insert into public.audit_log (action, detail) values ('test', '{"n": 1}'::jsonb)`);
    const before = await dump(source);
    expect(before.reviews.length).toBeGreaterThan(0);
    expect(before.employees.length).toBeGreaterThan(100);
    expect(before.audit_log.length).toBeGreaterThan(0);

    const target = await emptyDb();
    // Accounts only come back for sign-in users that exist in the target project.
    const users = (before.app_users as { user_id: string }[]).map((u) => `('${u.user_id}')`).join(', ');
    await target.exec(`insert into auth.users (id) values ${users}`);
    await target.exec(buildRestoreSql(before));

    expect(await dump(target)).toEqual(before);
  });

  it('skips accounts whose sign-in user no longer exists', async () => {
    const source = await createDb();
    const data = await dump(source);
    const target = await emptyDb();
    await target.exec(buildRestoreSql(data));
    const after = await dump(target);
    expect(after.app_users).toEqual([]);
    expect(after.employees).toEqual(data.employees);
  });

  it('refuses a backup with a missing table', () => {
    expect(() => buildRestoreSql({ app_users: [] })).toThrow(/missing table/);
  });
});
