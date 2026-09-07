import { pool } from '../../db/pool.js';
import { getPendingFeesTotal, getTodaysCollectionTotal } from '../fees/repository.js';
import { getInstituteSettings } from '../settings/service.js';

export interface DashboardSummary {
  instituteName: string;
  totalStudents: number;
  totalCourses: number;
  totalStaff: number;
  todaysAdmissions: number;
  todaysFeeCollections: number;
  pendingFees: number;
  attendanceSummary: { presentToday: number; absentToday: number } | null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = new Date().toISOString().slice(0, 10);

  // All eight independent — run together instead of one-at-a-time so total
  // latency is the slowest single query, not the sum of all of them.
  const [
    { rows: staffRows },
    { rows: studentRows },
    { rows: admissionRows },
    { rows: courseRows },
    { rows: attendanceRows },
    todaysFeeCollections,
    pendingFees,
    instituteSettings,
  ] = await Promise.all([
    pool.query<{ count: string }>(`select cast(count(*) as char) as count from staff where deleted_at is null and is_active = true`),
    pool.query<{ count: string }>(`select cast(count(*) as char) as count from students where deleted_at is null`),
    pool.query<{ count: string }>(
      `select cast(count(*) as char) as count from students where deleted_at is null and admission_date = current_date`,
    ),
    pool.query<{ count: string }>(`select cast(count(*) as char) as count from courses where deleted_at is null and status = 'active'`),
    pool.query<{ present: string; absent: string }>(
      `select
         cast(sum(case when status = 'present' then 1 else 0 end) as char) as present,
         cast(sum(case when status = 'absent' then 1 else 0 end) as char) as absent
       from attendance_records
       where attendance_date = current_date`,
    ),
    getTodaysCollectionTotal(today),
    getPendingFeesTotal(),
    getInstituteSettings(),
  ]);

  return {
    instituteName: instituteSettings.instituteName,
    totalStudents: Number(studentRows[0]?.count ?? 0),
    totalCourses: Number(courseRows[0]?.count ?? 0),
    totalStaff: Number(staffRows[0]?.count ?? 0),
    todaysAdmissions: Number(admissionRows[0]?.count ?? 0),
    todaysFeeCollections,
    pendingFees,
    attendanceSummary: {
      presentToday: Number(attendanceRows[0]?.present ?? 0),
      absentToday: Number(attendanceRows[0]?.absent ?? 0),
    },
  };
}
