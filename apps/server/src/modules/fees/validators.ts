import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

const installmentSchema = z.object({
  installmentNumber: z.number().int().positive(),
  amount: z.number().positive(),
  dueOffsetDays: z.number().int().min(0).default(0),
});

const additionalChargeSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  isOptional: z.boolean().default(false),
});

export const createFeeStructureSchema = z.object({
  courseId: z.string().uuid(),
  name: z.string().min(1),
  totalAmount: z.number().positive(),
  effectiveFrom: isoDateString,
  installments: z.array(installmentSchema).optional(),
  additionalCharges: z.array(additionalChargeSchema).optional(),
});

export const setFeeStructureActiveSchema = z.object({
  isActive: z.boolean(),
});

export const addDiscountSchema = z.object({
  enrollmentId: z.string().uuid(),
  reason: z.string().min(1),
  amount: z.number().positive(),
});

export const generateFeePlanSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const collectPaymentSchema = z.object({
  enrollmentId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMode: z.enum(['cash', 'cheque', 'online', 'card']),
  paymentReference: z.string().optional(),
  paymentDate: isoDateString,
  notes: z.string().optional(),
});

export const voidTransactionSchema = z.object({
  reason: z.string().min(1),
});
