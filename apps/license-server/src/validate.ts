import type { Request, Response } from 'express';
import { z } from 'zod';
import { findLicenseByKey, updateLicense } from './db.js';

const WARNING_DAYS = 30;

const validateSchema = z.object({
  licenseKey: z.string().min(1),
  instanceId: z.string().min(1),
});

export function validate(req: Request, res: Response): void {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ valid: false, state: 'invalid_request' });
    return;
  }
  const { licenseKey, instanceId } = parsed.data;

  const license = findLicenseByKey(licenseKey);

  if (!license) {
    res.json({ valid: false, state: 'not_found' });
    return;
  }

  // Never blocks the check-in over a mismatch — a redeploy, server
  // migration, or restore-from-backup legitimately changes the instance id.
  // Surfaced here (server log) so the vendor can look at the admin listing
  // and decide whether it looks like an unauthorized second deployment
  // rather than software silently enforcing a false positive.
  if (license.last_seen_instance_id && license.last_seen_instance_id !== instanceId) {
    console.warn(
      `[license] "${license.client_name}" (${licenseKey}) checked in from a new instance id ` +
        `(was ${license.last_seen_instance_id}, now ${instanceId}) — verify this is an expected redeploy.`,
    );
  }

  updateLicense(licenseKey, {
    last_seen_at: new Date().toISOString(),
    last_seen_instance_id: instanceId,
    first_seen_instance_id: license.first_seen_instance_id ?? instanceId,
  });

  if (license.status !== 'active') {
    res.json({ valid: false, state: license.status, clientName: license.client_name });
    return;
  }

  const daysRemaining = Math.ceil((new Date(license.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const state = daysRemaining < 0 ? 'expired' : daysRemaining <= WARNING_DAYS ? 'expiring_soon' : 'valid';

  res.json({
    valid: state !== 'expired',
    state,
    clientName: license.client_name,
    expiresAt: license.expires_at,
    daysRemaining,
  });
}
