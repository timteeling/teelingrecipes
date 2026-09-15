import { auth } from '@/lib/auth';

/**
 * Proxies every auth request through to the Neon Auth service. Sign-in,
 * callback, session and sign-out all route through here.
 */
export const { GET, POST } = auth.handler();
