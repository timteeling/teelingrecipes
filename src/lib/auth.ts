import { createNeonAuth } from '@neondatabase/auth/next/server';

import { env } from './env';

/**
 * Neon Managed Better Auth.
 *
 * The auth service runs on Neon, not in this app. Identity, sessions and
 * provider accounts live in the `neon_auth.*` schema of the same database,
 * so auth state branches with the database in preview environments.
 *
 * Google OAuth credentials are configured in the Neon Console rather than
 * here, so no client id or secret appears in this app's environment.
 */
export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
  },
});
