import { pool } from '../../db/pool.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { getEnrollmentDisplayContext, getPrimaryContactPhone } from '../../lib/enrollmentContext.js';
import { getSetting } from '../../lib/settings.js';
import { notify } from '../notifications/service.js';
import * as repo from './repository.js';

const DEFAULT_RECEIPT_PREFIX = 'RCPT';

async function getReceiptPrefix(): Promise<string> {
  return (await getSetting('receipt.prefix')) ?? DEFAULT_RECEIPT_PREFIX;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function computeFinancialYear(dateStr: string): string {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  return month >= 4 ? `${year}-${String((year + 1) % 100).padStart(2, '0')}` : `${year - 1}-${String(year % 100).padStart(2, '0')}`;
}

const AMOUNT_TOLERANCE = 0.01;

// --- Fee structures ---

export interface FeeStructureDto {
  id: string;
  courseId: string;
  name: string;
  totalAmount: number;
  effectiveFrom: string;
  isActive: boolean;
  installments: { installmentNumber: number; amount: number; dueOffsetDays: number }[];
  additionalCharges: { name: string; amount: number; isOptional: boolean }[];
}

async function toFeeStructureDto(row: repo.FeeStructureRow): Promise<FeeStructureDto> {
  const [installments, charges] = await Promise.all([
    repo.getInstallmentsForStructure(row.id),
    repo.getAdditionalChargesForStructure(row.id),
  ]);
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    totalAmount: Number(row.total_amount),
    effectiveFrom: row.effective_from,
    isActive: row.is_active,
    installments: installments.map((i) => ({
      installmentNumber: i.installment_number,
      amount: Number(i.amount),
      dueOffsetDays: i.due_offset_days,
    })),
    additionalCharges: charges.map((c) => ({ name: c.name, amount: Number(c.amount), isOptional: c.is_optional })),
  };
}

export async function listFeeStructuresForCourse(courseId: string): Promise<FeeStructureDto[]> {
  const rows = await repo.listFeeStructuresForCourse(courseId);
  return Promise.all(rows.map(toFeeStructureDto));
}

export async function createFeeStructure(
  actorId: string,
  input: {
    courseId: string;
    name: string;
    totalAmount: number;
    effectiveFrom: string;
    installments?: { installmentNumber: number; amount: number; dueOffsetDays: number }[];
    additionalCharges?: { name: string; amount: number; isOptional: boolean }[];
  },
): Promise<FeeStructureDto> {
  const installments = input.installments ?? [];
  if (installments.length > 0) {
    const sum = installments.reduce((s, i) => s + i.amount, 0);
    if (Math.abs(sum - input.totalAmount) > AMOUNT_TOLERANCE) {
      throw new HttpError(400, `Installment amounts must sum to the total amount (got ${sum}, expected ${input.totalAmount})`);
    }
  }

  const created = await repo.createFeeStructure({
    courseId: input.courseId,
    name: input.name,
    totalAmount: input.totalAmount,
    effectiveFrom: input.effectiveFrom,
    installments,
    additionalCharges: input.additionalCharges ?? [],
  });

  await recordAudit({
    actorStaffId: actorId,
    action: 'fee_structure.create',
    entityType: 'fee_structure',
    entityId: created.id,
    afterData: input,
  });

  return toFeeStructureDto(created);
}

export async function setFeeStructureActive(actorId: string, id: string, isActive: boolean): Promise<void> {
  const structure = await repo.getFeeStructureById(id);
  if (!structure) throw new HttpError(404, 'Fee structure not found');
  await repo.setFeeStructureActive(id, isActive);
  await recordAudit({
    actorStaffId: actorId,
    action: isActive ? 'fee_structure.activate' : 'fee_structure.deactivate',
    entityType: 'fee_structure',
    entityId: id,
  });
}

// --- Discounts ---

export interface FeeDiscountDto {
  id: string;
  reason: string;
  amount: number;
  approvedByName: string;
  approvedAt: string;
}

export async function listDiscounts(enrollmentId: string): Promise<FeeDiscountDto[]> {
  const rows = await repo.getDiscountsForEnrollment(enrollmentId);
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    amount: Number(r.amount),
    approvedByName: r.approved_by_name,
    approvedAt: r.approved_at,
  }));
}

export async function addDiscount(
  actorId: string,
  input: { enrollmentId: string; reason: string; amount: number },
): Promise<void> {
  const plan = await repo.getFeePlanByEnrollment(input.enrollmentId);
  if (plan) {
    throw new HttpError(400, 'Cannot add a discount after the fee plan has already been generated for this enrollment');
  }

  const info = await getEnrollmentCourseInfo(input.enrollmentId);
  if (!info) throw new HttpError(404, 'Enrollment not found');

  // Without this cap, a discount larger than the course fee silently zeroes
  // out every installment once the plan is generated (distributeDiscount has
  // nowhere left to apply the excess) — the plan "generates" successfully
  // but comes out empty and totalPayable 0, with nothing telling the person
  // who approved the discount that anything is wrong. Reject it up front
  // instead, against whatever fee structure would actually apply.
  const structure = await repo.getActiveFeeStructureForCourse(info.courseId, info.enrollmentDate);
  if (structure) {
    const existing = await repo.getDiscountsForEnrollment(input.enrollmentId);
    const totalDiscount = existing.reduce((s, d) => s + Number(d.amount), 0) + input.amount;
    const total = Number(structure.total_amount);
    if (totalDiscount > total + AMOUNT_TOLERANCE) {
      throw new HttpError(
        400,
        `Total discount (${totalDiscount.toFixed(2)}) cannot exceed the course fee (${total.toFixed(2)})`,
      );
    }
  }

  await repo.addDiscount({ ...input, approvedBy: actorId });
  await recordAudit({
    actorStaffId: actorId,
    action: 'fee_discount.add',
    entityType: 'student_enrollment',
    entityId: input.enrollmentId,
    afterData: input,
  });
}

// --- Fee plan generation ---

export interface FeeInstallmentDto {
  id: string;
  installmentNumber: number;
  label: string | null;
  amountDue: number;
  dueDate: string;
  amountPaid: number;
  status: string;
}

export interface FeePlanDto {
  id: string;
  enrollmentId: string;
  feeStructureId: string;
  totalPayable: number;
  installments: FeeInstallmentDto[];
}

function toInstallmentDto(row: repo.StudentFeeInstallmentRow): FeeInstallmentDto {
  return {
    id: row.id,
    installmentNumber: row.installment_number,
    label: row.label,
    amountDue: Number(row.amount_due),
    dueDate: row.due_date,
    amountPaid: Number(row.amount_paid),
    status: row.status,
  };
}

async function getEnrollmentCourseInfo(
  enrollmentId: string,
): Promise<{ courseId: string; enrollmentDate: string; status: string } | null> {
  const { rows } = await pool.query<{ course_id: string; enrollment_date: string; status: string }>(
    `select cb.course_id, se.enrollment_date, se.status
     from student_enrollments se
     join course_batches cb on cb.id = se.course_batch_id
     where se.id = ?`,
    [enrollmentId],
  );
  const row = rows[0];
  return row ? { courseId: row.course_id, enrollmentDate: row.enrollment_date, status: row.status } : null;
}

function distributeDiscount(amounts: number[], discount: number): number[] {
  let remaining = discount;
  const result = [...amounts];
  for (let i = result.length - 1; i >= 0 && remaining > 0; i--) {
    const reduceBy = Math.min(result[i]!, remaining);
    result[i] = Number((result[i]! - reduceBy).toFixed(2));
    remaining = Number((remaining - reduceBy).toFixed(2));
  }
  return result;
}

export async function generateFeePlan(actorId: string, enrollmentId: string): Promise<FeePlanDto> {
  const existing = await repo.getFeePlanByEnrollment(enrollmentId);
  if (existing) throw new HttpError(409, 'A fee plan already exists for this enrollment');

  const info = await getEnrollmentCourseInfo(enrollmentId);
  if (!info) throw new HttpError(404, 'Enrollment not found');
  if (info.status !== 'active') {
    throw new HttpError(400, `Cannot generate a fee plan for a ${info.status} enrollment`);
  }

  const structure = await repo.getActiveFeeStructureForCourse(info.courseId, info.enrollmentDate);
  if (!structure) {
    // getActiveFeeStructureForCourse silently returns nothing whether the
    // course has no fee structure at all, has one but it's deactivated, or
    // has one that simply hasn't taken effect yet as of this enrollment's
    // date — three very different situations that all deserve a different,
    // actionable message instead of one generic "no active fee structure"
    // that reads as "you forgot to add one" even when you didn't.
    const all = await repo.listFeeStructuresForCourse(info.courseId);
    if (all.length === 0) {
      throw new HttpError(400, 'No fee structure defined for this course yet — add one from the course page first.');
    }
    const active = all.filter((s) => s.is_active);
    if (active.length === 0) {
      throw new HttpError(400, 'This course has a fee structure, but it is deactivated — activate it from the course page.');
    }
    const earliest = active.reduce((min, s) => (s.effective_from < min ? s.effective_from : min), active[0]!.effective_from);
    throw new HttpError(
      400,
      `This course's fee structure isn't effective until ${earliest}, which is after this enrollment's date (${info.enrollmentDate}). ` +
        `Either backdate the fee structure's "Effective from" date, or use a later enrollment date.`,
    );
  }

  const [installmentDefs, charges, discounts] = await Promise.all([
    repo.getInstallmentsForStructure(structure.id),
    repo.getAdditionalChargesForStructure(structure.id),
    repo.getDiscountsForEnrollment(enrollmentId),
  ]);

  const totalDiscount = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const baseAmounts =
    installmentDefs.length > 0 ? installmentDefs.map((i) => Number(i.amount)) : [Number(structure.total_amount)];
  const adjustedAmounts = distributeDiscount(baseAmounts, totalDiscount);

  const client = await pool.connect();
  try {
    await client.query('begin');

    const totalPayable =
      adjustedAmounts.reduce((s, a) => s + a, 0) + charges.reduce((s, c) => s + Number(c.amount), 0);
    const plan = await repo.createFeePlan(client, {
      enrollmentId,
      feeStructureId: structure.id,
      totalPayable,
    });

    let installmentNumber = 1;
    for (let idx = 0; idx < adjustedAmounts.length; idx++) {
      const amount = adjustedAmounts[idx]!;
      if (amount <= 0) continue;
      const offsetDays = installmentDefs[idx]?.due_offset_days ?? 0;
      await repo.createFeeInstallment(client, {
        planId: plan.id,
        installmentNumber: installmentNumber++,
        label: installmentDefs.length > 0 ? `Installment ${idx + 1}` : 'Course Fee',
        amountDue: amount,
        dueDate: addDays(info.enrollmentDate, offsetDays),
      });
    }
    for (const charge of charges) {
      await repo.createFeeInstallment(client, {
        planId: plan.id,
        installmentNumber: installmentNumber++,
        label: charge.name,
        amountDue: Number(charge.amount),
        dueDate: info.enrollmentDate,
      });
    }

    await client.query('commit');

    await recordAudit({
      actorStaffId: actorId,
      action: 'fee_plan.generate',
      entityType: 'student_enrollment',
      entityId: enrollmentId,
      afterData: { feeStructureId: structure.id, totalPayable },
    });

    const installments = await repo.getInstallmentsForPlan(plan.id);
    return {
      id: plan.id,
      enrollmentId: plan.enrollment_id,
      feeStructureId: plan.fee_structure_id,
      totalPayable: Number(plan.total_payable),
      installments: installments.map(toInstallmentDto),
    };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function getFeeSummaryForEnrollment(enrollmentId: string): Promise<FeePlanDto | null> {
  const plan = await repo.getFeePlanByEnrollment(enrollmentId);
  if (!plan) return null;
  const installments = await repo.getInstallmentsForPlan(plan.id);
  return {
    id: plan.id,
    enrollmentId: plan.enrollment_id,
    feeStructureId: plan.fee_structure_id,
    totalPayable: Number(plan.total_payable),
    installments: installments.map(toInstallmentDto),
  };
}

// --- Fee transactions ---

export interface FeeTransactionDto {
  id: string;
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
  createdAt: string;
}

function toTransactionDto(row: repo.FeeTransactionRow): FeeTransactionDto {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    receiptNumber: row.receipt_number,
    financialYear: row.financial_year,
    amount: Number(row.amount),
    paymentMode: row.payment_mode,
    paymentReference: row.payment_reference,
    paymentDate: row.payment_date,
    collectedBy: row.collected_by,
    transactionType: row.transaction_type,
    reversedTransactionId: row.reversed_transaction_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function collectPayment(
  actorId: string,
  input: {
    enrollmentId: string;
    amount: number;
    paymentMode: string;
    paymentReference?: string;
    paymentDate: string;
    notes?: string;
  },
): Promise<FeeTransactionDto> {
  const plan = await repo.getFeePlanByEnrollment(input.enrollmentId);
  if (!plan) throw new HttpError(400, 'No fee plan exists for this enrollment yet');

  const client = await pool.connect();
  try {
    await client.query('begin');

    const unpaid = await repo.getUnpaidInstallmentsForPlan(client, plan.id);
    const totalPending = unpaid.reduce((s, i) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);
    if (input.amount > totalPending + AMOUNT_TOLERANCE) {
      throw new HttpError(400, `Amount (${input.amount}) exceeds pending balance (${totalPending.toFixed(2)})`);
    }
    // AMOUNT_TOLERANCE above only exists to absorb floating-point noise in
    // totalPending (numeric(10,2) columns summed as JS numbers); the amount
    // actually recorded and allocated must never exceed what's payable, or
    // the transaction total and the sum of its allocations permanently
    // disagree by the unallocated remainder. There's no credit-balance
    // concept in this system, so any such remainder is simply not owed.
    const amount = Math.min(input.amount, totalPending);

    const financialYear = computeFinancialYear(input.paymentDate);
    const receiptNumber = await repo.nextReceiptNumber(client, financialYear, await getReceiptPrefix());

    const transaction = await repo.createFeeTransaction(client, {
      enrollmentId: input.enrollmentId,
      receiptNumber,
      financialYear,
      amount,
      paymentMode: input.paymentMode,
      paymentReference: input.paymentReference ?? null,
      paymentDate: input.paymentDate,
      collectedBy: actorId,
      transactionType: 'payment',
      reversedTransactionId: null,
      notes: input.notes ?? null,
    });

    let remaining = amount;
    for (const installment of unpaid) {
      if (remaining <= AMOUNT_TOLERANCE) break;
      const due = Number(installment.amount_due) - Number(installment.amount_paid);
      const allocate = Math.min(due, remaining);
      if (allocate <= 0) continue;
      await repo.createAllocation(client, {
        feeTransactionId: transaction.id,
        studentFeeInstallmentId: installment.id,
        amountAllocated: allocate,
      });
      await repo.applyPaymentToInstallment(client, installment.id, allocate);
      remaining = Number((remaining - allocate).toFixed(2));
    }

    await client.query('commit');

    await recordAudit({
      actorStaffId: actorId,
      action: 'fee_transaction.collect',
      entityType: 'fee_transaction',
      entityId: transaction.id,
      afterData: { enrollmentId: input.enrollmentId, amount, receiptNumber },
    });

    // Best-effort, after commit: the payment is already durable, so a
    // notification failure (bad template, gateway down) must never affect
    // the response to the cashier who just collected real money.
    sendPaymentConfirmation(input.enrollmentId, amount, receiptNumber).catch((err) =>
      console.error('[fees] payment confirmation notification failed:', err),
    );

    return toTransactionDto(transaction);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

async function sendPaymentConfirmation(enrollmentId: string, amount: number, receiptNumber: string): Promise<void> {
  const [context, phone] = await Promise.all([
    getEnrollmentDisplayContext(enrollmentId),
    getPrimaryContactPhone(enrollmentId),
  ]);
  if (!context) return;

  await notify({
    templateKey: 'payment_confirmation',
    recipientType: 'student_enrollment',
    recipientId: enrollmentId,
    to: phone,
    variables: {
      studentName: `${context.first_name} ${context.last_name}`,
      amount: amount.toFixed(2),
      courseName: context.course_name,
      receiptNumber,
    },
  });
}

export async function voidTransaction(actorId: string, transactionId: string, reason: string): Promise<FeeTransactionDto> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    // Locked for the rest of this transaction so two concurrent void calls
    // on the same payment serialize instead of both passing the checks below.
    const original = await repo.getTransactionByIdForUpdate(client, transactionId);
    if (!original) throw new HttpError(404, 'Transaction not found');
    if (original.transaction_type !== 'payment') {
      throw new HttpError(400, 'Only payment transactions can be voided');
    }
    if (await repo.isTransactionAlreadyVoided(client, transactionId)) {
      throw new HttpError(409, 'This transaction has already been voided');
    }

    const allocations = await repo.getAllocationsForTransaction(transactionId);
    for (const alloc of allocations) {
      await repo.reversePaymentFromInstallment(client, alloc.student_fee_installment_id, Number(alloc.amount_allocated));
    }

    const today = new Date().toISOString().slice(0, 10);
    const financialYear = computeFinancialYear(today);
    const receiptNumber = await repo.nextReceiptNumber(client, financialYear, await getReceiptPrefix());

    const voidTxn = await repo.createFeeTransaction(client, {
      enrollmentId: original.enrollment_id,
      receiptNumber,
      financialYear,
      amount: -Number(original.amount),
      paymentMode: original.payment_mode,
      paymentReference: original.payment_reference,
      paymentDate: today,
      collectedBy: actorId,
      transactionType: 'void',
      reversedTransactionId: original.id,
      notes: reason,
    });

    await client.query('commit');

    await recordAudit({
      actorStaffId: actorId,
      action: 'fee_transaction.void',
      entityType: 'fee_transaction',
      entityId: original.id,
      beforeData: { amount: original.amount, receiptNumber: original.receipt_number },
      afterData: { voidTransactionId: voidTxn.id, reason },
    });

    return toTransactionDto(voidTxn);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function listTransactionsForEnrollment(enrollmentId: string): Promise<FeeTransactionDto[]> {
  return (await repo.getTransactionsForEnrollment(enrollmentId)).map(toTransactionDto);
}

export async function getTransaction(id: string): Promise<FeeTransactionDto> {
  const row = await repo.getTransactionById(id);
  if (!row) throw new HttpError(404, 'Transaction not found');
  return toTransactionDto(row);
}

export interface RecentTransactionDto {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  transactionType: string;
  studentName: string;
  admissionNumber: string;
  courseName: string;
}

export async function listRecentTransactions(limit: number): Promise<RecentTransactionDto[]> {
  const rows = await repo.getRecentTransactions(limit);
  return rows.map((r) => ({
    id: r.id,
    receiptNumber: r.receipt_number,
    paymentDate: r.payment_date,
    amount: Number(r.amount),
    paymentMode: r.payment_mode,
    transactionType: r.transaction_type,
    studentName: `${r.first_name} ${r.last_name}`,
    admissionNumber: r.admission_number,
    courseName: r.course_name,
  }));
}

export async function getTodaysCollectionTotal(date: string): Promise<number> {
  return repo.getTodaysCollectionTotal(date);
}

export async function getPendingFeesTotal(): Promise<number> {
  return repo.getPendingFeesTotal();
}
