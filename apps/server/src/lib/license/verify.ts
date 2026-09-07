import { env } from '../../config/env.js';
import { readLicenseCache } from './checkin.js';

export type LicenseStatus =
  | { state: 'missing' }
  | { state: 'invalid'; reason: string }
  | { state: 'expired'; licensedTo: string; expiresAt: string }
  | { state: 'expiring_soon'; licensedTo: string; expiresAt: string; daysRemaining: number }
  | { state: 'valid'; licensedTo: string; expiresAt: string; daysRemaining: number };

// How long a cached "good" result is trusted without a fresh confirmation
// from the license server before the banner starts saying so — long enough
// to ride out a multi-day outage/migration of that server without alarming
// the client, short enough to still surface a real, prolonged problem.
const STALE_AFTER_DAYS = 14;

/**
 * Purely reads the local cache written by checkin.ts — never makes a
 * network call itself, so this is safe to call from a request handler
 * (the /api/v1/license/status route) without adding latency or a
 * dependency on the license server being reachable right now.
 */
export function getLicenseStatus(): LicenseStatus {
  if (!env.LICENSE_SERVER_URL || !env.LICENSE_KEY) {
    return { state: 'missing' };
  }

  const cache = readLicenseCache();
  if (!cache?.lastResponse || !cache.lastSuccessAt) {
    return { state: 'missing' };
  }

  const daysSinceSuccess = (Date.now() - new Date(cache.lastSuccessAt).getTime()) / (24 * 60 * 60 * 1000);
  if (daysSinceSuccess > STALE_AFTER_DAYS) {
    return {
      state: 'invalid',
      reason: `Could not reach the license server recently (last confirmed ${Math.floor(daysSinceSuccess)} days ago).`,
    };
  }

  const r = cache.lastResponse;
  const licensedTo = r.clientName ?? 'this installation';

  switch (r.state) {
    case 'not_found':
      return { state: 'invalid', reason: 'License key was not recognized by the license server.' };
    case 'suspended':
      return { state: 'invalid', reason: `Support license for ${licensedTo} is suspended.` };
    case 'cancelled':
      return { state: 'invalid', reason: `Support license for ${licensedTo} was cancelled.` };
    case 'expired':
      return { state: 'expired', licensedTo, expiresAt: r.expiresAt ?? '' };
    case 'expiring_soon':
      return { state: 'expiring_soon', licensedTo, expiresAt: r.expiresAt ?? '', daysRemaining: r.daysRemaining ?? 0 };
    case 'valid':
      return { state: 'valid', licensedTo, expiresAt: r.expiresAt ?? '', daysRemaining: r.daysRemaining ?? 0 };
  }
}
