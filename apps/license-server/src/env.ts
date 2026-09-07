import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  DB_PATH: z.string().default('./data/licenses.json'),
  // Shared secret for the admin endpoints / admin.html page — this is the
  // only auth this service has, since it's a single-operator (you) tool,
  // not a multi-user system. Generate with `openssl rand -base64 32`.
  ADMIN_TOKEN: z.string().min(16, 'ADMIN_TOKEN must be at least 16 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  throw new Error('Fatal: environment validation failed. Fix .env and restart.');
}

export const env = parsed.data;
