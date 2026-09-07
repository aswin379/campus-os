import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const accountTransactionsRouter = Router();

accountTransactionsRouter.use(authenticate);

accountTransactionsRouter.get('/', authorize('accounts.view'), asyncHandler(controller.listTransactions));
accountTransactionsRouter.get('/:id', authorize('accounts.view'), asyncHandler(controller.getTransaction));
accountTransactionsRouter.post('/', authorize('accounts.create'), asyncHandler(controller.createTransaction));
accountTransactionsRouter.patch('/:id', authorize('accounts.edit'), asyncHandler(controller.updateTransaction));
accountTransactionsRouter.delete('/:id', authorize('accounts.delete'), asyncHandler(controller.deleteTransaction));
