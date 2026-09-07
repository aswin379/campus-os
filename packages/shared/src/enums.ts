export const StudentStatus = {
  ENQUIRY: 'enquiry',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  SUSPENDED: 'suspended',
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export const ContactType = {
  SELF: 'self',
  GUARDIAN: 'guardian',
  EMERGENCY: 'emergency',
} as const;
export type ContactType = (typeof ContactType)[keyof typeof ContactType];

export const CourseBatchStatus = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;
export type CourseBatchStatus = (typeof CourseBatchStatus)[keyof typeof CourseBatchStatus];

export const DurationUnit = {
  MONTHS: 'months',
  YEARS: 'years',
} as const;
export type DurationUnit = (typeof DurationUnit)[keyof typeof DurationUnit];

export const EnrollmentStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  TRANSFERRED: 'transferred',
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const AttendanceStatus = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const PaymentMode = {
  CASH: 'cash',
  CHEQUE: 'cheque',
  ONLINE: 'online',
  CARD: 'card',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const FeeTransactionType = {
  PAYMENT: 'payment',
  ADJUSTMENT: 'adjustment',
  VOID: 'void',
} as const;
export type FeeTransactionType = (typeof FeeTransactionType)[keyof typeof FeeTransactionType];

export const InstallmentStatus = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;
export type InstallmentStatus = (typeof InstallmentStatus)[keyof typeof InstallmentStatus];

export const ExamResultStatus = {
  PASS: 'pass',
  FAIL: 'fail',
  INCOMPLETE: 'incomplete',
} as const;
export type ExamResultStatus = (typeof ExamResultStatus)[keyof typeof ExamResultStatus];

export const NotificationChannel = {
  SMS: 'sms',
  EMAIL: 'email',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
