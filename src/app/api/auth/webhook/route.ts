import { createHmac, timingSafeEqual } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { allowedEmails } from '@/db/schema';
import { env } from '@/lib/env';

/**
 * Allowlist gate for Neon Managed Better Auth.
 *
 * Neon's managed auth permits anyone to sign up by default — restricted
 * signups are not yet supported — so the `user.before_create` webhook is the
 * enforcement point. It is a BLOCKING event: if this endpoint is down or
 * returns 500, all new sign-ups fail. That is the correct failure direction
 * for a private family app, but it does mean this route must stay healthy.
 *
 * This is not the only gate. `requireMember()` re-checks the allowlist on
 * every authenticated request, so a user record created by any other path
 * still sees nothing.
 *
 * TODO(confirm): the signature header name and signing scheme below are
 * modelled on the usual HMAC-SHA256-over-raw-body convention and have NOT
 * been verified against Neon's webhook documentation. Confirm before relying
 * on this in production.
 */

const SIGNATURE_HEADER = 'x-neon-signature';

function verify(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', env.NEON_AUTH_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const given = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  const want = Buffer.from(expected, 'hex');

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

function deny(message: string) {
  return NextResponse.json({ allow: false, message }, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  // Read the raw body before parsing — the signature covers the exact bytes.
  const rawBody = await request.text();

  if (!verify(rawBody, request.headers.get(SIGNATURE_HEADER))) {
    // Fail closed. An unverified call must never be able to approve a signup.
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: { event?: string; data?: { user?: { email?: string } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return deny('Malformed request.');
  }

  if (payload.event !== 'user.before_create') {
    // Not a gate event; acknowledge without acting.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const email = payload.data?.user?.email?.trim().toLowerCase();
  if (!email) return deny('No email address on the sign-up request.');

  const rows = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);

  if (rows.length === 0) {
    // Message is shown to the person attempting to sign up, so it is
    // deliberately vague about whether the address exists.
    return deny('This app is invite only. Ask Tim to add your email address.');
  }

  return NextResponse.json({ allow: true }, { status: 200 });
}
