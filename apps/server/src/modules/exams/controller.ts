import type { Request, Response } from 'express';
import { getEnrollmentDisplayContext } from '../../lib/enrollmentContext.js';
import { parseOr400 } from '../../lib/http.js';
import { generateCertificatePdf } from '../../lib/pdf/certificate.js';
import { generateMarksheetPdf } from '../../lib/pdf/marksheet.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { getInstituteSettings } from '../settings/service.js';
import * as service from './service.js';
import { enterMarkSchema } from './validators.js';

export async function enterMark(req: Request, res: Response): Promise<void> {
  const data = parseOr400(enterMarkSchema, req.body, res);
  if (!data) return;
  await service.enterMark(req.user!.id, data);
  res.status(204).send();
}

export async function getMarks(req: Request, res: Response): Promise<void> {
  res.json(await service.getMarks(req.params.enrollmentId!));
}

export async function getResultPreview(req: Request, res: Response): Promise<void> {
  res.json(await service.getResultPreview(req.params.enrollmentId!));
}

export async function publishResult(req: Request, res: Response): Promise<void> {
  res.json(await service.publishResult(req.user!.id, req.params.enrollmentId!));
}

export async function getMarksheet(req: Request, res: Response): Promise<void> {
  const enrollmentId = req.params.enrollmentId!;
  const [marks, result, context, instituteSettings] = await Promise.all([
    service.getMarks(enrollmentId),
    service.getResultPreview(enrollmentId),
    getEnrollmentDisplayContext(enrollmentId),
    getInstituteSettings(),
  ]);
  if (!context) throw new HttpError(404, 'Enrollment not found');

  const pdf = await generateMarksheetPdf({
    studentName: `${context.first_name} ${context.last_name}`,
    admissionNumber: context.admission_number,
    courseName: context.course_name,
    batchName: context.batch_name,
    marks: marks.map((m) => ({ componentName: m.componentName, maxMarks: m.maxMarks, marksObtained: m.marksObtained })),
    totalPercentage: result.totalPercentage,
    resultStatus: result.resultStatus,
    instituteName: instituteSettings.instituteName,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="marksheet-${context.admission_number.replace(/\//g, '-')}.pdf"`);
  res.send(pdf);
}

export async function getCertificate(req: Request, res: Response): Promise<void> {
  const enrollmentId = req.params.enrollmentId!;
  const result = await service.getResultPreview(enrollmentId);
  if (!result.publishedAt || result.resultStatus !== 'pass' || !result.certificateNumber) {
    throw new HttpError(400, 'Certificate not available: result must be published and passing');
  }

  const [context, instituteSettings] = await Promise.all([
    getEnrollmentDisplayContext(enrollmentId),
    getInstituteSettings(),
  ]);
  if (!context) throw new HttpError(404, 'Enrollment not found');

  const pdf = await generateCertificatePdf({
    studentName: `${context.first_name} ${context.last_name}`,
    admissionNumber: context.admission_number,
    courseName: context.course_name,
    certificateNumber: result.certificateNumber,
    issuedDate: result.publishedAt.slice(0, 10),
    instituteName: instituteSettings.instituteName,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="certificate-${result.certificateNumber.replace(/\//g, '-')}.pdf"`);
  res.send(pdf);
}
