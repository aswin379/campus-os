import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const boolFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: boolFromString.default('false'),
  APP_BASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  COOKIE_SECURE: boolFromString.default('false'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./data/uploads'),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  SMS_PROVIDER: z.enum(['console', 'msg91', 'twilio']).default('console'),
  EMAIL_PROVIDER: z.enum(['console', 'sendgrid']).default('console'),
  // Central license check-in (see lib/license/) — both optional so the app
  // still runs (showing a "missing" banner) if licensing isn't configured
  // yet, e.g. during initial setup before the vendor has issued a key.
  LICENSE_SERVER_URL: z.union([z.literal(''), z.string().url()]).optional(),
  LICENSE_KEY: z.string().optional(),
  LICENSE_INSTANCE_ID_PATH: z.string().default('./data/instance-id'),
  LICENSE_CACHE_PATH: z.string().default('./data/license-cache.json'),
  VENDOR_SUPPORT_CONTACT: z.string().optional(),
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
