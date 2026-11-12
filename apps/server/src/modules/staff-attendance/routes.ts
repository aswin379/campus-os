import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const staffAttendanceRouter = Router();
staffAttendanceRouter.use(authenticate);

staffAttendanceRouter.get('/roster', authorize('staff_attendance.view'), asyncHandler(controller.getRoster));
staffAttendanceRouter.post('/mark', authorize('staff_attendance.mark'), asyncHandler(controller.markAttendance));
staffAttendanceRouter.get('/summary', authorize('staff_attendance.view'), asyncHandler(controller.getMonthlySummary));
