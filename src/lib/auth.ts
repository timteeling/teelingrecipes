import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { allowedEmails } from '@/db/schema';
import { env, magicLinkEnabled } from './env';
import { magicLinkEmail, sendEmail } from './email';

/**
 * The allowlist gate. This is what replaces the legacy app's open `/register`
 * route, where anyone on the internet could create an account with full read
 * and write access to every recipe.
 *
 * It is enforced regardless of how someone arrives — Google or magic link.
 * Authenticating with Google proves who you are, not that you are family.
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

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  account: {
    accountLinking: {
      // Migrated users exist as rows with an email but no linked identity.
      // Without this, their first Google sign-in would collide on the unique
      // email instead of attaching to the row they already own.
      enabled: true,
      trustedProviders: ['google'],
    },
  },

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
    // Only registered when an email sender is configured. With Google as the
    // primary method this stays off, and the app needs no email vendor.
    ...(magicLinkEnabled
      ? [
          magicLink({
            expiresIn: 60 * 15,
            sendMagicLink: async ({ email, url }) => {
              // Silently no-op for addresses that are not allowlisted, so the
              // endpoint cannot be used to enumerate who has an account.
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
        ]
      : []),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
