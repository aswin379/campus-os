import { pool } from '../db/pool.js';
import { sqlIn } from '../db/sqlHelpers.js';

/**
 * Read-only access to the settings key-value store for modules that just
 * need one value (receipt prefix, institute name on a PDF) without
 * depending on the whole settings module's controller/validators — settings
 * are stored as JSON, so a plain string value is unwrapped here.
 */
export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await pool.query<{ value: string | null }>(`select value from settings where \`key\` = ?`, [key]);
  const value = rows[0]?.value;
  return typeof value === 'string' ? value : null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const { clause, params } = sqlIn(keys);
  const { rows } = await pool.query<{ key: string; value: string | null }>(
    `select \`key\`, value from settings where \`key\` in ${clause}`,
    params,
  );
  const byKey = new Map(rows.map((r) => [r.key, typeof r.value === 'string' ? r.value : null]));
  return Object.fromEntries(keys.map((k) => [k, byKey.get(k) ?? null]));
}
