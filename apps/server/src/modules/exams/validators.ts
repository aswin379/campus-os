import { z } from 'zod';

export const enterMarkSchema = z.object({
  enrollmentId: z.string().uuid(),
  assessmentComponentId: z.string().uuid(),
  marksObtained: z.number().min(0),
  remarks: z.string().optional(),
});
