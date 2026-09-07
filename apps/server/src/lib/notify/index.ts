import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { ConsoleNotificationProvider } from './consoleProvider.js';
import type { NotificationProvider } from './types.js';

export type { NotificationProvider, NotificationResult, OutboundMessage } from './types.js';

/** Single source of truth for both provider resolution and Settings validation, so they can't drift. */
export const IMPLEMENTED_PROVIDERS = ['console'] as const;

function resolveProvider(name: string): NotificationProvider {
  switch (name) {
    case 'console':
      return new ConsoleNotificationProvider();
    default:
      throw new Error(`Notification provider "${name}" is not implemented yet. Use "console" for now.`);
  }
}

const envDefault: Record<'sms' | 'email', NotificationProvider> = {
  sms: resolveProvider(env.SMS_PROVIDER),
  email: resolveProvider(env.EMAIL_PROVIDER),
};

/**
 * Looked up per-send (not cached at startup) so an admin switching the
 * active provider in Settings takes effect on the next notification without
 * a server restart. Falls back to the env-configured default if no row
 * exists yet in notification_settings for this channel.
 */
export async function getProvider(channel: 'sms' | 'email'): Promise<NotificationProvider> {
  const { rows } = await pool.query<{ provider_name: string }>(
    `select provider_name from notification_settings where channel = ?`,
    [channel],
  );
  const providerName = rows[0]?.provider_name;
  return providerName ? resolveProvider(providerName) : envDefault[channel];
}
