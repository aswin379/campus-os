import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

export const SOURCES = ['walk_in', 'phone', 'website', 'referral', 'social_media', 'advertisement', 'other'] as const;
const STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'] as const;

export const createLeadSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  source: z.enum(SOURCES),
  interestedCourseId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const updateLeadSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  // .nullable() lets the client explicitly clear these fields by sending
  // null; omitting the key entirely still means "leave unchanged" — see
  // leads/repository.ts's updateLead for how the two are told apart.
  email: z.string().email().nullable().optional(),
  source: z.enum(SOURCES).optional(),
  status: z.enum(STATUSES).optional(),
  interestedCourseId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const listLeadsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  source: z.enum(SOURCES).optional(),
  followupDueToday: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const createFollowupSchema = z.object({
  followupDate: isoDateString,
  notes: z.string().min(1),
  nextFollowupDate: isoDateString.optional(),
});
