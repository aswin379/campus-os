import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const coursesRouter = Router();
coursesRouter.use(authenticate);

coursesRouter.get('/', authorize('courses.view'), asyncHandler(controller.listCourses));
coursesRouter.post('/', authorize('courses.manage'), asyncHandler(controller.createCourse));
coursesRouter.get('/:id', authorize('courses.view'), asyncHandler(controller.getCourse));
coursesRouter.patch('/:id', authorize('courses.manage'), asyncHandler(controller.updateCourse));

coursesRouter.get('/:id/assessment-structure', authorize('courses.view'), asyncHandler(controller.getAssessmentStructure));
coursesRouter.put('/:id/assessment-structure', authorize('exams.configure'), asyncHandler(controller.setAssessmentStructure));

coursesRouter.get('/:id/batches', authorize('courses.view'), asyncHandler(controller.listBatches));
coursesRouter.post('/:id/batches', authorize('courses.manage'), asyncHandler(controller.createBatch));

export const courseBatchesRouter = Router();
courseBatchesRouter.use(authenticate);
courseBatchesRouter.patch('/:batchId/status', authorize('courses.manage'), asyncHandler(controller.setBatchStatus));

export const enrollmentsRouter = Router();
enrollmentsRouter.use(authenticate);
enrollmentsRouter.get('/', authorize('courses.view'), asyncHandler(controller.listEnrollments));
enrollmentsRouter.post('/', authorize('courses.assign_students'), asyncHandler(controller.enrollStudent));
enrollmentsRouter.patch('/:id/status', authorize('courses.assign_students'), asyncHandler(controller.setEnrollmentStatus));
