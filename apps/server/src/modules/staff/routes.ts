import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const staffRouter = Router();

staffRouter.use(authenticate);

staffRouter.get('/', authorize('staff.view'), asyncHandler(controller.listStaff));
staffRouter.get('/:id', authorize('staff.view'), asyncHandler(controller.getStaff));
staffRouter.post('/', authorize('staff.create'), asyncHandler(controller.createStaff));
staffRouter.patch('/:id', authorize('staff.edit'), asyncHandler(controller.updateStaff));
staffRouter.patch('/:id/active', authorize('staff.edit'), asyncHandler(controller.setStaffActive));
staffRouter.post('/:id/reset-password', authorize('staff.edit'), asyncHandler(controller.resetPassword));
staffRouter.patch(
  '/:id/permission-overrides',
  authorize('staff.assign_permissions'),
  asyncHandler(controller.setStaffPermissionOverride),
);

export const rolesRouter = Router();

rolesRouter.use(authenticate);

rolesRouter.get('/', authorize('roles.manage'), asyncHandler(controller.listRoles));
rolesRouter.post('/', authorize('roles.manage'), asyncHandler(controller.createRole));
rolesRouter.patch('/:id/permissions', authorize('roles.manage'), asyncHandler(controller.updateRolePermissions));

export const permissionsRouter = Router();

permissionsRouter.use(authenticate);
permissionsRouter.get('/', authorize('staff.assign_permissions'), asyncHandler(controller.listPermissions));
