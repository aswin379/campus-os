import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { sqlIn } from '../../db/sqlHelpers.js';

export interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export async function listStaff(): Promise<StaffRow[]> {
  const { rows } = await pool.query<StaffRow>(
    `select id, full_name, email, phone, is_active, is_super_admin, last_login_at, created_at
     from staff where deleted_at is null order by full_name`,
  );
  return rows;
}

export async function getStaffById(id: string): Promise<StaffRow | null> {
  const { rows } = await pool.query<StaffRow>(
    `select id, full_name, email, phone, is_active, is_super_admin, last_login_at, created_at
     from staff where id = ? and deleted_at is null`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findStaffByEmail(email: string): Promise<StaffRow | null> {
  const { rows } = await pool.query<StaffRow>(
    `select id, full_name, email, phone, is_active, is_super_admin, last_login_at, created_at
     from staff where email = ? and deleted_at is null`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createStaff(input: {
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
}): Promise<StaffRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into staff (id, full_name, email, phone, password_hash)
     values (?, ?, ?, ?, ?)`,
    [id, input.fullName, input.email.toLowerCase().trim(), input.phone, input.passwordHash],
  );
  const { rows } = await pool.query<StaffRow>(
    `select id, full_name, email, phone, is_active, is_super_admin, last_login_at, created_at
     from staff where id = ?`,
    [id],
  );
  return rows[0]!;
}

export async function updateStaff(
  id: string,
  input: { fullName?: string; email?: string; phone?: string },
): Promise<StaffRow | null> {
  const result = await pool.query(
    `update staff set
       full_name = coalesce(?, full_name),
       email = coalesce(?, email),
       phone = coalesce(?, phone),
       updated_at = now()
     where id = ? and deleted_at is null`,
    [input.fullName ?? null, input.email?.toLowerCase().trim() ?? null, input.phone ?? null, id],
  );
  if (result.rowCount === 0) return null;
  const { rows } = await pool.query<StaffRow>(
    `select id, full_name, email, phone, is_active, is_super_admin, last_login_at, created_at
     from staff where id = ? and deleted_at is null`,
    [id],
  );
  return rows[0] ?? null;
}

export async function setStaffActive(id: string, isActive: boolean): Promise<void> {
  await pool.query(`update staff set is_active = ?, updated_at = now() where id = ?`, [isActive, id]);
}

export async function getStaffRoleIds(staffId: string): Promise<string[]> {
  const { rows } = await pool.query<{ role_id: string }>(
    `select role_id from staff_roles where staff_id = ?`,
    [staffId],
  );
  return rows.map((r) => r.role_id);
}

/** Batched alternative to calling getStaffRoleIds once per row (avoids an N+1 when listing staff). */
export async function getRoleIdsForStaffMembers(staffIds: string[]): Promise<Map<string, string[]>> {
  const byStaff = new Map<string, string[]>();
  if (staffIds.length === 0) return byStaff;

  const { clause, params } = sqlIn(staffIds);
  const { rows } = await pool.query<{ staff_id: string; role_id: string }>(
    `select staff_id, role_id from staff_roles where staff_id in ${clause}`,
    params,
  );
  for (const row of rows) {
    const existing = byStaff.get(row.staff_id);
    if (existing) existing.push(row.role_id);
    else byStaff.set(row.staff_id, [row.role_id]);
  }
  return byStaff;
}

export async function setStaffRoles(staffId: string, roleIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`delete from staff_roles where staff_id = ?`, [staffId]);
    for (const roleId of roleIds) {
      await client.query(`insert into staff_roles (staff_id, role_id) values (?, ?)`, [staffId, roleId]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function listRoles(): Promise<RoleRow[]> {
  const { rows } = await pool.query<RoleRow>(`select id, name, description, is_system from roles order by name`);
  return rows;
}

export async function getRolePermissionKeys(roleId: string): Promise<string[]> {
  const { rows } = await pool.query<{ key: string }>(
    `select p.\`key\` as \`key\` from role_permissions rp join permissions p on p.id = rp.permission_id where rp.role_id = ?`,
    [roleId],
  );
  return rows.map((r) => r.key);
}

/** Batched alternative to calling getRolePermissionKeys once per row (avoids an N+1 when listing roles). */
export async function getPermissionKeysForRoles(roleIds: string[]): Promise<Map<string, string[]>> {
  const byRole = new Map<string, string[]>();
  if (roleIds.length === 0) return byRole;

  const { clause, params } = sqlIn(roleIds);
  const { rows } = await pool.query<{ role_id: string; key: string }>(
    `select rp.role_id, p.\`key\` as \`key\`
     from role_permissions rp
     join permissions p on p.id = rp.permission_id
     where rp.role_id in ${clause}`,
    params,
  );
  for (const row of rows) {
    const existing = byRole.get(row.role_id);
    if (existing) existing.push(row.key);
    else byRole.set(row.role_id, [row.key]);
  }
  return byRole;
}

export async function createRole(input: { name: string; description: string | null }): Promise<RoleRow> {
  const id = crypto.randomUUID();
  await pool.query(`insert into roles (id, name, description) values (?, ?, ?)`, [id, input.name, input.description]);
  const { rows } = await pool.query<RoleRow>(`select id, name, description, is_system from roles where id = ?`, [id]);
  return rows[0]!;
}

export async function setRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`delete from role_permissions where role_id = ?`, [roleId]);
    if (permissionKeys.length > 0) {
      const { clause, params } = sqlIn(permissionKeys);
      await client.query(
        `insert into role_permissions (role_id, permission_id)
         select ?, id from permissions where \`key\` in ${clause}`,
        [roleId, ...params],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function listPermissions(): Promise<{ key: string; module: string; description: string | null }[]> {
  const { rows } = await pool.query<{ key: string; module: string; description: string | null }>(
    `select \`key\`, module, description from permissions order by module, \`key\``,
  );
  return rows;
}

export async function setStaffPermissionOverride(
  staffId: string,
  permissionKey: string,
  effect: 'grant' | 'revoke' | null,
): Promise<void> {
  await pool.query(
    `delete from staff_permission_overrides
     where staff_id = ? and permission_id = (select id from permissions where \`key\` = ?)`,
    [staffId, permissionKey],
  );
  if (effect) {
    await pool.query(
      `insert into staff_permission_overrides (staff_id, permission_id, effect)
       select ?, id, ? from permissions where \`key\` = ?`,
      [staffId, effect, permissionKey],
    );
  }
}
