/**
 * exam_marks.assessment_component_id was ON DELETE CASCADE, which let
 * replaceAssessmentComponents silently wipe historical marks by deleting and
 * re-inserting a course's assessment components. The application now
 * pre-checks and refuses that operation once marks exist, but this
 * constraint is the DB-level backstop in case that check is ever bypassed.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('exam_marks', 'exam_marks_assessment_component_id_fkey');
  pgm.addConstraint('exam_marks', 'exam_marks_assessment_component_id_fkey', {
    foreignKeys: {
      columns: 'assessment_component_id',
      references: 'course_assessment_components',
      onDelete: 'restrict',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('exam_marks', 'exam_marks_assessment_component_id_fkey');
  pgm.addConstraint('exam_marks', 'exam_marks_assessment_component_id_fkey', {
    foreignKeys: {
      columns: 'assessment_component_id',
      references: 'course_assessment_components',
      onDelete: 'cascade',
    },
  });
};
