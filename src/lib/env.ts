import { z } from 'zod';

/**
 * Fail fast and loudly on misconfiguration. The legacy app hardcoded its
 * session secret in source (`login.js`), which is exactly what this prevents.
 */
const schema = z
  .object({
    // Neon POOLED connection string (host contains `-pooler`). Serverless
    // functions open many short-lived connections; the direct string will
    // exhaust the connection limit.
    DATABASE_URL: z.string().url(),

    BETTER_AUTH_SECRET: z.string().min(32, 'generate with: openssl rand -base64 32'),
    BETTER_AUTH_URL: z.string().url(),

    // Primary sign-in method. Every known family member already has a Google
    // account, so this needs no email infrastructure at all.
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    // Optional magic-link fallback, for anyone without a Google account.
    // Leave unset and magic links simply are not offered.
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().email().optional(),

    BLOB_READ_WRITE_TOKEN: z.string().min(1),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .refine((e) => !e.RESEND_API_KEY || Boolean(e.EMAIL_FROM), {
    message: 'EMAIL_FROM is required when RESEND_API_KEY is set',
    path: ['EMAIL_FROM'],
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

/** Magic links are offered only when an email sender is configured. */
export const magicLinkEnabled = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
