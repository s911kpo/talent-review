// Excel export aligned to the template (SPEC section 9). Pure apart from ExcelJS, so it runs in tests.
import type { Workbook, Worksheet } from 'exceljs';
import type { DevPlanItem, OptionItem, Review } from '../review/types';

export const PLANNING_SHEET = 'Planning Tool ';
export const OPTIONS_SHEET = 'Drop Down Options ';
export const DEV_PLAN_SHEET = 'Development Plan';
export const KEY_TALENT_SHEET = 'Key Talent List';

const FIRST_DATA_ROW = 4;
const LAST_VALIDATED_ROW = 500;
const MAX_CELL_LENGTH = 32000;
const LOCATION_SUFFIX = 'Xindian District / New Taipei City / Taiwan';

export interface ExportEmployee {
  fullName: string;
  localName: string;
  position: string;
  dept: string;
}

export interface ExportRow {
  review: Review;
  employee: ExportEmployee;
  supervisorName: string;
}

export interface ExportInput {
  quarterLabel: string;
  rows: ExportRow[];
  options: OptionItem[];
  draft: boolean;
}

/** One line, trimmed and bounded, so no value can break the one-employee-one-row layout. */
export function clean(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s*(\r\n|\n|\r)\s*/g, '; ')
    .replace(/\t/g, ' ')
    .trim()
    .slice(0, MAX_CELL_LENGTH);
}

const bounded = (value: string) => value.trim().slice(0, MAX_CELL_LENGTH);
const numbered = (items: string[]) => items.map((text, i) => `${i + 1}. ${text}`).join('; ');
const employeeLabel = (e: ExportEmployee) => clean(`${e.fullName} ${e.localName}`);

/** Columns A to S, in template order. */
export function planningRowValues(row: ExportRow, quarterLabel: string): string[] {
  const { review: r, employee, supervisorName } = row;
  const roles = r.next_roles.filter((n) => n.role_title.trim() !== '');
  const successorName = (s: Review['successors'][number]) =>
    s.successor_type === 'tbh' ? 'TBH (To-Be-Hired)' : clean(s.display_name ?? s.external_name ?? String(s.successor_employee_id ?? ''));
  const pbm = (list: Review['pbm_strengths']) =>
    numbered(list.filter((p) => p.principle).map((p) => `${clean(p.principle)}: ${clean(p.evidence)}`));

  return [
    quarterLabel,
    clean(supervisorName),
    employeeLabel(employee),
    clean(`${employee.position} / ${LOCATION_SUFFIX}`),
    clean(r.retention_risk),
    r.retention_risk === 'Low' ? '' : r.retention_reasons.map(clean).join('; '),
    clean(r.mobility_status),
    r.mobility_status === 'Not Now' ? '' : clean(r.desired_locations),
    numbered(roles.map((n) => clean(n.role_title))),
    numbered(roles.map((n) => clean(n.readiness))),
    numbered(r.successors.map(successorName)),
    numbered(r.successors.map((s) => (s.successor_type === 'tbh' ? '-' : clean(s.readiness)))),
    pbm(r.pbm_strengths),
    pbm(r.pbm_improvements),
    clean(r.performance_strengths),
    numbered(r.development_areas.filter((a) => a.text.trim() !== '').map((a) => clean(a.text))),
    r.aspirations_not_discussed ? 'Not yet discussed with employee' : clean(r.personal_aspirations),
    clean(r.additional_comments),
    r.is_critical_role ? 'Yes--Check Box' : '',
  ];
}

export function sortRows(rows: ExportRow[]): ExportRow[] {
  const by = (a: string, b: string) => a.localeCompare(b, 'en');
  return [...rows].sort((a, b) =>
    by(a.employee.dept, b.employee.dept)
    || by(a.supervisorName, b.supervisorName)
    || by(a.employee.fullName, b.employee.fullName));
}

const OPTION_COLUMNS = ['retention_risk', 'mobility', 'readiness', 'retention_reason', 'quarter', 'critical_role', 'dev_type', 'plan_status'];

function writeOptions(ws: Worksheet, options: OptionItem[]): Record<string, number> {
  ws.getCell(1, 7).value = 'Development Type';
  ws.getCell(1, 8).value = 'Plan Status';
  const lastRow = Math.max(ws.rowCount, 12);
  for (let r = 2; r <= lastRow; r++) {
    for (let c = 1; c <= 8; c++) ws.getCell(r, c).value = null;
  }
  const counts: Record<string, number> = {};
  OPTION_COLUMNS.forEach((key, i) => {
    const values = options.filter((o) => o.list_key === key).sort((a, b) => a.sort - b.sort);
    values.forEach((o, j) => {
      ws.getCell(j + 2, i + 1).value = o.value.trim();
    });
    counts[key] = values.length;
  });
  return counts;
}

function rebuildValidations(ws: Worksheet, counts: Record<string, number>) {
  // ExcelJS drops the template's x14 dropdowns and keeps the stray T4:T36 rule; start clean.
  (ws as unknown as { dataValidations: { model: Record<string, unknown> } }).dataValidations.model = {};
  const range = (key: string) => {
    const col = String.fromCharCode(65 + OPTION_COLUMNS.indexOf(key));
    return `'${OPTIONS_SHEET}'!$${col}$2:$${col}$${Math.max(counts[key], 1) + 1}`;
  };
  // Multi-value cells cannot satisfy a single-choice list, so Excel must not raise errors on them.
  const rules: Array<[number, string, boolean]> = [
    [1, 'quarter', true], [5, 'retention_risk', true], [6, 'retention_reason', false], [7, 'mobility', true],
    [10, 'readiness', false], [12, 'readiness', false], [19, 'critical_role', true],
  ];
  for (let r = FIRST_DATA_ROW; r <= LAST_VALIDATED_ROW; r++) {
    for (const [col, key, showError] of rules) {
      ws.getCell(r, col).dataValidation = {
        type: 'list', allowBlank: true, formulae: [range(key)],
        showErrorMessage: showError, showInputMessage: false,
      };
    }
  }
}

function writePlanning(ws: Worksheet, rows: ExportRow[], quarterLabel: string, draft: boolean) {
  if (draft) {
    const title = ws.getCell('A2');
    title.value = `${String(title.value ?? '').trim()} - DRAFT`;
  }
  const template = ws.getRow(FIRST_DATA_ROW);
  const styles = Array.from({ length: 19 }, (_, i) => ({ ...template.getCell(i + 1).style }));
  rows.forEach((row, i) => {
    const target = ws.getRow(FIRST_DATA_ROW + i);
    planningRowValues(row, quarterLabel).forEach((value, c) => {
      const cell = target.getCell(c + 1);
      cell.value = value === '' ? null : value;
      cell.style = styles[c];
    });
    target.height = template.height;
    target.commit?.();
  });
}

function writeDevPlan(wb: Workbook, rows: ExportRow[], quarterLabel: string) {
  const ws = wb.addWorksheet(DEV_PLAN_SHEET);
  const columns = [
    'Employee ID', 'Employee', 'Supervisor', 'Quarter', 'Dev Area #', 'Development Area', 'Goal / Success Measure',
    'Development Type', 'Specific Actions', 'Support / Resources', 'Owner', 'Start Date', 'Target Date',
    'Checkpoint / Evaluation', 'Status', 'Progress Notes',
  ];
  ws.addRow(columns).font = { bold: true };
  ws.columns.forEach((c) => { c.width = 22; });
  const actionsCol = columns.indexOf('Specific Actions') + 1;

  for (const { review, employee, supervisorName } of rows) {
    const plans: DevPlanItem[] = [...review.dev_plan].sort((a, b) => a.area_idx - b.area_idx);
    for (const p of plans) {
      const position = review.development_areas.findIndex((a) => a.idx === p.area_idx);
      const added = ws.addRow([
        review.employee_id, employeeLabel(employee), clean(supervisorName), quarterLabel, position + 1,
        clean(review.development_areas[position]?.text), clean(p.goal), clean(p.dev_type),
        bounded(p.actions), clean(p.support), clean(p.owner), p.start_date ?? '', p.target_date ?? '',
        clean(p.checkpoint), clean(p.status), clean(p.progress_notes),
      ]);
      added.getCell(actionsCol).alignment = { wrapText: true, vertical: 'top' };
    }
  }
}

function writeKeyTalent(wb: Workbook, rows: ExportRow[]) {
  const ws = wb.addWorksheet(KEY_TALENT_SHEET);
  ws.addRow([
    'Employee ID', 'Employee', 'Dept', 'Position', 'Supervisor', 'Key Talent Reasons', 'Note',
    'Review Status', 'Version', 'Last Updated',
  ]).font = { bold: true };
  ws.columns.forEach((c) => { c.width = 22; });
  for (const { review, employee, supervisorName } of rows) {
    ws.addRow([
      review.employee_id, employeeLabel(employee), clean(employee.dept), clean(employee.position), clean(supervisorName),
      review.key_talent_reasons.map(clean).join('; '), clean(review.key_talent_note), review.status,
      review.version, review.updated_at,
    ]);
  }
}

/** Fills a workbook already loaded from the template. */
export function populateWorkbook(wb: Workbook, input: ExportInput): void {
  const planning = wb.getWorksheet(PLANNING_SHEET);
  const options = wb.getWorksheet(OPTIONS_SHEET);
  if (!planning || !options) throw new Error('template_sheet_missing');

  const rows = sortRows(input.rows);
  const counts = writeOptions(options, input.options);
  writePlanning(planning, rows, input.quarterLabel, input.draft);
  rebuildValidations(planning, counts);
  writeDevPlan(wb, rows, input.quarterLabel);
  writeKeyTalent(wb, rows);
  wb.creator = 'Talent Review';
  wb.lastModifiedBy = 'Talent Review';
}

export function exportFileName(cycleCode: string, scope: string, when: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${when.getFullYear()}${p(when.getMonth() + 1)}${p(when.getDate())}-${p(when.getHours())}${p(when.getMinutes())}`;
  const safeScope = scope.replace(/[\\/:*?"<>|,\s]+/g, '_').replace(/^_+|_+$/g, '');
  return `TalentReview_${cycleCode}_${safeScope}_${stamp}.xlsx`;
}

export async function buildExportBlob(input: ExportInput): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const response = await fetch(`${import.meta.env.BASE_URL}templates/template.xlsx`);
  if (!response.ok) throw new Error('template_unavailable');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await response.arrayBuffer());
  populateWorkbook(wb, input);
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
