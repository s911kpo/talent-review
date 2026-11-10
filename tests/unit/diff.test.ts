import { describe, expect, it } from 'vitest';
import { diffSnapshots } from '../../src/lib/review/diff';

describe('snapshot comparison', () => {
  it('reports only fields whose content changed', () => {
    const changes = diffSnapshots(
      { performance_strengths: 'a', retention_risk: 'Low', version: 1, updated_at: 'x' },
      { performance_strengths: 'b', retention_risk: 'Low', version: 2, updated_at: 'y' },
    );
    expect(changes).toEqual([{ field: 'performance_strengths', before: 'a', after: 'b' }]);
  });

  it('ignores key order and row metadata in nested rows', () => {
    expect(diffSnapshots(
      { next_roles: [{ id: '1', rank: 1, role_title: 'A', updated_at: 'x' }] },
      { next_roles: [{ role_title: 'A', rank: 1, id: '2', updated_at: 'y' }] },
    )).toEqual([]);
  });

  it('detects nested changes and treats missing as empty', () => {
    expect(diffSnapshots({ successors: [{ rank: 1 }] }, { successors: [{ rank: 2 }] })).toHaveLength(1);
    expect(diffSnapshots({ additional_comments: null }, {})).toEqual([]);
  });
});
