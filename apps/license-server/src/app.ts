import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate } from './validate.js';
import { requireAdmin, listLicenses, createLicense, updateLicense } from './admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/api/v1/validate', validate);

  app.get('/api/v1/admin/licenses', requireAdmin, listLicenses);
  app.post('/api/v1/admin/licenses', requireAdmin, createLicense);
  app.patch('/api/v1/admin/licenses/:licenseKey', requireAdmin, updateLicense);

  // Vanilla HTML/JS admin page — no build step needed for a single-operator
  // internal tool. It prompts for ADMIN_TOKEN client-side and calls the
  // endpoints above directly.
  app.use(express.static(path.resolve(__dirname, '../public')));

  return app;
}
