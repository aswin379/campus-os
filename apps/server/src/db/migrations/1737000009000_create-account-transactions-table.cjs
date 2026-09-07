exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('account_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    type: { type: 'text', notNull: true, check: "type in ('income', 'expense')" },
    category: { type: 'text', notNull: true },
    amount: { type: 'numeric(12,2)', notNull: true, check: 'amount > 0' },
    transaction_date: { type: 'date', notNull: true },
    payment_mode: {
      type: 'text',
      notNull: true,
      check: "payment_mode in ('cash', 'cheque', 'online', 'card')",
    },
    description: { type: 'text' },
    recorded_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    deleted_at: { type: 'timestamptz' },
  });
  pgm.createIndex('account_transactions', 'type');
  pgm.createIndex('account_transactions', 'transaction_date');
  pgm.createIndex('account_transactions', 'category');
};

exports.down = (pgm) => {
  pgm.dropTable('account_transactions');
};
