import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import * as repo from './repository.js';

export interface CourseDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationValue: number;
  durationUnit: string;
  status: string;
  createdAt: string;
}

function toCourseDto(row: repo.CourseRow): CourseDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    durationValue: row.duration_value,
    durationUnit: row.duration_unit,
    status: row.status,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ER_DUP_ENTRY';
}

export async function listCourses(): Promise<CourseDto[]> {
  return (await repo.listCourses()).map(toCourseDto);
}

export async function getCourse(id: string): Promise<CourseDto> {
  const row = await repo.getCourseById(id);
  if (!row) throw new HttpError(404, 'Course not found');
  return toCourseDto(row);
}

export async function createCourse(
  actorId: string,
  input: { name: string; code: string; description?: string; durationValue: number; durationUnit: string },
): Promise<CourseDto> {
  try {
    const created = await repo.createCourse({
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      durationValue: input.durationValue,
      durationUnit: input.durationUnit,
    });
    await recordAudit({
      actorStaffId: actorId,
      action: 'course.create',
      entityType: 'course',
      entityId: created.id,
      afterData: input,
    });
    return toCourseDto(created);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'A course with this code already exists');
    throw err;
  }
}

export async function updateCourse(
  actorId: string,
  id: string,
  input: { name?: string; code?: string; description?: string; durationValue?: number; durationUnit?: string; status?: string },
): Promise<CourseDto> {
  const before = await repo.getCourseById(id);
  if (!before) throw new HttpError(404, 'Course not found');

  let updated: repo.CourseRow | null;
  try {
    updated = await repo.updateCourse(id, input);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'A course with this code already exists');
    throw err;
  }
  if (!updated) throw new HttpError(404, 'Course not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'course.update',
    entityType: 'course',
    entityId: id,
    beforeData: before,
    afterData: input,
  });

  return toCourseDto(updated);
}

// --- Assessment components ---

export interface AssessmentComponentDto {
  id?: string;
  name: string;
  maxMarks: number;
  weightPercent: number;
  sequence: number;
}

export async function getAssessmentStructure(
  courseId: string,
): Promise<{ components: AssessmentComponentDto[]; passPercentage: number | null }> {
  const [components, passPercentage] = await Promise.all([
    repo.listAssessmentComponents(courseId),
    repo.getPassPercentage(courseId),
  ]);
  return {
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      maxMarks: Number(c.max_marks),
      weightPercent: Number(c.weight_percent),
      sequence: c.sequence,
    })),
    passPercentage,
  };
}

const WEIGHT_TOLERANCE = 0.01;

export async function setAssessmentStructure(
  actorId: string,
  courseId: string,
  input: { components: AssessmentComponentDto[]; passPercentage: number },
): Promise<void> {
  const course = await repo.getCourseById(courseId);
  if (!course) throw new HttpError(404, 'Course not found');

  const totalWeight = input.components.reduce((sum, c) => sum + c.weightPercent, 0);
  if (Math.abs(totalWeight - 100) > WEIGHT_TOLERANCE) {
    throw new HttpError(400, `Assessment component weights must sum to 100 (got ${totalWeight})`);
  }
  if (input.passPercentage < 0 || input.passPercentage > 100) {
    throw new HttpError(400, 'Pass percentage must be between 0 and 100');
  }

  if (await repo.courseHasExamMarks(courseId)) {
    throw new HttpError(
      409,
      'Cannot change the assessment structure: marks have already been entered for this course. ' +
        'Editing the structure would permanently delete those marks. Contact support if this course genuinely needs restructuring.',
    );
  }

  await repo.replaceAssessmentComponents(
    courseId,
    input.components.map((c, i) => ({
      name: c.name,
      maxMarks: c.maxMarks,
      weightPercent: c.weightPercent,
      sequence: c.sequence ?? i,
    })),
  );
  await repo.setPassPercentage(courseId, input.passPercentage);

  await recordAudit({
    actorStaffId: actorId,
    action: 'course.assessment_structure_update',
    entityType: 'course',
    entityId: courseId,
    afterData: input,
  });
}

// --- Course batches ---

export interface CourseBatchDto {
  id: string;
  courseId: string;
  batchName: string;
  startDate: string;
  endDatePlanned: string;
  endDateActual: string | null;
  status: string;
}

function toBatchDto(row: repo.CourseBatchRow): CourseBatchDto {
  return {
    id: row.id,
    courseId: row.course_id,
    batchName: row.batch_name,
    startDate: row.start_date,
    endDatePlanned: row.end_date_planned,
    endDateActual: row.end_date_actual,
    status: row.status,
  };
}

export async function listBatchesForCourse(courseId: string): Promise<CourseBatchDto[]> {
  return (await repo.listBatchesForCourse(courseId)).map(toBatchDto);
}

export async function createBatch(
  actorId: string,
  input: { courseId: string; batchName: string; startDate: string; endDatePlanned: string },
): Promise<CourseBatchDto> {
  const course = await repo.getCourseById(input.courseId);
  if (!course) throw new HttpError(404, 'Course not found');
  if (input.endDatePlanned < input.startDate) {
    throw new HttpError(400, 'Planned end date must be after the start date');
  }

  const created = await repo.createBatch(input);
  await recordAudit({
    actorStaffId: actorId,
    action: 'course_batch.create',
    entityType: 'course_batch',
    entityId: created.id,
    afterData: input,
  });
  return toBatchDto(created);
}

const VALID_BATCH_STATUSES = ['upcoming', 'ongoing', 'completed', 'archived'];

export async function setBatchStatus(actorId: string, id: string, status: string): Promise<CourseBatchDto> {
  if (!VALID_BATCH_STATUSES.includes(status)) throw new HttpError(400, 'Invalid batch status');

  const before = await repo.getBatchById(id);
  if (!before) throw new HttpError(404, 'Batch not found');

  const endDateActual = status === 'completed' ? new Date().toISOString().slice(0, 10) : null;
  const updated = await repo.setBatchStatus(id, status, endDateActual);
  if (!updated) throw new HttpError(404, 'Batch not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'course_batch.status_change',
    entityType: 'course_batch',
    entityId: id,
    beforeData: { status: before.status },
    afterData: { status },
  });

  return toBatchDto(updated);
}

// --- Enrollments ---

export interface EnrollmentDto {
  id: string;
  studentId: string;
  courseBatchId: string;
  enrollmentDate: string;
  status: string;
  completionDate: string | null;
}

export interface EnrollmentWithStudentDto extends EnrollmentDto {
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

function toEnrollmentDto(row: repo.EnrollmentRow): EnrollmentDto {
  return {
    id: row.id,
    studentId: row.student_id,
    courseBatchId: row.course_batch_id,
    enrollmentDate: row.enrollment_date,
    status: row.status,
    completionDate: row.completion_date,
  };
}

export async function listEnrollmentsForBatch(batchId: string): Promise<EnrollmentWithStudentDto[]> {
  const rows = await repo.listEnrollmentsForBatchWithStudents(batchId);
  return rows.map((row) => ({
    ...toEnrollmentDto(row),
    admissionNumber: row.admission_number,
    firstName: row.first_name,
    lastName: row.last_name,
  }));
}

export interface EnrollmentWithCourseDto extends EnrollmentDto {
  batchName: string;
  courseName: string;
  courseCode: string;
}

export async function listEnrollmentsForStudent(studentId: string): Promise<EnrollmentWithCourseDto[]> {
  const rows = await repo.listEnrollmentsForStudentWithCourse(studentId);
  return rows.map((row) => ({
    ...toEnrollmentDto(row),
    batchName: row.batch_name,
    courseName: row.course_name,
    courseCode: row.course_code,
  }));
}

export async function enrollStudent(
  actorId: string,
  input: { studentId: string; courseBatchId: string; enrollmentDate: string },
): Promise<EnrollmentDto> {
  const batch = await repo.getBatchById(input.courseBatchId);
  if (!batch) throw new HttpError(404, 'Course batch not found');
  if (batch.status === 'archived') throw new HttpError(400, 'Cannot enroll into an archived batch');

  // getCourseById already filters deleted_at, so a soft-deleted course's
  // batches are rejected here too, not just deactivated ones.
  const course = await repo.getCourseById(batch.course_id);
  if (!course || course.status !== 'active') {
    throw new HttpError(400, 'Cannot enroll into a batch whose course is not active');
  }

  try {
    const created = await repo.createEnrollment(input);
    await recordAudit({
      actorStaffId: actorId,
      action: 'enrollment.create',
      entityType: 'student_enrollment',
      entityId: created.id,
      afterData: input,
    });
    return toEnrollmentDto(created);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'Student is already enrolled in this batch');
    throw err;
  }
}

const VALID_ENROLLMENT_STATUSES = ['active', 'completed', 'dropped', 'transferred'];

export async function setEnrollmentStatus(actorId: string, id: string, status: string): Promise<EnrollmentDto> {
  if (!VALID_ENROLLMENT_STATUSES.includes(status)) throw new HttpError(400, 'Invalid enrollment status');

  const completionDate = status === 'completed' ? new Date().toISOString().slice(0, 10) : null;
  const updated = await repo.setEnrollmentStatus(id, status, completionDate);
  if (!updated) throw new HttpError(404, 'Enrollment not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'enrollment.status_change',
    entityType: 'student_enrollment',
    entityId: id,
    afterData: { status },
  });

  return toEnrollmentDto(updated);
}
