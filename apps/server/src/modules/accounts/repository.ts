import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface AccountTransactionRow {
  id: string;
  type: string;
  category: string;
  amount: string;
  transaction_date: string;
  payment_mode: string;
  description: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionInput {
  type: string;
  category: string;
  amount: number;
  transactionDate: string;
  paymentMode: string;
  description: string | null;
  recordedBy: string;
}

export async function createTransaction(input: CreateTransactionInput): Promise<AccountTransactionRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into account_transactions (id, type, category, amount, transaction_date, payment_mode, description, recorded_by)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.type, input.category, input.amount, input.transactionDate, input.paymentMode, input.description, input.recordedBy],
  );
  const { rows } = await pool.query<AccountTransactionRow>(`select * from account_transactions where id = ?`, [id]);
  return rows[0]!;
}

export interface ListTransactionsFilters {
  search?: string;
  type?: string;
  category?: string;
  from?: string;
  to?: string;
}

export async function listTransactions(filters: ListTransactionsFilters): Promise<AccountTransactionRow[]> {
  const conditions: string[] = ['deleted_at is null'];
  const params: unknown[] = [];

  if (filters.search) {
    const like = `%${filters.search}%`;
    params.push(like, like);
    conditions.push(`(category like ? or description like ?)`);
  }
  if (filters.type) {
    params.push(filters.type);
    conditions.push(`type = ?`);
  }
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`category = ?`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`transaction_date >= ?`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`transaction_date <= ?`);
  }

  const { rows } = await pool.query<AccountTransactionRow>(
    `select * from account_transactions where ${conditions.join(' and ')} order by transaction_date desc, created_at desc limit 500`,
    params,
  );
  return rows;
}

export async function getTransactionById(id: string): Promise<AccountTransactionRow | null> {
  const { rows } = await pool.query<AccountTransactionRow>(
    `select * from account_transactions where id = ? and deleted_at is null`,
    [id],
  );
  return rows[0] ?? null;
}

export interface UpdateTransactionInput {
  type?: string;
  category?: string;
  amount?: number;
  transactionDate?: string;
  paymentMode?: string;
  description?: string | null;
}

/**
 * coalesce(?, column) can't tell "field omitted, leave unchanged" apart
 * from "field explicitly cleared to null" — both arrive as a null bind
 * parameter otherwise. Only include a SET clause for keys actually present
 * on `input` (checked via `in`, so an explicit `null` still counts as
 * present), so omitted fields are left alone and explicit nulls take effect.
 */
export async function updateTransaction(id: string, input: UpdateTransactionInput): Promise<AccountTransactionRow | null> {
  const setClauses: string[] = ['updated_at = now()'];
  const setParams: unknown[] = [];
  function setField(column: string, value: unknown): void {
    setParams.push(value);
    setClauses.push(`${column} = ?`);
  }
  if ('type' in input) setField('type', input.type);
  if ('category' in input) setField('category', input.category);
  if ('amount' in input) setField('amount', input.amount);
  if ('transactionDate' in input) setField('transaction_date', input.transactionDate);
  if ('paymentMode' in input) setField('payment_mode', input.paymentMode);
  if ('description' in input) setField('description', input.description);

  const result = await pool.query(
    `update account_transactions set ${setClauses.join(', ')} where id = ? and deleted_at is null`,
    [...setParams, id],
  );
  if (result.rowCount === 0) return null;

  const { rows } = await pool.query<AccountTransactionRow>(
    `select * from account_transactions where id = ? and deleted_at is null`,
    [id],
  );
  return rows[0] ?? null;
}

export async function softDeleteTransaction(id: string): Promise<void> {
  await pool.query(`update account_transactions set deleted_at = now() where id = ?`, [id]);
}
