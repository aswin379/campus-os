import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

export const rosterQuerySchema = z.object({
  batchId: z.string().uuid(),
  date: isoDateString,
});

export const markAttendanceSchema = z.object({
  batchId: z.string().uuid(),
  date: isoDateString,
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      status: z.enum(['present', 'absent', 'half_day']),
    }),
  ),
});

export const editAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'half_day']),
});

export const historyQuerySchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const batchSummaryQuerySchema = z.object({
  batchId: z.string().uuid(),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});
