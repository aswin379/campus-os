import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get('/students', authorize('reports.view'), asyncHandler(controller.getStudentReport));
reportsRouter.get('/courses', authorize('reports.view'), asyncHandler(controller.getCourseReport));
reportsRouter.get('/fee-collection', authorize('reports.view'), asyncHandler(controller.getFeeCollectionReport));
reportsRouter.get('/pending-fees', authorize('reports.view'), asyncHandler(controller.getPendingFeesReport));
reportsRouter.get('/audit-log', authorize('audit.view'), asyncHandler(controller.getAuditLog));
