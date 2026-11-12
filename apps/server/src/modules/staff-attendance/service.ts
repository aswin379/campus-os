import { recordAudit } from '../../lib/audit/log.js';
import * as repo from './repository.js';

export interface StaffAttendanceRosterItem {
  staffId: string;
  fullName: string;
  status: string | null;
}

export async function getRoster(date: string): Promise<StaffAttendanceRosterItem[]> {
  const rows = await repo.getRosterForDate(date);
  return rows.map((r) => ({ staffId: r.staff_id, fullName: r.full_name, status: r.status }));
}

export async function markAttendance(
  actorId: string,
  input: { date: string; records: { staffId: string; status: string }[] },
): Promise<void> {
  await repo.upsertStaffAttendance(input.date, input.records, actorId);
  await recordAudit({
    actorStaffId: actorId,
    action: 'staff_attendance.mark',
    entityType: 'staff_attendance',
    entityId: input.date,
    afterData: { count: input.records.length },
  });
}

export interface MonthlyStaffSummaryItem {
  staffId: string;
  fullName: string;
  present: number;
  absent: number;
  leave: number;
}

export async function getMonthlySummary(year: number, month: number): Promise<MonthlyStaffSummaryItem[]> {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await repo.getMonthlySummary(yearMonth);
  return rows.map((r) => ({
    staffId: r.staff_id,
    fullName: r.full_name,
    present: Number(r.present_count),
    absent: Number(r.absent_count),
    leave: Number(r.leave_count),
  }));
}
