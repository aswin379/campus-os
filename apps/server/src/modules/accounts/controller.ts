import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { createTransactionSchema, updateTransactionSchema, listTransactionsQuerySchema } from './validators.js';

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const query = parseOr400(listTransactionsQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.listTransactions(query));
}

export async function getTransaction(req: Request, res: Response): Promise<void> {
  res.json(await service.getTransaction(req.params.id!));
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createTransactionSchema, req.body, res);
  if (!data) return;
  const created = await service.createTransaction(req.user!.id, data);
  res.status(201).json(created);
}

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateTransactionSchema, req.body, res);
  if (!data) return;
  const updated = await service.updateTransaction(req.user!.id, req.params.id!, data);
  res.json(updated);
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  await service.deleteTransaction(req.user!.id, req.params.id!);
  res.status(204).send();
}
