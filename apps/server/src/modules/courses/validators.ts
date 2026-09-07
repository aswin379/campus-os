import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

export const createCourseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  durationValue: z.number().int().positive(),
  durationUnit: z.enum(['months', 'years']),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  durationValue: z.number().int().positive().optional(),
  durationUnit: z.enum(['months', 'years']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const assessmentComponentSchema = z.object({
  name: z.string().min(1),
  maxMarks: z.number().positive(),
  weightPercent: z.number().min(0).max(100),
  sequence: z.number().int().default(0),
});

export const assessmentStructureSchema = z.object({
  components: z.array(assessmentComponentSchema).min(1),
  passPercentage: z.number().min(0).max(100),
});

export const createBatchSchema = z.object({
  batchName: z.string().min(1),
  startDate: isoDateString,
  endDatePlanned: isoDateString,
});

export const setBatchStatusSchema = z.object({
  status: z.enum(['upcoming', 'ongoing', 'completed', 'archived']),
});

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid(),
  courseBatchId: z.string().uuid(),
  enrollmentDate: isoDateString,
});

export const setEnrollmentStatusSchema = z.object({
  status: z.enum(['active', 'completed', 'dropped', 'transferred']),
});
