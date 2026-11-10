// Parses docs/GUIDANCE_BANK.md into a question_bank migration and JSON for the local demo mode.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'docs/GUIDANCE_BANK.md'), 'utf8').replace(/\r\n/g, '\n');

// SPEC 6.4 step table. `section` is a letter translated by the UI.
const META = {
  KT_SELECT: { step_order: 0, section: null, field_ref: null, input_type: 'key_talent', list_key: 'key_talent_reason', required: true },
  CRITICAL_ROLE: { step_order: 1, section: 'A', field_ref: 'S', input_type: 'yes_no', required: true },
  PERF_STRENGTHS: { step_order: 2, section: 'A', field_ref: 'O', input_type: 'textarea', required: true },
  PBM_STRENGTHS: { step_order: 3, section: 'B', field_ref: 'M', input_type: 'pbm', list_key: 'pbm_principle', required: true },
  PBM_IMPROVE: { step_order: 4, section: 'B', field_ref: 'N', input_type: 'pbm', list_key: 'pbm_principle', required: true },
  DEV_AREAS: { step_order: 5, section: 'C', field_ref: 'P', input_type: 'dev_areas', required: true },
  ASPIRATIONS: { step_order: 6, section: 'C', field_ref: 'Q', input_type: 'aspirations', required: true },
  NEXT_ROLES: { step_order: 7, section: 'C', field_ref: 'I/J', input_type: 'next_roles', list_key: 'readiness', required: true },
  MOBILITY: { step_order: 8, section: 'C', field_ref: 'G/H', input_type: 'mobility', list_key: 'mobility', required: true },
  RETENTION: { step_order: 9, section: 'D', field_ref: 'E/F', input_type: 'retention', list_key: 'retention_risk', required: true },
  SUCCESSORS: { step_order: 10, section: 'D', field_ref: 'K/L', input_type: 'successors', list_key: 'readiness', required: true },
  DEV_PLAN: { step_order: 11, section: 'E', field_ref: 'Development Plan', input_type: 'dev_plan', list_key: 'dev_type', required: true },
  COMMENTS: { step_order: 12, section: 'F', field_ref: 'R', input_type: 'textarea', required: false },
  SUBMIT_HRBP: { step_order: 99, section: null, field_ref: null, input_type: 'info', required: false },
};

const FIELD_BY_HEADING = [
  [/^題目/, 'question'], [/^一行提示/, 'hint'], [/^燈泡/, 'guide'], [/^好範例/, 'good_example'],
  [/^弱範例/, 'weak_example'], [/^常見陷阱/, 'pitfalls'], [/^標題/, 'title'], [/^內文/, 'guide'],
];

const dedent = (lines) => {
  const body = lines.join('\n').replace(/^\n+|\s+$/g, '');
  return body.split('\n').map((l) => l.replace(/^ {2}/, '')).join('\n').trim();
};

function parseBlock(body) {
  const out = {};
  let field = null;
  let lang = null;
  let buffer = [];
  const flush = () => {
    if (field && lang) out[`${field}_${lang}`] = dedent(buffer);
    buffer = [];
  };
  for (const line of body.split('\n')) {
    const heading = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (heading) {
      flush();
      lang = null;
      field = FIELD_BY_HEADING.find(([re]) => re.test(heading[1]))?.[1] ?? null;
      continue;
    }
    const zh = line.match(/^- 中[:：]\s*(.*)$/);
    const en = line.match(/^- EN[:：]\s*(.*)$/);
    if (zh || en) {
      flush();
      lang = zh ? 'zh' : 'en';
      if ((zh ?? en)[1]) buffer.push(`  ${(zh ?? en)[1]}`);
      continue;
    }
    if (field && lang) buffer.push(line);
  }
  flush();
  return out;
}

const sections = md.split(/^## /m).slice(1);
const rows = [];
for (const section of sections) {
  const [headLine, ...rest] = section.split('\n');
  const key = headLine.match(/\b([A-Z][A-Z_]{3,})\b/)?.[1];
  if (!key || !META[key]) continue;
  const titleMatch = headLine.match(/—\s*(.+?)\s*\/\s*([^（(]+)/);
  const parsed = parseBlock(rest.join('\n').split(/^---$/m)[0]);
  rows.push({
    key,
    ...META[key],
    list_key: META[key].list_key ?? null,
    title_zh: parsed.title_zh ?? titleMatch?.[1] ?? key,
    title_en: parsed.title_en ?? titleMatch?.[2]?.trim() ?? key,
    question_zh: parsed.question_zh ?? null, question_en: parsed.question_en ?? null,
    hint_zh: parsed.hint_zh ?? null, hint_en: parsed.hint_en ?? null,
    guide_zh: parsed.guide_zh ?? null, guide_en: parsed.guide_en ?? null,
    good_example_zh: parsed.good_example_zh ?? null, good_example_en: parsed.good_example_en ?? null,
    weak_example_zh: parsed.weak_example_zh ?? null, weak_example_en: parsed.weak_example_en ?? null,
    pitfalls_zh: parsed.pitfalls_zh ?? null, pitfalls_en: parsed.pitfalls_en ?? null,
  });
}

if (rows.length !== Object.keys(META).length) {
  const found = new Set(rows.map((r) => r.key));
  throw new Error(`Missing: ${Object.keys(META).filter((k) => !found.has(k))}`);
}
for (const r of rows) {
  if (r.key === 'SUBMIT_HRBP') continue;
  for (const f of ['question_zh', 'question_en', 'hint_zh', 'hint_en', 'guide_zh', 'guide_en', 'good_example_zh', 'weak_example_en', 'pitfalls_zh']) {
    if (!r[f]) throw new Error(`${r.key} is missing ${f}`);
  }
}

const COLUMNS = Object.keys(rows[0]);
const lit = (v) => (v === null ? 'null' : typeof v === 'string' ? `$gb$${v}$gb$` : String(v));
const sql = [
  '-- GENERATED by scripts/gen-question-bank.mjs from docs/GUIDANCE_BANK.md. HR edits live data in the console.',
  `insert into public.question_bank (${COLUMNS.join(', ')}) values`,
  rows.map((r) => `  (${COLUMNS.map((c) => lit(r[c])).join(', ')})`).join(',\n'),
  'on conflict (key) do nothing;',
  '',
].join('\n');
writeFileSync(join(root, 'supabase/migrations/20261111000200_question_bank.sql'), sql, 'utf8');

const optionSql = readFileSync(join(root, 'supabase/migrations/20261110000400_option_lists.sql'), 'utf8');
const options = [...optionSql.matchAll(/\('(\w+)', '([^']+)', '([^']+)', '([^']+)', (\d+)\)/g)].map((m) => ({
  list_key: m[1], value: m[2], label_zh: m[3], label_en: m[4], sort: Number(m[5]),
}));

mkdirSync(join(root, 'src/data/generated'), { recursive: true });
writeFileSync(join(root, 'src/data/generated/questionBank.json'), JSON.stringify(rows, null, 2) + '\n', 'utf8');
writeFileSync(join(root, 'src/data/generated/options.json'), JSON.stringify(options, null, 2) + '\n', 'utf8');
console.log(`Generated ${rows.length} questions and ${options.length} options.`);
