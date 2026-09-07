import type { PermissionKey } from '@erp/shared';
import type { NextFunction, Request, Response } from 'express';

/**
 * is_super_admin bypasses all permission checks so the institute can never
 * lock itself out of its own system via a permission misconfiguration.
 */
export function authorize(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.isSuperAdmin || req.user.permissions.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: `Missing permission: ${permission}` });
  };
}

/**
 * For reads that are a genuine prerequisite of more than one write action —
 * e.g. seeing a fee balance is required to collect a payment OR to review
 * the structure, and seeing entered marks is required to enter more marks OR
 * to publish a result. Gating the read behind only one of those write
 * permissions would let a staff member hold the write permission yet be
 * unable to see the data they need to use it.
 */
export function authorizeAny(...permissions: PermissionKey[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.isSuperAdmin || permissions.some((p) => req.user!.permissions.includes(p))) {
      next();
      return;
    }
    res.status(403).json({ error: `Missing permission: one of ${permissions.join(', ')}` });
  };
}
