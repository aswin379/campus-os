import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, authorizeAny } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const feeStructuresRouter = Router();
feeStructuresRouter.use(authenticate);
feeStructuresRouter.get('/', authorize('fees.structure.view'), asyncHandler(controller.listFeeStructures));
feeStructuresRouter.post('/', authorize('fees.structure.manage'), asyncHandler(controller.createFeeStructure));
feeStructuresRouter.patch('/:id/active', authorize('fees.structure.manage'), asyncHandler(controller.setFeeStructureActive));

// Seeing a student's balance is a prerequisite for collecting a payment, not
// just for browsing — gating it behind fees.view alone would let a cashier
// hold fees.collect yet never be able to see how much is owed.
const canReadFeeData = authorizeAny('fees.view', 'fees.collect');

export const feeDiscountsRouter = Router();
feeDiscountsRouter.use(authenticate);
feeDiscountsRouter.get('/', canReadFeeData, asyncHandler(controller.listDiscounts));
feeDiscountsRouter.post('/', authorize('fees.structure.manage'), asyncHandler(controller.addDiscount));

export const feePlansRouter = Router();
feePlansRouter.use(authenticate);
feePlansRouter.post('/', authorize('fees.collect'), asyncHandler(controller.generateFeePlan));
feePlansRouter.get('/summary', canReadFeeData, asyncHandler(controller.getFeeSummary));

export const feeTransactionsRouter = Router();
feeTransactionsRouter.use(authenticate);
feeTransactionsRouter.get('/', canReadFeeData, asyncHandler(controller.listTransactions));
feeTransactionsRouter.get('/recent', canReadFeeData, asyncHandler(controller.listRecentTransactions));
feeTransactionsRouter.post('/', authorize('fees.collect'), asyncHandler(controller.collectPayment));
feeTransactionsRouter.post('/:id/void', authorize('fees.edit'), asyncHandler(controller.voidTransaction));
feeTransactionsRouter.get('/:id/receipt', authorize('fees.receipt.reprint'), asyncHandler(controller.getReceipt));
