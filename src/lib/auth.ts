import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { allowedEmails } from '@/db/schema';
import { env } from './env';
import { magicLinkEmail, sendEmail } from './email';

/**
 * The allowlist gate. This is what replaces the legacy app's open `/register`
 * route, where anyone on the internet could create an account with full read
 * and write access to every recipe.
 */
async function isAllowed(email: string): Promise<boolean> {
  const rows = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email.trim().toLowerCase()))
    .limit(1);
  return rows.length > 0;
}

export const auth = betterAuth({
  appName: 'Teeling Family Recipes',
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),

  // No password auth anywhere in this app. Nothing to hash, nothing to reset,
  // nothing to stuff credentials against.
  emailAndPassword: { enabled: false },

  user: {
    additionalFields: {
      firstName: { type: 'string', required: false, input: true },
      lastName: { type: 'string', required: false, input: true },
      // Never settable from client input — it is an authorization decision.
      role: { type: 'string', required: false, input: false, defaultValue: 'member' },
      legacyCid: { type: 'number', required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
  },

  databaseHooks: {
    user: {
      create: {
        // Defence in depth: even if a sign-in flow is reached some other way,
        // an account is never created for an address that is not allowlisted.
        before: async (user) => {
          if (!(await isAllowed(user.email))) {
            throw new Error('This email address is not on the allowlist.');
          }
          return { data: user };
        },
      },
    },
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        // Silently no-op for addresses that are not allowlisted. The caller
        // still sees success, so this endpoint cannot be used to enumerate
        // which family members have accounts.
        if (!(await isAllowed(email))) return;

        const { html, text } = magicLinkEmail(url);
        await sendEmail({
          to: email,
          subject: 'Sign in to Teeling Family Recipes',
          html,
          text,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
