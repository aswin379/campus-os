import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

const TYPES = ['income', 'expense'] as const;
const PAYMENT_MODES = ['cash', 'cheque', 'online', 'card'] as const;

export const createTransactionSchema = z.object({
  type: z.enum(TYPES),
  category: z.string().min(1),
  amount: z.number().positive(),
  transactionDate: isoDateString,
  paymentMode: z.enum(PAYMENT_MODES),
  description: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(TYPES).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  transactionDate: isoDateString.optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  // .nullable() lets the client explicitly clear this field by sending
  // null; omitting the key entirely still means "leave unchanged" — see
  // accounts/repository.ts's updateTransaction for how the two are told apart.
  description: z.string().nullable().optional(),
});

export const listTransactionsQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(TYPES).optional(),
  category: z.string().optional(),
  from: isoDateString.optional(),
  to: isoDateString.optional(),
});
