exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('courses', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    code: { type: 'text', notNull: true, unique: true },
    description: { type: 'text' },
    duration_value: { type: 'integer', notNull: true },
    duration_unit: { type: 'text', notNull: true, check: "duration_unit in ('months', 'years')" },
    status: { type: 'text', notNull: true, default: 'active', check: "status in ('active', 'inactive')" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    deleted_at: { type: 'timestamptz' },
  });

  pgm.createTable('course_batches', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    course_id: { type: 'uuid', notNull: true, references: 'courses', onDelete: 'restrict' },
    batch_name: { type: 'text', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date_planned: { type: 'date', notNull: true },
    end_date_actual: { type: 'date' },
    status: {
      type: 'text',
      notNull: true,
      default: 'upcoming',
      check: "status in ('upcoming', 'ongoing', 'completed', 'archived')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('course_batches', 'course_id');
  pgm.createIndex('course_batches', 'status');

  pgm.createTable('course_assessment_components', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    course_id: { type: 'uuid', notNull: true, references: 'courses', onDelete: 'cascade' },
    name: { type: 'text', notNull: true },
    max_marks: { type: 'numeric(6,2)', notNull: true },
    weight_percent: { type: 'numeric(5,2)', notNull: true },
    sequence: { type: 'integer', notNull: true, default: 0 },
    is_active: { type: 'boolean', notNull: true, default: true },
  });
  pgm.createIndex('course_assessment_components', 'course_id');

  pgm.createTable('course_pass_criteria', {
    course_id: { type: 'uuid', primaryKey: true, references: 'courses', onDelete: 'cascade' },
    pass_percentage: { type: 'numeric(5,2)', notNull: true, default: 40 },
  });

  pgm.createTable('student_enrollments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    student_id: { type: 'uuid', notNull: true, references: 'students', onDelete: 'cascade' },
    course_batch_id: { type: 'uuid', notNull: true, references: 'course_batches', onDelete: 'restrict' },
    enrollment_date: { type: 'date', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'active',
      check: "status in ('active', 'completed', 'dropped', 'transferred')",
    },
    completion_date: { type: 'date' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('student_enrollments', 'student_id');
  pgm.createIndex('student_enrollments', 'course_batch_id');
  pgm.addConstraint('student_enrollments', 'student_enrollments_unique_active', {
    unique: ['student_id', 'course_batch_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('student_enrollments');
  pgm.dropTable('course_pass_criteria');
  pgm.dropTable('course_assessment_components');
  pgm.dropTable('course_batches');
  pgm.dropTable('courses');
};
