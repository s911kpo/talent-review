import type { Workbook, CellValue } from 'exceljs';
import { COLUMN_MAP, missingColumns, normalizeHeader, type NamelistField, type RawRow } from './namelist';

export class NamelistFormatError extends Error {
  constructor(public missing: string[]) {
    super('namelist_format');
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('result' in value) return cellText(value.result as CellValue);
    if ('text' in value) return String(value.text);
    return '';
  }
  return String(value);
}

/** Reads the first sheet. Only columns in COLUMN_MAP are touched, so Birth month never leaves the file. */
export function rowsFromWorkbook(workbook: Workbook): Array<RawRow & { rowNumber: number }> {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new NamelistFormatError(Object.keys(COLUMN_MAP));

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value);
  });
  const missing = missingColumns(headers.filter(Boolean));
  if (missing.length > 0) throw new NamelistFormatError(missing);

  const columns = new Map<number, NamelistField>();
  headers.forEach((h, col) => {
    const field = COLUMN_MAP[normalizeHeader(h ?? '')];
    if (field) columns.set(col, field);
  });

  const out: Array<RawRow & { rowNumber: number }> = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const record = { rowNumber: n } as RawRow & { rowNumber: number };
    let hasValue = false;
    for (const [col, field] of columns) {
      const text = cellText(row.getCell(col).value);
      record[field] = text;
      if (text.trim() !== '') hasValue = true;
    }
    if (hasValue) out.push(record);
  }
  return out;
}

export async function parseNamelistFile(data: ArrayBuffer) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return rowsFromWorkbook(workbook);
}
