exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('fee_structures', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    course_id: { type: 'uuid', notNull: true, references: 'courses', onDelete: 'restrict' },
    name: { type: 'text', notNull: true },
    total_amount: { type: 'numeric(10,2)', notNull: true },
    effective_from: { type: 'date', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('fee_structures', 'course_id');

  pgm.createTable('fee_installments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    fee_structure_id: { type: 'uuid', notNull: true, references: 'fee_structures', onDelete: 'cascade' },
    installment_number: { type: 'integer', notNull: true },
    amount: { type: 'numeric(10,2)', notNull: true },
    due_offset_days: { type: 'integer', notNull: true, default: 0 },
  });
  pgm.createIndex('fee_installments', 'fee_structure_id');

  pgm.createTable('fee_additional_charges', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    fee_structure_id: { type: 'uuid', notNull: true, references: 'fee_structures', onDelete: 'cascade' },
    name: { type: 'text', notNull: true },
    amount: { type: 'numeric(10,2)', notNull: true },
    is_optional: { type: 'boolean', notNull: true, default: false },
  });
  pgm.createIndex('fee_additional_charges', 'fee_structure_id');

  pgm.createTable('fee_discounts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    enrollment_id: { type: 'uuid', notNull: true, references: 'student_enrollments', onDelete: 'cascade' },
    reason: { type: 'text', notNull: true },
    amount: { type: 'numeric(10,2)', notNull: true },
    approved_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    approved_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('fee_discounts', 'enrollment_id');

  pgm.createTable('student_fee_plans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    enrollment_id: { type: 'uuid', notNull: true, unique: true, references: 'student_enrollments', onDelete: 'restrict' },
    fee_structure_id: { type: 'uuid', notNull: true, references: 'fee_structures', onDelete: 'restrict' },
    total_payable: { type: 'numeric(10,2)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('student_fee_installments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    student_fee_plan_id: { type: 'uuid', notNull: true, references: 'student_fee_plans', onDelete: 'cascade' },
    installment_number: { type: 'integer', notNull: true },
    label: { type: 'text' },
    amount_due: { type: 'numeric(10,2)', notNull: true },
    due_date: { type: 'date', notNull: true },
    amount_paid: { type: 'numeric(10,2)', notNull: true, default: 0 },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status in ('pending', 'partial', 'paid', 'overdue')",
    },
  });
  pgm.createIndex('student_fee_installments', 'student_fee_plan_id');

  pgm.createTable('receipt_number_sequences', {
    financial_year: { type: 'text', primaryKey: true },
    last_number: { type: 'integer', notNull: true, default: 0 },
    prefix: { type: 'text' },
  });

  pgm.createTable('fee_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    enrollment_id: { type: 'uuid', notNull: true, references: 'student_enrollments', onDelete: 'restrict' },
    receipt_number: { type: 'text', notNull: true, unique: true },
    financial_year: { type: 'text', notNull: true },
    amount: { type: 'numeric(10,2)', notNull: true },
    payment_mode: { type: 'text', notNull: true, check: "payment_mode in ('cash', 'cheque', 'online', 'card')" },
    payment_reference: { type: 'text' },
    payment_date: { type: 'date', notNull: true },
    collected_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    transaction_type: { type: 'text', notNull: true, check: "transaction_type in ('payment', 'adjustment', 'void')" },
    reversed_transaction_id: { type: 'uuid', references: 'fee_transactions', onDelete: 'restrict' },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('fee_transactions', 'enrollment_id');
  pgm.createIndex('fee_transactions', 'financial_year');

  pgm.createTable('fee_transaction_installment_allocations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    fee_transaction_id: { type: 'uuid', notNull: true, references: 'fee_transactions', onDelete: 'cascade' },
    student_fee_installment_id: { type: 'uuid', notNull: true, references: 'student_fee_installments', onDelete: 'restrict' },
    amount_allocated: { type: 'numeric(10,2)', notNull: true },
  });
  pgm.createIndex('fee_transaction_installment_allocations', 'fee_transaction_id');
  pgm.createIndex('fee_transaction_installment_allocations', 'student_fee_installment_id');
};

exports.down = (pgm) => {
  pgm.dropTable('fee_transaction_installment_allocations');
  pgm.dropTable('fee_transactions');
  pgm.dropTable('receipt_number_sequences');
  pgm.dropTable('student_fee_installments');
  pgm.dropTable('student_fee_plans');
  pgm.dropTable('fee_discounts');
  pgm.dropTable('fee_additional_charges');
  pgm.dropTable('fee_installments');
  pgm.dropTable('fee_structures');
};
