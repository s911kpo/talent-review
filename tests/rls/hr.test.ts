import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { A_REPORT, CYCLE, GM, MGR_A, Q, asHr, asManager, createDb, seedReview } from './harness';

let db: PGlite;
let r1: string;
let r2: string;

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec(`delete from public.reviews; delete from public.team_submissions; delete from public.audit_log;`);
  r1 = await seedReview(db, A_REPORT, MGR_A, 'submitted');
  r2 = await seedReview(db, A_REPORT + 1, MGR_A, 'submitted');
  await db.query(`insert into public.team_submissions (cycle_id, reviewer_id, status) values ($1, $2, 'submitted')`, [CYCLE, MGR_A]);
});

const statuses = async () => {
  const res = await db.query<{ id: string; status: string }>(`select id, status from public.reviews`);
  return Object.fromEntries(res.rows.map((r) => [r.id, r.status]));
};
const teamStatus = async () =>
  (await db.query<{ status: string }>(`select status from public.team_submissions where reviewer_id = $1`, [MGR_A])).rows[0].status;

/** HR actions run and commit here, since the point is the state they leave behind. */
async function hr(sql: string, params: unknown[]) {
  await db.query(`select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false)`);
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params as never[]);
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const returnOne = (id: string, comment = 'Please add evidence') =>
  hr(`select public.hr_return_reviews($1, $2, $3::jsonb)`, [CYCLE, MGR_A, JSON.stringify([{ review_id: id, comment }])]);
const confirm = () => hr(`select public.hr_confirm_team($1, $2)`, [CYCLE, MGR_A]);
const lock = () => hr(`select public.hr_lock_team($1, $2)`, [CYCLE, MGR_A]);

describe('return', () => {
  it('returns only the named person and leaves the rest submitted', async () => {
    await returnOne(r1);
    const s = await statuses();
    expect(s[r1]).toBe('returned');
    expect(s[r2]).toBe('submitted');
    expect(await teamStatus()).toBe('returned');
  });

  it('shows the comment to the manager, who can edit only the returned person', async () => {
    await returnOne(r1, 'Add detail');
    await asManager(db, MGR_A, async (q) => {
      const comments = await q<{ body: string }>(`select body from public.review_comments where review_id = $1 and body = 'Add detail'`, [r1]);
      expect(comments).toHaveLength(1);
      expect(await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [r1])).toHaveLength(1);
      expect(await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [r2])).toEqual([]);
    });
  });

  it('requires a comment', async () => {
    await expect(returnOne(r1, '  ')).rejects.toThrow(/comment_required/);
  });

  it('writes a version and an audit entry', async () => {
    await returnOne(r1);
    const v = await db.query(`select * from public.review_versions where review_id = $1 and action = 'return'`, [r1]);
    expect(v.rows).toHaveLength(1);
    const a = await db.query(`select * from public.audit_log where action = 'reviews_returned'`);
    expect(a.rows).toHaveLength(1);
  });

  it('cannot return work that is not submitted', async () => {
    await returnOne(r1);
    await expect(returnOne(r1)).rejects.toThrow(/review_not_returnable/);
  });
});

describe('confirm and lock', () => {
  it('moves the team through confirmed and locked', async () => {
    await confirm();
    expect(await teamStatus()).toBe('confirmed');
    expect((await statuses())[r1]).toBe('confirmed');
    await lock();
    expect(await teamStatus()).toBe('locked');
    expect((await statuses())[r2]).toBe('locked');
  });

  it('refuses to lock before confirming, or confirm with a person out for changes', async () => {
    await expect(lock()).rejects.toThrow(/team_not_confirmed/);
    await returnOne(r1);
    await expect(confirm()).rejects.toThrow(/team_not_submitted/);
  });

  it('unlocks to confirmed or draft and rejects anything else', async () => {
    await confirm();
    await lock();
    await expect(hr(`select public.hr_unlock_team($1, $2, 'submitted')`, [CYCLE, MGR_A])).rejects.toThrow(/invalid_target/);
    await hr(`select public.hr_unlock_team($1, $2, 'confirmed')`, [CYCLE, MGR_A]);
    expect(await teamStatus()).toBe('confirmed');
  });

  it('lets the manager edit again after unlock to draft', async () => {
    await confirm();
    await lock();
    await hr(`select public.hr_unlock_team($1, $2, 'draft')`, [CYCLE, MGR_A]);
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [r1])).toHaveLength(1);
    });
  });

  it('keeps locked work closed to managers', async () => {
    await confirm();
    await lock();
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [r1])).toEqual([]);
    });
  });
});

describe('reopen requests', () => {
  const request = () => asReopen();
  async function asReopen() {
    await db.query(`update public.team_submissions set reopen_requested_at = now(), reopen_reason = 'Update' where reviewer_id = $1`, [MGR_A]);
  }

  it('reopens only the named people', async () => {
    await request();
    await hr(`select public.hr_decide_reopen($1, $2, true, $3)`, [CYCLE, MGR_A, [A_REPORT]]);
    const s = await statuses();
    expect(s[r1]).toBe('draft');
    expect(s[r2]).toBe('submitted');
    expect(await teamStatus()).toBe('draft');
  });

  it('reopens the whole team when no one is named', async () => {
    await request();
    await hr(`select public.hr_decide_reopen($1, $2, true, null)`, [CYCLE, MGR_A]);
    const s = await statuses();
    expect([s[r1], s[r2]]).toEqual(['draft', 'draft']);
  });

  it('clears a rejected request without changing work', async () => {
    await request();
    await hr(`select public.hr_decide_reopen($1, $2, false, null)`, [CYCLE, MGR_A]);
    expect((await statuses())[r1]).toBe('submitted');
    const t = await db.query<{ reopen_requested_at: string | null }>(`select reopen_requested_at from public.team_submissions where reviewer_id = $1`, [MGR_A]);
    expect(t.rows[0].reopen_requested_at).toBeNull();
  });

  it('needs an open request', async () => {
    await expect(hr(`select public.hr_decide_reopen($1, $2, true, null)`, [CYCLE, MGR_A])).rejects.toThrow(/no_reopen_request/);
  });
});

describe('access', () => {
  it.each([
    ['hr_team_overview', `select * from public.hr_team_overview($1)`, [CYCLE]],
    ['hr_confirm_team', `select public.hr_confirm_team($1, ${MGR_A})`, [CYCLE]],
    ['hr_lock_team', `select public.hr_lock_team($1, ${MGR_A})`, [CYCLE]],
    ['hr_unlock_team', `select public.hr_unlock_team($1, ${MGR_A}, 'draft')`, [CYCLE]],
    ['hr_decide_reopen', `select public.hr_decide_reopen($1, ${MGR_A}, true, null)`, [CYCLE]],
    ['hr_return_reviews', `select public.hr_return_reviews($1, ${MGR_A}, '[]'::jsonb)`, [CYCLE]],
  ])('refuses %s for managers', async (_n, sql, params) => {
    await expect(asManager(db, GM, (q) => q(sql, params))).rejects.toThrow(/forbidden/);
  });

  it('keeps internal writers away from clients', async () => {
    await expect(asHr(db, (q) => q(`select public.record_audit('a', 'b', 'c', '{}')`))).rejects.toThrow(/permission denied/);
  });

  it('gives managers site averages as numbers only, from submitted work', async () => {
    await db.query(`update public.reviews set retention_risk = 'High' where id = $1`, [r1]);
    await seedReview(db, A_REPORT + 2, MGR_A, 'draft');
    await asManager(db, GM, async (q) => {
      const rows = await q<Record<string, unknown>>(`select * from public.plant_averages($1)`, [CYCLE]);
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0]).sort()).toEqual(['coverage_pct', 'key_pct', 'med_high_pct', 'not_discussed_pct', 'plan_complete_pct']);
      expect(Number(rows[0].med_high_pct)).toBe(50); // the draft is not counted: 1 of 2 submitted
      expect(Number(rows[0].key_pct)).toBeCloseTo((2 / 108) * 100);
    });
  });

  it('reports team progress to HR', async () => {
    await asHr(db, async (q: Q) => {
      const rows = await q<{ reviewer_id: number; direct_count: number; status: string }>(
        `select reviewer_id::int, direct_count::int, status from public.hr_team_overview($1)`, [CYCLE],
      );
      expect(rows).toHaveLength(11);
      expect(rows.find((r) => r.reviewer_id === MGR_A)).toEqual({ reviewer_id: MGR_A, direct_count: 10, status: 'submitted' });
    });
  });
});
