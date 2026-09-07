import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { hashPassword } from '../auth/service.js';
import { deleteAllSessionsForStaff, updatePasswordHash } from '../auth/repository.js';
import * as repo from './repository.js';

export interface StaffWithRoles {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roleIds: string[];
}

async function toStaffWithRoles(row: repo.StaffRow): Promise<StaffWithRoles> {
  const roleIds = await repo.getStaffRoleIds(row.id);
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
    isSuperAdmin: row.is_super_admin,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    roleIds,
  };
}

export async function listStaff(): Promise<StaffWithRoles[]> {
  const rows = await repo.listStaff();
  const roleIdsByStaff = await repo.getRoleIdsForStaffMembers(rows.map((r) => r.id));
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
    isSuperAdmin: row.is_super_admin,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    roleIds: roleIdsByStaff.get(row.id) ?? [],
  }));
}

export async function getStaff(id: string): Promise<StaffWithRoles> {
  const row = await repo.getStaffById(id);
  if (!row) throw new HttpError(404, 'Staff not found');
  return toStaffWithRoles(row);
}

export async function createStaff(
  actorId: string,
  input: { fullName: string; email: string; phone?: string; password: string; roleIds: string[] },
): Promise<StaffWithRoles> {
  const existing = await repo.findStaffByEmail(input.email.toLowerCase().trim());
  if (existing) throw new HttpError(409, 'A staff member with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const created = await repo.createStaff({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash,
  });
  await repo.setStaffRoles(created.id, input.roleIds);
  await recordAudit({
    actorStaffId: actorId,
    action: 'staff.create',
    entityType: 'staff',
    entityId: created.id,
    afterData: { fullName: input.fullName, email: input.email, roleIds: input.roleIds },
  });
  return toStaffWithRoles(created);
}

export async function updateStaff(
  actorId: string,
  id: string,
  input: { fullName?: string; email?: string; phone?: string; roleIds?: string[] },
): Promise<StaffWithRoles> {
  if (input.roleIds && actorId === id) {
    throw new HttpError(400, 'You cannot change your own roles — ask another admin to do it');
  }

  const before = await repo.getStaffById(id);
  if (!before) throw new HttpError(404, 'Staff not found');

  if (input.email) {
    const existing = await repo.findStaffByEmail(input.email.toLowerCase().trim());
    if (existing && existing.id !== id) {
      throw new HttpError(409, 'A staff member with this email already exists');
    }
  }

  const updated = await repo.updateStaff(id, input);
  if (!updated) throw new HttpError(404, 'Staff not found');

  if (input.roleIds) {
    await repo.setStaffRoles(id, input.roleIds);
  }

  await recordAudit({
    actorStaffId: actorId,
    action: 'staff.update',
    entityType: 'staff',
    entityId: id,
    beforeData: before,
    afterData: input,
  });

  return toStaffWithRoles(updated);
}

export async function setStaffActive(actorId: string, id: string, isActive: boolean): Promise<void> {
  const staff = await repo.getStaffById(id);
  if (!staff) throw new HttpError(404, 'Staff not found');
  if (staff.is_super_admin && !isActive) {
    throw new HttpError(400, 'Cannot deactivate a super admin account');
  }

  await repo.setStaffActive(id, isActive);
  await recordAudit({
    actorStaffId: actorId,
    action: isActive ? 'staff.activate' : 'staff.deactivate',
    entityType: 'staff',
    entityId: id,
  });
}

/**
 * Admin-initiated reset (no current password required) — distinct from
 * modules/auth/service.ts's changePassword, which is the self-service flow
 * that does require it. Every existing session for the target is
 * invalidated (not just "other" sessions, since the target isn't the one
 * making this request), so a reset actually locks out anyone using the old
 * password immediately, not just on their next login attempt.
 */
export async function resetStaffPassword(
  actorId: string,
  actorIsSuperAdmin: boolean,
  staffId: string,
  newPassword: string,
): Promise<void> {
  const staff = await repo.getStaffById(staffId);
  if (!staff) throw new HttpError(404, 'Staff not found');
  if (staff.is_super_admin && !actorIsSuperAdmin) {
    throw new HttpError(403, "Only a super admin can reset another super admin's password");
  }

  const passwordHash = await hashPassword(newPassword);
  await updatePasswordHash(staffId, passwordHash);
  await deleteAllSessionsForStaff(staffId);

  await recordAudit({
    actorStaffId: actorId,
    action: 'staff.reset_password',
    entityType: 'staff',
    entityId: staffId,
  });
}

export async function listRolesWithPermissions() {
  const roles = await repo.listRoles();
  const permissionKeysByRole = await repo.getPermissionKeysForRoles(roles.map((r) => r.id));
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.is_system,
    permissionKeys: permissionKeysByRole.get(role.id) ?? [],
  }));
}

export async function createRole(
  actorId: string,
  input: { name: string; description?: string; permissionKeys: string[] },
) {
  const role = await repo.createRole({ name: input.name, description: input.description ?? null });
  await repo.setRolePermissions(role.id, input.permissionKeys);
  await recordAudit({
    actorStaffId: actorId,
    action: 'role.create',
    entityType: 'role',
    entityId: role.id,
    afterData: input,
  });
  return { ...role, permissionKeys: input.permissionKeys };
}

export async function updateRolePermissions(actorId: string, roleId: string, permissionKeys: string[]) {
  const before = await repo.getRolePermissionKeys(roleId);
  await repo.setRolePermissions(roleId, permissionKeys);
  await recordAudit({
    actorStaffId: actorId,
    action: 'role.update_permissions',
    entityType: 'role',
    entityId: roleId,
    beforeData: { permissionKeys: before },
    afterData: { permissionKeys },
  });
}

export async function listPermissions() {
  return repo.listPermissions();
}

export async function setStaffPermissionOverride(
  actorId: string,
  staffId: string,
  permissionKey: string,
  effect: 'grant' | 'revoke' | null,
): Promise<void> {
  if (actorId === staffId) {
    throw new HttpError(400, 'You cannot change your own permission overrides — ask another admin to do it');
  }

  await repo.setStaffPermissionOverride(staffId, permissionKey, effect);
  await recordAudit({
    actorStaffId: actorId,
    action: 'staff.permission_override',
    entityType: 'staff',
    entityId: staffId,
    afterData: { permissionKey, effect },
  });
}
