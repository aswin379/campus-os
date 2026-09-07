exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('leads', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    full_name: { type: 'text', notNull: true },
    phone: { type: 'text', notNull: true },
    email: { type: 'text' },
    source: {
      type: 'text',
      notNull: true,
      check: "source in ('walk_in', 'phone', 'website', 'referral', 'social_media', 'advertisement', 'other')",
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'new',
      check: "status in ('new', 'contacted', 'interested', 'converted', 'lost')",
    },
    interested_course_id: { type: 'uuid', references: 'courses', onDelete: 'set null' },
    assigned_to: { type: 'uuid', references: 'staff', onDelete: 'set null' },
    notes: { type: 'text' },
    created_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    deleted_at: { type: 'timestamptz' },
  });
  pgm.createIndex('leads', 'status');
  pgm.createIndex('leads', 'source');
  pgm.createIndex('leads', 'full_name');
  pgm.createIndex('leads', 'phone');

  pgm.createTable('lead_followups', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    lead_id: { type: 'uuid', notNull: true, references: 'leads', onDelete: 'cascade' },
    followup_date: { type: 'date', notNull: true },
    notes: { type: 'text', notNull: true },
    next_followup_date: { type: 'date' },
    created_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('lead_followups', 'lead_id');
};

exports.down = (pgm) => {
  pgm.dropTable('lead_followups');
  pgm.dropTable('leads');
};
