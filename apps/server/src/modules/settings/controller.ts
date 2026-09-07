import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { updateSettingsSchema } from './validators.js';

export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json(await service.getInstituteSettings());
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateSettingsSchema, req.body, res);
  if (!data) return;
  res.json(await service.updateInstituteSettings(req.user!.id, data));
}
