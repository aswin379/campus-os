import { pool } from '../../db/pool.js';

export interface StaffAuthRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  is_super_admin: boolean;
}

export async function findStaffByEmail(email: string): Promise<StaffAuthRow | null> {
  const { rows } = await pool.query<StaffAuthRow>(
    `select id, full_name, email, password_hash, is_active, is_super_admin
     from staff where email = ? and deleted_at is null`,
    [email],
  );
  return rows[0] ?? null;
}

export async function getStaffFullName(staffId: string): Promise<string | null> {
  const { rows } = await pool.query<{ full_name: string }>(
    `select full_name from staff where id = ? and deleted_at is null`,
    [staffId],
  );
  return rows[0]?.full_name ?? null;
}

export async function findStaffPasswordHash(staffId: string): Promise<string | null> {
  const { rows } = await pool.query<{ password_hash: string }>(
    `select password_hash from staff where id = ? and deleted_at is null`,
    [staffId],
  );
  return rows[0]?.password_hash ?? null;
}

export async function updatePasswordHash(staffId: string, passwordHash: string): Promise<void> {
  await pool.query(`update staff set password_hash = ?, updated_at = now() where id = ?`, [
    passwordHash,
    staffId,
  ]);
}

/**
 * A hijacked session should not survive the victim changing their password
 * to lock the attacker out. Keeps the caller's own current session alive
 * (excluded by session_id) so they aren't logged out of the device they just
 * used. `data` is express-mysql-session's session table column — a
 * JSON-stringified blob in a text column, not a native JSON column, but
 * JSON_EXTRACT/JSON_UNQUOTE work on valid JSON text regardless.
 */
export async function deleteOtherSessionsForStaff(staffId: string, currentSid: string): Promise<void> {
  await pool.query(
    `delete from sessions where json_unquote(json_extract(data, '$.staffId')) = ? and session_id != ?`,
    [staffId, currentSid],
  );
}

/**
 * Used when an admin resets someone else's password — unlike a self-service
 * password change (deleteOtherSessionsForStaff), there's no "current
 * session" of the target to preserve, so every session of theirs is
 * invalidated.
 */
export async function deleteAllSessionsForStaff(staffId: string): Promise<void> {
  await pool.query(`delete from sessions where json_unquote(json_extract(data, '$.staffId')) = ?`, [staffId]);
}

export async function touchLastLogin(staffId: string): Promise<void> {
  await pool.query(`update staff set last_login_at = now() where id = ?`, [staffId]);
}

export async function getStaffRoleNames(staffId: string): Promise<string[]> {
  const { rows } = await pool.query<{ name: string }>(
    `select r.name from staff_roles sr join roles r on r.id = sr.role_id where sr.staff_id = ?`,
    [staffId],
  );
  return rows.map((r) => r.name);
}
