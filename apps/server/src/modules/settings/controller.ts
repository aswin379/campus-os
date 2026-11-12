import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { updateSettingsSchema } from './validators.js';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json(await service.getInstituteSettings());
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateSettingsSchema, req.body, res);
  if (!data) return;
  res.json(await service.updateInstituteSettings(req.user!.id, data));
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No logo uploaded' });
    return;
  }
  await service.uploadInstituteLogo(req.user!.id, {
    buffer: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
  });
  res.status(204).send();
}

export async function getLogo(_req: Request, res: Response): Promise<void> {
  const logo = await service.getInstituteLogo();
  if (!logo) {
    res.status(404).json({ error: 'No logo on file' });
    return;
  }
  const ext = logo.key.split('.').pop() ?? '';
  res.setHeader('Content-Type', CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream');
  res.send(logo.buffer);
}
