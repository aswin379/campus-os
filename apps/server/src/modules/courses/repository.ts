import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface CourseRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  duration_value: number;
  duration_unit: string;
  status: string;
  created_at: string;
}

export interface CourseBatchRow {
  id: string;
  course_id: string;
  batch_name: string;
  start_date: string;
  end_date_planned: string;
  end_date_actual: string | null;
  status: string;
}

export interface AssessmentComponentRow {
  id: string;
  course_id: string;
  name: string;
  max_marks: string;
  weight_percent: string;
  sequence: number;
  is_active: boolean;
}

export interface EnrollmentRow {
  id: string;
  student_id: string;
  course_batch_id: string;
  enrollment_date: string;
  status: string;
  completion_date: string | null;
}

// --- Courses ---

export async function listCourses(): Promise<CourseRow[]> {
  const { rows } = await pool.query<CourseRow>(`select * from courses where deleted_at is null order by name`);
  return rows;
}

export async function getCourseById(id: string): Promise<CourseRow | null> {
  const { rows } = await pool.query<CourseRow>(`select * from courses where id = ? and deleted_at is null`, [id]);
  return rows[0] ?? null;
}

export async function createCourse(input: {
  name: string;
  code: string;
  description: string | null;
  durationValue: number;
  durationUnit: string;
}): Promise<CourseRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into courses (id, name, code, description, duration_value, duration_unit)
     values (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.code, input.description, input.durationValue, input.durationUnit],
  );
  const { rows } = await pool.query<CourseRow>(`select * from courses where id = ?`, [id]);
  return rows[0]!;
}

export async function updateCourse(
  id: string,
  input: {
    name?: string;
    code?: string;
    description?: string;
    durationValue?: number;
    durationUnit?: string;
    status?: string;
  },
): Promise<CourseRow | null> {
  const result = await pool.query(
    `update courses set
       name = coalesce(?, name),
       code = coalesce(?, code),
       description = coalesce(?, description),
       duration_value = coalesce(?, duration_value),
       duration_unit = coalesce(?, duration_unit),
       status = coalesce(?, status),
       updated_at = now()
     where id = ? and deleted_at is null`,
    [
      input.name ?? null,
      input.code ?? null,
      input.description ?? null,
      input.durationValue ?? null,
      input.durationUnit ?? null,
      input.status ?? null,
      id,
    ],
  );
  if (result.rowCount === 0) return null;
  const { rows } = await pool.query<CourseRow>(`select * from courses where id = ? and deleted_at is null`, [id]);
  return rows[0] ?? null;
}

// --- Assessment components & pass criteria ---

export async function listAssessmentComponents(courseId: string): Promise<AssessmentComponentRow[]> {
  const { rows } = await pool.query<AssessmentComponentRow>(
    `select * from course_assessment_components where course_id = ? order by sequence`,
    [courseId],
  );
  return rows;
}

export async function courseHasExamMarks(courseId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: number }>(
    `select exists(
       select 1 from exam_marks em
       join course_assessment_components cac on cac.id = em.assessment_component_id
       where cac.course_id = ?
     ) as \`exists\``,
    [courseId],
  );
  return Boolean(rows[0]?.exists);
}

export async function replaceAssessmentComponents(
  courseId: string,
  components: { name: string; maxMarks: number; weightPercent: number; sequence: number }[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // course_assessment_components -> exam_marks is ON DELETE RESTRICT (not
    // cascade) precisely so this delete fails loudly instead of silently
    // wiping historical marks if the pre-check below is ever bypassed.
    await client.query(`delete from course_assessment_components where course_id = ?`, [courseId]);
    for (const c of components) {
      await client.query(
        `insert into course_assessment_components (id, course_id, name, max_marks, weight_percent, sequence)
         values (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), courseId, c.name, c.maxMarks, c.weightPercent, c.sequence],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPassPercentage(courseId: string): Promise<number | null> {
  const { rows } = await pool.query<{ pass_percentage: string }>(
    `select pass_percentage from course_pass_criteria where course_id = ?`,
    [courseId],
  );
  return rows[0] ? Number(rows[0].pass_percentage) : null;
}

export async function setPassPercentage(courseId: string, passPercentage: number): Promise<void> {
  await pool.query(
    `insert into course_pass_criteria (course_id, pass_percentage)
     values (?, ?)
     on duplicate key update pass_percentage = values(pass_percentage)`,
    [courseId, passPercentage],
  );
}

// --- Course batches ---

export async function listBatchesForCourse(courseId: string): Promise<CourseBatchRow[]> {
  const { rows } = await pool.query<CourseBatchRow>(
    `select * from course_batches where course_id = ? order by start_date desc`,
    [courseId],
  );
  return rows;
}

export async function getBatchById(id: string): Promise<CourseBatchRow | null> {
  const { rows } = await pool.query<CourseBatchRow>(`select * from course_batches where id = ?`, [id]);
  return rows[0] ?? null;
}

export async function createBatch(input: {
  courseId: string;
  batchName: string;
  startDate: string;
  endDatePlanned: string;
}): Promise<CourseBatchRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into course_batches (id, course_id, batch_name, start_date, end_date_planned)
     values (?, ?, ?, ?, ?)`,
    [id, input.courseId, input.batchName, input.startDate, input.endDatePlanned],
  );
  const { rows } = await pool.query<CourseBatchRow>(`select * from course_batches where id = ?`, [id]);
  return rows[0]!;
}

export async function setBatchStatus(
  id: string,
  status: string,
  endDateActual: string | null,
): Promise<CourseBatchRow | null> {
  // Set directly, not coalesce — the caller already computes endDateActual
  // as a date when moving to 'completed' or null otherwise, and coalesce
  // would silently keep a stale date if a batch is later reverted off
  // 'completed' (e.g. back to 'ongoing').
  const result = await pool.query(
    `update course_batches set status = ?, end_date_actual = ?, updated_at = now()
     where id = ?`,
    [status, endDateActual, id],
  );
  if (result.rowCount === 0) return null;
  const { rows } = await pool.query<CourseBatchRow>(`select * from course_batches where id = ?`, [id]);
  return rows[0] ?? null;
}

// --- Enrollments ---

export interface EnrollmentWithStudentRow extends EnrollmentRow {
  admission_number: string;
  first_name: string;
  last_name: string;
}

/**
 * Joins student display fields in so the roster view doesn't need to fetch
 * each enrolled student individually (a batch of 60 students would
 * otherwise cost 60 extra HTTP round trips from the browser).
 */
export async function listEnrollmentsForBatchWithStudents(batchId: string): Promise<EnrollmentWithStudentRow[]> {
  const { rows } = await pool.query<EnrollmentWithStudentRow>(
    `select se.*, s.admission_number, s.first_name, s.last_name
     from student_enrollments se
     join students s on s.id = se.student_id
     where se.course_batch_id = ?
     order by se.enrollment_date`,
    [batchId],
  );
  return rows;
}

export async function listEnrollmentsForStudent(studentId: string): Promise<EnrollmentRow[]> {
  const { rows } = await pool.query<EnrollmentRow>(
    `select * from student_enrollments where student_id = ? order by enrollment_date desc`,
    [studentId],
  );
  return rows;
}

export interface EnrollmentWithCourseRow extends EnrollmentRow {
  batch_name: string;
  course_name: string;
  course_code: string;
}

/**
 * Joins batch/course display fields in so a student's enrollment cards can
 * show which course they're actually in — a bare enrollment row only has a
 * courseBatchId, which isn't human-readable on its own.
 */
export async function listEnrollmentsForStudentWithCourse(studentId: string): Promise<EnrollmentWithCourseRow[]> {
  const { rows } = await pool.query<EnrollmentWithCourseRow>(
    `select se.*, cb.batch_name, c.name as course_name, c.code as course_code
     from student_enrollments se
     join course_batches cb on cb.id = se.course_batch_id
     join courses c on c.id = cb.course_id
     where se.student_id = ?
     order by se.enrollment_date desc`,
    [studentId],
  );
  return rows;
}

export async function createEnrollment(input: {
  studentId: string;
  courseBatchId: string;
  enrollmentDate: string;
}): Promise<EnrollmentRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into student_enrollments (id, student_id, course_batch_id, enrollment_date)
     values (?, ?, ?, ?)`,
    [id, input.studentId, input.courseBatchId, input.enrollmentDate],
  );
  const { rows } = await pool.query<EnrollmentRow>(`select * from student_enrollments where id = ?`, [id]);
  return rows[0]!;
}

export async function setEnrollmentStatus(
  id: string,
  status: string,
  completionDate: string | null,
): Promise<EnrollmentRow | null> {
  // Set directly, not coalesce — see setBatchStatus above for why: the
  // caller already computes completionDate as null for any non-'completed'
  // status, and coalesce would leave a stale date if reverted off 'completed'.
  const result = await pool.query(
    `update student_enrollments set status = ?, completion_date = ?, updated_at = now()
     where id = ?`,
    [status, completionDate, id],
  );
  if (result.rowCount === 0) return null;
  const { rows } = await pool.query<EnrollmentRow>(`select * from student_enrollments where id = ?`, [id]);
  return rows[0] ?? null;
}
