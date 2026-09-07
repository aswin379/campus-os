import type { Request, Response } from 'express';
import { parseOr400 } from '../../lib/http.js';
import * as service from './service.js';
import {
  assessmentStructureSchema,
  createBatchSchema,
  createCourseSchema,
  enrollStudentSchema,
  setBatchStatusSchema,
  setEnrollmentStatusSchema,
  updateCourseSchema,
} from './validators.js';

export async function listCourses(_req: Request, res: Response): Promise<void> {
  res.json(await service.listCourses());
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  res.json(await service.getCourse(req.params.id!));
}

export async function createCourse(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createCourseSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.createCourse(req.user!.id, data));
}

export async function updateCourse(req: Request, res: Response): Promise<void> {
  const data = parseOr400(updateCourseSchema, req.body, res);
  if (!data) return;
  res.json(await service.updateCourse(req.user!.id, req.params.id!, data));
}

export async function getAssessmentStructure(req: Request, res: Response): Promise<void> {
  res.json(await service.getAssessmentStructure(req.params.id!));
}

export async function setAssessmentStructure(req: Request, res: Response): Promise<void> {
  const data = parseOr400(assessmentStructureSchema, req.body, res);
  if (!data) return;
  await service.setAssessmentStructure(req.user!.id, req.params.id!, data);
  res.status(204).send();
}

export async function listBatches(req: Request, res: Response): Promise<void> {
  res.json(await service.listBatchesForCourse(req.params.id!));
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const data = parseOr400(createBatchSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.createBatch(req.user!.id, { ...data, courseId: req.params.id! }));
}

export async function setBatchStatus(req: Request, res: Response): Promise<void> {
  const data = parseOr400(setBatchStatusSchema, req.body, res);
  if (!data) return;
  res.json(await service.setBatchStatus(req.user!.id, req.params.batchId!, data.status));
}

export async function listEnrollments(req: Request, res: Response): Promise<void> {
  const { batchId, studentId } = req.query;
  if (typeof batchId === 'string') {
    res.json(await service.listEnrollmentsForBatch(batchId));
    return;
  }
  if (typeof studentId === 'string') {
    res.json(await service.listEnrollmentsForStudent(studentId));
    return;
  }
  res.status(400).json({ error: 'batchId or studentId query parameter is required' });
}

export async function enrollStudent(req: Request, res: Response): Promise<void> {
  const data = parseOr400(enrollStudentSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await service.enrollStudent(req.user!.id, data));
}

export async function setEnrollmentStatus(req: Request, res: Response): Promise<void> {
  const data = parseOr400(setEnrollmentStatusSchema, req.body, res);
  if (!data) return;
  res.json(await service.setEnrollmentStatus(req.user!.id, req.params.id!, data.status));
}
