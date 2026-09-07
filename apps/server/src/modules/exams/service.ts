import { pool } from '../../db/pool.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { toMysqlDatetime } from '../../db/sqlHelpers.js';
import { getPassPercentage, listAssessmentComponents } from '../courses/repository.js';
import * as repo from './repository.js';

export async function enterMark(
  actorId: string,
  input: { enrollmentId: string; assessmentComponentId: string; marksObtained: number; remarks?: string },
): Promise<void> {
  const component = await repo.getAssessmentComponent(input.assessmentComponentId);
  if (!component) throw new HttpError(404, 'Assessment component not found');

  const enrollmentInfo = await repo.getEnrollmentCourseInfo(input.enrollmentId);
  if (!enrollmentInfo) throw new HttpError(404, 'Enrollment not found');
  if (enrollmentInfo.courseId !== component.courseId) {
    throw new HttpError(400, 'This assessment component does not belong to the enrolled course');
  }

  if (input.marksObtained < 0 || input.marksObtained > component.maxMarks) {
    throw new HttpError(400, `Marks must be between 0 and ${component.maxMarks}`);
  }

  await repo.upsertMark({
    enrollmentId: input.enrollmentId,
    assessmentComponentId: input.assessmentComponentId,
    marksObtained: input.marksObtained,
    remarks: input.remarks ?? null,
    enteredBy: actorId,
  });

  await recordAudit({
    actorStaffId: actorId,
    action: 'exam.enter_mark',
    entityType: 'student_enrollment',
    entityId: input.enrollmentId,
    afterData: input,
  });
}

export interface MarkDto {
  componentId: string;
  componentName: string;
  maxMarks: number;
  weightPercent: number;
  marksObtained: number | null;
}

export async function getMarks(enrollmentId: string): Promise<MarkDto[]> {
  const info = await repo.getEnrollmentCourseInfo(enrollmentId);
  if (!info) throw new HttpError(404, 'Enrollment not found');

  const [components, marks] = await Promise.all([
    listAssessmentComponents(info.courseId),
    repo.getMarksForEnrollment(enrollmentId),
  ]);

  const marksByComponent = new Map(marks.map((m) => [m.assessment_component_id, m]));

  return components
    .filter((c) => c.is_active)
    .map((c) => {
      const mark = marksByComponent.get(c.id);
      return {
        componentId: c.id,
        componentName: c.name,
        maxMarks: Number(c.max_marks),
        weightPercent: Number(c.weight_percent),
        marksObtained: mark ? Number(mark.marks_obtained) : null,
      };
    });
}

export interface ComputedResult {
  totalPercentage: number | null;
  resultStatus: 'pass' | 'fail' | 'incomplete';
  passPercentage: number;
}

async function computeResult(enrollmentId: string, courseId: string): Promise<ComputedResult> {
  const [components, marks, passPercentage] = await Promise.all([
    listAssessmentComponents(courseId),
    repo.getMarksForEnrollment(enrollmentId),
    getPassPercentage(courseId),
  ]);

  const activeComponents = components.filter((c) => c.is_active);
  const marksByComponent = new Map(marks.map((m) => [m.assessment_component_id, m]));
  const pass = passPercentage ?? 40;

  const allEntered = activeComponents.every((c) => marksByComponent.has(c.id));
  if (!allEntered || activeComponents.length === 0) {
    return { totalPercentage: null, resultStatus: 'incomplete', passPercentage: pass };
  }

  const totalPercentage = activeComponents.reduce((sum, c) => {
    const mark = marksByComponent.get(c.id)!;
    const scored = Number(mark.marks_obtained) / Number(c.max_marks);
    return sum + scored * Number(c.weight_percent);
  }, 0);

  const rounded = Number(totalPercentage.toFixed(2));
  return {
    totalPercentage: rounded,
    resultStatus: rounded >= pass ? 'pass' : 'fail',
    passPercentage: pass,
  };
}

export interface ExamResultDto {
  enrollmentId: string;
  totalPercentage: number | null;
  resultStatus: string;
  passPercentage: number;
  publishedAt: string | null;
  certificateNumber: string | null;
}

export async function getResultPreview(enrollmentId: string): Promise<ExamResultDto> {
  const info = await repo.getEnrollmentCourseInfo(enrollmentId);
  if (!info) throw new HttpError(404, 'Enrollment not found');

  const existing = await repo.getResultByEnrollment(enrollmentId);

  // A published result is a frozen snapshot — show exactly what was
  // published, not a live recomputation, so status and percentage can never
  // disagree (e.g. if a mark is edited after publish, computeResult() would
  // reflect the edit while existing.result_status still reflects what was
  // actually published; mixing the two here would print a status paired
  // with a percentage that didn't produce it).
  if (existing?.published_at) {
    const passPercentage = (await getPassPercentage(info.courseId)) ?? 40;
    return {
      enrollmentId,
      totalPercentage: existing.total_percentage === null ? null : Number(existing.total_percentage),
      resultStatus: existing.result_status,
      passPercentage,
      publishedAt: existing.published_at,
      certificateNumber: existing.certificate_number,
    };
  }

  const computed = await computeResult(enrollmentId, info.courseId);
  return {
    enrollmentId,
    totalPercentage: computed.totalPercentage,
    resultStatus: computed.resultStatus,
    passPercentage: computed.passPercentage,
    publishedAt: null,
    certificateNumber: null,
  };
}

export async function publishResult(actorId: string, enrollmentId: string): Promise<ExamResultDto> {
  const info = await repo.getEnrollmentCourseInfo(enrollmentId);
  if (!info) throw new HttpError(404, 'Enrollment not found');

  const client = await pool.connect();
  try {
    await client.query('begin');

    // Held for the rest of this transaction so two concurrent publishes for
    // the same enrollment serialize — the second one only proceeds after the
    // first commits, by which point certificate_number is already set and
    // it takes the "already has a number" branch instead of allocating a
    // second one.
    await repo.acquireEnrollmentPublishLock(client, enrollmentId);

    const computed = await computeResult(enrollmentId, info.courseId);
    if (computed.resultStatus === 'incomplete') {
      throw new HttpError(400, 'Cannot publish: marks are not entered for all assessment components');
    }

    const existing = await repo.getResultByEnrollment(enrollmentId, client);
    let certificateNumber = existing?.certificate_number ?? null;

    if (computed.resultStatus === 'pass' && !certificateNumber) {
      certificateNumber = await repo.nextCertificateNumber(client, new Date().getFullYear());
    }

    const result = await repo.upsertResult(
      {
        enrollmentId,
        totalPercentage: computed.totalPercentage!,
        resultStatus: computed.resultStatus,
        publishedAt: existing?.published_at ?? toMysqlDatetime(new Date().toISOString()),
        certificateNumber,
      },
      client,
    );

    await client.query('commit');

    await recordAudit({
      actorStaffId: actorId,
      action: 'exam.publish_result',
      entityType: 'student_enrollment',
      entityId: enrollmentId,
      afterData: { resultStatus: computed.resultStatus, totalPercentage: computed.totalPercentage, certificateNumber },
    });

    return {
      enrollmentId,
      totalPercentage: Number(result.total_percentage),
      resultStatus: result.result_status,
      passPercentage: computed.passPercentage,
      publishedAt: result.published_at,
      certificateNumber: result.certificate_number,
    };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    // MySQL's GET_LOCK is session-scoped, not transaction-scoped like
    // Postgres's advisory lock — must be explicitly released before this
    // connection goes back to the pool, or it stays held for whichever
    // caller reuses this same pooled connection next (see repository.ts).
    await repo.releaseEnrollmentPublishLock(client, enrollmentId);
    client.release();
  }
}

