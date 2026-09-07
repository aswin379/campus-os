import crypto from 'node:crypto';
import type { PoolClient } from '../../db/pool.js';
import { pool } from '../../db/pool.js';

// --- Fee structures ---

export interface FeeStructureRow {
  id: string;
  course_id: string;
  name: string;
  total_amount: string;
  effective_from: string;
  is_active: boolean;
  created_at: string;
}

export interface FeeInstallmentRow {
  id: string;
  fee_structure_id: string;
  installment_number: number;
  amount: string;
  due_offset_days: number;
}

export interface FeeAdditionalChargeRow {
  id: string;
  fee_structure_id: string;
  name: string;
  amount: string;
  is_optional: boolean;
}

export async function listFeeStructuresForCourse(courseId: string): Promise<FeeStructureRow[]> {
  const { rows } = await pool.query<FeeStructureRow>(
    `select * from fee_structures where course_id = ? order by effective_from desc`,
    [courseId],
  );
  return rows;
}

export async function getFeeStructureById(id: string): Promise<FeeStructureRow | null> {
  const { rows } = await pool.query<FeeStructureRow>(`select * from fee_structures where id = ?`, [id]);
  return rows[0] ?? null;
}

export async function getActiveFeeStructureForCourse(courseId: string, onDate: string): Promise<FeeStructureRow | null> {
  const { rows } = await pool.query<FeeStructureRow>(
    `select * from fee_structures
     where course_id = ? and is_active = true and effective_from <= ?
     order by effective_from desc limit 1`,
    [courseId, onDate],
  );
  return rows[0] ?? null;
}

export async function getInstallmentsForStructure(structureId: string): Promise<FeeInstallmentRow[]> {
  const { rows } = await pool.query<FeeInstallmentRow>(
    `select * from fee_installments where fee_structure_id = ? order by installment_number`,
    [structureId],
  );
  return rows;
}

export async function getAdditionalChargesForStructure(structureId: string): Promise<FeeAdditionalChargeRow[]> {
  const { rows } = await pool.query<FeeAdditionalChargeRow>(
    `select * from fee_additional_charges where fee_structure_id = ?`,
    [structureId],
  );
  return rows;
}

export async function createFeeStructure(input: {
  courseId: string;
  name: string;
  totalAmount: number;
  effectiveFrom: string;
  installments: { installmentNumber: number; amount: number; dueOffsetDays: number }[];
  additionalCharges: { name: string; amount: number; isOptional: boolean }[];
}): Promise<FeeStructureRow> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const structureId = crypto.randomUUID();
    await client.query(
      `insert into fee_structures (id, course_id, name, total_amount, effective_from)
       values (?, ?, ?, ?, ?)`,
      [structureId, input.courseId, input.name, input.totalAmount, input.effectiveFrom],
    );
    const { rows } = await client.query<FeeStructureRow>(`select * from fee_structures where id = ?`, [structureId]);
    const structure = rows[0]!;

    for (const i of input.installments) {
      await client.query(
        `insert into fee_installments (id, fee_structure_id, installment_number, amount, due_offset_days)
         values (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), structure.id, i.installmentNumber, i.amount, i.dueOffsetDays],
      );
    }
    for (const c of input.additionalCharges) {
      await client.query(
        `insert into fee_additional_charges (id, fee_structure_id, name, amount, is_optional)
         values (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), structure.id, c.name, c.amount, c.isOptional],
      );
    }

    await client.query('commit');
    return structure;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function setFeeStructureActive(id: string, isActive: boolean): Promise<void> {
  await pool.query(`update fee_structures set is_active = ? where id = ?`, [isActive, id]);
}

// --- Discounts ---

export interface FeeDiscountRow {
  id: string;
  enrollment_id: string;
  reason: string;
  amount: string;
  approved_by: string;
  approved_at: string;
}

export interface FeeDiscountWithNameRow extends FeeDiscountRow {
  approved_by_name: string;
}

export async function getDiscountsForEnrollment(enrollmentId: string): Promise<FeeDiscountWithNameRow[]> {
  const { rows } = await pool.query<FeeDiscountWithNameRow>(
    `select fd.*, st.full_name as approved_by_name
     from fee_discounts fd
     join staff st on st.id = fd.approved_by
     where fd.enrollment_id = ?
     order by fd.approved_at desc`,
    [enrollmentId],
  );
  return rows;
}

export async function addDiscount(input: {
  enrollmentId: string;
  reason: string;
  amount: number;
  approvedBy: string;
}): Promise<FeeDiscountRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into fee_discounts (id, enrollment_id, reason, amount, approved_by)
     values (?, ?, ?, ?, ?)`,
    [id, input.enrollmentId, input.reason, input.amount, input.approvedBy],
  );
  const { rows } = await pool.query<FeeDiscountRow>(`select * from fee_discounts where id = ?`, [id]);
  return rows[0]!;
}

// --- Student fee plans & installments ---

export interface StudentFeePlanRow {
  id: string;
  enrollment_id: string;
  fee_structure_id: string;
  total_payable: string;
  created_at: string;
}

export interface StudentFeeInstallmentRow {
  id: string;
  student_fee_plan_id: string;
  installment_number: number;
  label: string | null;
  amount_due: string;
  due_date: string;
  amount_paid: string;
  status: string;
}

export async function getFeePlanByEnrollment(enrollmentId: string): Promise<StudentFeePlanRow | null> {
  const { rows } = await pool.query<StudentFeePlanRow>(
    `select * from student_fee_plans where enrollment_id = ?`,
    [enrollmentId],
  );
  return rows[0] ?? null;
}

export async function createFeePlan(
  client: PoolClient,
  input: { enrollmentId: string; feeStructureId: string; totalPayable: number },
): Promise<StudentFeePlanRow> {
  const id = crypto.randomUUID();
  await client.query(
    `insert into student_fee_plans (id, enrollment_id, fee_structure_id, total_payable)
     values (?, ?, ?, ?)`,
    [id, input.enrollmentId, input.feeStructureId, input.totalPayable],
  );
  const { rows } = await client.query<StudentFeePlanRow>(`select * from student_fee_plans where id = ?`, [id]);
  return rows[0]!;
}

export async function createFeeInstallment(
  client: PoolClient,
  input: { planId: string; installmentNumber: number; label: string | null; amountDue: number; dueDate: string },
): Promise<void> {
  await client.query(
    `insert into student_fee_installments (id, student_fee_plan_id, installment_number, label, amount_due, due_date)
     values (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), input.planId, input.installmentNumber, input.label, input.amountDue, input.dueDate],
  );
}

export async function getInstallmentsForPlan(planId: string): Promise<StudentFeeInstallmentRow[]> {
  const { rows } = await pool.query<StudentFeeInstallmentRow>(
    `select * from student_fee_installments where student_fee_plan_id = ? order by installment_number`,
    [planId],
  );
  return rows;
}

export async function getUnpaidInstallmentsForPlan(client: PoolClient, planId: string): Promise<StudentFeeInstallmentRow[]> {
  const { rows } = await client.query<StudentFeeInstallmentRow>(
    `select * from student_fee_installments
     where student_fee_plan_id = ? and status != 'paid'
     order by due_date, installment_number
     for update`,
    [planId],
  );
  return rows;
}

export async function applyPaymentToInstallment(
  client: PoolClient,
  installmentId: string,
  amount: number,
): Promise<void> {
  // MySQL evaluates UPDATE SET assignments left-to-right, where a later
  // assignment sees the value already written by an earlier one in the same
  // statement (unlike Postgres, which evaluates every SET expression
  // against the original row). So `amount_paid` here already reflects
  // `amount_paid + ?` from the first assignment — do NOT add `?` again in
  // the CASE below, or the payment gets double-counted and installments
  // flip to 'paid' one payment early.
  await client.query(
    `update student_fee_installments set
       amount_paid = amount_paid + ?,
       status = case
         when amount_paid >= amount_due then 'paid'
         when amount_paid > 0 then 'partial'
         else 'pending'
       end
     where id = ?`,
    [amount, installmentId],
  );
}

export async function reversePaymentFromInstallment(
  client: PoolClient,
  installmentId: string,
  amount: number,
): Promise<void> {
  // GREATEST(...,0) is a defense-in-depth floor — the real guard against a
  // double reversal is voidTransaction's idempotency check, but this keeps
  // amount_paid from ever going negative even if that check is bypassed.
  // Same MySQL left-to-right SET evaluation caveat as applyPaymentToInstallment
  // above — `amount_paid` here already reflects the GREATEST(...) subtraction
  // from the first assignment, so the CASE below must not repeat it.
  await client.query(
    `update student_fee_installments set
       amount_paid = greatest(amount_paid - ?, 0),
       status = case
         when amount_paid >= amount_due then 'paid'
         when amount_paid > 0 then 'partial'
         else 'pending'
       end
     where id = ?`,
    [amount, installmentId],
  );
}

// --- Fee transactions & receipts ---

export interface FeeTransactionRow {
  id: string;
  enrollment_id: string;
  receipt_number: string;
  financial_year: string;
  amount: string;
  payment_mode: string;
  payment_reference: string | null;
  payment_date: string;
  collected_by: string;
  transaction_type: string;
  reversed_transaction_id: string | null;
  notes: string | null;
  created_at: string;
}

export async function nextReceiptNumber(client: PoolClient, financialYear: string, prefix: string): Promise<string> {
  await client.query(
    `insert into receipt_number_sequences (financial_year, last_number, prefix)
     values (?, 1, ?)
     on duplicate key update last_number = LAST_INSERT_ID(last_number + 1)`,
    [financialYear, prefix],
  );
  const { rows } = await client.query<{ seq: number }>(`select LAST_INSERT_ID() as seq`);
  const seq = rows[0]!.seq;
  return `${prefix}/${financialYear}/${String(seq).padStart(4, '0')}`;
}

export async function createFeeTransaction(
  client: PoolClient,
  input: {
    enrollmentId: string;
    receiptNumber: string;
    financialYear: string;
    amount: number;
    paymentMode: string;
    paymentReference: string | null;
    paymentDate: string;
    collectedBy: string;
    transactionType: string;
    reversedTransactionId: string | null;
    notes: string | null;
  },
): Promise<FeeTransactionRow> {
  const id = crypto.randomUUID();
  await client.query(
    `insert into fee_transactions
       (id, enrollment_id, receipt_number, financial_year, amount, payment_mode, payment_reference,
        payment_date, collected_by, transaction_type, reversed_transaction_id, notes)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.enrollmentId,
      input.receiptNumber,
      input.financialYear,
      input.amount,
      input.paymentMode,
      input.paymentReference,
      input.paymentDate,
      input.collectedBy,
      input.transactionType,
      input.reversedTransactionId,
      input.notes,
    ],
  );
  const { rows } = await client.query<FeeTransactionRow>(`select * from fee_transactions where id = ?`, [id]);
  return rows[0]!;
}

export async function createAllocation(
  client: PoolClient,
  input: { feeTransactionId: string; studentFeeInstallmentId: string; amountAllocated: number },
): Promise<void> {
  await client.query(
    `insert into fee_transaction_installment_allocations (id, fee_transaction_id, student_fee_installment_id, amount_allocated)
     values (?, ?, ?, ?)`,
    [crypto.randomUUID(), input.feeTransactionId, input.studentFeeInstallmentId, input.amountAllocated],
  );
}

export async function getTransactionById(id: string): Promise<FeeTransactionRow | null> {
  const { rows } = await pool.query<FeeTransactionRow>(`select * from fee_transactions where id = ?`, [id]);
  return rows[0] ?? null;
}

/** Locks the row for the duration of the caller's transaction so two concurrent voids of the same payment serialize. */
export async function getTransactionByIdForUpdate(client: PoolClient, id: string): Promise<FeeTransactionRow | null> {
  const { rows } = await client.query<FeeTransactionRow>(`select * from fee_transactions where id = ? for update`, [id]);
  return rows[0] ?? null;
}

export async function isTransactionAlreadyVoided(client: PoolClient, transactionId: string): Promise<boolean> {
  const { rows } = await client.query<{ exists: number }>(
    `select exists(select 1 from fee_transactions where reversed_transaction_id = ?) as \`exists\``,
    [transactionId],
  );
  return Boolean(rows[0]?.exists);
}

export async function getTransactionsForEnrollment(enrollmentId: string): Promise<FeeTransactionRow[]> {
  const { rows } = await pool.query<FeeTransactionRow>(
    `select * from fee_transactions where enrollment_id = ? order by created_at desc`,
    [enrollmentId],
  );
  return rows;
}

export interface AllocationRow {
  id: string;
  fee_transaction_id: string;
  student_fee_installment_id: string;
  amount_allocated: string;
}

export async function getAllocationsForTransaction(transactionId: string): Promise<AllocationRow[]> {
  const { rows } = await pool.query<AllocationRow>(
    `select * from fee_transaction_installment_allocations where fee_transaction_id = ?`,
    [transactionId],
  );
  return rows;
}

export async function getTodaysCollectionTotal(date: string): Promise<number> {
  // A void is always dated the day it happened (never backdated — the
  // ledger shouldn't rewrite history), but a "collections for day X" total
  // must still net out a later void of a payment originally collected on X,
  // or that day's report stays permanently overstated. Attribute the void's
  // amount back to the original transaction's payment_date via the self-join.
  const { rows } = await pool.query<{ total: string }>(
    `select cast(coalesce(sum(ft.amount), 0) as char) as total
     from fee_transactions ft
     left join fee_transactions orig on orig.id = ft.reversed_transaction_id
     where coalesce(orig.payment_date, ft.payment_date) = ?`,
    [date],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getPendingFeesTotal(): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `select cast(coalesce(sum(amount_due - amount_paid), 0) as char) as total
     from student_fee_installments where status != 'paid'`,
  );
  return Number(rows[0]?.total ?? 0);
}
