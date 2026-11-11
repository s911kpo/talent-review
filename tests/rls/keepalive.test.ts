import { describe, expect, it } from 'vitest';
import { createDb, as } from './harness';

describe('keep_alive', () => {
  it('lets anonymous callers run it and returns only a timestamp', async () => {
    const db = await createDb();
    const rows = await as(db, { role: 'anon' }, (q) => q<{ keep_alive: unknown }>('select public.keep_alive()'));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).toEqual(['keep_alive']);
    expect(rows[0].keep_alive).toBeInstanceOf(Date);
  });

  it('does not open any table to anonymous callers', async () => {
    const db = await createDb();
    await expect(as(db, { role: 'anon' }, (q) => q('select * from public.cycles'))).rejects.toThrow(/permission denied/);
  });
});
