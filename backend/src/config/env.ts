import { z } from 'zod';
import { logger } from '../utils/logger';

// Validate configuration ONCE at startup so the app fails fast (and loudly) on a bad
// deploy instead of erroring deep in a request. dotenv must be loaded before this runs
// (app.ts imports 'dotenv/config' on its first line).
const isTest = process.env.NODE_ENV === 'test';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  APP_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().optional(), // comma-separated allow-list (production domains)
  // TEMPORARY: when 'true', new customers are verified on sign-up and no verification
  // email is sent. Needed because our host (Railway) blocks outbound SMTP, so the Gmail
  // verification email can't be delivered. Flip back to 'false' once email is sent over
  // an HTTP provider (e.g. Brevo) instead of SMTP. Kept as an env flag so it can be
  // toggled without a code change.
  AUTO_VERIFY_CUSTOMERS: z.string().optional(),
  // Optional integrations — features degrade gracefully when absent.
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  logger.error(`Invalid environment configuration:\n${issues}`);
  if (!isTest) process.exit(1);
}

export const env = parsed.success
  ? parsed.data
  : // In tests we don't hard-exit; fall back so the suite can still report failures.
    ({ ...process.env, NODE_ENV: 'test', PORT: 5000, JWT_EXPIRES_IN: '7d', APP_URL: 'http://localhost:5173' } as z.infer<typeof schema>);

// Enforce a strong JWT secret in production; warn (don't block) elsewhere so local/test
// setups stay frictionless.
if (env.JWT_SECRET.length < 32) {
  if (env.NODE_ENV === 'production') {
    logger.error('JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  } else {
    logger.warn('JWT_SECRET is shorter than 32 chars — fine for dev, but use a long random secret in production.');
  }
}

export const isProd = env.NODE_ENV === 'production';

// TEMPORARY auth toggle (see AUTO_VERIFY_CUSTOMERS above).
export const autoVerifyCustomers = env.AUTO_VERIFY_CUSTOMERS === 'true';
if (autoVerifyCustomers) {
  logger.warn('AUTO_VERIFY_CUSTOMERS is ON — new customers skip email verification.');
}
