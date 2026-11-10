import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { analyzeNamelist, diffPopulation, missingColumns, normalizeHeader, type RawRow } from '../../src/lib/namelist/namelist';
import { NamelistFormatError, rowsFromWorkbook } from '../../src/lib/namelist/parseXlsx';

const HEADERS = ['Talent Review', 'ID', 'LocalName', 'Full Name', 'Supervisor ID', 'Supervisor', 'Dept.', 'Dept. No.', 'Position', 'Gender', 'Birth month', 'Start Date'];

let n = 1;
const raw = (id: string, supervisorId: string, talentReview = 'Y', extra: Partial<RawRow> = {}) => ({
  rowNumber: ++n, talentReview, id, supervisorId,
  localName: '王小明', fullName: `Wang, ${id}`, supervisor: 'Boss', dept: 'PE', deptNo: '5101',
  position: 'Engineer', gender: 'M', startDate: '2020-01-15', ...extra,
});
const boss = (id: string) => raw(id, '0', 'N');
const codes = (a: ReturnType<typeof analyzeNamelist>) => a.issues.map((i) => i.code);

describe('headers', () => {
  it('normalizes line breaks and spacing', () => {
    expect(normalizeHeader('  Talent\n Review ')).toBe('talent review');
    expect(normalizeHeader('Dept.\r\nNo.')).toBe('dept. no.');
  });

  it('reports missing columns and does not require Birth month', () => {
    expect(missingColumns(HEADERS.filter((h) => h !== 'Birth month'))).toEqual([]);
    expect(missingColumns(HEADERS.filter((h) => h !== 'Position'))).toEqual(['position']);
  });
});

describe('analysis', () => {
  it('accepts a valid list and computes reviewers', () => {
    const a = analyzeNamelist([boss('1'), raw('2', '1'), raw('3', '1'), raw('4', '2')]);
    expect(a.hasErrors).toBe(false);
    expect(a.reviewerIds).toEqual([1, 2]);
    expect(a.inScopeCount).toBe(3);
  });

  it('flags duplicate ids', () => {
    expect(codes(analyzeNamelist([boss('1'), boss('1')]))).toContain('duplicate_id');
  });

  it('flags an unknown supervisor', () => {
    expect(codes(analyzeNamelist([raw('2', '99')]))).toContain('unknown_supervisor');
  });

  it('flags in-scope with external supervisor', () => {
    expect(codes(analyzeNamelist([raw('2', '0', 'Y')]))).toContain('in_scope_without_supervisor');
  });

  it('allows out-of-scope with external supervisor', () => {
    expect(analyzeNamelist([raw('2', '0', 'N')]).hasErrors).toBe(false);
  });

  it('flags self-supervision', () => {
    expect(codes(analyzeNamelist([raw('2', '2')]))).toContain('self_supervisor');
  });

  it('reports one error per supervisor loop', () => {
    const a = analyzeNamelist([raw('1', '3'), raw('2', '1'), raw('3', '2')]);
    expect(a.issues.filter((i) => i.code === 'supervisor_cycle')).toHaveLength(1);
    expect(a.hasErrors).toBe(true);
  });

  it('trims names and warns without blocking', () => {
    const a = analyzeNamelist([raw('2', '0', 'N', { fullName: ' Wang, A ' })]);
    expect(a.hasErrors).toBe(false);
    expect(codes(a)).toContain('name_whitespace');
    expect(a.rows[0].full_name).toBe('Wang, A');
  });

  it('warns on non-numeric department numbers', () => {
    expect(codes(analyzeNamelist([raw('2', '0', 'N', { deptNo: 'A1' })]))).toContain('dept_no_not_numeric');
  });

  it('lists a likely title typo and leaves the value unchanged', () => {
    const rows = [
      raw('1', '0', 'N', { position: 'Process Engineer' }), raw('2', '0', 'N', { position: 'Process Engineer' }),
      raw('3', '0', 'N', { position: 'Process Engineer' }), raw('4', '0', 'N', { position: 'Proces Engineer' }),
    ];
    const a = analyzeNamelist(rows);
    expect(codes(a)).toContain('possible_title_typo');
    expect(a.hasErrors).toBe(false);
    expect(a.rows[3].position).toBe('Proces Engineer');
  });

  it('treats only Y as in scope', () => {
    expect(analyzeNamelist([boss('1'), raw('2', '1', ' y ')]).rows[1].in_scope).toBe(true);
    expect(analyzeNamelist([boss('1'), raw('2', '1', 'N')]).rows[1].in_scope).toBe(false);
  });

  it('never carries a birth field', () => {
    const a = analyzeNamelist([boss('1')]);
    expect(Object.keys(a.rows[0]).filter((k) => /birth/i.test(k))).toEqual([]);
  });
});

describe('diff', () => {
  it('finds additions, departures, supervisor and scope changes', () => {
    const next = analyzeNamelist([boss('1'), raw('2', '1'), raw('4', '1', 'N')]).rows;
    const diff = diffPopulation(next, [
      { employee_id: 1, in_scope: false, supervisor_id: 0 },
      { employee_id: 2, in_scope: true, supervisor_id: 9 },
      { employee_id: 3, in_scope: true, supervisor_id: 1 },
    ]);
    expect(diff.added).toEqual([4]);
    expect(diff.removed).toEqual([3]);
    expect(diff.supervisorChanged).toEqual([{ employeeId: 2, from: 9, to: 1 }]);
    expect(diff.scopeChanged).toEqual([]);
  });
});

describe('xlsx parsing', () => {
  function workbook(headers: string[], rows: unknown[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('11.10 Namelist');
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    return wb;
  }
  const SECRET_MONTH = 'BIRTH-SENTINEL';
  const row = ['Y', 900002, '王', 'Wang, A', 900001, 'Boss', 'PE', 5101, 'Engineer', 'M', SECRET_MONTH, new Date('2020-03-01T00:00:00Z')];

  it('reads cells and converts dates and numbers', () => {
    const [r] = rowsFromWorkbook(workbook(HEADERS, [row]));
    expect(r.id).toBe('900002');
    expect(r.startDate).toBe('2020-03-01');
    expect(r.deptNo).toBe('5101');
  });

  it('accepts headers with line breaks', () => {
    const headers = HEADERS.map((h) => (h === 'Supervisor ID' ? 'Supervisor\nID' : h));
    expect(rowsFromWorkbook(workbook(headers, [row]))).toHaveLength(1);
  });

  it('drops Birth month at parse time', () => {
    const [r] = rowsFromWorkbook(workbook(HEADERS, [row]));
    expect(JSON.stringify(r)).not.toContain(SECRET_MONTH);
  });

  it('skips blank rows', () => {
    expect(rowsFromWorkbook(workbook(HEADERS, [row, [], row]))).toHaveLength(2);
  });

  it('rejects a file with missing columns', () => {
    expect(() => rowsFromWorkbook(workbook(['ID', 'Foo'], []))).toThrow(NamelistFormatError);
  });
});
