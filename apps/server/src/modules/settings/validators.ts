import { z } from 'zod';

export const updateSettingsSchema = z.object({
  instituteName: z.string().min(1).optional(),
  instituteAddress: z.string().optional(),
  institutePhone: z.string().optional(),
  instituteEmail: z.string().optional(),
  receiptPrefix: z.string().min(1).optional(),
  receiptTermsText: z.string().optional(),
});
