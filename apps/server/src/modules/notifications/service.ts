import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { getPrimaryContactPhone } from '../../lib/enrollmentContext.js';
import { getProvider, IMPLEMENTED_PROVIDERS } from '../../lib/notify/index.js';
import { toMysqlDatetime } from '../../db/sqlHelpers.js';
import * as repo from './repository.js';

function render(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
}

/**
 * Never throws — a notification failure (bad template, provider down,
 * missing contact info) must never roll back or block the business
 * transaction it's attached to (e.g. a fee payment must still succeed even
 * if SMS delivery fails). Always logs the attempt, successful or not.
 */
export async function notify(input: {
  templateKey: string;
  recipientType: string;
  recipientId: string;
  to: string | null;
  variables: Record<string, string>;
}): Promise<void> {
  const template = await repo.getTemplate(input.templateKey);
  if (!template || !template.is_active) {
    console.warn(`[notify] template "${input.templateKey}" not found or inactive; skipping`);
    return;
  }
  if (!input.to) {
    await repo.insertLog({
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel: template.channel,
      templateKey: input.templateKey,
      renderedBody: '',
      status: 'failed',
      providerName: 'none',
      providerResponse: { errorMessage: 'No contact address on file for this recipient' },
      sentAt: null,
    });
    return;
  }

  const body = render(template.body_template, input.variables);
  const subject = template.subject ? render(template.subject, input.variables) : undefined;

  try {
    const provider = await getProvider(template.channel as 'sms' | 'email');
    const result = await provider.send({ channel: template.channel as 'sms' | 'email', to: input.to, subject, body });
    await repo.insertLog({
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel: template.channel,
      templateKey: input.templateKey,
      renderedBody: body,
      status: result.success ? 'sent' : 'failed',
      providerName: provider.name,
      providerResponse: result.success ? result.providerResponse : { errorMessage: result.errorMessage },
      sentAt: result.success ? toMysqlDatetime(new Date().toISOString()) : null,
    });
  } catch (err) {
    console.error(`[notify] failed to send "${input.templateKey}" to ${input.to}:`, err);
    await repo.insertLog({
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel: template.channel,
      templateKey: input.templateKey,
      renderedBody: body,
      status: 'failed',
      providerName: 'unknown',
      providerResponse: { errorMessage: err instanceof Error ? err.message : String(err) },
      sentAt: null,
    });
  }
}

/**
 * Run once a day (see lib/scheduler.ts). One reminder per enrollment per
 * day even if it has multiple overdue installments — the earliest due date
 * wins since listOverdueInstallments is ordered by due_date, and the dedup
 * guard (wasReminderSentToday) keys on enrollment so a student is never
 * sent more than one reminder SMS in the same run.
 */
export async function checkAndSendFeeDueReminders(): Promise<{ sent: number; skipped: number }> {
  const rows = await repo.listOverdueInstallments();
  const seenEnrollments = new Set<string>();
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    if (seenEnrollments.has(row.enrollment_id)) continue;
    seenEnrollments.add(row.enrollment_id);

    if (await repo.wasReminderSentToday('fee_due_reminder', row.enrollment_id)) {
      skipped++;
      continue;
    }

    const phone = await getPrimaryContactPhone(row.enrollment_id);
    const balance = Number(row.amount_due) - Number(row.amount_paid);
    await notify({
      templateKey: 'fee_due_reminder',
      recipientType: 'student_enrollment',
      recipientId: row.enrollment_id,
      to: phone,
      variables: {
        studentName: `${row.first_name} ${row.last_name}`,
        amount: balance.toFixed(2),
        courseName: row.course_name,
        dueDate: row.due_date,
      },
    });
    sent++;
  }

  return { sent, skipped };
}

export interface TemplateDto {
  key: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
}

function toTemplateDto(row: repo.NotificationTemplateRow): TemplateDto {
  return {
    key: row.key,
    channel: row.channel,
    subject: row.subject,
    bodyTemplate: row.body_template,
    isActive: row.is_active,
  };
}

export async function listTemplates(): Promise<TemplateDto[]> {
  return (await repo.listTemplates()).map(toTemplateDto);
}

export async function upsertTemplate(
  actorId: string,
  input: { key: string; channel: string; subject?: string; bodyTemplate: string; isActive: boolean },
): Promise<TemplateDto> {
  if (input.channel !== 'sms' && input.channel !== 'email') {
    throw new HttpError(400, 'channel must be "sms" or "email"');
  }
  const saved = await repo.upsertTemplate({
    key: input.key,
    channel: input.channel,
    subject: input.subject ?? null,
    bodyTemplate: input.bodyTemplate,
    isActive: input.isActive,
  });
  await recordAudit({
    actorStaffId: actorId,
    action: 'notification_template.upsert',
    entityType: 'notification_template',
    entityId: saved.key,
    afterData: input,
  });
  return toTemplateDto(saved);
}

export interface LogDto {
  id: string;
  recipientType: string;
  recipientId: string;
  channel: string;
  templateKey: string;
  status: string;
  providerName: string;
  sentAt: string | null;
  createdAt: string;
}

export async function listLogs(filters: { recipientId?: string; templateKey?: string }): Promise<LogDto[]> {
  const rows = await repo.listLogs(filters, 200);
  return rows.map((r) => ({
    id: r.id,
    recipientType: r.recipient_type,
    recipientId: r.recipient_id,
    channel: r.channel,
    templateKey: r.template_key,
    status: r.status,
    providerName: r.provider_name,
    sentAt: r.sent_at,
    createdAt: r.created_at,
  }));
}

export async function listSettings() {
  const rows = await repo.listSettings();
  return rows.map((r) => ({ channel: r.channel, providerName: r.provider_name, config: r.config }));
}

export async function setSetting(
  actorId: string,
  channel: string,
  providerName: string,
  config: Record<string, unknown>,
): Promise<void> {
  if (channel !== 'sms' && channel !== 'email') {
    throw new HttpError(400, 'channel must be "sms" or "email"');
  }
  if (!(IMPLEMENTED_PROVIDERS as readonly string[]).includes(providerName)) {
    throw new HttpError(400, `Unknown provider "${providerName}". Implemented providers: ${IMPLEMENTED_PROVIDERS.join(', ')}`);
  }
  await repo.setSetting(channel, providerName, config);
  await recordAudit({
    actorStaffId: actorId,
    action: 'notification_setting.update',
    entityType: 'notification_setting',
    entityId: channel,
    afterData: { providerName },
  });
}
