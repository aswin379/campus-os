import type { Request, Response } from 'express';
import * as service from './service.js';
import type { ExportFormat } from './service.js';

function parseFormat(req: Request): ExportFormat {
  const f = req.query.format;
  return f === 'pdf' || f === 'xlsx' ? f : 'json';
}

function send(res: Response, result: Awaited<ReturnType<typeof service.getStudentReport>>): void {
  if (result.format === 'json') {
    res.json(result.data);
    return;
  }
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
}

export async function getStudentReport(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  send(res, await service.getStudentReport(status, parseFormat(req)));
}

export async function getCourseReport(req: Request, res: Response): Promise<void> {
  send(res, await service.getCourseReport(parseFormat(req)));
}

export async function getFeeCollectionReport(req: Request, res: Response): Promise<void> {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  if (!from || !to) {
    res.status(400).json({ error: 'from and to query parameters are required (YYYY-MM-DD)' });
    return;
  }
  send(res, await service.getFeeCollectionReport(from, to, parseFormat(req)));
}

export async function getPendingFeesReport(req: Request, res: Response): Promise<void> {
  send(res, await service.getPendingFeesReport(parseFormat(req)));
}

export async function getAuditLog(req: Request, res: Response): Promise<void> {
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await service.getAuditLog({ entityType, entityId }, limit));
}
