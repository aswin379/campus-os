import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import * as repo from './repository.js';

export interface RosterEntryDto {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  attendanceId: string | null;
  status: string | null;
}

export async function getRoster(batchId: string, date: string): Promise<RosterEntryDto[]> {
  const rows = await repo.getRosterForBatchDate(batchId, date);
  return rows.map((r) => ({
    enrollmentId: r.enrollment_id,
    studentId: r.student_id,
    admissionNumber: r.admission_number,
    firstName: r.first_name,
    lastName: r.last_name,
    attendanceId: r.attendance_id,
    status: r.status,
  }));
}

const VALID_STATUSES = ['present', 'absent', 'half_day'];

export async function markAttendance(
  actorId: string,
  input: { batchId: string; date: string; records: { enrollmentId: string; status: string }[] },
): Promise<void> {
  for (const r of input.records) {
    if (!VALID_STATUSES.includes(r.status)) throw new HttpError(400, `Invalid attendance status: ${r.status}`);
  }

  try {
    await repo.bulkMarkAttendance(input.batchId, input.date, input.records, actorId);
  } catch (err) {
    if (err instanceof repo.EnrollmentNotInBatchError) {
      throw new HttpError(400, err.message);
    }
    throw err;
  }

  await recordAudit({
    actorStaffId: actorId,
    action: 'attendance.mark',
    entityType: 'course_batch',
    entityId: input.batchId,
    afterData: { date: input.date, count: input.records.length },
  });
}

export interface AttendanceDto {
  id: string;
  enrollmentId: string;
  attendanceDate: string;
  status: string;
  markedBy: string;
  markedAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

function toDto(row: repo.AttendanceRow): AttendanceDto {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    attendanceDate: row.attendance_date,
    status: row.status,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function editAttendance(actorId: string, id: string, status: string): Promise<AttendanceDto> {
  if (!VALID_STATUSES.includes(status)) throw new HttpError(400, `Invalid attendance status: ${status}`);

  const before = await repo.getAttendanceById(id);
  if (!before) throw new HttpError(404, 'Attendance record not found');

  const updated = await repo.updateAttendanceStatus(id, status, actorId);
  if (!updated) throw new HttpError(404, 'Attendance record not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'attendance.edit',
    entityType: 'attendance_record',
    entityId: id,
    beforeData: { status: before.status },
    afterData: { status },
  });

  return toDto(updated);
}

export async function getHistory(enrollmentId: string): Promise<AttendanceDto[]> {
  return (await repo.getHistoryForEnrollment(enrollmentId)).map(toDto);
}

export interface MonthlySummaryDto {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
}

export async function getBatchMonthlySummary(batchId: string, year: number, month: number): Promise<MonthlySummaryDto[]> {
  const rows = await repo.getBatchMonthlySummary(batchId, year, month);
  return rows.map((r) => ({
    enrollmentId: r.enrollment_id,
    studentId: r.student_id,
    admissionNumber: r.admission_number,
    firstName: r.first_name,
    lastName: r.last_name,
    presentCount: Number(r.present_count),
    absentCount: Number(r.absent_count),
    halfDayCount: Number(r.half_day_count),
  }));
}
