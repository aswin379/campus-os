import type { Request, Response } from 'express';
import { changePasswordSchema, loginSchema } from './validators.js';
import * as authService from './service.js';
import { DEFAULT_SESSION_MAX_AGE_MS, REMEMBER_ME_MAX_AGE_MS } from '../../middleware/session.js';

export async function postLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const result = await authService.login(parsed.data.email, parsed.data.password);

  // Regenerate the session ID on authentication (not just reuse the
  // pre-login session) so a session ID an attacker planted or observed
  // before login never becomes a valid authenticated session (fixation).
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.staffId = result.staffId;
  req.session.cookie.maxAge = parsed.data.rememberMe ? REMEMBER_ME_MAX_AGE_MS : DEFAULT_SESSION_MAX_AGE_MS;

  res.json({
    id: result.staffId,
    fullName: result.fullName,
    isSuperAdmin: result.isSuperAdmin,
    permissions: result.permissions,
    roles: result.roles,
  });
}

export function postLogout(req: Request, res: Response): void {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to log out' });
      return;
    }
    res.clearCookie('connect.sid');
    res.status(204).send();
  });
}

export async function postChangePassword(req: Request, res: Response): Promise<void> {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  await authService.changePassword(req.user!.id, parsed.data.currentPassword, parsed.data.newPassword, req.sessionID);
  res.status(204).send();
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const { fullName, roles } = await authService.getCurrentUserDetails(req.user!.id);
  res.json({
    id: req.user!.id,
    fullName,
    isSuperAdmin: req.user!.isSuperAdmin,
    permissions: req.user!.permissions,
    roles,
  });
}
