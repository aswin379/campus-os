import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get('/', authorize('settings.manage'), asyncHandler(controller.getSettings));
settingsRouter.put('/', authorize('settings.manage'), asyncHandler(controller.updateSettings));
settingsRouter.get('/logo', authorize('settings.manage'), asyncHandler(controller.getLogo));
settingsRouter.post('/logo', authorize('settings.manage'), upload.single('logo'), asyncHandler(controller.uploadLogo));
