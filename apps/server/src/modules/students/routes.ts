import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const studentsRouter = Router();

studentsRouter.use(authenticate);

studentsRouter.get('/', authorize('students.view'), asyncHandler(controller.listStudents));
studentsRouter.get('/:id', authorize('students.view'), asyncHandler(controller.getStudent));
studentsRouter.get('/:id/photo', authorize('students.view'), asyncHandler(controller.getPhoto));
studentsRouter.post('/', authorize('students.create'), asyncHandler(controller.createStudent));
studentsRouter.patch('/:id', authorize('students.edit'), asyncHandler(controller.updateStudent));
studentsRouter.delete('/:id', authorize('students.delete'), asyncHandler(controller.deleteStudent));
studentsRouter.post(
  '/:id/photo',
  authorize('students.edit'),
  upload.single('photo'),
  asyncHandler(controller.uploadPhoto),
);
