exports.shorthands = undefined;

/**
 * Institute only wants Present/Absent/Half Day tracked — Late and Excused
 * are dropped. Any existing rows using those values are folded into
 * 'absent' (the conservative choice: a day the student wasn't fully present
 * for) before the check constraint is tightened, so the migration never
 * fails against real data.
 */
exports.up = (pgm) => {
  pgm.sql("update attendance_records set status = 'absent' where status in ('late', 'excused')");
  pgm.dropConstraint('attendance_records', 'attendance_records_status_check');
  pgm.addConstraint('attendance_records', 'attendance_records_status_check', {
    check: "status in ('present', 'absent', 'half_day')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('attendance_records', 'attendance_records_status_check');
  pgm.addConstraint('attendance_records', 'attendance_records_status_check', {
    check: "status in ('present', 'absent', 'late', 'excused')",
  });
};
