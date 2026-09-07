import { z } from 'zod';

export const upsertTemplateSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(['sms', 'email']),
  subject: z.string().optional(),
  bodyTemplate: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const setSettingSchema = z.object({
  channel: z.enum(['sms', 'email']),
  providerName: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});

export const listLogsQuerySchema = z.object({
  recipientId: z.string().uuid().optional(),
  templateKey: z.string().optional(),
});
