exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('admission_number_sequences', {
    year: { type: 'integer', primaryKey: true },
    last_number: { type: 'integer', notNull: true, default: 0 },
  });

  pgm.createTable('students', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    admission_number: { type: 'text', notNull: true, unique: true },
    first_name: { type: 'text', notNull: true },
    last_name: { type: 'text', notNull: true },
    date_of_birth: { type: 'date' },
    gender: { type: 'text' },
    photo_key: { type: 'text' },
    status: {
      type: 'text',
      notNull: true,
      default: 'enquiry',
      check: "status in ('enquiry', 'active', 'completed', 'dropped', 'suspended')",
    },
    admission_date: { type: 'date', notNull: true },
    address: { type: 'text' },
    city: { type: 'text' },
    state: { type: 'text' },
    pincode: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    deleted_at: { type: 'timestamptz' },
  });
  pgm.createIndex('students', 'status');
  pgm.createIndex('students', ['first_name', 'last_name']);

  pgm.createTable('student_contacts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    student_id: { type: 'uuid', notNull: true, references: 'students', onDelete: 'cascade' },
    contact_type: {
      type: 'text',
      notNull: true,
      check: "contact_type in ('self', 'guardian', 'emergency')",
    },
    relation: { type: 'text' },
    name: { type: 'text', notNull: true },
    phone: { type: 'text', notNull: true },
    email: { type: 'text' },
    is_primary: { type: 'boolean', notNull: true, default: false },
  });
  pgm.createIndex('student_contacts', 'student_id');
};

exports.down = (pgm) => {
  pgm.dropTable('student_contacts');
  pgm.dropTable('students');
  pgm.dropTable('admission_number_sequences');
};
