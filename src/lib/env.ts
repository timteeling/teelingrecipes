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

  BETTER_AUTH_SECRET: z.string().min(32, 'generate with: openssl rand -base64 32'),
  BETTER_AUTH_URL: z.string().url(),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),

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
