/**
 * Canonical permission list for the ERP. This is the single source of truth:
 * - The DB `permissions` table is seeded from this list (see apps/server/src/db/seeds).
 * - Backend `authorize()` middleware checks against these keys.
 * - Frontend uses these same keys to conditionally render UI.
 *
 * Adding a permission = adding an entry here, then re-running the seed script.
 */

export interface PermissionDefinition {
  key: string;
  module: string;
  description: string;
}

export const PERMISSIONS = [
  // Dashboard
  { key: 'dashboard.view', module: 'dashboard', description: 'View dashboard summary stats' },

  // Students
  { key: 'students.view', module: 'students', description: 'View student records' },
  { key: 'students.create', module: 'students', description: 'Add new students' },
  { key: 'students.edit', module: 'students', description: 'Edit student records' },
  { key: 'students.delete', module: 'students', description: 'Delete (soft-delete) student records' },
  { key: 'students.remarks', module: 'students', description: 'View and add remarks on students' },

  // Courses
  { key: 'courses.view', module: 'courses', description: 'View courses and batches' },
  { key: 'courses.manage', module: 'courses', description: 'Create/edit courses and batches' },
  { key: 'courses.assign_students', module: 'courses', description: 'Assign students to a course batch' },

  // Attendance
  { key: 'attendance.view', module: 'attendance', description: 'View attendance records and reports' },
  { key: 'attendance.mark', module: 'attendance', description: 'Mark daily attendance' },
  { key: 'attendance.edit', module: 'attendance', description: 'Edit previously marked attendance' },

  // Staff attendance
  { key: 'staff_attendance.view', module: 'staff_attendance', description: 'View staff attendance records' },
  { key: 'staff_attendance.mark', module: 'staff_attendance', description: 'Mark daily staff attendance' },

  // Fee structure (admin-only by default, but permission-gated not role-hardcoded)
  { key: 'fees.structure.view', module: 'fees', description: 'View fee structures' },
  { key: 'fees.structure.manage', module: 'fees', description: 'Create/edit fee structures, installments, discounts' },

  // Fee collection
  { key: 'fees.view', module: 'fees', description: 'View payment history and balances' },
  { key: 'fees.collect', module: 'fees', description: 'Record fee payments' },
  { key: 'fees.edit', module: 'fees', description: 'Void/reissue a payment entry' },
  { key: 'fees.receipt.reprint', module: 'fees', description: 'Reprint a receipt' },

  // Exams
  { key: 'exams.configure', module: 'exams', description: 'Configure assessment components and pass criteria' },
  { key: 'exams.enter_marks', module: 'exams', description: 'Enter marks per student per assessment component' },
  { key: 'exams.publish_results', module: 'exams', description: 'Compute and publish final results' },
  { key: 'exams.view_results', module: 'exams', description: 'View results, mark sheets, certificates' },

  // Notifications
  { key: 'notifications.manage', module: 'notifications', description: 'Configure notification providers and templates' },
  { key: 'notifications.view_logs', module: 'notifications', description: 'View notification logs' },

  // Reports
  { key: 'reports.view', module: 'reports', description: 'View and export reports' },

  // Staff & roles
  { key: 'staff.view', module: 'staff', description: 'View staff details' },
  { key: 'staff.create', module: 'staff', description: 'Add new staff' },
  { key: 'staff.edit', module: 'staff', description: 'Edit staff details, activate/deactivate' },
  { key: 'staff.assign_permissions', module: 'staff', description: 'Assign roles/permission overrides to staff' },
  { key: 'roles.manage', module: 'staff', description: 'Create/edit roles and their permissions' },

  // Settings
  { key: 'settings.manage', module: 'settings', description: 'Edit institute settings' },

  // Audit
  { key: 'audit.view', module: 'audit', description: 'View the audit log' },

  // Leads
  { key: 'leads.view', module: 'leads', description: 'View leads and their followup history' },
  { key: 'leads.create', module: 'leads', description: 'Add new leads' },
  { key: 'leads.edit', module: 'leads', description: 'Edit lead details, status, and add followups' },
  { key: 'leads.delete', module: 'leads', description: 'Delete (soft-delete) leads' },

  // Accounts (expenses & income)
  { key: 'accounts.view', module: 'accounts', description: 'View income/expense entries' },
  { key: 'accounts.create', module: 'accounts', description: 'Record income/expense entries' },
  { key: 'accounts.edit', module: 'accounts', description: 'Edit income/expense entries' },
  { key: 'accounts.delete', module: 'accounts', description: 'Delete (soft-delete) income/expense entries' },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);
