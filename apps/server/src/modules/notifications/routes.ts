import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/templates', authorize('notifications.manage'), asyncHandler(controller.listTemplates));
notificationsRouter.put('/templates', authorize('notifications.manage'), asyncHandler(controller.upsertTemplate));
notificationsRouter.get('/logs', authorize('notifications.view_logs'), asyncHandler(controller.listLogs));
notificationsRouter.get('/settings', authorize('notifications.manage'), asyncHandler(controller.listSettings));
notificationsRouter.put('/settings', authorize('notifications.manage'), asyncHandler(controller.setSetting));
