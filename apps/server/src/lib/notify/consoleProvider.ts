import type { NotificationProvider, NotificationResult, OutboundMessage } from './types.js';

/**
 * Default provider for v1 — no real SMS/email account required. Logs the
 * message and reports success so the rest of the notification pipeline
 * (templates, logging, trigger points like payment confirmation) can be
 * built and demoed end-to-end before a real gateway is wired in.
 */
export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = 'console';

  async send(message: OutboundMessage): Promise<NotificationResult> {
    console.log(`[notify:${message.channel}] to=${message.to} subject=${message.subject ?? ''}\n${message.body}`);
    return { success: true, providerResponse: { loggedAt: new Date().toISOString() } };
  }
}
