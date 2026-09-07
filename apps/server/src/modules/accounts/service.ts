import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import * as repo from './repository.js';

export interface TransactionDto {
  id: string;
  type: string;
  category: string;
  amount: number;
  transactionDate: string;
  paymentMode: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDto(row: repo.AccountTransactionRow): TransactionDto {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    amount: Number(row.amount),
    transactionDate: row.transaction_date,
    paymentMode: row.payment_mode,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTransactions(filters: {
  search?: string;
  type?: string;
  category?: string;
  from?: string;
  to?: string;
}): Promise<TransactionDto[]> {
  return (await repo.listTransactions(filters)).map(toDto);
}

export async function getTransaction(id: string): Promise<TransactionDto> {
  const row = await repo.getTransactionById(id);
  if (!row) throw new HttpError(404, 'Transaction not found');
  return toDto(row);
}

export async function createTransaction(
  actorId: string,
  input: {
    type: string;
    category: string;
    amount: number;
    transactionDate: string;
    paymentMode: string;
    description?: string;
  },
): Promise<TransactionDto> {
  const created = await repo.createTransaction({
    type: input.type,
    category: input.category,
    amount: input.amount,
    transactionDate: input.transactionDate,
    paymentMode: input.paymentMode,
    description: input.description ?? null,
    recordedBy: actorId,
  });

  await recordAudit({
    actorStaffId: actorId,
    action: 'account_transaction.create',
    entityType: 'account_transaction',
    entityId: created.id,
    afterData: { type: input.type, category: input.category, amount: input.amount },
  });

  return toDto(created);
}

export async function updateTransaction(
  actorId: string,
  id: string,
  input: {
    type?: string;
    category?: string;
    amount?: number;
    transactionDate?: string;
    paymentMode?: string;
    description?: string | null;
  },
): Promise<TransactionDto> {
  const before = await repo.getTransactionById(id);
  if (!before) throw new HttpError(404, 'Transaction not found');

  const updated = await repo.updateTransaction(id, input);
  if (!updated) throw new HttpError(404, 'Transaction not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'account_transaction.update',
    entityType: 'account_transaction',
    entityId: id,
    beforeData: before,
    afterData: input,
  });

  return toDto(updated);
}

export async function deleteTransaction(actorId: string, id: string): Promise<void> {
  const transaction = await repo.getTransactionById(id);
  if (!transaction) throw new HttpError(404, 'Transaction not found');

  await repo.softDeleteTransaction(id);
  await recordAudit({
    actorStaffId: actorId,
    action: 'account_transaction.delete',
    entityType: 'account_transaction',
    entityId: id,
  });
}
