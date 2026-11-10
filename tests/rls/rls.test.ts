import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  A_REPORT, B_REPORT, CYCLE, EXT_MGR, GM, HR_LINKED_EMPLOYEE, HR_LINKED_UID, MGR_A, MGR_B, Q,
  as, asHr, asManager, createDb, seedReview, uid,
} from './harness';

const CHILD_TABLES = ['next_roles', 'successors', 'dev_plan_items'];

let db: PGlite;
let draftA: string; // A's direct report, draft
let draftB: string; // B's direct report, draft
let submittedA: string; // A's direct report, submitted
let returnedA: string; // A's direct report, returned
let aboutMgrA: string; // GM's review of manager A
let aboutHrLinked: string; // review of the employee who is also an HR user

const count = async (q: Q, sql: string, params?: unknown[]) =>
  Number((await q<{ n: number }>(`select count(*)::int as n from (${sql}) t`, params))[0].n);

beforeAll(async () => {
  db = await createDb();
  draftA = await seedReview(db, A_REPORT, MGR_A, 'draft');
  draftB = await seedReview(db, B_REPORT, MGR_B, 'draft');
  submittedA = await seedReview(db, A_REPORT + 1, MGR_A, 'submitted');
  returnedA = await seedReview(db, A_REPORT + 2, MGR_A, 'returned');
  aboutMgrA = await seedReview(db, MGR_A, GM, 'submitted');
  aboutHrLinked = await seedReview(db, HR_LINKED_EMPLOYEE, 900004, 'submitted');
});

afterAll(async () => {
  await db.close();
});

describe('baseline protection', () => {
  it('has RLS enabled on every public table', async () => {
    const res = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(16);
    expect(res.rows.filter((r) => !r.rowsecurity)).toEqual([]);
  });

  it('denies anonymous access to every table', async () => {
    const res = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    );
    for (const { tablename } of res.rows) {
      await expect(
        as(db, { role: 'anon' }, (q) => q(`select * from public.${tablename} limit 1`)),
        tablename,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('denies anonymous execution of scope functions', async () => {
    await expect(as(db, { role: 'anon' }, (q) => q(`select public.my_employee_id()`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('gives an authenticated user without an app_users row nothing', async () => {
    const stranger = uid(424242);
    await as(db, { role: 'authenticated', uid: stranger }, async (q) => {
      expect(await count(q, 'select * from public.reviews')).toBe(0);
      expect(await count(q, 'select * from public.employees')).toBe(0);
      expect(await count(q, 'select * from public.cycle_population')).toBe(0);
    });
  });

  it('never grants TRUNCATE to client roles', async () => {
    const res = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.role_table_grants
       where table_schema = 'public' and privilege_type = 'TRUNCATE'
         and grantee in ('anon', 'authenticated')`,
    );
    expect(res.rows[0].n).toBe(0);
  });
});

describe('scope', () => {
  it('computes direct scope from the snapshot', async () => {
    await asManager(db, GM, async (q) => {
      expect(await count(q, `select public.direct_scope($1)`, [CYCLE])).toBe(15);
    });
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select public.direct_scope($1)`, [CYCLE])).toBe(10);
    });
  });

  it('computes line scope below sub-managers and excludes direct reports', async () => {
    await asManager(db, GM, async (q) => {
      expect(await count(q, `select public.line_scope($1)`, [CYCLE])).toBe(10 + 10 + 10 + 9 + 9);
      const overlap = await q(
        `select public.line_scope($1) intersect select public.direct_scope($1)`, [CYCLE],
      );
      expect(overlap).toEqual([]);
    });
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select public.line_scope($1)`, [CYCLE])).toBe(0);
    });
  });

  it('stops at supervisor 0 and never climbs to external supervisors', async () => {
    await asManager(db, EXT_MGR, async (q) => {
      expect(await count(q, `select public.direct_scope($1)`, [CYCLE])).toBe(9);
      expect(await count(q, `select public.line_scope($1)`, [CYCLE])).toBe(0);
    });
  });

  it('terminates on a supervisor loop in the data', async () => {
    await db.exec('begin');
    try {
      await db.query(
        `update public.cycle_population set supervisor_id = $1 where cycle_id = $2 and employee_id = $3`,
        [A_REPORT, CYCLE, MGR_A],
      );
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid(MGR_A)]);
      await db.exec('set local role authenticated');
      const rows = await db.query<{ employee_id: number }>(`select employee_id::int from public.my_scope()`);
      expect(rows.rows.length).toBeGreaterThan(0);
      expect(rows.rows.map((r) => r.employee_id)).not.toContain(MGR_A);
    } finally {
      await db.exec('rollback');
    }
  });

  it('leaves out reports who are out of scope, including their reviews', async () => {
    const outOfScope = A_REPORT + 5;
    const reviewId = await seedReview(db, outOfScope, MGR_A, 'draft');
    await db.query(
      `update public.cycle_population set in_scope = false where cycle_id = $1 and employee_id = $2`,
      [CYCLE, outOfScope],
    );
    try {
      await asManager(db, MGR_A, async (q) => {
        expect(await count(q, `select public.direct_scope($1)`, [CYCLE])).toBe(9);
        expect(await count(q, `select * from public.reviews where id = $1`, [reviewId])).toBe(0);
      });
      await asManager(db, GM, async (q) => {
        expect(await count(q, `select public.line_scope($1)`, [CYCLE])).toBe(47);
      });
    } finally {
      await db.query(
        `update public.cycle_population set in_scope = true where cycle_id = $1 and employee_id = $2`,
        [CYCLE, outOfScope],
      );
      await db.query(`delete from public.reviews where id = $1`, [reviewId]);
    }
  });

  it('limits employees and population to the scope', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select * from public.cycle_population`)).toBe(10);
      expect(await count(q, `select * from public.employees where employee_id = $1`, [B_REPORT])).toBe(0);
      expect(await count(q, `select * from public.cycle_population where employee_id = $1`, [B_REPORT])).toBe(0);
    });
  });

  it('exposes only name, title and department in the directory', async () => {
    await asManager(db, MGR_A, async (q) => {
      const rows = await q<Record<string, unknown>>(
        `select * from public.employee_directory($1, '', 50)`, [CYCLE],
      );
      expect(rows.length).toBe(50);
      expect(Object.keys(rows[0]).sort()).toEqual(['dept', 'employee_id', 'full_name', 'local_name', 'position']);
    });
  });
});

describe('manager isolation', () => {
  it('reads own direct reviews and not those of another manager', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select * from public.reviews where id = $1`, [draftA])).toBe(1);
      expect(await count(q, `select * from public.reviews where id = $1`, [draftB])).toBe(0);
    });
  });

  it('cannot update another manager review', async () => {
    await asManager(db, MGR_A, async (q) => {
      const rows = await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [draftB]);
      expect(rows).toEqual([]);
    });
  });

  it('cannot create a review for another team', async () => {
    await expect(
      asManager(db, MGR_A, (q) =>
        q(`insert into public.reviews (cycle_id, employee_id, reviewer_id, status) values ($1, $2, $3, 'draft')`, [
          CYCLE, B_REPORT + 1, MGR_A,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('cannot forge reviewer_id on insert', async () => {
    await expect(
      asManager(db, MGR_A, (q) =>
        q(`insert into public.reviews (cycle_id, employee_id, reviewer_id, status) values ($1, $2, $3, 'draft')`, [
          CYCLE, A_REPORT + 3, MGR_B,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it.each(CHILD_TABLES)('isolates %s across teams', async (table) => {
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select * from public.${table} where review_id = $1`, [draftA])).toBe(1);
      expect(await count(q, `select * from public.${table} where review_id = $1`, [draftB])).toBe(0);
    });
  });

  it('cannot insert child rows into another team review', async () => {
    await expect(
      asManager(db, MGR_A, (q) =>
        q(`insert into public.next_roles (review_id, rank, role_title) values ($1, 2, 'x')`, [draftB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('nobody sees the review about themselves', () => {
  it('hides it from a sub-manager, parent and child tables alike', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select * from public.reviews where employee_id = $1`, [MGR_A])).toBe(0);
      expect(await count(q, `select * from public.reviews where id = $1`, [aboutMgrA])).toBe(0);
      for (const t of CHILD_TABLES) {
        expect(await count(q, `select * from public.${t} where review_id = $1`, [aboutMgrA]), t).toBe(0);
      }
    });
  });

  it('hides it from an HR user linked to that employee, while the rest stays visible', async () => {
    await asHr(db, async (q) => {
      expect(await count(q, `select * from public.reviews where id = $1`, [aboutHrLinked])).toBe(0);
      expect(await count(q, `select * from public.next_roles where review_id = $1`, [aboutHrLinked])).toBe(0);
      expect(await count(q, `select * from public.review_versions where review_id = $1`, [aboutHrLinked])).toBe(0);
      expect(await count(q, `select * from public.reviews where id = $1`, [draftA])).toBe(1);
    }, HR_LINKED_UID);
  });

  it('prevents that HR user from editing it', async () => {
    await asHr(db, async (q) => {
      const rows = await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [aboutHrLinked]);
      expect(rows).toEqual([]);
    }, HR_LINKED_UID);
  });
});

describe('line visibility', () => {
  it('shows submitted work to the upper manager and hides draft and returned', async () => {
    await asManager(db, GM, async (q) => {
      expect(await count(q, `select * from public.reviews where id = $1`, [submittedA])).toBe(1);
      expect(await count(q, `select * from public.reviews where id = $1`, [draftA])).toBe(0);
      expect(await count(q, `select * from public.reviews where id = $1`, [returnedA])).toBe(0);
    });
  });

  it.each(CHILD_TABLES)('applies the same draft rule to %s', async (table) => {
    await asManager(db, GM, async (q) => {
      expect(await count(q, `select * from public.${table} where review_id = $1`, [submittedA])).toBe(1);
      expect(await count(q, `select * from public.${table} where review_id = $1`, [draftA])).toBe(0);
    });
  });

  it('keeps line access read-only', async () => {
    await asManager(db, GM, async (q) => {
      expect(await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [submittedA])).toEqual([]);
      expect(await q(`delete from public.next_roles where review_id = $1 returning id`, [submittedA])).toEqual([]);
    });
  });

  it('keeps HR comments away from the upper manager', async () => {
    await asManager(db, GM, async (q) => {
      expect(await count(q, `select * from public.review_comments where review_id = $1`, [submittedA])).toBe(0);
    });
  });
});

describe('state machine and field protection', () => {
  it('lets a manager edit draft and returned', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.reviews set additional_comments = 'ok' where id = $1 returning id`, [draftA])).toHaveLength(1);
      expect(await q(`update public.reviews set additional_comments = 'ok' where id = $1 returning id`, [returnedA])).toHaveLength(1);
    });
  });

  it('blocks a manager from editing submitted work', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [submittedA])).toEqual([]);
    });
  });

  it('blocks a manager from submitting by direct update', async () => {
    await expect(
      asManager(db, MGR_A, (q) => q(`update public.reviews set status = 'submitted' where id = $1`, [draftA])),
    ).rejects.toThrow(/review_not_editable|row-level security/);
  });

  it('blocks a manager from jumping to confirmed', async () => {
    await expect(
      asManager(db, MGR_A, (q) => q(`update public.reviews set status = 'confirmed' where id = $1`, [draftA])),
    ).rejects.toThrow(/illegal_status_transition/);
  });

  it('blocks protected fields', async () => {
    await expect(
      asManager(db, MGR_A, (q) => q(`update public.reviews set version = 99 where id = $1`, [draftA])),
    ).rejects.toThrow(/protected_review_field/);
    await expect(
      asManager(db, MGR_A, (q) => q(`update public.reviews set submitted_at = now() where id = $1`, [draftA])),
    ).rejects.toThrow(/protected_review_field/);
  });

  it('rejects illegal transitions even for HR', async () => {
    await expect(
      asHr(db, (q) => q(`update public.reviews set status = 'locked' where id = $1`, [draftA])),
    ).rejects.toThrow(/illegal_status_transition/);
  });

  it('allows the legal HR path submitted to confirmed to locked to draft', async () => {
    await asHr(db, async (q) => {
      for (const s of ['confirmed', 'locked', 'draft']) {
        expect(await q(`update public.reviews set status = $1 where id = $2 returning id`, [s, submittedA])).toHaveLength(1);
      }
    });
  });

  it('rejects edits once the cycle is closed', async () => {
    await db.exec('begin');
    try {
      await db.query(`update public.cycles set status = 'closed' where id = $1`, [CYCLE]);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid(MGR_A)]);
      await db.exec('set local role authenticated');
      const res = await db.query(`update public.reviews set additional_comments = 'x' where id = $1 returning id`, [draftA]);
      expect(res.rows).toEqual([]);
    } finally {
      await db.exec('rollback');
    }
  });

  it('prevents managers from changing team status', async () => {
    await db.query(`insert into public.team_submissions (cycle_id, reviewer_id) values ($1, $2)`, [CYCLE, MGR_A]);
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.team_submissions set status = 'submitted' where reviewer_id = $1 returning reviewer_id`, [MGR_A])).toEqual([]);
    });
  });
});

describe('accounts and server-only data', () => {
  it('blocks role escalation', async () => {
    await expect(
      asManager(db, MGR_A, (q) => q(`update public.app_users set role = 'hr' where user_id = $1`, [uid(MGR_A)])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asManager(db, MGR_A, (q) => q(`update public.app_users set employee_id = $1 where user_id = $2`, [MGR_B, uid(MGR_A)])),
    ).rejects.toThrow(/permission denied/);
  });

  it('allows a user to change only their own preferences', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.app_users set locale = 'en' where user_id = $1 returning user_id`, [uid(MGR_A)])).toHaveLength(1);
      expect(await q(`update public.app_users set locale = 'en' where user_id = $1 returning user_id`, [uid(MGR_B)])).toEqual([]);
      expect(await count(q, `select * from public.app_users`)).toBe(1);
    });
  });

  it('shows login attempts to no client role', async () => {
    await expect(asManager(db, MGR_A, (q) => q(`select * from public.login_attempts`))).rejects.toThrow(/permission denied/);
    await expect(asHr(db, (q) => q(`select * from public.login_attempts`))).rejects.toThrow(/permission denied/);
  });

  it('limits audit log and version history to HR', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select * from public.audit_log`)).toBe(0);
      expect(await count(q, `select * from public.review_versions where review_id = $1`, [draftA])).toBe(0);
    });
    await expect(
      asManager(db, MGR_A, (q) => q(`insert into public.audit_log (action) values ('forged')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('lets a manager read HR comments on their own team', async () => {
    await asManager(db, MGR_A, async (q) => {
      expect(await count(q, `select * from public.review_comments where review_id = $1`, [draftA])).toBe(1);
      await expect(q(`insert into public.review_comments (review_id, body) values ($1, 'x')`, [draftA])).rejects.toThrow(/row-level security/);
    });
  });

  it('blocks managers from writing option lists and cycles', async () => {
    await expect(
      asManager(db, MGR_A, (q) => q(`insert into public.option_lists (list_key, value, label_zh, label_en) values ('a', 'b', 'c', 'd')`)),
    ).rejects.toThrow(/row-level security/);
    await asManager(db, MGR_A, async (q) => {
      expect(await q(`update public.cycles set status = 'closed' returning id`)).toEqual([]);
    });
  });
});

describe('HR access', () => {
  it('reads everything in the cycle', async () => {
    await asHr(db, async (q) => {
      expect(await count(q, `select * from public.cycle_population`)).toBe(122);
      expect(await count(q, `select * from public.reviews`)).toBeGreaterThanOrEqual(6);
      expect(await count(q, `select * from public.review_versions`)).toBeGreaterThanOrEqual(6);
    });
  });

  it('lists the expected reviewers', async () => {
    await asHr(db, async (q) => {
      expect(await count(q, `select * from public.expected_reviewers($1)`, [CYCLE])).toBe(11);
    });
    await expect(
      asManager(db, MGR_A, (q) => q(`select * from public.expected_reviewers($1)`, [CYCLE])),
    ).rejects.toThrow(/forbidden/);
  });
});

describe('namelist import', () => {
  const row = (employee_id: number, supervisor_id: number, in_scope = true) => ({
    employee_id, supervisor_id, in_scope, full_name: `Person ${employee_id}`, local_name: 'X',
    gender: 'F', start_date: '2020-01-01', supervisor_name_raw: 'S', dept: 'D', dept_no: '1', position: 'P',
  });
  const NEW_CYCLE = '22222222-2222-4222-8222-222222222222';
  const call = (q: Q, rows: unknown[], cycle = NEW_CYCLE) =>
    q(`select public.import_namelist($1, $2::jsonb) as r`, [cycle, JSON.stringify(rows)]);

  beforeAll(async () => {
    await db.query(`insert into public.cycles (id, code, quarter_label, status) values ($1, 'T', 'Q1 2027', 'open')`, [NEW_CYCLE]);
  });

  const expectReject = (rows: unknown[], pattern: RegExp) =>
    expect(asHr(db, (q) => call(q, rows))).rejects.toThrow(pattern);

  it('rejects non-HR callers', async () => {
    await expect(asManager(db, MGR_A, (q) => call(q, [row(1, 0, false)]))).rejects.toThrow(/forbidden/);
  });

  it('refuses any birth field and stores none', async () => {
    await expectReject([{ ...row(1, 0, false), birth_month: 5 }], /birth_month_rejected/);
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and column_name ilike '%birth%'`,
    );
    expect(cols.rows).toEqual([]);
  });

  it('rejects structural errors', async () => {
    await expectReject([row(1, 0, false), row(1, 0, false)], /duplicate_employee_id/);
    await expectReject([row(1, 1, false)], /self_supervisor|violates check/);
    await expectReject([row(1, 0, true)], /in_scope_without_supervisor/);
    await expectReject([row(1, 777)], /unknown_supervisor/);
    await expectReject([row(1, 2), row(2, 3), row(3, 1)], /supervisor_cycle/);
  });

  it('writes the snapshot and moves reviews to a new supervisor with an audit entry', async () => {
    await db.exec('begin');
    try {
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid(1)]);
      await db.exec('set local role authenticated');
      const first = await db.query<{ r: { rows: number } }>(
        `select public.import_namelist($1, $2::jsonb) as r`,
        [NEW_CYCLE, JSON.stringify([row(800001, 0, false), row(800002, 0, false), row(800003, 800001)])],
      );
      expect(first.rows[0].r.rows).toBe(3);

      await db.exec('reset role');
      await db.query(
        `insert into public.reviews (cycle_id, employee_id, reviewer_id, status) values ($1, 800003, 800001, 'draft')`,
        [NEW_CYCLE],
      );
      await db.exec('set local role authenticated');

      const second = await db.query<{ r: { reviews_transferred: number } }>(
        `select public.import_namelist($1, $2::jsonb) as r`,
        [NEW_CYCLE, JSON.stringify([row(800001, 0, false), row(800002, 0, false), row(800003, 800002)])],
      );
      expect(second.rows[0].r.reviews_transferred).toBe(1);

      const review = await db.query<{ reviewer_id: number }>(
        `select reviewer_id::int from public.reviews where employee_id = 800003`,
      );
      expect(review.rows[0].reviewer_id).toBe(800002);

      const audit = await db.query(`select * from public.audit_log where action = 'review_reassigned'`);
      expect(audit.rows).toHaveLength(1);
    } finally {
      await db.exec('rollback');
    }
  });

  it('takes people missing from a new upload out of scope but keeps them in history', async () => {
    await db.exec('begin');
    try {
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid(1)]);
      await db.exec('set local role authenticated');
      await db.query(`select public.import_namelist($1, $2::jsonb)`, [
        NEW_CYCLE, JSON.stringify([row(800001, 0, false), row(800003, 800001), row(800004, 800001)]),
      ]);
      const res = await db.query<{ r: { departed: number } }>(`select public.import_namelist($1, $2::jsonb) as r`, [
        NEW_CYCLE, JSON.stringify([row(800001, 0, false), row(800003, 800001)]),
      ]);
      expect(res.rows[0].r.departed).toBe(1);
      const left = await db.query<{ in_scope: boolean }>(
        `select in_scope from public.cycle_population where cycle_id = $1 and employee_id = 800004`, [NEW_CYCLE],
      );
      expect(left.rows[0].in_scope).toBe(false);
    } finally {
      await db.exec('rollback');
    }
  });
});
