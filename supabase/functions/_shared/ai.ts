// Pure rules for the ai-generate function, shared with unit tests. No Deno or Node APIs here.

export const OUTPUT_TYPES = [
  'team_dev_suggestions', 'org_health_summary', 'succession_risk_brief', 'learning_map',
  'dev_theme_tagging', 'translate_en', 'hrbp_discussion_brief',
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export const isOutputType = (v: unknown): v is OutputType =>
  typeof v === 'string' && (OUTPUT_TYPES as readonly string[]).includes(v);

/** Managers may only request development suggestions for their own team (SPEC 10). */
export function isAllowed(role: 'manager' | 'hr', type: OutputType): boolean {
  return role === 'hr' || type === 'team_dev_suggestions';
}

export const needsTeamScope = (type: OutputType): boolean =>
  type === 'team_dev_suggestions' || type === 'hrbp_discussion_brief';

export const THEME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tags'],
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['employee_id', 'area_idx', 'theme'],
        properties: {
          employee_id: { type: 'integer' },
          area_idx: { type: 'integer' },
          theme: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface ThemeTagging {
  tags: { employee_id: number; area_idx: number; theme: string }[];
}

/** Checks parsed output and that it only tags people actually sent. */
export function parseThemeTagging(text: string, knownEmployeeIds: Set<number>): ThemeTagging | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const tags = (value as ThemeTagging | null)?.tags;
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    if (!Number.isInteger(t?.employee_id) || !Number.isInteger(t?.area_idx)) return null;
    if (typeof t?.theme !== 'string' || t.theme.trim() === '') return null;
    if (!knownEmployeeIds.has(t.employee_id)) return null;
  }
  return { tags };
}

export function languageInstruction(locale: string, bilingual: boolean): string {
  if (bilingual) return 'Write the full output in Traditional Chinese, then repeat it in English.';
  return locale === 'en' ? 'Write the output in English.' : 'Write the output in Traditional Chinese (zh-TW).';
}
