import { useEffect, useState } from 'react';
import { api } from '../api/client';

type LicenseStatus =
  | { state: 'missing' }
  | { state: 'invalid'; reason: string }
  | { state: 'expired'; licensedTo: string; expiresAt: string }
  | { state: 'expiring_soon'; licensedTo: string; expiresAt: string; daysRemaining: number }
  | { state: 'valid'; licensedTo: string; expiresAt: string; daysRemaining: number };

type LicenseStatusResponse = LicenseStatus & { supportContact: string | null };

/**
 * Purely informational — never hides or disables anything else in the app.
 * An expired/missing support contract is a billing conversation, not a
 * reason to lock an institute out of its own student/fee data.
 */
export function LicenseBanner() {
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null);

  useEffect(() => {
    api.get<LicenseStatusResponse>('/license/status').then(setStatus).catch(() => undefined);
  }, []);

  if (!status || status.state === 'valid') return null;

  const contactSuffix = status.supportContact ? ` Contact ${status.supportContact} to renew.` : ' Contact your vendor to renew.';

  let message: string;
  switch (status.state) {
    case 'missing':
      message = `No support license on file.${contactSuffix}`;
      break;
    case 'invalid':
      message = `Support license could not be verified (${status.reason})${contactSuffix}`;
      break;
    case 'expired':
      message = `Support contract for ${status.licensedTo} expired on ${status.expiresAt.slice(0, 10)}.${contactSuffix}`;
      break;
    case 'expiring_soon':
      message = `Support contract for ${status.licensedTo} expires in ${status.daysRemaining} day(s) (${status.expiresAt.slice(0, 10)}).${contactSuffix}`;
      break;
  }

  const tone = status.state === 'expiring_soon' ? 'alert-warning' : 'alert-error';

  return <div className={`alert ${tone}`}>{message}</div>;
}
