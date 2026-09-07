import { createApp } from './app.js';
import { env } from './config/env.js';
import { startScheduledJobs } from './lib/scheduler.js';
import { getLicenseStatus } from './lib/license/verify.js';
import { checkInWithLicenseServer } from './lib/license/checkin.js';

// Defense in depth: Node terminates the process by default on an unhandled
// promise rejection. Every request-handling path should already route errors
// through asyncHandler/errorHandler, but a single missed `await` anywhere
// (this app or a dependency) would otherwise take down every user's session
// at once instead of failing the one request. Log loudly and keep running.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (this indicates a missing asyncHandler/await somewhere):', reason);
});

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`ERP server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Check in and log the result — after app.listen, not before, so a slow or
// unreachable license server never delays the app becoming available. Both
// the check-in itself and getLicenseStatus() are already fully tolerant of
// missing config/network failure (see lib/license/); this is purely
// informational logging. See docs/OPERATIONS.md "Support contract /
// license" for the renewal workflow.
checkInWithLicenseServer().finally(() => {
  const license = getLicenseStatus();
  if (license.state === 'missing') {
    console.warn('[license] Not configured or no license server reachable yet — support contract status unknown.');
  } else if (license.state === 'invalid') {
    console.warn(`[license] ${license.reason}`);
  } else if (license.state === 'expired') {
    console.warn(`[license] Support contract for "${license.licensedTo}" expired on ${license.expiresAt}.`);
  } else if (license.state === 'expiring_soon') {
    console.warn(`[license] Support contract for "${license.licensedTo}" expires in ${license.daysRemaining} day(s) (${license.expiresAt}).`);
  } else {
    console.log(`[license] Support contract for "${license.licensedTo}" valid until ${license.expiresAt}.`);
  }
});

startScheduledJobs();
