import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');

export const CYCLE = '11111111-1111-4111-8111-111111111111';
export const GM = 900001;
export const MGR_A = 900002;
export const MGR_B = 900003;
export const EXT_MGR = 900017;
export const A_REPORT = 900030;
export const B_REPORT = 900040;

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const HR_UID = uid(1);
export const HR_LINKED_UID = uid(2);
export const HR_LINKED_EMPLOYEE = 900050;

/**
 * Stands in for the parts of Supabase the migrations depend on, including its permissive
 * default grants, so tests prove the migrations themselves close those doors.
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(root, 'supabase', 'migrations');
  for (const f of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  await db.exec(readFileSync(join(root, 'supabase', 'seed', 'fake_seed.sql'), 'utf8'));

  const managers = [GM, MGR_A, MGR_B, EXT_MGR];
  for (const m of managers) {
    await db.exec(`
      insert into auth.users (id) values ('${uid(m)}');
      insert into public.app_users (user_id, employee_id, role, display_name)
      values ('${uid(m)}', ${m}, 'manager', 'M${m}');
    `);
  }
  await db.exec(`
    insert into auth.users (id) values ('${HR_UID}'), ('${HR_LINKED_UID}');
    insert into public.app_users (user_id, employee_id, role, display_name) values
      ('${HR_UID}', null, 'hr', 'HR'),
      ('${HR_LINKED_UID}', ${HR_LINKED_EMPLOYEE}, 'hr', 'HR linked');
  `);
  return db;
}

export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Runs fn as a role and identity inside a transaction that is always rolled back. */
export async function as<R>(
  db: PGlite,
  who: { role: 'anon' | 'authenticated' | 'service_role'; uid?: string },
  fn: (q: Q) => Promise<R>,
): Promise<R> {
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who.uid ?? '']);
    await db.exec(`set local role ${who.role}`);
    const q: Q = async <T,>(sql: string, params?: unknown[]) => {
      const res = await db.query<T>(sql, params as never[]);
      return res.rows;
    };
    return await fn(q);
  } finally {
    await db.exec('rollback');
  }
}

export const asManager = <R,>(db: PGlite, employeeId: number, fn: (q: Q) => Promise<R>) =>
  as(db, { role: 'authenticated', uid: uid(employeeId) }, fn);
export const asHr = <R,>(db: PGlite, fn: (q: Q) => Promise<R>, id = HR_UID) =>
  as(db, { role: 'authenticated', uid: id }, fn);

/** Inserts a review directly (test setup runs as superuser, bypassing RLS). */
export async function seedReview(
  db: PGlite,
  employeeId: number,
  reviewerId: number,
  status: string,
  cycle = CYCLE,
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `insert into public.reviews (cycle_id, employee_id, reviewer_id, status, is_key_talent, performance_strengths)
     values ($1, $2, $3, $4, true, 'secret content') returning id`,
    [cycle, employeeId, reviewerId, status],
  );
  const id = res.rows[0].id;
  await db.query(`insert into public.next_roles (review_id, rank, role_title) values ($1, 1, 'Next')`, [id]);
  await db.query(`insert into public.successors (review_id, rank, successor_type) values ($1, 1, 'tbh')`, [id]);
  await db.query(`insert into public.dev_plan_items (review_id, area_idx, goal) values ($1, 1, 'Goal')`, [id]);
  await db.query(`insert into public.review_comments (review_id, body) values ($1, 'hr note')`, [id]);
  await db.query(
    `insert into public.review_versions (review_id, version, action, snapshot) values ($1, 1, 'save', '{}')`,
    [id],
  );
  return id;
}
