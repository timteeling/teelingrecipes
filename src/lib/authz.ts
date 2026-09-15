import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { allowedEmails, profiles } from '@/db/schema';
import { auth } from './auth';
import type { Recipe } from '@/db/schema';

export interface Member {
  profileId: string;
  neonUserId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Resolves the Neon session to an allowlisted profile.
 *
 * The allowlist is re-checked here on every request rather than trusted from
 * sign-up time. Neon's managed auth lets anyone create an account by default,
 * so a valid Neon session is not by itself proof of membership.
 *
 * Returns null when there is no session, or when the session belongs to
 * someone who is not (or is no longer) on the allowlist.
 */
export async function currentMember(): Promise<Member | null> {
  // Reads the session cookie from the request context. Callers that render
  // in a Server Component must set `export const dynamic = 'force-dynamic'`.
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user?.email) return null;

  const email = user.email.trim().toLowerCase();

  const rows = await db
    .select({
      profileId: profiles.id,
      email: profiles.email,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
      allowed: allowedEmails.email,
    })
    .from(profiles)
    .innerJoin(allowedEmails, eq(allowedEmails.email, profiles.email))
    .where(eq(profiles.email, email))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    profileId: row.profileId,
    neonUserId: user.id,
    email: row.email,
    name: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email,
    role: row.role,
  };
}

/**
 * Attaches the Neon user id to a migrated profile on first sign-in. Migrated
 * rows are created by the migration with an email but no Neon identity.
 */
export async function linkNeonUser(profileId: string, neonUserId: string): Promise<void> {
  await db
    .update(profiles)
    .set({ neonUserId, updatedAt: new Date() })
    .where(and(eq(profiles.id, profileId), isNull(profiles.neonUserId)));
}

export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) throw new Error('UNAUTHORIZED');
  return member;
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (member.role !== 'admin') throw new Error('FORBIDDEN');
  return member;
}

/**
 * Authorization policy, decided deliberately rather than by omission as in the
 * legacy app (where `recipe.userId` was recorded but never checked, so any
 * signed-in user could modify or delete anything).
 *
 *   edit   — any allowlisted member. It is a shared cookbook; anyone should be
 *            able to fix a typo or improve a recipe.
 *   delete — the original author, or an admin. Deletion is irreversible.
 */
export function canEditRecipe(member: Member | null): boolean {
  return member !== null;
}

export function canDeleteRecipe(
  member: Member | null,
  recipe: Pick<Recipe, 'authorId'>,
): boolean {
  if (!member) return false;
  if (member.role === 'admin') return true;
  return recipe.authorId === member.profileId;
}
