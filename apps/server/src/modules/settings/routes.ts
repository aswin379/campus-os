import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get('/', authorize('settings.manage'), asyncHandler(controller.getSettings));
settingsRouter.put('/', authorize('settings.manage'), asyncHandler(controller.updateSettings));
