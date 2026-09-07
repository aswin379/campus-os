import { pool } from '../../db/pool.js';

export interface StudentReportRow {
  admission_number: string;
  first_name: string;
  last_name: string;
  status: string;
  admission_date: string;
  city: string | null;
}

export async function getStudentReport(status?: string): Promise<StudentReportRow[]> {
  const conditions = ['deleted_at is null'];
  const params: unknown[] = [];
  if (status) {
    params.push(status);
    conditions.push(`status = ?`);
  }
  const { rows } = await pool.query<StudentReportRow>(
    `select admission_number, first_name, last_name, status, admission_date, city
     from students where ${conditions.join(' and ')} order by admission_number`,
    params,
  );
  return rows;
}

export interface CourseReportRow {
  code: string;
  name: string;
  duration_value: number;
  duration_unit: string;
  status: string;
  batch_count: string;
  active_enrollment_count: string;
}

export async function getCourseReport(): Promise<CourseReportRow[]> {
  const { rows } = await pool.query<CourseReportRow>(
    `select
       c.code, c.name, c.duration_value, c.duration_unit, c.status,
       cast(count(distinct cb.id) as char) as batch_count,
       cast(count(distinct case when se.status = 'active' then se.id end) as char) as active_enrollment_count
     from courses c
     left join course_batches cb on cb.course_id = c.id
     left join student_enrollments se on se.course_batch_id = cb.id
     where c.deleted_at is null
     group by c.id
     order by c.name`,
  );
  return rows;
}

export interface FeeCollectionReportRow {
  receipt_number: string;
  payment_date: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  course_name: string;
  amount: string;
  payment_mode: string;
  transaction_type: string;
}

export async function getFeeCollectionReport(fromDate: string, toDate: string): Promise<FeeCollectionReportRow[]> {
  // Filtered by the attributed date (a void's original transaction's
  // payment_date, not the void's own recording date) so this report agrees
  // with the dashboard's "today's collections" figure — see
  // fees/repository.ts getTodaysCollectionTotal for the same reasoning. The
  // displayed payment_date column stays the row's own real date.
  const { rows } = await pool.query<FeeCollectionReportRow>(
    `select
       ft.receipt_number, ft.payment_date, s.admission_number, s.first_name, s.last_name,
       c.name as course_name, ft.amount, ft.payment_mode, ft.transaction_type
     from fee_transactions ft
     left join fee_transactions orig on orig.id = ft.reversed_transaction_id
     join student_enrollments se on se.id = ft.enrollment_id
     join students s on s.id = se.student_id
     join course_batches cb on cb.id = se.course_batch_id
     join courses c on c.id = cb.course_id
     where coalesce(orig.payment_date, ft.payment_date) between ? and ?
     order by coalesce(orig.payment_date, ft.payment_date), ft.created_at`,
    [fromDate, toDate],
  );
  return rows;
}

export interface PendingFeesReportRow {
  admission_number: string;
  first_name: string;
  last_name: string;
  course_name: string;
  label: string | null;
  due_date: string;
  amount_due: string;
  amount_paid: string;
  status: string;
}

export async function getPendingFeesReport(): Promise<PendingFeesReportRow[]> {
  const { rows } = await pool.query<PendingFeesReportRow>(
    `select
       s.admission_number, s.first_name, s.last_name, c.name as course_name,
       sfi.label, sfi.due_date, sfi.amount_due, sfi.amount_paid, sfi.status
     from student_fee_installments sfi
     join student_fee_plans sfp on sfp.id = sfi.student_fee_plan_id
     join student_enrollments se on se.id = sfp.enrollment_id
     join students s on s.id = se.student_id
     join course_batches cb on cb.id = se.course_batch_id
     join courses c on c.id = cb.course_id
     where sfi.status != 'paid'
     order by sfi.due_date`,
  );
  return rows;
}

export interface AuditLogRow {
  id: string;
  actor_staff_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

export async function getAuditLog(filters: { entityType?: string; entityId?: string }, limit: number): Promise<AuditLogRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.entityType) {
    params.push(filters.entityType);
    conditions.push(`al.entity_type = ?`);
  }
  if (filters.entityId) {
    params.push(filters.entityId);
    conditions.push(`al.entity_id = ?`);
  }
  params.push(limit);

  const { rows } = await pool.query<AuditLogRow>(
    `select al.id, al.actor_staff_id, s.full_name as actor_name, al.action, al.entity_type, al.entity_id,
            al.before_data, al.after_data, al.created_at
     from audit_log al
     left join staff s on s.id = al.actor_staff_id
     ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
     order by al.created_at desc
     limit ?`,
    params,
  );
  return rows;
}
