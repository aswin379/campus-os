import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

export interface LicenseRow {
  license_key: string;
  client_name: string;
  status: 'active' | 'suspended' | 'cancelled';
  expires_at: string;
  created_at: string;
  updated_at: string;
  first_seen_instance_id: string | null;
  last_seen_instance_id: string | null;
  last_seen_at: string | null;
}

const dbPath = path.resolve(env.DB_PATH);

/**
 * A plain JSON file, not a real database — deliberately. This service
 * handles a handful of license rows with occasional writes (a check-in a
 * day per client, admin edits a few times a year), nowhere near the scale
 * that would justify a native-compiled DB driver (better-sqlite3) and the
 * cross-platform build fragility that comes with one (this is exactly the
 * kind of native-module friction that broke local dev on Windows here).
 * All reads/writes are synchronous, so within one Express handler there's
 * no `await` between read and write — Node's single-threaded event loop
 * can't interleave another request's handler in between, which is what
 * actually keeps concurrent requests from corrupting this file.
 */
function readAll(): LicenseRow[] {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(rows: LicenseRow[]): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // Write to a temp file then rename (atomic on the same filesystem) so a
  // crash mid-write can never leave licenses.json half-written/corrupt.
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(rows, null, 2));
  fs.renameSync(tmpPath, dbPath);
}

export function listLicenseRows(): LicenseRow[] {
  return readAll().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function findLicenseByKey(licenseKey: string): LicenseRow | undefined {
  return readAll().find((r) => r.license_key === licenseKey);
}

export function insertLicense(row: LicenseRow): void {
  const rows = readAll();
  rows.push(row);
  writeAll(rows);
}

export function updateLicense(licenseKey: string, patch: Partial<LicenseRow>): LicenseRow | undefined {
  const rows = readAll();
  const row = rows.find((r) => r.license_key === licenseKey);
  if (!row) return undefined;
  Object.assign(row, patch);
  writeAll(rows);
  return row;
}
