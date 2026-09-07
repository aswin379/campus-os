import type { Request, Response } from 'express';
import { getEnrollmentDisplayContext } from '../../lib/enrollmentContext.js';
import { parseOr400 } from '../../lib/http.js';
import { generateReceiptPdf } from '../../lib/pdf/receipt.js';
import { getInstituteSettings } from '../settings/service.js';
import * as service from './service.js';
import {
  addDiscountSchema,
  collectPaymentSchema,
  createFeeStructureSchema,
  generateFeePlanSchema,
  setFeeStructureActiveSchema,
  voidTransactionSchema,
} from './validators.js';

export async function listFeeStructures(req: Request, res: Response): Promise<void> {
  const courseId = req.query.courseId;
  if (typeof courseId !== 'string') {
    res.status(400).json({ error: 'courseId query parameter is required' });
    return;
  }
  res.json(await service.listFeeStructuresForCourse(courseId));
}

export async function createFeeStructure(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createFeeStructureSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.createFeeStructure(req.user!.id, data));
}

export async function setFeeStructureActive(req: Request, res: Response): Promise<void> {
  const data = parseOr400(setFeeStructureActiveSchema, req.body, res);
  if (!data) return;
  await service.setFeeStructureActive(req.user!.id, req.params.id!, data.isActive);
  res.status(204).send();
}

export async function listDiscounts(req: Request, res: Response): Promise<void> {
  const enrollmentId = req.query.enrollmentId;
  if (typeof enrollmentId !== 'string') {
    res.status(400).json({ error: 'enrollmentId query parameter is required' });
    return;
  }
  res.json(await service.listDiscounts(enrollmentId));
}

export async function addDiscount(req: Request, res: Response): Promise<void> {
  const data = parseOr400(addDiscountSchema, req.body, res);
  if (!data) return;
  await service.addDiscount(req.user!.id, data);
  res.status(201).send();
}

export async function generateFeePlan(req: Request, res: Response): Promise<void> {
  const data = parseOr400(generateFeePlanSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.generateFeePlan(req.user!.id, data.enrollmentId));
}

export async function getFeeSummary(req: Request, res: Response): Promise<void> {
  const enrollmentId = req.query.enrollmentId;
  if (typeof enrollmentId !== 'string') {
    res.status(400).json({ error: 'enrollmentId query parameter is required' });
    return;
  }
  const plan = await service.getFeeSummaryForEnrollment(enrollmentId);
  res.json(plan);
}

export async function collectPayment(req: Request, res: Response): Promise<void> {
  const data = parseOr400(collectPaymentSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.collectPayment(req.user!.id, data));
}

export async function voidTransaction(req: Request, res: Response): Promise<void> {
  const data = parseOr400(voidTransactionSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.voidTransaction(req.user!.id, req.params.id!, data.reason));
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const enrollmentId = req.query.enrollmentId;
  if (typeof enrollmentId !== 'string') {
    res.status(400).json({ error: 'enrollmentId query parameter is required' });
    return;
  }
  res.json(await service.listTransactionsForEnrollment(enrollmentId));
}

export async function getReceipt(req: Request, res: Response): Promise<void> {
  const transaction = await service.getTransaction(req.params.id!);
  const [context, instituteSettings, original] = await Promise.all([
    getEnrollmentDisplayContext(transaction.enrollmentId),
    getInstituteSettings(),
    transaction.reversedTransactionId ? service.getTransaction(transaction.reversedTransactionId) : null,
  ]);
  if (!context) {
    res.status(404).json({ error: 'Receipt context not found' });
    return;
  }

  const pdf = await generateReceiptPdf({
    receiptNumber: transaction.receiptNumber,
    paymentDate: transaction.paymentDate,
    amount: transaction.amount,
    paymentMode: transaction.paymentMode,
    transactionType: transaction.transactionType,
    notes: transaction.notes,
    studentName: `${context.first_name} ${context.last_name}`,
    admissionNumber: context.admission_number,
    courseName: context.course_name,
    batchName: context.batch_name,
    instituteName: instituteSettings.instituteName,
    instituteAddress: instituteSettings.instituteAddress,
    termsText: instituteSettings.receiptTermsText,
    originalReceiptNumber: original?.receiptNumber ?? null,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${transaction.receiptNumber.replace(/\//g, '-')}.pdf"`);
  res.send(pdf);
}
