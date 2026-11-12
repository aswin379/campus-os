import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

export const STAFF_ATTENDANCE_STATUSES = ['present', 'absent', 'leave'] as const;

export const rosterQuerySchema = z.object({
  date: isoDateString,
});

export const markStaffAttendanceSchema = z.object({
  date: isoDateString,
  records: z
    .array(
      z.object({
        staffId: z.string().uuid(),
        status: z.enum(STAFF_ATTENDANCE_STATUSES),
      }),
    )
    .min(1),
});

export const monthlySummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
