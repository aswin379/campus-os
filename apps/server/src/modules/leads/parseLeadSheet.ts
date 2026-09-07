import ExcelJS from 'exceljs';
import type { BulkLeadRow } from './service.js';

const COLUMN_ALIASES: Record<string, keyof BulkLeadRow> = {
  'full name': 'fullName',
  fullname: 'fullName',
  name: 'fullName',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  email: 'email',
  source: 'source',
  notes: 'notes',
  note: 'notes',
};

/** Expects a header row (any order, extra/unknown columns ignored) with at
 * least Full Name and Phone — see COLUMN_ALIASES for accepted header text. */
export async function parseLeadSheet(buffer: Buffer): Promise<BulkLeadRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled type defs predate @types/node's generic
  // Buffer<TArrayBuffer>, so no runtime-identical Buffer value satisfies its
  // .load() signature under strict structural typing regardless of how it's
  // cast — the mismatch is purely in the type declarations, never an actual
  // runtime concern, hence the blanket `any` rather than another ineffective
  // Buffer-shaped cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const columnByIndex = new Map<number, keyof BulkLeadRow>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    const field = COLUMN_ALIASES[key];
    if (field) columnByIndex.set(colNumber, field);
  });

  const rows: BulkLeadRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const entry: BulkLeadRow = {};
    columnByIndex.forEach((field, colNumber) => {
      const value = row.getCell(colNumber).text?.trim();
      if (value) entry[field] = value;
    });
    rows.push(entry);
  }
  return rows;
}
