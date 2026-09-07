import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

attendanceRouter.get('/roster', authorize('attendance.view'), asyncHandler(controller.getRoster));
attendanceRouter.post('/mark', authorize('attendance.mark'), asyncHandler(controller.markAttendance));
attendanceRouter.patch('/:id', authorize('attendance.edit'), asyncHandler(controller.editAttendance));
attendanceRouter.get('/history', authorize('attendance.view'), asyncHandler(controller.getHistory));
attendanceRouter.get('/summary', authorize('attendance.view'), asyncHandler(controller.getBatchSummary));
