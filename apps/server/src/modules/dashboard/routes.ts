import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { getDashboardSummary } from './service.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/summary',
  authenticate,
  authorize('dashboard.view'),
  asyncHandler(async (_req, res) => {
    res.json(await getDashboardSummary());
  }),
);
