import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { getLicenseStatus } from '../../lib/license/verify.js';
import { env } from '../../config/env.js';

export const licenseRouter = Router();

// No specific permission required (beyond being logged in) — support
// contract status isn't sensitive business data, and every staff member
// should see the renewal banner, not just admins.
licenseRouter.get(
  '/status',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ ...getLicenseStatus(), supportContact: env.VENDOR_SUPPORT_CONTACT ?? null });
  }),
);
