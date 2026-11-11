// Scale test for the database layer (SPEC 8.4: 5,000 employees x several cycles stays smooth).
// PGlite runs Postgres compiled to WebAssembly, typically several times slower than the hosted
// database, so passing here leaves real headroom. Timings are written to test-results/stress-db.json.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { generateOrg, type MockOrg } from '../../src/lib/mock/orgGenerator';

const root = join(__dirname, '..', '..');
const SIZE = Number(process.env.STRESS_SIZE ?? 5000);
const CYCLES = ['c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003'];
const CURRENT = CYCLES[2];
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rid = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
const HR = uid(1);

const timings: Record<string, number> = {};
let db: PGlite;
let org: MockOrg;

async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const out = await fn();
  timings[name] = Math.round(performance.now() - t0);
  return out;
}

async function as<T>(who: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who]);
    await db.exec('set local role authenticated');
    return await fn();
  } finally {
    await db.exec('rollback');
  }
}

const insertJson = async (table: string, cols: string[], rows: unknown[]) => {
  for (let i = 0; i < rows.length; i += 2000) {
    await db.query(
      `insert into public.${table} (${cols.join(', ')}) select ${cols.join(', ')} from jsonb_populate_recordset(null::public.${table}, $1::jsonb)`,
      [JSON.stringify(rows.slice(i, i + 2000))],
    );
  }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  for (const f of readdirSync(join(root, 'supabase', 'migrations')).sort()) {
    await db.exec(readFileSync(join(root, 'supabase', 'migrations', f), 'utf8'));
  }
  org = generateOrg({ size: SIZE, seed: 99, cycleId: CURRENT, today: new Date('2026-11-11T00:00:00Z') });

  await db.query(`insert into auth.users (id) values ($1)`, [HR]);
  await db.query(`insert into public.app_users (user_id, employee_id, role, display_name) values ($1, null, 'hr', 'HR')`, [HR]);
  const accounts = org.reviewers.map((id) => ({ user_id: uid(id), employee_id: id, role: 'manager', display_name: `M${id}` }));
  await db.query(`insert into auth.users (id) select (x->>'user_id')::uuid from jsonb_array_elements($1::jsonb) x`, [JSON.stringify(accounts)]);
  await insertJson('app_users', ['user_id', 'employee_id', 'role', 'display_name'], accounts);
  for (const [i, c] of CYCLES.entries()) {
    await db.query(`insert into public.cycles (id, code, quarter_label, status) values ($1, $2, $3, $4)`, [c, `C${i}`, `Q${i + 2} 2026`, i === 2 ? 'open' : 'closed']);
  }
}, 600_000);

afterAll(() => {
  mkdirSync(join(root, 'test-results'), { recursive: true });
  writeFileSync(join(root, 'test-results', 'stress-db.json'), JSON.stringify({ size: SIZE, people: org?.people.length, reviews: org?.reviews.length, timings }, null, 2));
});

describe(`database at ${SIZE} employees x ${CYCLES.length} cycles`, () => {
  it('imports the namelist for each cycle through the HR function', async () => {
    const rows = org.people.map((p) => ({
      employee_id: p.employeeId, supervisor_id: p.supervisor, in_scope: p.supervisor !== 0, full_name: p.fullName, local_name: p.localName,
      gender: p.gender, start_date: p.startDate, supervisor_name_raw: '', dept: p.dept, dept_no: '100', position: p.position,
    }));
    for (const [i, c] of CYCLES.entries()) {
      const res = await timed(`import_namelist_cycle${i + 1}`, () => as(HR, async () => {
        const r = await db.query<{ r: unknown }>(`select public.import_namelist($1, $2::jsonb) as r`, [c, JSON.stringify(rows)]);
        await db.exec('commit');
        await db.exec('begin');
        return r;
      }));
      expect(res.rows).toHaveLength(1);
    }
    expect(timings.import_namelist_cycle1).toBeLessThan(60_000);
  }, 600_000);

  it('loads a full cycle of reviews', async () => {
    const reviews = org.reviews.map((r, i) => ({
      ...r, id: rid(i + 1), status: r.status, rev: r.rev, version: r.version,
      submitted_at: ['submitted', 'confirmed', 'locked', 'returned'].includes(r.status) ? r.updated_at : null,
    }));
    await timed('seed_reviews', async () => {
      await insertJson('reviews', ['id', 'cycle_id', 'employee_id', 'reviewer_id', 'is_key_talent', 'key_talent_reasons', 'key_talent_note',
        'status', 'retention_risk', 'retention_reasons', 'mobility_status', 'desired_locations', 'pbm_strengths', 'pbm_improvements',
        'performance_strengths', 'development_areas', 'personal_aspirations', 'aspirations_not_discussed', 'additional_comments',
        'is_critical_role', 'completed_steps', 'version', 'rev', 'submitted_at'], reviews);
      const children = <T,>(pick: (r: (typeof org.reviews)[number]) => T[]) =>
        org.reviews.flatMap((r, i) => pick(r).map((c) => ({ ...c, review_id: rid(i + 1) })));
      await insertJson('next_roles', ['review_id', 'rank', 'role_title', 'readiness'], children((r) => r.next_roles));
      await insertJson('successors', ['review_id', 'rank', 'successor_type', 'successor_employee_id', 'external_name', 'readiness'], children((r) => r.successors));
      await insertJson('dev_plan_items', ['review_id', 'area_idx', 'goal', 'dev_type', 'actions', 'support', 'owner', 'start_date', 'target_date', 'checkpoint', 'status', 'progress_notes'], children((r) => r.dev_plan));
      const teams = Object.entries(org.teams).map(([id, t]) => ({ ...t, cycle_id: CURRENT, reviewer_id: Number(id) }));
      await insertJson('team_submissions', ['cycle_id', 'reviewer_id', 'status', 'submitted_at', 'reopen_requested_at', 'reopen_reason', 'discussion_status', 'discussion_date'], teams);
    });
    const n = await db.query<{ n: number }>(`select count(*)::int n from public.reviews`);
    expect(n.rows[0].n).toBe(org.reviews.length);
  }, 600_000);

  it('HR reads every review of the cycle (dashboard query) quickly', async () => {
    const n = await timed('hr_dashboard_reviews', () => as(HR, () => db.query<{ n: number }>(
      `select count(*)::int n from public.reviews r where r.cycle_id = $1 and r.is_key_talent`, [CURRENT])));
    expect(n.rows[0].n).toBe(org.reviews.length);
    await timed('hr_dashboard_population', () => as(HR, () => db.query(
      `select p.employee_id, p.dept, p.supervisor_id, e.full_name from public.cycle_population p join public.employees e using (employee_id) where p.cycle_id = $1 and p.in_scope`, [CURRENT])));
    await timed('hr_team_overview', () => as(HR, () => db.query(`select * from public.hr_team_overview($1)`, [CURRENT])));
    await timed('plant_averages', () => as(HR, () => db.query(`select * from public.plant_averages($1)`, [CURRENT])));
    await timed('expected_reviewers', () => as(HR, () => db.query(`select * from public.expected_reviewers($1)`, [CURRENT])));
    expect(timings.hr_dashboard_reviews).toBeLessThan(5000);
    expect(timings.hr_team_overview).toBeLessThan(10_000);
  }, 120_000);

  it('the GM line scope (recursive, every cycle) stays fast and exact', async () => {
    const lineSize = org.people.filter((p) => p.supervisor !== 0 && p.supervisor !== org.gm).length;
    const line = await timed('gm_line_scope', () => as(uid(org.gm), () => db.query<{ n: number }>(
      `select count(*)::int n from public.line_scope($1)`, [CURRENT])));
    expect(line.rows[0].n).toBe(lineSize);
    const readable = await timed('gm_reviews_rls', () => as(uid(org.gm), () => db.query<{ n: number }>(
      `select count(*)::int n from public.reviews where cycle_id = $1`, [CURRENT])));
    const expected = org.reviews.filter((r) => r.reviewer_id === org.gm || (r.reviewer_id !== org.gm && ['submitted', 'confirmed', 'locked'].includes(r.status))).length;
    expect(readable.rows[0].n).toBe(expected);
    expect(timings.gm_line_scope).toBeLessThan(10_000);
    expect(timings.gm_reviews_rls).toBeLessThan(15_000);
  }, 120_000);

  it('a section manager sees only their own team, even among thousands of rows', async () => {
    const section = org.reviewers.find((id) => org.people.find((p) => p.employeeId === id)!.position.startsWith('Section'))!;
    const mine = org.reviews.filter((r) => r.reviewer_id === section).length;
    const res = await timed('section_reviews_rls', () => as(uid(section), () => db.query<{ n: number }>(
      `select count(*)::int n from public.reviews where cycle_id = $1`, [CURRENT])));
    expect(res.rows[0].n).toBe(mine);
    const dir = await timed('employee_directory_search', () => as(uid(section), () => db.query(
      `select * from public.employee_directory($1, 'Chen', 20)`, [CURRENT])));
    expect(dir.rows.length).toBeLessThanOrEqual(20);
    expect(timings.section_reviews_rls).toBeLessThan(5000);
  }, 120_000);

  it('autosave (save_review) stays fast with a large table', async () => {
    const draft = org.reviews.findIndex((r) => r.status === 'draft');
    const review = org.reviews[draft];
    const durations: number[] = [];
    await as(uid(review.reviewer_id), async () => {
      let rev = review.rev;
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now();
        const res = await db.query<{ rev: number }>(`select * from public.save_review($1, $2, $3::jsonb)`,
          [rid(draft + 1), rev, JSON.stringify({ additional_comments: `stress ${i}` })]);
        durations.push(performance.now() - t0);
        rev = res.rows[0].rev;
      }
    });
    durations.sort((a, b) => a - b);
    timings.save_review_p50 = Math.round(durations[10]);
    timings.save_review_p95 = Math.round(durations[18]);
    expect(timings.save_review_p95).toBeLessThan(2000);
  }, 120_000);
});
