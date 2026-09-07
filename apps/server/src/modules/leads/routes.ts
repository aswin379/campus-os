import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const leadsRouter = Router();

leadsRouter.use(authenticate);

leadsRouter.get('/', authorize('leads.view'), asyncHandler(controller.listLeads));
leadsRouter.get('/bulk-upload/sample', authorize('leads.create'), asyncHandler(controller.downloadSampleLeadSheet));
leadsRouter.post('/bulk-upload', authorize('leads.create'), upload.single('file'), asyncHandler(controller.bulkUploadLeads));
leadsRouter.get('/:id', authorize('leads.view'), asyncHandler(controller.getLead));
leadsRouter.post('/', authorize('leads.create'), asyncHandler(controller.createLead));
leadsRouter.patch('/:id', authorize('leads.edit'), asyncHandler(controller.updateLead));
leadsRouter.delete('/:id', authorize('leads.delete'), asyncHandler(controller.deleteLead));

leadsRouter.get('/:id/followups', authorize('leads.view'), asyncHandler(controller.listFollowups));
leadsRouter.post('/:id/followups', authorize('leads.edit'), asyncHandler(controller.addFollowup));
