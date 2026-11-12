import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { markStaffAttendanceSchema, monthlySummaryQuerySchema, rosterQuerySchema } from './validators.js';

export async function getRoster(req: Request, res: Response): Promise<void> {
  const query = parseOr400(rosterQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.getRoster(query.date));
}

export async function markAttendance(req: Request, res: Response): Promise<void> {
  const data = parseOr400(markStaffAttendanceSchema, req.body, res);
  if (!data) return;
  await service.markAttendance(req.user!.id, data);
  res.status(201).send();
}

export async function getMonthlySummary(req: Request, res: Response): Promise<void> {
  const query = parseOr400(monthlySummaryQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.getMonthlySummary(query.year, query.month));
}
