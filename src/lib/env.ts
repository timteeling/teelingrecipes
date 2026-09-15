import { z } from 'zod';

/**
 * Fail fast and loudly on misconfiguration. The legacy app hardcoded its
 * session secret in source (`login.js`), which is exactly what this prevents.
 */
const schema = z.object({
  // Neon POOLED connection string (host contains `-pooler`). Serverless
  // functions open many short-lived connections; the direct string will
  // exhaust the connection limit.
  DATABASE_URL: z.string().url(),

  // Neon Managed Better Auth instance, from Console -> Auth.
  // e.g. https://ep-xxxx.neonauth.us-east-1.aws.neon.tech
  NEON_AUTH_BASE_URL: z.string().url(),

  // Signs the session cookie. openssl rand -base64 32
  NEON_AUTH_COOKIE_SECRET: z.string().min(32, 'must be at least 32 characters'),

  // Shared secret for verifying Neon's user.before_create webhook. Without
  // this the allowlist gate could be spoofed by anyone who finds the URL.
  NEON_AUTH_WEBHOOK_SECRET: z.string().min(16),

  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
