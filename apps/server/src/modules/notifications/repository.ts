import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface NotificationTemplateRow {
  id: string;
  key: string;
  channel: string;
  subject: string | null;
  body_template: string;
  is_active: boolean;
}

export async function listTemplates(): Promise<NotificationTemplateRow[]> {
  const { rows } = await pool.query<NotificationTemplateRow>(`select * from notification_templates order by \`key\``);
  return rows;
}

export async function getTemplate(key: string): Promise<NotificationTemplateRow | null> {
  const { rows } = await pool.query<NotificationTemplateRow>(`select * from notification_templates where \`key\` = ?`, [key]);
  return rows[0] ?? null;
}

export async function upsertTemplate(input: {
  key: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
}): Promise<NotificationTemplateRow> {
  await pool.query(
    `insert into notification_templates (id, \`key\`, channel, subject, body_template, is_active)
     values (?, ?, ?, ?, ?, ?)
     on duplicate key update
       channel = values(channel), subject = values(subject),
       body_template = values(body_template), is_active = values(is_active)`,
    [crypto.randomUUID(), input.key, input.channel, input.subject, input.bodyTemplate, input.isActive],
  );
  const { rows } = await pool.query<NotificationTemplateRow>(`select * from notification_templates where \`key\` = ?`, [input.key]);
  return rows[0]!;
}

export interface OverdueInstallmentRow {
  enrollment_id: string;
  amount_due: string;
  amount_paid: string;
  due_date: string;
  course_name: string;
  first_name: string;
  last_name: string;
}

/** One row per overdue/pending installment past its due date, earliest due date first (so grouping by enrollment keeps the most urgent one). */
export async function listOverdueInstallments(): Promise<OverdueInstallmentRow[]> {
  const { rows } = await pool.query<OverdueInstallmentRow>(
    `select se.id as enrollment_id, sfi.amount_due, sfi.amount_paid, sfi.due_date, c.name as course_name,
            s.first_name, s.last_name
     from student_fee_installments sfi
     join student_fee_plans sfp on sfp.id = sfi.student_fee_plan_id
     join student_enrollments se on se.id = sfp.enrollment_id
     join students s on s.id = se.student_id
     join course_batches cb on cb.id = se.course_batch_id
     join courses c on c.id = cb.course_id
     where sfi.status != 'paid' and sfi.due_date <= current_date and se.status = 'active'
     order by sfi.due_date`,
  );
  return rows;
}

export interface NotificationLogRow {
  id: string;
  recipient_type: string;
  recipient_id: string;
  channel: string;
  template_key: string;
  rendered_body: string;
  status: string;
  provider_name: string;
  provider_response: unknown;
  sent_at: string | null;
  created_at: string;
}

export async function insertLog(input: {
  recipientType: string;
  recipientId: string;
  channel: string;
  templateKey: string;
  renderedBody: string;
  status: string;
  providerName: string;
  providerResponse: unknown;
  sentAt: string | null;
}): Promise<void> {
  await pool.query(
    `insert into notification_log
       (recipient_type, recipient_id, channel, template_key, rendered_body, status, provider_name, provider_response, sent_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.recipientType,
      input.recipientId,
      input.channel,
      input.templateKey,
      input.renderedBody,
      input.status,
      input.providerName,
      input.providerResponse ? JSON.stringify(input.providerResponse) : null,
      input.sentAt,
    ],
  );
}

export async function listLogs(
  filters: { recipientId?: string; templateKey?: string },
  limit: number,
): Promise<NotificationLogRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.recipientId) {
    params.push(filters.recipientId);
    conditions.push(`recipient_id = ?`);
  }
  if (filters.templateKey) {
    params.push(filters.templateKey);
    conditions.push(`template_key = ?`);
  }
  params.push(limit);

  const { rows } = await pool.query<NotificationLogRow>(
    `select * from notification_log
     ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
     order by created_at desc limit ?`,
    params,
  );
  return rows;
}

/** Dedup guard for the daily fee-due-reminder job so it doesn't resend every run for the same overdue installment. */
export async function wasReminderSentToday(templateKey: string, recipientId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: number }>(
    `select exists(
       select 1 from notification_log
       where template_key = ? and recipient_id = ? and date(created_at) = current_date
     ) as \`exists\``,
    [templateKey, recipientId],
  );
  return Boolean(rows[0]?.exists);
}

export interface NotificationSettingRow {
  channel: string;
  provider_name: string;
  config: Record<string, unknown>;
}

export async function listSettings(): Promise<NotificationSettingRow[]> {
  const { rows } = await pool.query<NotificationSettingRow>(`select * from notification_settings order by channel`);
  return rows;
}

export async function setSetting(channel: string, providerName: string, config: Record<string, unknown>): Promise<void> {
  await pool.query(
    `insert into notification_settings (channel, provider_name, config)
     values (?, ?, ?)
     on duplicate key update provider_name = values(provider_name), config = values(config)`,
    [channel, providerName, JSON.stringify(config)],
  );
}
