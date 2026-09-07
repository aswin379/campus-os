import { z } from 'zod';

/**
 * Strict 'YYYY-MM-DD' — every date field in this app is stored/compared as
 * this exact shape (see db/pool.ts's DATE type parser). A loose
 * `z.string().min(1)` lets malformed values like '2026-7-5' through, which
 * later breaks fixed-position string slicing (e.g. computeFinancialYear)
 * in ways that are wrong but don't throw.
 */
export const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Must be a valid calendar date');
