import crypto from 'node:crypto';
import { PERMISSIONS } from '@erp/shared';
import { pool } from '../pool.js';
import { hashPassword } from '../../modules/auth/service.js';

async function seedPermissions(): Promise<void> {
  for (const p of PERMISSIONS) {
    await pool.query(
      `insert into permissions (id, \`key\`, module, description)
       values (uuid(), ?, ?, ?)
       on duplicate key update module = values(module), description = values(description)`,
      [p.key, p.module, p.description],
    );
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions.`);
}

async function seedAdminRole(): Promise<string> {
  const adminRoleId = crypto.randomUUID();
  await pool.query(
    `insert into roles (id, name, description, is_system)
     values (?, 'Admin', 'Full access to all modules', true)
     on duplicate key update description = values(description)`,
    [adminRoleId],
  );
  const { rows } = await pool.query<{ id: string }>(`select id from roles where name = 'Admin'`);
  const roleId = rows[0]!.id;

  await pool.query(`delete from role_permissions where role_id = ?`, [roleId]);
  await pool.query(
    `insert into role_permissions (role_id, permission_id) select ?, id from permissions`,
    [roleId],
  );
  console.log('Seeded "Admin" role with all permissions.');
  return roleId;
}

// A day-to-day front-office role, seeded alongside Admin so "Add Staff"
// isn't stuck offering only Admin as the sole role to assign.
const STAFF_ROLE_PERMISSIONS = [
  'dashboard.view',
  'students.view',
  'students.create',
  'students.edit',
  'courses.view',
  'attendance.view',
  'attendance.mark',
  'fees.view',
  'fees.collect',
  'exams.view_results',
  'leads.view',
  'leads.create',
  'leads.edit',
];

async function seedStaffRole(): Promise<void> {
  const staffRoleId = crypto.randomUUID();
  await pool.query(
    `insert into roles (id, name, description, is_system)
     values (?, 'Staff', 'Day-to-day front-office access (students, attendance, fees, leads)', false)
     on duplicate key update description = values(description)`,
    [staffRoleId],
  );
  const { rows } = await pool.query<{ id: string }>(`select id from roles where name = 'Staff'`);
  const roleId = rows[0]!.id;

  await pool.query(`delete from role_permissions where role_id = ?`, [roleId]);
  for (const key of STAFF_ROLE_PERMISSIONS) {
    await pool.query(
      `insert into role_permissions (role_id, permission_id) select ?, id from permissions where \`key\` = ?`,
      [roleId, key],
    );
  }
  console.log('Seeded "Staff" role with default front-office permissions.');
}

async function seedSuperAdmin(adminRoleId: string): Promise<void> {
  const { rows } = await pool.query<{ count: number }>(`select count(*) as count from staff`);
  if (Number(rows[0]!.count) > 0) {
    console.log('Staff table is not empty, skipping super-admin bootstrap.');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@institute.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-on-first-login';
  const passwordHash = await hashPassword(password);

  const staffId = crypto.randomUUID();
  await pool.query(
    `insert into staff (id, full_name, email, password_hash, is_super_admin)
     values (?, 'Super Admin', ?, ?, true)`,
    [staffId, email, passwordHash],
  );

  await pool.query(`insert into staff_roles (staff_id, role_id) values (?, ?)`, [staffId, adminRoleId]);

  console.log(`Created super-admin account: ${email} (change the password after first login).`);
}

async function seedNotificationTemplates(): Promise<void> {
  const templates = [
    {
      key: 'payment_confirmation',
      channel: 'sms',
      subject: null,
      body: 'Dear {{studentName}}, we have received your payment of Rs. {{amount}} for {{courseName}} (Receipt: {{receiptNumber}}). Thank you.',
    },
    {
      key: 'fee_due_reminder',
      channel: 'sms',
      subject: null,
      body: 'Dear {{studentName}}, a fee installment of Rs. {{amount}} for {{courseName}} was due on {{dueDate}}. Please pay at your earliest convenience.',
    },
  ];

  for (const t of templates) {
    await pool.query(
      `insert ignore into notification_templates (id, \`key\`, channel, subject, body_template)
       values (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), t.key, t.channel, t.subject, t.body],
    );
  }
  console.log(`Seeded ${templates.length} notification templates.`);
}

async function main(): Promise<void> {
  await seedPermissions();
  const adminRoleId = await seedAdminRole();
  await seedStaffRole();
  await seedSuperAdmin(adminRoleId);
  await seedNotificationTemplates();
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
