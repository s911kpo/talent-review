// SPEC section 9 acceptance checks, run against the real template.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import options from '../../src/data/generated/options.json';
import {
  DEV_PLAN_SHEET, KEY_TALENT_SHEET, OPTIONS_SHEET, PLANNING_SHEET,
  clean, exportFileName, populateWorkbook, type ExportRow,
} from '../../src/lib/export/planningTool';
import { emptyReview } from '../../src/lib/review/steps';
import type { OptionItem, Review } from '../../src/lib/review/types';

const root = join(__dirname, '..', '..');
const ORIGINAL = join(root, 'docs/template/DSS_Talent_Assessment_Succession_tool_template.xlsx');
const PUBLIC = join(root, 'public/templates/template.xlsx');

const review = (employee_id: number, over: Partial<Review> = {}): Review => ({
  ...emptyReview({ id: `r${employee_id}`, cycle_id: 'c', employee_id, reviewer_id: 9 }),
  key_talent_reasons: ['Successor Candidate', 'Critical Role Holder'],
  is_critical_role: true,
  performance_strengths: 'Line one\nLine two\r\nLine three\tend',
  pbm_strengths: [{ principle: 'Integrity', evidence: 'Owned a mistake' }, { principle: 'Humility', evidence: 'Asked for help' }],
  pbm_improvements: [{ principle: 'Transformation', evidence: 'Legacy habits' }],
  development_areas: [{ idx: 1, text: 'Lead projects' }, { idx: 3, text: 'Data storytelling' }],
  personal_aspirations: 'Technical expert',
  retention_risk: 'Medium',
  retention_reasons: ['Competitive Market', 'Career Move'],
  mobility_status: '1-2 years',
  desired_locations: 'Penang, Malaysia',
  additional_comments: 'Note\nwith break',
  next_roles: [{ rank: 1, role_title: 'Sr. Engineer', readiness: '1-2 years' }, { rank: 2, role_title: 'Manager', readiness: '3+ years' }],
  successors: [
    { rank: 1, successor_type: 'internal', successor_employee_id: 77, external_name: null, readiness: 'Ready Now', display_name: 'Lin, A' },
    { rank: 2, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null },
  ],
  dev_plan: [
    { area_idx: 3, goal: 'Present', dev_type: 'Exposure (20%)', actions: 'A\nB', support: '', owner: 'E', start_date: '2026-12-01', target_date: '2027-03-01', checkpoint: 'Reviewed', status: 'Not Started', progress_notes: '' },
    { area_idx: 1, goal: 'Lead', dev_type: 'Experience (70%)', actions: 'First action\nSecond action', support: 'Sponsor', owner: 'E', start_date: '2026-12-01', target_date: '2027-06-30', checkpoint: 'Report', status: 'On Track', progress_notes: '' },
  ],
  ...over,
});

const row = (id: number, dept: string, supervisor: string, name: string, over: Partial<Review> = {}): ExportRow => ({
  review: review(id, over),
  employee: { fullName: name, localName: '王', position: 'Engineer', dept },
  supervisorName: supervisor,
});

const FIXTURE: ExportRow[] = [
  row(3, 'Quality', 'Yu, Boss', 'Zhang, C'),
  row(1, 'Process', 'Yu, Boss', 'Wang, B', {
    retention_risk: 'Low', retention_reasons: [], mobility_status: 'Not Now', desired_locations: 'ignored',
    aspirations_not_discussed: true, personal_aspirations: 'ignored', is_critical_role: false,
  }),
  row(2, 'Process', 'Lin, Boss', 'Xu, A'),
];

const cellText = (ws: ExcelJS.Worksheet, r: number, c: number) => {
  const v = ws.getCell(r, c).value;
  return v === null || v === undefined ? '' : String(v);
};

const plain = (v: ExcelJS.CellValue): string => {
  if (v && typeof v === 'object' && 'richText' in v) return v.richText.map((t) => t.text).join('');
  return v === null || v === undefined ? '' : String(v);
};

async function reopen(draft = false) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PUBLIC);
  populateWorkbook(wb, { quarterLabel: 'Q4 2026', rows: FIXTURE, options: options as OptionItem[], draft });
  const buffer = await wb.xlsx.writeBuffer();
  const again = new ExcelJS.Workbook();
  await again.xlsx.load(buffer as ArrayBuffer);
  return { wb: again, buffer: buffer as ArrayBuffer };
}

let out: ExcelJS.Workbook;
let original: ExcelJS.Workbook;
let planning: ExcelJS.Worksheet;
let buffer: ArrayBuffer;

beforeAll(async () => {
  ({ wb: out, buffer } = await reopen());
  original = new ExcelJS.Workbook();
  await original.xlsx.readFile(ORIGINAL);
  planning = out.getWorksheet(PLANNING_SHEET)!;
});

describe('template alignment', () => {
  it('keeps row 3 headers character for character', () => {
    const source = original.getWorksheet(PLANNING_SHEET)!;
    for (let c = 1; c <= 19; c++) expect(cellText(planning, 3, c), `column ${c}`).toBe(cellText(source, 3, c));
  });

  it('includes trailing spaces in sheet names and headers', () => {
    expect(out.getWorksheet('Planning Tool ')).toBeDefined();
    expect(out.getWorksheet('Drop Down Options ')).toBeDefined();
    expect(cellText(planning, 3, 1)).toBe('Quarter ');
    expect(cellText(planning, 3, 5)).toBe('Retention Risk ');
    expect(cellText(planning, 3, 16)).toBe('Development Areas ');
  });

  it('leaves Criteria & Definitions unchanged', () => {
    const a = original.getWorksheet('Criteria & Definitions')!;
    const b = out.getWorksheet('Criteria & Definitions')!;
    for (let r = 1; r <= 15; r++) {
      for (let c = 1; c <= 4; c++) expect(plain(b.getCell(r, c).value), `${r},${c}`).toBe(plain(a.getCell(r, c).value));
    }
  });

  it('keeps template images', async () => {
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).filter((f) => /^xl\/media\/.+\.png$/.test(f)).length).toBe(2);
  });
});

describe('rows', () => {
  it('writes one row per key talent from row 4 with nothing after', () => {
    for (let r = 4; r < 4 + FIXTURE.length; r++) expect(cellText(planning, r, 3)).not.toBe('');
    expect(cellText(planning, 4 + FIXTURE.length, 3)).toBe('');
  });

  it('sorts by department, reviewer, then employee', () => {
    expect([4, 5, 6].map((r) => cellText(planning, r, 3))).toEqual(['Xu, A 王', 'Wang, B 王', 'Zhang, C 王']);
  });

  it('matches Key Talent List row for row', () => {
    const list = out.getWorksheet(KEY_TALENT_SHEET)!;
    expect(list.rowCount - 1).toBe(FIXTURE.length);
    for (let i = 0; i < FIXTURE.length; i++) {
      expect(cellText(list, i + 2, 2)).toBe(cellText(planning, i + 4, 3));
    }
  });

  it('has no line breaks in any Planning Tool data cell', () => {
    for (let r = 4; r < 4 + FIXTURE.length; r++) {
      for (let c = 1; c <= 19; c++) expect(cellText(planning, r, c), `${r},${c}`).not.toMatch(/[\r\n\t]/);
    }
  });

  it('keeps I and J, K and L numbering aligned', () => {
    const items = (s: string) => s.split('; ').map((x) => x.match(/^(\d+)\./)?.[1]);
    for (let r = 4; r < 4 + FIXTURE.length; r++) {
      expect(items(cellText(planning, r, 9))).toEqual(items(cellText(planning, r, 10)));
      expect(items(cellText(planning, r, 11))).toEqual(items(cellText(planning, r, 12)));
    }
  });

  it('maps every column as specified', () => {
    const r = 6; // Zhang, C
    const v = (c: number) => cellText(planning, r, c);
    expect(v(1)).toBe('Q4 2026');
    expect(v(2)).toBe('Yu, Boss');
    expect(v(4)).toBe('Engineer / Xindian District / New Taipei City / Taiwan');
    expect(v(5)).toBe('Medium');
    expect(v(6)).toBe('Competitive Market; Career Move');
    expect(v(7)).toBe('1-2 years');
    expect(v(8)).toBe('Penang, Malaysia');
    expect(v(9)).toBe('1. Sr. Engineer; 2. Manager');
    expect(v(10)).toBe('1. 1-2 years; 2. 3+ years');
    expect(v(11)).toBe('1. Lin, A; 2. TBH (To-Be-Hired)');
    expect(v(12)).toBe('1. Ready Now; 2. -');
    expect(v(13)).toBe('1. Integrity: Owned a mistake; 2. Humility: Asked for help');
    expect(v(14)).toBe('1. Transformation: Legacy habits');
    expect(v(15)).toBe('Line one; Line two; Line three end');
    expect(v(16)).toBe('1. Lead projects; 2. Data storytelling');
    expect(v(17)).toBe('Technical expert');
    expect(v(18)).toBe('Note; with break');
    expect(v(19)).toBe('Yes--Check Box');
  });

  it('applies the conditional blanks', () => {
    const r = 5; // Wang, B
    expect(cellText(planning, r, 6)).toBe('');
    expect(cellText(planning, r, 8)).toBe('');
    expect(cellText(planning, r, 17)).toBe('Not yet discussed with employee');
    expect(cellText(planning, r, 19)).toBe('');
  });
});

describe('dropdowns', () => {
  const validation = (ws: ExcelJS.Worksheet, ref: string) => ws.getCell(ref).dataValidation;

  it('rebuilds every dropdown against the options sheet', () => {
    const cases: Array<[string, string]> = [
      ['A4', 'E'], ['E4', 'A'], ['F4', 'D'], ['G4', 'B'], ['J4', 'C'], ['L4', 'C'], ['S4', 'F'],
      ['A500', 'E'], ['S500', 'F'],
    ];
    for (const [ref, col] of cases) {
      const dv = validation(planning, ref);
      expect(dv?.type, ref).toBe('list');
      expect(dv?.formulae?.[0], ref).toContain(`'Drop Down Options '!$${col}$2:$${col}$`);
    }
  });

  it('silences errors on multi-value columns only', () => {
    for (const ref of ['F4', 'J4', 'L4']) expect(validation(planning, ref)?.showErrorMessage, ref).toBeFalsy();
    for (const ref of ['A4', 'E4', 'G4', 'S4']) expect(validation(planning, ref)?.showErrorMessage, ref).toBe(true);
  });

  it('removes the stray T4:T36 rule', () => {
    expect(validation(planning, 'T4')).toBeUndefined();
    expect(validation(planning, 'T36')).toBeUndefined();
  });

  it('writes current options, including the new columns, and trims values', () => {
    const ws = out.getWorksheet(OPTIONS_SHEET)!;
    expect(cellText(ws, 1, 7)).toBe('Development Type');
    expect(cellText(ws, 1, 8)).toBe('Plan Status');
    expect(cellText(ws, 2, 5)).toBe('Q4 2026');
    expect(cellText(ws, 3, 5)).toBe('');
    expect(cellText(ws, 11, 4)).toBe('Culture Fit');
    expect(cellText(ws, 2, 7)).toBe('Experience (70%)');
    expect(cellText(ws, 5, 8)).toBe('Completed');
  });
});

describe('added sheets', () => {
  it('lists one row per plan with the right development area', () => {
    const ws = out.getWorksheet(DEV_PLAN_SHEET)!;
    expect(ws.rowCount - 1).toBe(FIXTURE.length * 2);
    expect(cellText(ws, 2, 5)).toBe('1');
    expect(cellText(ws, 2, 6)).toBe('Lead projects');
    expect(cellText(ws, 3, 5)).toBe('2');
    expect(cellText(ws, 3, 6)).toBe('Data storytelling');
  });

  it('keeps line breaks in Specific Actions with wrapping', () => {
    const ws = out.getWorksheet(DEV_PLAN_SHEET)!;
    expect(cellText(ws, 2, 9)).toBe('First action\nSecond action');
    expect(ws.getCell(2, 9).alignment?.wrapText).toBe(true);
  });
});

describe('draft label and file name', () => {
  it('marks drafts in the title row and leaves headers alone', async () => {
    const { wb } = await reopen(true);
    const ws = wb.getWorksheet(PLANNING_SHEET)!;
    expect(cellText(ws, 2, 1)).toMatch(/- DRAFT$/);
    expect(cellText(ws, 3, 1)).toBe('Quarter ');
  });

  it('does not mark final exports', () => {
    expect(cellText(planning, 2, 1)).not.toMatch(/DRAFT/);
  });

  it('builds the file name', () => {
    expect(exportFileName('Q4-2026', 'All', new Date(2026, 10, 30, 9, 5))).toBe('TalentReview_Q4-2026_All_20261130-0905.xlsx');
    expect(exportFileName('Q4-2026', 'Yu, Eason', new Date(2026, 10, 30, 9, 5))).toBe('TalentReview_Q4-2026_Yu_Eason_20261130-0905.xlsx');
  });

  it('collapses multi-line text and limits length', () => {
    expect(clean(' a\r\n\n b\tc ')).toBe('a; b c');
    expect(clean('x'.repeat(40000))).toHaveLength(32000);
    expect(clean(null)).toBe('');
  });
});

describe('public template', () => {
  it('carries no personal names or embedded queries', async () => {
    const zip = await JSZip.loadAsync(readFileSync(PUBLIC));
    const core = await zip.file('docProps/core.xml')!.async('string');
    expect(core).not.toMatch(/Pienkowski|Hsu/);
    expect(Object.keys(zip.files).filter((f) => f.startsWith('customXml/'))).toEqual([]);
  });
});
