import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { createLeadSchema, updateLeadSchema, listLeadsQuerySchema, createFollowupSchema } from './validators.js';
import { parseLeadSheet } from './parseLeadSheet.js';

const ALLOWED_SPREADSHEET_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

export async function listLeads(req: Request, res: Response): Promise<void> {
  const query = parseOr400(listLeadsQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.listLeads(query));
}

export async function getLead(req: Request, res: Response): Promise<void> {
  res.json(await service.getLead(req.params.id!));
}

export async function createLead(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createLeadSchema, req.body, res);
  if (!data) return;
  const created = await service.createLead(req.user!.id, data);
  res.status(201).json(created);
}

export async function updateLead(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateLeadSchema, req.body, res);
  if (!data) return;
  const updated = await service.updateLead(req.user!.id, req.params.id!, data);
  res.json(updated);
}

export async function deleteLead(req: Request, res: Response): Promise<void> {
  await service.deleteLead(req.user!.id, req.params.id!);
  res.status(204).send();
}

export async function downloadSampleLeadSheet(_req: Request, res: Response): Promise<void> {
  const buffer = await service.buildSampleLeadSheet();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-bulk-upload-sample.xlsx"');
  res.send(buffer);
}

export async function bulkUploadLeads(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  if (!ALLOWED_SPREADSHEET_TYPES.has(file.mimetype)) {
    res.status(400).json({ error: 'File must be an .xlsx or .xls spreadsheet' });
    return;
  }

  let rows;
  try {
    rows = await parseLeadSheet(file.buffer);
  } catch {
    res.status(400).json({ error: 'Could not read the uploaded file — make sure it is a valid spreadsheet' });
    return;
  }
  if (rows.length === 0) {
    res.status(400).json({ error: 'No data rows found in the uploaded file' });
    return;
  }

  res.json(await service.bulkCreateLeads(req.user!.id, rows));
}

export async function listFollowups(req: Request, res: Response): Promise<void> {
  res.json(await service.listFollowups(req.params.id!));
}

export async function addFollowup(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createFollowupSchema, req.body, res);
  if (!data) return;
  const created = await service.addFollowup(req.user!.id, req.params.id!, data);
  res.status(201).json(created);
}
