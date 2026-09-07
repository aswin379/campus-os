const TONE_BY_STATUS: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  // students
  active: 'success',
  enquiry: 'info',
  completed: 'success',
  dropped: 'danger',
  suspended: 'danger',
  // courses / batches
  upcoming: 'info',
  ongoing: 'success',
  archived: 'danger',
  inactive: 'danger',
  // enrollments
  transferred: 'warning',
  // fees
  paid: 'success',
  partial: 'warning',
  pending: 'warning',
  overdue: 'danger',
  payment: 'success',
  void: 'danger',
  adjustment: 'warning',
  // attendance
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
  // exams
  pass: 'success',
  fail: 'danger',
  incomplete: 'warning',
  // notifications
  sent: 'success',
  failed: 'danger',
  queued: 'warning',
  // leads
  new: 'info',
  contacted: 'warning',
  interested: 'warning',
  converted: 'success',
  lost: 'danger',
  // accounts
  income: 'success',
  expense: 'danger',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status.toLowerCase()];
  return <span className={`badge${tone ? ` badge-${tone}` : ''}`}>{status}</span>;
}
