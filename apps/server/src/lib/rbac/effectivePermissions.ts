import type { PermissionKey } from '@erp/shared';
import { pool } from '../../db/pool.js';

/**
 * Effective permissions = union of all permissions from the staff member's
 * roles, plus per-staff overrides. A 'revoke' override wins over any 'grant'
 * (from a role or another override) so an admin can always lock down a
 * specific staff member without restructuring roles.
 */
export async function computeEffectivePermissions(staffId: string): Promise<PermissionKey[]> {
  // EXCEPT/CTEs require MySQL 8.0.31+.
  const { rows } = await pool.query<{ key: string }>(
    `
    with role_perms as (
      select p.\`key\` as \`key\`
      from staff_roles sr
      join role_permissions rp on rp.role_id = sr.role_id
      join permissions p on p.id = rp.permission_id
      where sr.staff_id = ?
    ),
    granted as (
      select p.\`key\` as \`key\`
      from staff_permission_overrides spo
      join permissions p on p.id = spo.permission_id
      where spo.staff_id = ? and spo.effect = 'grant'
    ),
    revoked as (
      select p.\`key\` as \`key\`
      from staff_permission_overrides spo
      join permissions p on p.id = spo.permission_id
      where spo.staff_id = ? and spo.effect = 'revoke'
    )
    select \`key\` from role_perms
    union
    select \`key\` from granted
    except
    select \`key\` from revoked
    `,
    [staffId, staffId, staffId],
  );

  return rows.map((r) => r.key as PermissionKey);
}

export async function isSuperAdmin(staffId: string): Promise<boolean> {
  const { rows } = await pool.query<{ is_super_admin: boolean }>(
    `select is_super_admin from staff where id = ? and deleted_at is null`,
    [staffId],
  );
  return rows[0]?.is_super_admin ?? false;
}
