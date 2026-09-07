import type { Response } from 'express';
import type { z, ZodTypeAny } from 'zod';

/**
 * Parses `body` against `schema`; on failure writes a 400 response and
 * returns undefined so the caller can `if (!data) return;`. Shared across
 * every controller instead of each module re-declaring the same helper.
 */
export function parseOr400<S extends ZodTypeAny>(schema: S, body: unknown, res: Response): z.infer<S> | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return undefined;
  }
  return parsed.data;
}
