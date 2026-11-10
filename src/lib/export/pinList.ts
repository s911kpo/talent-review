export interface PinRow {
  employeeId: number;
  name: string;
  pin: string;
}

/** Builds the one-time PIN list. Exists only in the browser; PINs are never stored in the database. */
export async function buildPinListBlob(rows: PinRow[]): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PIN');
  ws.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'PIN', key: 'pin', width: 14 },
  ];
  rows.forEach((r) => ws.addRow(r));
  ws.getColumn('pin').numFmt = '@';
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
