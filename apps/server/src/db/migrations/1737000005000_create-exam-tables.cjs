exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('exam_marks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    enrollment_id: { type: 'uuid', notNull: true, references: 'student_enrollments', onDelete: 'cascade' },
    assessment_component_id: { type: 'uuid', notNull: true, references: 'course_assessment_components', onDelete: 'cascade' },
    marks_obtained: { type: 'numeric(6,2)', notNull: true },
    remarks: { type: 'text' },
    entered_by: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'restrict' },
    entered_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('exam_marks', 'exam_marks_unique_enrollment_component', {
    unique: ['enrollment_id', 'assessment_component_id'],
  });

  pgm.createTable('exam_results', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    enrollment_id: { type: 'uuid', notNull: true, unique: true, references: 'student_enrollments', onDelete: 'cascade' },
    total_percentage: { type: 'numeric(5,2)' },
    result_status: {
      type: 'text',
      notNull: true,
      default: 'incomplete',
      check: "result_status in ('pass', 'fail', 'incomplete')",
    },
    computed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    published_at: { type: 'timestamptz' },
    certificate_number: { type: 'text', unique: true },
    certificate_issued_at: { type: 'timestamptz' },
  });

  pgm.createTable('certificate_number_sequences', {
    year: { type: 'integer', primaryKey: true },
    last_number: { type: 'integer', notNull: true, default: 0 },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('certificate_number_sequences');
  pgm.dropTable('exam_results');
  pgm.dropTable('exam_marks');
};
