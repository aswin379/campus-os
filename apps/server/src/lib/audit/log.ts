import { pool } from '../../db/pool.js';

interface AuditEntry {
  actorStaffId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
}

/**
 * Written explicitly from service-layer code at mutation points (not DB
 * triggers) so business-meaningful events (e.g. "permission granted") log
 * readable context rather than a raw column diff.
 *
 * Every caller does `await recordAudit(...)` right after the real write it
 * describes, with no try/catch — so a transient failure here (a pool
 * hiccup, a momentary DB blip) must never propagate, or it fails the whole
 * request (e.g. "Failed to save lead") even though the actual row was
 * already committed. Swallow and log instead, same as notification-send
 * failures are treated elsewhere in this app.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `insert into audit_log (actor_staff_id, action, entity_type, entity_id, before_data, after_data, ip_address)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.actorStaffId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.beforeData ? JSON.stringify(entry.beforeData) : null,
        entry.afterData ? JSON.stringify(entry.afterData) : null,
        entry.ipAddress ?? null,
      ],
    );
  } catch (err) {
    console.error('Failed to write audit log entry (action continued regardless):', entry.action, err);
  }
}
