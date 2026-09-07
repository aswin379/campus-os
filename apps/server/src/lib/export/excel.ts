import ExcelJS from 'exceljs';
import type { ReportColumn, ReportRow } from './types.js';

export async function buildExcelBuffer(sheetName: string, columns: ReportColumn[], rows: ReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
