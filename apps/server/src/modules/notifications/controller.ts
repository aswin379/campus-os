import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { listLogsQuerySchema, setSettingSchema, upsertTemplateSchema } from './validators.js';

export async function listTemplates(_req: Request, res: Response): Promise<void> {
  res.json(await service.listTemplates());
}

export async function upsertTemplate(req: Request, res: Response): Promise<void> {
  const data = parseOr400(upsertTemplateSchema, req.body, res);
  if (!data) return;
  res.json(await service.upsertTemplate(req.user!.id, data));
}

export async function listLogs(req: Request, res: Response): Promise<void> {
  const query = parseOr400(listLogsQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.listLogs(query));
}

export async function listSettings(_req: Request, res: Response): Promise<void> {
  res.json(await service.listSettings());
}

export async function setSetting(req: Request, res: Response): Promise<void> {
  const data = parseOr400(setSettingSchema, req.body, res);
  if (!data) return;
  await service.setSetting(req.user!.id, data.channel, data.providerName, data.config);
  res.status(204).send();
}
