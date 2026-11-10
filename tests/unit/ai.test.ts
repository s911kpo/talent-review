import { describe, expect, it } from 'vitest';
import { OUTPUT_TYPES, isAllowed, isOutputType, languageInstruction, needsTeamScope, parseThemeTagging } from '../../supabase/functions/_shared/ai';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const known = new Set([1, 2]);

describe('permissions', () => {
  it('lets managers use only team development suggestions', () => {
    for (const type of OUTPUT_TYPES) {
      expect(isAllowed('manager', type), type).toBe(type === 'team_dev_suggestions');
      expect(isAllowed('hr', type), type).toBe(true);
    }
  });
  it('recognizes output types and which need a team', () => {
    expect(isOutputType('org_health_summary')).toBe(true);
    expect(isOutputType('other')).toBe(false);
    expect(needsTeamScope('hrbp_discussion_brief')).toBe(true);
    expect(needsTeamScope('org_health_summary')).toBe(false);
  });
});

describe('theme tagging validation', () => {
  it('accepts valid output', () => {
    expect(parseThemeTagging('{"tags":[{"employee_id":1,"area_idx":1,"theme":"Leadership"}]}', known)?.tags).toHaveLength(1);
  });
  it.each([
    ['not json', 'nope'],
    ['wrong shape', '{"x":1}'],
    ['non-integer id', '{"tags":[{"employee_id":"1","area_idx":1,"theme":"A"}]}'],
    ['blank theme', '{"tags":[{"employee_id":1,"area_idx":1,"theme":" "}]}'],
    ['unknown person', '{"tags":[{"employee_id":9,"area_idx":1,"theme":"A"}]}'],
  ])('rejects %s', (_n, text) => {
    expect(parseThemeTagging(text, known)).toBeNull();
  });
});

describe('prompts', () => {
  const dir = join(__dirname, '../../supabase/functions/ai-generate/prompts');

  it('has one for every output type, plus the common rules', () => {
    const files = readdirSync(dir);
    for (const type of OUTPUT_TYPES) expect(files, type).toContain(`${type}.md`);
    expect(files).toContain('_common.md');
  });

  it('forbids forced distribution in the common rules', () => {
    expect(readFileSync(join(dir, '_common.md'), 'utf8')).toMatch(/forced distribution/i);
  });

  it('chooses the output language', () => {
    expect(languageInstruction('en', false)).toMatch(/English/);
    expect(languageInstruction('zh-TW', false)).toMatch(/Traditional Chinese/);
    expect(languageInstruction('en', true)).toMatch(/then repeat/);
  });
});
