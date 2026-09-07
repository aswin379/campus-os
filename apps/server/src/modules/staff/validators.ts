import { z } from 'zod';

export const createStaffSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  roleIds: z.array(z.string().uuid()).min(1, 'Select at least one role'),
});

export const updateStaffSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});

export const permissionOverrideSchema = z.object({
  permissionKey: z.string(),
  effect: z.enum(['grant', 'revoke']).nullable(),
});
