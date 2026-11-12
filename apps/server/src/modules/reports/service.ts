import { HttpError } from '../../middleware/errorHandler.js';
import { buildExcelBuffer } from '../../lib/export/excel.js';
import { buildPdfTableBuffer } from '../../lib/export/pdfTable.js';
import type { ReportColumn, ReportRow } from '../../lib/export/types.js';
import * as repo from './repository.js';

export type ExportFormat = 'json' | 'pdf' | 'xlsx';

export type ReportResult =
  | { format: 'json'; data: ReportRow[] }
  | { format: 'pdf' | 'xlsx'; buffer: Buffer; filename: string; contentType: string };

async function buildResult(title: string, columns: ReportColumn[], rows: ReportRow[], format: ExportFormat): Promise<ReportResult> {
  if (format === 'json') return { format: 'json', data: rows };
  if (format === 'pdf') {
    const buffer = await buildPdfTableBuffer(title, columns, rows);
    return { format: 'pdf', buffer, filename: `${title}.pdf`, contentType: 'application/pdf' };
  }
  if (format === 'xlsx') {
    const buffer = await buildExcelBuffer(title, columns, rows);
    return {
      format: 'xlsx',
      buffer,
      filename: `${title}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  throw new HttpError(400, `Unsupported export format: ${format}`);
}

const STUDENT_COLUMNS: ReportColumn[] = [
  { key: 'admissionNumber', header: 'Admission #', width: 1.2 },
  { key: 'name', header: 'Name', width: 2 },
  { key: 'status', header: 'Status', width: 1 },
  { key: 'admissionDate', header: 'Admission Date', width: 1.2 },
  { key: 'city', header: 'City', width: 1.2 },
];

export async function getStudentReport(status: string | undefined, format: ExportFormat): Promise<ReportResult> {
  const rows = await repo.getStudentReport(status);
  const data: ReportRow[] = rows.map((r) => ({
    admissionNumber: r.admission_number,
    name: `${r.first_name} ${r.last_name}`,
    status: r.status,
    admissionDate: r.admission_date,
    city: r.city,
  }));
  return buildResult('Student Report', STUDENT_COLUMNS, data, format);
}

const COURSE_COLUMNS: ReportColumn[] = [
  { key: 'code', header: 'Code', width: 1 },
  { key: 'name', header: 'Name', width: 2.2 },
  { key: 'duration', header: 'Duration', width: 1 },
  { key: 'status', header: 'Status', width: 1 },
  { key: 'batchCount', header: 'Batches', width: 1 },
  { key: 'activeEnrollmentCount', header: 'Active Students', width: 1.3 },
];

export async function getCourseReport(format: ExportFormat): Promise<ReportResult> {
  const rows = await repo.getCourseReport();
  const data: ReportRow[] = rows.map((r) => ({
    code: r.code,
    name: r.name,
    duration: `${r.duration_value} ${r.duration_unit}`,
    status: r.status,
    batchCount: Number(r.batch_count),
    activeEnrollmentCount: Number(r.active_enrollment_count),
  }));
  return buildResult('Course Report', COURSE_COLUMNS, data, format);
}

const FEE_COLLECTION_COLUMNS: ReportColumn[] = [
  { key: 'receiptNumber', header: 'Receipt #', width: 1.5 },
  { key: 'date', header: 'Date', width: 1 },
  { key: 'admissionNumber', header: 'Admission #', width: 1.1 },
  { key: 'studentName', header: 'Student', width: 1.8 },
  { key: 'course', header: 'Course', width: 2 },
  { key: 'amount', header: 'Amount', width: 1 },
  { key: 'mode', header: 'Mode', width: 0.9 },
  { key: 'type', header: 'Type', width: 0.9 },
];

export async function getFeeCollectionReport(fromDate: string, toDate: string, format: ExportFormat): Promise<ReportResult> {
  const rows = await repo.getFeeCollectionReport(fromDate, toDate);
  const data: ReportRow[] = rows.map((r) => ({
    receiptNumber: r.receipt_number,
    date: r.payment_date,
    admissionNumber: r.admission_number,
    studentName: `${r.first_name} ${r.last_name}`,
    course: r.course_name,
    amount: Number(r.amount),
    mode: r.payment_mode,
    type: r.transaction_type,
  }));
  const title = fromDate === toDate ? `Daily Collection Report ${fromDate}` : `Fee Collection Report ${fromDate} to ${toDate}`;
  return buildResult(title, FEE_COLLECTION_COLUMNS, data, format);
}

const PENDING_FEES_COLUMNS: ReportColumn[] = [
  { key: 'admissionNumber', header: 'Admission #', width: 1.1 },
  { key: 'studentName', header: 'Student', width: 1.6 },
  { key: 'course', header: 'Course', width: 1.8 },
  { key: 'item', header: 'Item', width: 1.3 },
  { key: 'dueDate', header: 'Due Date', width: 1 },
  { key: 'amountDue', header: 'Amount Due', width: 1 },
  { key: 'amountPaid', header: 'Amount Paid', width: 1 },
  { key: 'amountPending', header: 'Amount Pending', width: 1.1 },
  { key: 'status', header: 'Status', width: 0.9 },
];

export async function getPendingFeesReport(format: ExportFormat): Promise<ReportResult> {
  const rows = await repo.getPendingFeesReport();
  const data: ReportRow[] = rows.map((r) => {
    const amountDue = Number(r.amount_due);
    const amountPaid = Number(r.amount_paid);
    return {
      admissionNumber: r.admission_number,
      studentName: `${r.first_name} ${r.last_name}`,
      course: r.course_name,
      item: r.label,
      dueDate: r.due_date,
      amountDue,
      amountPaid,
      amountPending: amountDue - amountPaid,
      status: r.status,
    };
  });
  return buildResult('Pending Fees Report', PENDING_FEES_COLUMNS, data, format);
}

export async function getAuditLog(filters: { entityType?: string; entityId?: string }, limit: number) {
  const rows = await repo.getAuditLog(filters, limit);
  return rows.map((r) => ({
    id: r.id,
    actorStaffId: r.actor_staff_id,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    beforeData: r.before_data,
    afterData: r.after_data,
    createdAt: r.created_at,
  }));
}
