import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { computeEffectivePermissions } from '../lib/rbac/effectivePermissions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        isSuperAdmin: boolean;
        permissions: string[];
      };
    }
  }
}

/**
 * Wrapped in asyncHandler at the source (not left to each call site to
 * remember) so a rejected query here always reaches errorHandler as a normal
 * 500 instead of becoming an unhandled promise rejection — Express 4 does
 * not auto-catch async middleware, and this middleware runs on every
 * authenticated request in the app.
 */
export const authenticate = asyncHandler(async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const staffId = req.session.staffId;
  if (!staffId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { rows } = await pool.query<{ is_active: boolean; is_super_admin: boolean }>(
    `select is_active, is_super_admin from staff where id = ? and deleted_at is null`,
    [staffId],
  );
  const staff = rows[0];
  if (!staff || !staff.is_active) {
    req.session.destroy(() => undefined);
    res.status(401).json({ error: 'Account inactive or not found' });
    return;
  }

  // Computed fresh (not cached in the session) so a role/permission change or
  // deactivation by an admin takes effect on the staff member's very next
  // request, not only after they log in again.
  const permissions = staff.is_super_admin ? [] : await computeEffectivePermissions(staffId);

  req.user = {
    id: staffId,
    isSuperAdmin: staff.is_super_admin,
    permissions,
  };
  next();
});
