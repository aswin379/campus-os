import crypto from 'node:crypto';
import type { PoolClient } from '../../db/pool.js';
import { pool } from '../../db/pool.js';

type Queryable = typeof pool | PoolClient;

/**
 * Serializes concurrent publishResult calls for the same enrollment.
 * Unlike Postgres's pg_advisory_xact_lock, MySQL's GET_LOCK is
 * session-scoped, not transaction-scoped — it does NOT auto-release at
 * commit/rollback. The caller (exams/service.ts's publishResult) MUST call
 * releaseEnrollmentPublishLock in its `finally` block before releasing the
 * connection back to the pool, or the lock would stay held on that pooled
 * connection and could wedge an unrelated later transaction that happens to
 * reuse it.
 */
export async function acquireEnrollmentPublishLock(client: PoolClient, enrollmentId: string): Promise<void> {
  await client.query('select get_lock(?, 10)', [`exam_publish:${enrollmentId}`]);
}

export async function releaseEnrollmentPublishLock(client: PoolClient, enrollmentId: string): Promise<void> {
  await client.query('select release_lock(?)', [`exam_publish:${enrollmentId}`]);
}

export async function getEnrollmentCourseInfo(enrollmentId: string): Promise<{ courseId: string } | null> {
  const { rows } = await pool.query<{ course_id: string }>(
    `select cb.course_id
     from student_enrollments se
     join course_batches cb on cb.id = se.course_batch_id
     where se.id = ?`,
    [enrollmentId],
  );
  return rows[0] ? { courseId: rows[0].course_id } : null;
}

export async function getAssessmentComponent(id: string): Promise<{ id: string; courseId: string; maxMarks: number } | null> {
  const { rows } = await pool.query<{ id: string; course_id: string; max_marks: string }>(
    `select id, course_id, max_marks from course_assessment_components where id = ?`,
    [id],
  );
  const row = rows[0];
  return row ? { id: row.id, courseId: row.course_id, maxMarks: Number(row.max_marks) } : null;
}

export interface ExamMarkRow {
  id: string;
  enrollment_id: string;
  assessment_component_id: string;
  marks_obtained: string;
  remarks: string | null;
  entered_by: string;
  entered_at: string;
  component_name: string;
  max_marks: string;
  weight_percent: string;
  sequence: number;
}

export async function getMarksForEnrollment(enrollmentId: string): Promise<ExamMarkRow[]> {
  const { rows } = await pool.query<ExamMarkRow>(
    `select em.id, em.enrollment_id, em.assessment_component_id, em.marks_obtained, em.remarks,
            em.entered_by, em.entered_at, cac.name as component_name, cac.max_marks, cac.weight_percent, cac.sequence
     from exam_marks em
     join course_assessment_components cac on cac.id = em.assessment_component_id
     where em.enrollment_id = ?
     order by cac.sequence`,
    [enrollmentId],
  );
  return rows;
}

export async function upsertMark(input: {
  enrollmentId: string;
  assessmentComponentId: string;
  marksObtained: number;
  remarks: string | null;
  enteredBy: string;
}): Promise<void> {
  await pool.query(
    `insert into exam_marks (id, enrollment_id, assessment_component_id, marks_obtained, remarks, entered_by)
     values (?, ?, ?, ?, ?, ?)
     on duplicate key update marks_obtained = values(marks_obtained), remarks = values(remarks),
                   entered_by = values(entered_by), entered_at = now()`,
    [crypto.randomUUID(), input.enrollmentId, input.assessmentComponentId, input.marksObtained, input.remarks, input.enteredBy],
  );
}

export interface ExamResultRow {
  id: string;
  enrollment_id: string;
  total_percentage: string | null;
  result_status: string;
  computed_at: string;
  published_at: string | null;
  certificate_number: string | null;
  certificate_issued_at: string | null;
}

export async function getResultByEnrollment(enrollmentId: string, db: Queryable = pool): Promise<ExamResultRow | null> {
  const { rows } = await db.query<ExamResultRow>(`select * from exam_results where enrollment_id = ?`, [enrollmentId]);
  return rows[0] ?? null;
}

export async function upsertResult(
  input: {
    enrollmentId: string;
    totalPercentage: number;
    resultStatus: string;
    publishedAt: string | null;
    certificateNumber: string | null;
  },
  db: Queryable = pool,
): Promise<ExamResultRow> {
  await db.query(
    `insert into exam_results (id, enrollment_id, total_percentage, result_status, computed_at, published_at, certificate_number, certificate_issued_at)
     values (?, ?, ?, ?, now(), ?, ?, case when ? is not null then now() else null end)
     on duplicate key update
       total_percentage = values(total_percentage),
       result_status = values(result_status),
       computed_at = now(),
       published_at = coalesce(exam_results.published_at, values(published_at)),
       certificate_number = coalesce(exam_results.certificate_number, values(certificate_number)),
       certificate_issued_at = coalesce(exam_results.certificate_issued_at, values(certificate_issued_at))`,
    [
      crypto.randomUUID(),
      input.enrollmentId,
      input.totalPercentage,
      input.resultStatus,
      input.publishedAt,
      input.certificateNumber,
      input.certificateNumber,
    ],
  );
  const { rows } = await db.query<ExamResultRow>(`select * from exam_results where enrollment_id = ?`, [input.enrollmentId]);
  return rows[0]!;
}

export async function nextCertificateNumber(client: PoolClient, year: number): Promise<string> {
  await client.query(
    `insert into certificate_number_sequences (year, last_number)
     values (?, 1)
     on duplicate key update last_number = LAST_INSERT_ID(last_number + 1)`,
    [year],
  );
  const { rows } = await client.query<{ seq: number }>(`select LAST_INSERT_ID() as seq`);
  return `CERT/${year}/${String(rows[0]!.seq).padStart(4, '0')}`;
}
