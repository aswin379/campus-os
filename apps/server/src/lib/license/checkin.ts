import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { getInstanceId } from './instanceId.js';

interface ValidateResponse {
  valid: boolean;
  state: 'valid' | 'expiring_soon' | 'expired' | 'suspended' | 'cancelled' | 'not_found';
  clientName?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

export interface LicenseCache {
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  lastResponse: ValidateResponse | null;
}

function cachePath(): string {
  return path.resolve(env.LICENSE_CACHE_PATH);
}

export function readLicenseCache(): LicenseCache | null {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeLicenseCache(cache: LicenseCache): void {
  const filePath = cachePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
}

/**
 * Called periodically (see lib/scheduler.ts) and once at startup — never
 * from the request path, so a slow or unreachable license server never adds
 * latency to an actual user request. Only ever writes to the local cache;
 * apps/server/src/lib/license/verify.ts reads that cache synchronously to
 * answer `getLicenseStatus()`, which is what the banner/status endpoint
 * actually calls.
 */
export async function checkInWithLicenseServer(): Promise<void> {
  const now = new Date().toISOString();
  const previous = readLicenseCache();

  if (!env.LICENSE_SERVER_URL || !env.LICENSE_KEY) {
    return; // nothing configured yet — getLicenseStatus() reports "missing"
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${env.LICENSE_SERVER_URL}/api/v1/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: env.LICENSE_KEY, instanceId: getInstanceId() }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) throw new Error(`License server responded ${res.status}`);
    const response = (await res.json()) as ValidateResponse;

    writeLicenseCache({ lastAttemptAt: now, lastSuccessAt: now, lastResponse: response });
  } catch (err) {
    console.warn('[license] check-in failed (will retry on next scheduled run):', err instanceof Error ? err.message : err);
    // Keep the last known-good response so a transient outage doesn't
    // immediately flip the banner — only lastAttemptAt advances, and
    // verify.ts applies its own grace period on top of lastSuccessAt.
    writeLicenseCache({
      lastAttemptAt: now,
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      lastResponse: previous?.lastResponse ?? null,
    });
  }
}
