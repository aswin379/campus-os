exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('attendance_records', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    enrollment_id: { type: 'uuid', notNull: true, references: 'student_enrollments', onDelete: 'cascade' },
    attendance_date: { type: 'date', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      check: "status in ('present', 'absent', 'late', 'excused')",
    },
    marked_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    marked_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_by: { type: 'uuid', references: 'staff', onDelete: 'set null' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('attendance_records', 'attendance_records_unique_enrollment_date', {
    unique: ['enrollment_id', 'attendance_date'],
  });
  pgm.createIndex('attendance_records', 'attendance_date');
};

exports.down = (pgm) => {
  pgm.dropTable('attendance_records');
};
