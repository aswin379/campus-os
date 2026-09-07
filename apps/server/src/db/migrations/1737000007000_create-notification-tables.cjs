exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('notification_templates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    key: { type: 'text', notNull: true, unique: true },
    channel: { type: 'text', notNull: true, check: "channel in ('sms', 'email')" },
    subject: { type: 'text' },
    body_template: { type: 'text', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
  });

  pgm.createTable('notification_log', {
    id: 'id',
    recipient_type: { type: 'text', notNull: true },
    recipient_id: { type: 'uuid', notNull: true },
    channel: { type: 'text', notNull: true, check: "channel in ('sms', 'email')" },
    template_key: { type: 'text', notNull: true },
    rendered_body: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, check: "status in ('queued', 'sent', 'failed')" },
    provider_name: { type: 'text', notNull: true },
    provider_response: { type: 'jsonb' },
    sent_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('notification_log', ['recipient_type', 'recipient_id']);
  pgm.createIndex('notification_log', ['template_key', 'created_at']);

  pgm.createTable('notification_settings', {
    channel: { type: 'text', primaryKey: true, check: "channel in ('sms', 'email')" },
    provider_name: { type: 'text', notNull: true },
    config: { type: 'jsonb', notNull: true, default: '{}' },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('notification_settings');
  pgm.dropTable('notification_log');
  pgm.dropTable('notification_templates');
};
