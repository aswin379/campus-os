import cron from 'node-cron';
import { checkAndSendFeeDueReminders } from '../modules/notifications/service.js';
import { checkInWithLicenseServer } from './license/checkin.js';

/** Runs once daily at 09:00 server time — after institute opening hours, before the day's collection activity starts. */
export function startScheduledJobs(): void {
  cron.schedule('0 9 * * *', async () => {
    try {
      const { sent, skipped } = await checkAndSendFeeDueReminders();
      console.log(`[scheduler] fee due reminders: sent ${sent}, skipped ${skipped} (already reminded today)`);
    } catch (err) {
      console.error('[scheduler] fee due reminder job failed:', err);
    }
  });

  // Also once daily — checkInWithLicenseServer itself never throws (it
  // catches and caches failures), but wrapped anyway on the same defensive
  // principle as the job above: one job failing must never take down the
  // scheduler for the others.
  cron.schedule('30 9 * * *', async () => {
    try {
      await checkInWithLicenseServer();
    } catch (err) {
      console.error('[scheduler] license check-in job failed:', err);
    }
  });
}
