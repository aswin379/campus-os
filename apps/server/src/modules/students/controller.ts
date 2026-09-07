import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import { createStudentSchema, listStudentsQuerySchema, updateStudentSchema } from './validators.js';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function listStudents(req: Request, res: Response): Promise<void> {
  const query = parseOr400(listStudentsQuerySchema, req.query, res);
  if (!query) return;
  res.json(await service.listStudents(query));
}

export async function getStudent(req: Request, res: Response): Promise<void> {
  res.json(await service.getStudent(req.params.id!));
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createStudentSchema, req.body, res);
  if (!data) return;
  const created = await service.createStudent(req.user!.id, data);
  res.status(201).json(created);
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateStudentSchema, req.body, res);
  if (!data) return;
  const updated = await service.updateStudent(req.user!.id, req.params.id!, data);
  res.json(updated);
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  await service.deleteStudent(req.user!.id, req.params.id!);
  res.status(204).send();
}

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No photo uploaded' });
    return;
  }
  await service.uploadStudentPhoto(req.user!.id, req.params.id!, {
    buffer: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
  });
  res.status(204).send();
}

export async function getPhoto(req: Request, res: Response): Promise<void> {
  const photo = await service.getStudentPhoto(req.params.id!);
  if (!photo) {
    res.status(404).json({ error: 'No photo on file' });
    return;
  }
  const ext = photo.key.split('.').pop() ?? '';
  res.setHeader('Content-Type', CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream');
  res.send(photo.buffer);
}
