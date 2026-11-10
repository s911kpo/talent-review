import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { A_REPORT, B_REPORT, CYCLE, GM, MGR_A, MGR_B, asHr, asManager, createDb, seedReview, Q } from './harness';
import { emptyReview, missingSteps, STEP_KEYS } from '../../src/lib/review/steps';
import type { Review } from '../../src/lib/review/types';

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(`delete from public.reviews; delete from public.team_submissions;`);
});

const selectKey = (q: Q, employee: number, selected = true) =>
  q<{ id: string }>(`select public.set_key_talent($1, $2, $3, $4, null) as id`, [CYCLE, employee, selected, ['Successor Candidate']]);

const FULL_FIELDS = {
  is_critical_role: true,
  performance_strengths: 'Strong',
  pbm_strengths: [{ principle: 'Integrity', evidence: 'Example' }],
  pbm_improvements: [{ principle: 'Humility', evidence: 'Example' }],
  development_areas: [{ idx: 1, text: 'Lead projects' }],
  personal_aspirations: 'Expert',
  retention_risk: 'Low',
  retention_reasons: [],
  mobility_status: 'Not Now',
};
const FULL_ROLES = [{ rank: 1, role_title: 'Sr. Engineer', readiness: '1-2 years' }];
const FULL_SUCCESSORS = [{ rank: 1, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null }];
const FULL_PLAN = [{
  area_idx: 1, goal: 'Lead one project', dev_type: 'Experience (70%)', actions: 'a\nb', support: '', owner: 'Employee',
  start_date: '2026-12-01', target_date: '2027-06-30', checkpoint: 'Reviewed at midyear', status: 'Not Started', progress_notes: '',
}];

const save = (q: Q, id: string, rev: number, fields: unknown, roles: unknown = null, succ: unknown = null, plan: unknown = null) =>
  q<{ rev: number }>(`select * from public.save_review($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)`, [
    id, rev, JSON.stringify(fields),
    roles === null ? null : JSON.stringify(roles),
    succ === null ? null : JSON.stringify(succ),
    plan === null ? null : JSON.stringify(plan),
  ]);

async function fillComplete(q: Q, employee: number) {
  const [{ id }] = await selectKey(q, employee);
  const [{ rev }] = await q<{ rev: number }>(`select rev from public.reviews where id = $1`, [id]);
  await save(q, id, rev, FULL_FIELDS, FULL_ROLES, FULL_SUCCESSORS, FULL_PLAN);
  return id;
}

describe('key talent selection', () => {
  it('creates a draft for a direct report', async () => {
    await asManager(db, MGR_A, async (q) => {
      const [{ id }] = await selectKey(q, A_REPORT);
      const [row] = await q<{ status: string; reviewer_id: number }>(
        `select status, reviewer_id::int from public.reviews where id = $1`, [id],
      );
      expect(row).toEqual({ status: 'draft', reviewer_id: MGR_A });
    });
  });

  it('keeps content when deselected, then restores it', async () => {
    await asManager(db, MGR_A, async (q) => {
      const id = await fillComplete(q, A_REPORT);
      await selectKey(q, A_REPORT, false);
      const [off] = await q<{ status: string; performance_strengths: string }>(
        `select status, performance_strengths from public.reviews where id = $1`, [id],
      );
      expect(off).toEqual({ status: 'not_selected', performance_strengths: 'Strong' });
      await selectKey(q, A_REPORT, true);
      const [on] = await q<{ status: string }>(`select status from public.reviews where id = $1`, [id]);
      expect(on.status).toBe('draft');
    });
  });

  it('is refused for someone on another team', async () => {
    await expect(asManager(db, MGR_A, (q) => selectKey(q, B_REPORT))).rejects.toThrow(/row-level security/);
  });
});

describe('optimistic saving', () => {
  it('advances rev on each save and rejects a stale writer', async () => {
    await asManager(db, MGR_A, async (q) => {
      const [{ id }] = await selectKey(q, A_REPORT);
      const [{ rev }] = await q<{ rev: number }>(`select rev from public.reviews where id = $1`, [id]);
      const [first] = await save(q, id, rev, { performance_strengths: 'one' });
      expect(first.rev).toBe(rev + 1);
      await expect(save(q, id, rev, { performance_strengths: 'stale' })).rejects.toThrow(/version_conflict/);
    });
  });

  it('ignores fields outside the allowed list', async () => {
    await asManager(db, MGR_A, async (q) => {
      const [{ id }] = await selectKey(q, A_REPORT);
      await save(q, id, 0 + (await q<{ rev: number }>(`select rev from public.reviews where id = $1`, [id]))[0].rev, {
        status: 'confirmed', reviewer_id: MGR_B, version: 99,
      });
      const [row] = await q<{ status: string; reviewer_id: number; version: number }>(
        `select status, reviewer_id::int, version from public.reviews where id = $1`, [id],
      );
      expect(row).toEqual({ status: 'draft', reviewer_id: MGR_A, version: 1 });
    });
  });

  it('refuses another manager and submitted work', async () => {
    const other = await seedReview(db, B_REPORT, MGR_B, 'draft');
    const submitted = await seedReview(db, A_REPORT + 1, MGR_A, 'submitted');
    await expect(asManager(db, MGR_A, (q) => save(q, other, 0, {}))).rejects.toThrow(/review_not_editable/);
    await expect(asManager(db, MGR_A, (q) => save(q, submitted, 0, {}))).rejects.toThrow(/review_not_editable/);
  });

  it('replaces child rows and keeps them isolated', async () => {
    await asManager(db, MGR_A, async (q) => {
      const id = await fillComplete(q, A_REPORT);
      const rows = await q(`select * from public.next_roles where review_id = $1`, [id]);
      expect(rows).toHaveLength(1);
    });
  });

  it('records a version snapshot on leaving an employee', async () => {
    await asManager(db, MGR_A, async (q) => {
      const id = await fillComplete(q, A_REPORT);
      const [{ v }] = await q<{ v: number }>(`select public.snapshot_review($1) as v`, [id]);
      expect(v).toBe(2);
    });
  });
});

describe('team submission', () => {
  it('blocks submission while a review is incomplete', async () => {
    await expect(
      asManager(db, MGR_A, async (q) => {
        await selectKey(q, A_REPORT);
        return q(`select public.submit_team($1)`, [CYCLE]);
      }),
    ).rejects.toThrow(/incomplete_reviews/);
  });

  it('requires a reason when no one is selected', async () => {
    await expect(asManager(db, MGR_A, (q) => q(`select public.submit_team($1)`, [CYCLE]))).rejects.toThrow(/no_key_talent_reason_required/);
    await asManager(db, MGR_A, async (q) => {
      await q(`select public.set_no_key_talent($1, 'All new hires')`, [CYCLE]);
      const [{ n }] = await q<{ n: number }>(`select public.submit_team($1) as n`, [CYCLE]);
      expect(n).toBe(0);
    });
  });

  it('submits a complete team, freezes it, and shows it to the upper manager', async () => {
    await asManager(db, MGR_A, async (q) => {
      const id = await fillComplete(q, A_REPORT);
      await q(`select public.submit_team($1)`, [CYCLE]);
      const [row] = await q<{ status: string; version: number }>(`select status, version from public.reviews where id = $1`, [id]);
      expect(row).toEqual({ status: 'submitted', version: 2 });
      await expect(q(`select public.submit_team($1)`, [CYCLE])).rejects.toThrow(/team_not_editable/);
    });
  });

  it('becomes visible to the upper manager only after commit of submit', async () => {
    const id = await seedReview(db, A_REPORT, MGR_A, 'draft');
    await asManager(db, GM, async (q) => {
      expect(await q(`select id from public.reviews where id = $1`, [id])).toEqual([]);
    });
    await db.query(`update public.reviews set status = 'submitted' where id = $1`, [id]);
    await asManager(db, GM, async (q) => {
      expect(await q(`select id from public.reviews where id = $1`, [id])).toHaveLength(1);
    });
  });

  it('accepts a reopen request only after submission and requires a reason', async () => {
    await db.query(`insert into public.team_submissions (cycle_id, reviewer_id, status) values ($1, $2, 'draft')`, [CYCLE, MGR_A]);
    await expect(asManager(db, MGR_A, (q) => q(`select public.request_reopen($1, 'x')`, [CYCLE]))).rejects.toThrow(/team_not_submitted/);
    await db.query(`update public.team_submissions set status = 'submitted' where reviewer_id = $1`, [MGR_A]);
    await expect(asManager(db, MGR_A, (q) => q(`select public.request_reopen($1, '  ')`, [CYCLE]))).rejects.toThrow(/reason_required/);
    await asManager(db, MGR_A, (q) => q(`select public.request_reopen($1, 'Need to update')`, [CYCLE]));
  });

  it('reports line status to the upper manager only', async () => {
    await asManager(db, GM, async (q) => {
      const rows = await q<{ reviewer_id: number }>(`select reviewer_id::int from public.line_team_status($1)`, [CYCLE]);
      expect(rows).toHaveLength(5);
    });
    await asManager(db, MGR_B, async (q) => {
      expect(await q(`select * from public.line_team_status($1)`, [CYCLE])).toEqual([]);
    });
  });

  it('keeps internal helpers away from clients', async () => {
    await expect(asManager(db, MGR_A, (q) => q(`select public.review_missing_steps(gen_random_uuid())`))).rejects.toThrow(/permission denied/);
    await expect(asHr(db, (q) => q(`select public.review_snapshot_json(gen_random_uuid())`))).rejects.toThrow(/permission denied/);
  });
});

describe('completeness rules agree between database and app', () => {
  const base = (id: string, fields: Partial<Review>): Review => ({
    ...emptyReview({ id, cycle_id: CYCLE, employee_id: A_REPORT, reviewer_id: MGR_A }), ...fields,
  });

  const cases: Array<[string, Partial<Review>]> = [
    ['empty', {}],
    ['complete', {
      ...FULL_FIELDS, next_roles: FULL_ROLES, successors: FULL_SUCCESSORS as Review['successors'], dev_plan: FULL_PLAN,
    }],
    ['medium risk without reasons', { retention_risk: 'Medium' }],
    ['medium risk with reasons', { retention_risk: 'Medium', retention_reasons: ['Career Move'] }],
    ['not discussed checked', { aspirations_not_discussed: true }],
    ['blank evidence', { pbm_strengths: [{ principle: 'Integrity', evidence: '  ' }] }],
    ['area without plan', { development_areas: [{ idx: 1, text: 'x' }] }],
    ['internal successor without readiness', {
      successors: [{ rank: 1, successor_type: 'internal', successor_employee_id: B_REPORT, external_name: null, readiness: null }],
    }],
    ['external successor complete', {
      successors: [{ rank: 1, successor_type: 'external', successor_employee_id: null, external_name: 'A', readiness: 'Ready Now' }],
    }],
  ];

  it.each(cases)('%s', async (_name, fields) => {
    const review = base('x', fields);
    await db.exec('begin');
    try {
      const res = await db.query<{ id: string }>(
        `insert into public.reviews (cycle_id, employee_id, reviewer_id, status, is_critical_role, performance_strengths,
           pbm_strengths, pbm_improvements, development_areas, personal_aspirations, aspirations_not_discussed,
           retention_risk, retention_reasons, mobility_status)
         values ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
        [CYCLE, A_REPORT + 9, MGR_A, review.is_critical_role, review.performance_strengths,
          JSON.stringify(review.pbm_strengths), JSON.stringify(review.pbm_improvements), JSON.stringify(review.development_areas),
          review.personal_aspirations, review.aspirations_not_discussed, review.retention_risk, review.retention_reasons, review.mobility_status],
      );
      const id = res.rows[0].id;
      for (const n of review.next_roles) {
        await db.query(`insert into public.next_roles (review_id, rank, role_title, readiness) values ($1, $2, $3, $4)`, [id, n.rank, n.role_title, n.readiness]);
      }
      for (const s of review.successors) {
        await db.query(
          `insert into public.successors (review_id, rank, successor_type, successor_employee_id, external_name, readiness) values ($1, $2, $3, $4, $5, $6)`,
          [id, s.rank, s.successor_type, s.successor_employee_id, s.external_name, s.readiness],
        );
      }
      for (const p of review.dev_plan) {
        await db.query(
          `insert into public.dev_plan_items (review_id, area_idx, goal, dev_type, actions, owner, start_date, target_date, checkpoint) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, p.area_idx, p.goal, p.dev_type, p.actions, p.owner, p.start_date, p.target_date, p.checkpoint],
        );
      }
      const sql = await db.query<{ m: string[] }>(`select public.review_missing_steps($1) as m`, [id]);
      const inOrder = (list: string[]) => STEP_KEYS.filter((k) => list.includes(k));
      expect(inOrder(sql.rows[0].m)).toEqual(inOrder(missingSteps(review)));
    } finally {
      await db.exec('rollback');
    }
  });
});
