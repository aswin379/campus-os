import { pool } from '../../db/pool.js';
import { sqlIn } from '../../db/sqlHelpers.js';

export interface SettingRow {
  key: string;
  value: unknown;
}

export async function listByKeys(keys: string[]): Promise<SettingRow[]> {
  const { clause, params } = sqlIn(keys);
  const { rows } = await pool.query<SettingRow>(`select \`key\`, value from settings where \`key\` in ${clause}`, params);
  return rows;
}

export async function setMany(entries: { key: string; value: string }[], updatedBy: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const entry of entries) {
      await client.query(
        `insert into settings (\`key\`, value, updated_by, updated_at)
         values (?, ?, ?, now())
         on duplicate key update value = values(value), updated_by = values(updated_by), updated_at = now()`,
        [entry.key, JSON.stringify(entry.value), updatedBy],
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
