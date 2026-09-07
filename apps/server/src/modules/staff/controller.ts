import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import {
  createRoleSchema,
  createStaffSchema,
  permissionOverrideSchema,
  resetPasswordSchema,
  setActiveSchema,
  updateRolePermissionsSchema,
  updateStaffSchema,
} from './validators.js';

export async function listStaff(_req: Request, res: Response): Promise<void> {
  res.json(await service.listStaff());
}

export async function getStaff(req: Request, res: Response): Promise<void> {
  res.json(await service.getStaff(req.params.id!));
}

export async function createStaff(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createStaffSchema, req.body, res);
  if (!data) return;
  const created = await service.createStaff(req.user!.id, data);
  res.status(201).json(created);
}

export async function updateStaff(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateStaffSchema, req.body, res);
  if (!data) return;
  const updated = await service.updateStaff(req.user!.id, req.params.id!, data);
  res.json(updated);
}

export async function setStaffActive(req: Request, res: Response): Promise<void> {
  const data = parseOr400(setActiveSchema, req.body, res);
  if (!data) return;
  await service.setStaffActive(req.user!.id, req.params.id!, data.isActive);
  res.status(204).send();
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const data = parseOr400(resetPasswordSchema, req.body, res);
  if (!data) return;
  await service.resetStaffPassword(req.user!.id, req.user!.isSuperAdmin, req.params.id!, data.newPassword);
  res.status(204).send();
}

export async function listRoles(_req: Request, res: Response): Promise<void> {
  res.json(await service.listRolesWithPermissions());
}

export async function createRole(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createRoleSchema, req.body, res);
  if (!data) return;
  const role = await service.createRole(req.user!.id, data);
  res.status(201).json(role);
}

export async function updateRolePermissions(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateRolePermissionsSchema, req.body, res);
  if (!data) return;
  await service.updateRolePermissions(req.user!.id, req.params.id!, data.permissionKeys);
  res.status(204).send();
}

export async function listPermissions(_req: Request, res: Response): Promise<void> {
  res.json(await service.listPermissions());
}

export async function setStaffPermissionOverride(req: Request, res: Response): Promise<void> {
  const data = parseOr400(permissionOverrideSchema, req.body, res);
  if (!data) return;
  await service.setStaffPermissionOverride(req.user!.id, req.params.id!, data.permissionKey, data.effect);
  res.status(204).send();
}
