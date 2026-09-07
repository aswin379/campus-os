import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { findLicenseByKey, insertLicense, listLicenseRows, updateLicense as updateLicenseRow } from './db.js';
import { env } from './env.js';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length must match before calling timingSafeEqual (it throws on mismatched
  // lengths), but comparing lengths first doesn't leak anything useful about
  // the secret itself — only that the input string was the wrong length.
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    res.status(401).json({ error: 'Invalid or missing admin token' });
    return;
  }
  next();
}

export function listLicenses(_req: Request, res: Response): void {
  res.json(listLicenseRows());
}

const createSchema = z.object({
  clientName: z.string().min(1),
  days: z.number().int().positive().default(365),
});

export function createLicense(req: Request, res: Response): void {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'clientName is required', details: parsed.error.flatten() });
    return;
  }
  const { clientName, days } = parsed.data;
  const licenseKey = crypto.randomBytes(24).toString('base64url');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  insertLicense({
    license_key: licenseKey,
    client_name: clientName,
    status: 'active',
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
    first_seen_instance_id: null,
    last_seen_instance_id: null,
    last_seen_at: null,
  });

  res.status(201).json(findLicenseByKey(licenseKey));
}

const updateSchema = z.object({
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  expiresAt: z.string().datetime().optional(),
  extendDays: z.number().int().positive().optional(),
});

export function updateLicense(req: Request, res: Response): void {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  const licenseKey = req.params.licenseKey!;
  const existing = findLicenseByKey(licenseKey);
  if (!existing) {
    res.status(404).json({ error: 'License not found' });
    return;
  }

  const { status, expiresAt, extendDays } = parsed.data;
  // extendDays adds onto the CURRENT expiry (the common renewal case — "add
  // another year from where it left off"), not from today, so renewing a
  // few days early or late doesn't shift the client's actual expiry date.
  const nextExpiresAt = extendDays
    ? new Date(new Date(existing.expires_at).getTime() + extendDays * 24 * 60 * 60 * 1000).toISOString()
    : expiresAt;

  const updated = updateLicenseRow(licenseKey, {
    ...(status ? { status } : {}),
    ...(nextExpiresAt ? { expires_at: nextExpiresAt } : {}),
    updated_at: new Date().toISOString(),
  });

  res.json(updated);
}
