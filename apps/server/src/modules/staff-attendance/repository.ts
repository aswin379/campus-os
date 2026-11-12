import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface StaffRosterRow {
  staff_id: string;
  full_name: string;
  status: string | null;
}

export async function getRosterForDate(date: string): Promise<StaffRosterRow[]> {
  const { rows } = await pool.query<StaffRosterRow>(
    `select s.id as staff_id, s.full_name, sar.status
     from staff s
     left join staff_attendance_records sar on sar.staff_id = s.id and sar.attendance_date = ?
     where s.deleted_at is null and s.is_active = true and s.is_super_admin = false
     order by s.full_name`,
    [date],
  );
  return rows;
}

export async function upsertStaffAttendance(
  date: string,
  records: { staffId: string; status: string }[],
  actorId: string,
): Promise<void> {
  for (const r of records) {
    await pool.query(
      `insert into staff_attendance_records (id, staff_id, attendance_date, status, marked_by)
       values (?, ?, ?, ?, ?)
       on duplicate key update status = values(status), updated_by = ?, updated_at = now()`,
      [crypto.randomUUID(), r.staffId, date, r.status, actorId, actorId],
    );
  }
}

export interface MonthlyStaffSummaryRow {
  staff_id: string;
  full_name: string;
  present_count: string;
  absent_count: string;
  leave_count: string;
}

export async function getMonthlySummary(yearMonth: string): Promise<MonthlyStaffSummaryRow[]> {
  const { rows } = await pool.query<MonthlyStaffSummaryRow>(
    `select s.id as staff_id, s.full_name,
       coalesce(sum(sar.status = 'present'), 0) as present_count,
       coalesce(sum(sar.status = 'absent'), 0) as absent_count,
       coalesce(sum(sar.status = 'leave'), 0) as leave_count
     from staff s
     left join staff_attendance_records sar
       on sar.staff_id = s.id and date_format(sar.attendance_date, '%Y-%m') = ?
     where s.deleted_at is null and s.is_active = true and s.is_super_admin = false
     group by s.id, s.full_name
     order by s.full_name`,
    [yearMonth],
  );
  return rows;
}
