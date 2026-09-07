import { pool } from '../db/pool.js';

export interface EnrollmentDisplayContext {
  admission_number: string;
  first_name: string;
  last_name: string;
  course_name: string;
  batch_name: string;
}

/**
 * Student + course + batch display context for a given enrollment — used
 * anywhere a document (receipt, mark sheet, certificate) needs to print who
 * the enrollment belongs to. Shared rather than duplicated per module since
 * it's the same 4-table join regardless of which document is being built.
 */
export async function getEnrollmentDisplayContext(enrollmentId: string): Promise<EnrollmentDisplayContext | null> {
  const { rows } = await pool.query<EnrollmentDisplayContext>(
    `select s.admission_number, s.first_name, s.last_name, c.name as course_name, cb.batch_name
     from student_enrollments se
     join students s on s.id = se.student_id
     join course_batches cb on cb.id = se.course_batch_id
     join courses c on c.id = cb.course_id
     where se.id = ?`,
    [enrollmentId],
  );
  return rows[0] ?? null;
}

/** Best phone number to notify for an enrollment: the primary contact, falling back to any contact on file. */
export async function getPrimaryContactPhone(enrollmentId: string): Promise<string | null> {
  const { rows } = await pool.query<{ phone: string }>(
    `select sc.phone
     from student_enrollments se
     join student_contacts sc on sc.student_id = se.student_id
     where se.id = ?
     order by sc.is_primary desc
     limit 1`,
    [enrollmentId],
  );
  return rows[0]?.phone ?? null;
}
