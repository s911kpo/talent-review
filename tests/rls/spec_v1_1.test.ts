import { describe, expect, it } from 'vitest';
import { createDb } from './harness';
import options from '../../src/data/generated/options.json';

const OUR_VALUES = [
  'Integrity', 'Stewardship & Compliance', 'Principled Entrepreneurship', 'Transformation',
  'Knowledge', 'Humility', 'Respect', 'Self-Actualize',
];

describe('SPEC v1.1 PBM values', () => {
  it('the database has exactly the 8 Our Values as active pbm_principle options, in order', async () => {
    const db = await createDb();
    const res = await db.query<{ value: string }>(
      `select value from public.option_lists where list_key = 'pbm_principle' and is_active order by sort`,
    );
    expect(res.rows.map((r) => r.value)).toEqual(OUR_VALUES);
  });

  it('the demo data uses the same 8 values', () => {
    const pbm = (options as { list_key: string; value: string; sort: number }[])
      .filter((o) => o.list_key === 'pbm_principle').sort((a, b) => a.sort - b.sort);
    expect(pbm.map((o) => o.value)).toEqual(OUR_VALUES);
  });

  it('the PBM questions use the Our Values wording', async () => {
    const db = await createDb();
    const res = await db.query<{ question_zh: string; question_en: string }>(
      `select question_zh, question_en from public.question_bank where key in ('PBM_STRENGTHS', 'PBM_IMPROVE') order by step_order`,
    );
    expect(res.rows[0].question_zh).toContain('PBM 核心價值（Our Values）');
    expect(res.rows[0].question_en).toContain('PBM Values');
    expect(res.rows[1].question_zh).toContain('PBM 核心價值');
  });
});
