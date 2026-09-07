import bcrypt from 'bcrypt';
import { HttpError } from '../../middleware/errorHandler.js';
import { computeEffectivePermissions } from '../../lib/rbac/effectivePermissions.js';
import { recordAudit } from '../../lib/audit/log.js';
import * as repo from './repository.js';

const BCRYPT_COST = 12;

// Compared against when no account exists, so login takes roughly the same
// time whether or not the email is registered — otherwise a missing account
// returns in ~1ms (no bcrypt work) while a real one takes ~200ms (bcrypt
// cost 12), letting an attacker enumerate valid staff emails by timing.
const DUMMY_HASH_FOR_TIMING_SAFETY = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export interface LoginResult {
  staffId: string;
  fullName: string;
  isSuperAdmin: boolean;
  permissions: string[];
  roles: string[];
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const staff = await repo.findStaffByEmail(email.toLowerCase().trim());

  const passwordMatches = await bcrypt.compare(password, staff?.password_hash ?? DUMMY_HASH_FOR_TIMING_SAFETY);
  if (!staff || !staff.is_active || !passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const [permissions, roles] = await Promise.all([
    computeEffectivePermissions(staff.id),
    repo.getStaffRoleNames(staff.id),
  ]);

  await repo.touchLastLogin(staff.id);
  await recordAudit({
    actorStaffId: staff.id,
    action: 'auth.login',
    entityType: 'staff',
    entityId: staff.id,
  });

  return {
    staffId: staff.id,
    fullName: staff.full_name,
    isSuperAdmin: staff.is_super_admin,
    permissions,
    roles,
  };
}

export async function getCurrentUserDetails(staffId: string): Promise<{ fullName: string; roles: string[] }> {
  const [fullName, roles] = await Promise.all([repo.getStaffFullName(staffId), repo.getStaffRoleNames(staffId)]);
  return { fullName: fullName ?? '', roles };
}

export async function changePassword(
  staffId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string,
): Promise<void> {
  const currentHash = await repo.findStaffPasswordHash(staffId);
  if (!currentHash) {
    throw new HttpError(404, 'Staff not found');
  }

  const matches = await bcrypt.compare(currentPassword, currentHash);
  if (!matches) {
    throw new HttpError(401, 'Current password is incorrect');
  }

  if (newPassword.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await repo.updatePasswordHash(staffId, newHash);
  // A session hijacked before the password change must not survive it —
  // otherwise changing the password to lock an attacker out doesn't
  // actually lock them out. The caller's own current session is kept alive.
  await repo.deleteOtherSessionsForStaff(staffId, currentSessionId);
  await recordAudit({
    actorStaffId: staffId,
    action: 'auth.change_password',
    entityType: 'staff',
    entityId: staffId,
  });
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}
