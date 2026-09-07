import type { NotificationChannel } from '@erp/shared';

export interface OutboundMessage {
  channel: NotificationChannel;
  to: string;
  subject?: string;
  body: string;
  meta?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  providerResponse?: unknown;
  errorMessage?: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<NotificationResult>;
}
