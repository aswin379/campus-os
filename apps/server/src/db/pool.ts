import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

/**
 * A thin pg-`Pool`/`PoolClient`-shaped wrapper around mysql2, so the ~15
 * repository/service files that were written against pg's `{ rows, rowCount }`
 * query result and `pool.connect()`/`client.release()` transaction pattern
 * don't need their call-site shapes rewritten — only their SQL text
 * (placeholders, RETURNING, ON CONFLICT, etc.) needed to change when porting
 * off Postgres.
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface PoolClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

const rawPool = mysql.createPool({
  uri: env.DATABASE_URL,
  // Keep DATE/DATETIME columns as raw strings instead of JS Date objects —
  // same rationale as the pg type-parser this replaces: every TypeScript
  // type in this codebase declares these fields as `string`, and letting
  // the driver hand back Date objects instead silently breaks any in-process
  // string use (already bit this app once, see git history on pool.ts).
  dateStrings: true,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  // Without this, MySQL's UPDATE affectedRows only counts rows whose values
  // actually changed — unlike Postgres, which counts every row matched by
  // WHERE regardless of whether the SET values differ. Several repository
  // functions use rowCount === 0 to mean "no row with this id", not "no
  // values changed"; FOUND_ROWS makes affectedRows match that assumption.
  flags: ['FOUND_ROWS'],
  // MySQL has no native boolean type — `boolean` columns are TINYINT(1),
  // and mysql2's default TINY parser hands back a JS number (0/1), not a
  // JS boolean. Every TypeScript type in this codebase declares these
  // fields as `boolean` (a lie without this), and the mismatch is more than
  // cosmetic: a value round-tripped from a GET response back into a PATCH
  // body (e.g. a contact's isPrimary) then fails Zod's strict z.boolean()
  // validation, since 1/0 aren't booleans to Zod. Coerce at the one place
  // all rows pass through, same rationale as the dateStrings option above.
  typeCast(field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      const value = field.string();
      return value === null ? null : value === '1';
    }
    return next();
  },
});

rawPool.pool.on('error', (err) => {
  console.error('Unexpected error on idle MySQL connection', err);
});

// mysql2 returns a real row array for SELECT, but a single ResultSetHeader
// object (affectedRows/insertId/...) for INSERT/UPDATE/DELETE — unlike pg,
// which always returns `{ rows, rowCount }` regardless of statement type.
// Normalize both shapes back to the pg shape here, once, at the chokepoint.
function normalize<T>(result: unknown): QueryResult<T> {
  if (Array.isArray(result)) {
    return { rows: result as T[], rowCount: result.length };
  }
  const header = result as mysql.ResultSetHeader;
  return { rows: [], rowCount: header.affectedRows };
}

async function query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const [result] = await rawPool.query(sql, params);
  return normalize<T>(result);
}

export const pool = {
  query,
  async connect(): Promise<PoolClient> {
    const conn = await rawPool.getConnection();
    return {
      async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
        const [result] = await conn.query(sql, params);
        return normalize<T>(result);
      },
      release(): void {
        conn.release();
      },
    };
  },
  async end(): Promise<void> {
    await rawPool.end();
  },
};
