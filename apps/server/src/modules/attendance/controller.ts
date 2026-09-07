import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import {
  batchSummaryQuerySchema,
  editAttendanceSchema,
  historyQuerySchema,
  markAttendanceSchema,
  rosterQuerySchema,
} from './validators.js';

export async function getRoster(req: Request, res: Response): Promise<void> {
  const query = parseOr400(rosterQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.getRoster(query.batchId, query.date));
}

export async function markAttendance(req: Request, res: Response): Promise<void> {
  const data = parseOr400(markAttendanceSchema, req.body, res);
  if (!data) return;
  await service.markAttendance(req.user!.id, data);
  res.status(204).send();
}

export async function editAttendance(req: Request, res: Response): Promise<void> {
  const data = parseOr400(editAttendanceSchema, req.body, res);
  if (!data) return;
  res.json(await service.editAttendance(req.user!.id, req.params.id!, data.status));
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  const query = parseOr400(historyQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.getHistory(query.enrollmentId));
}

export async function getBatchSummary(req: Request, res: Response): Promise<void> {
  const query = parseOr400(batchSummaryQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.getBatchMonthlySummary(query.batchId, query.year, query.month));
}
