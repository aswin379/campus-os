import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface RosterRow {
  enrollment_id: string;
  student_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  attendance_id: string | null;
  status: string | null;
}

export async function getRosterForBatchDate(batchId: string, date: string): Promise<RosterRow[]> {
  const { rows } = await pool.query<RosterRow>(
    `select
       se.id as enrollment_id,
       s.id as student_id,
       s.admission_number,
       s.first_name,
       s.last_name,
       ar.id as attendance_id,
       ar.status
     from student_enrollments se
     join students s on s.id = se.student_id
     left join attendance_records ar on ar.enrollment_id = se.id and ar.attendance_date = ?
     where se.course_batch_id = ? and se.status = 'active'
     order by s.first_name, s.last_name`,
    [date, batchId],
  );
  return rows;
}

export interface AttendanceRow {
  id: string;
  enrollment_id: string;
  attendance_date: string;
  status: string;
  marked_by: string;
  marked_at: string;
  updated_by: string | null;
  updated_at: string;
}

export class EnrollmentNotInBatchError extends Error {
  constructor(public enrollmentId: string) {
    super(`Enrollment ${enrollmentId} is not an active enrollment in this batch`);
  }
}

export async function bulkMarkAttendance(
  batchId: string,
  date: string,
  records: { enrollmentId: string; status: string }[],
  actorId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const r of records) {
      // INSERT...SELECT silently inserts zero rows if enrollmentId isn't an
      // active enrollment in this batch (stale roster, copy/paste, client
      // bug) — check rowCount rather than letting that pass as success, or
      // the caller's audit log would record a full success when one or more
      // students were never actually marked.
      const result = await client.query(
        `insert into attendance_records (id, enrollment_id, attendance_date, status, marked_by)
         select ?, se.id, ?, ?, ?
         from student_enrollments se
         where se.id = ? and se.course_batch_id = ? and se.status = 'active'
         on duplicate key update status = values(status), updated_by = ?, updated_at = now()`,
        [crypto.randomUUID(), date, r.status, actorId, r.enrollmentId, batchId, actorId],
      );
      if (result.rowCount === 0) {
        throw new EnrollmentNotInBatchError(r.enrollmentId);
      }
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAttendanceById(id: string): Promise<AttendanceRow | null> {
  const { rows } = await pool.query<AttendanceRow>(`select * from attendance_records where id = ?`, [id]);
  return rows[0] ?? null;
}

export async function updateAttendanceStatus(id: string, status: string, actorId: string): Promise<AttendanceRow | null> {
  const result = await pool.query(
    `update attendance_records set status = ?, updated_by = ?, updated_at = now()
     where id = ?`,
    [status, actorId, id],
  );
  if (result.rowCount === 0) return null;
  const { rows } = await pool.query<AttendanceRow>(`select * from attendance_records where id = ?`, [id]);
  return rows[0] ?? null;
}

export async function getHistoryForEnrollment(enrollmentId: string): Promise<AttendanceRow[]> {
  const { rows } = await pool.query<AttendanceRow>(
    `select * from attendance_records where enrollment_id = ? order by attendance_date desc`,
    [enrollmentId],
  );
  return rows;
}

export interface MonthlySummaryRow {
  enrollment_id: string;
  student_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  present_count: string;
  absent_count: string;
  half_day_count: string;
}

export async function getBatchMonthlySummary(batchId: string, year: number, month: number): Promise<MonthlySummaryRow[]> {
  const { rows } = await pool.query<MonthlySummaryRow>(
    `select
       se.id as enrollment_id,
       s.id as student_id,
       s.admission_number,
       s.first_name,
       s.last_name,
       cast(sum(case when ar.status = 'present' then 1 else 0 end) as char) as present_count,
       cast(sum(case when ar.status = 'absent' then 1 else 0 end) as char) as absent_count,
       cast(sum(case when ar.status = 'half_day' then 1 else 0 end) as char) as half_day_count
     from student_enrollments se
     join students s on s.id = se.student_id
     left join attendance_records ar
       on ar.enrollment_id = se.id
       and extract(year from ar.attendance_date) = ?
       and extract(month from ar.attendance_date) = ?
     where se.course_batch_id = ? and se.status = 'active'
     group by se.id, s.id, s.admission_number, s.first_name, s.last_name
     order by s.first_name, s.last_name`,
    [year, month, batchId],
  );
  return rows;
}
