import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import * as controller from './controller.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(controller.postLogin));
authRouter.post('/logout', controller.postLogout);
authRouter.post('/change-password', authenticate, asyncHandler(controller.postChangePassword));
authRouter.get('/me', authenticate, asyncHandler(controller.getMe));
