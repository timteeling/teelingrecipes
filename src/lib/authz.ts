import { headers } from 'next/headers';

import { auth } from './auth';
import type { Recipe, User } from '@/db/schema';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/** The signed-in user, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as User;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/** Throws if not signed in. Use at the top of every mutation. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}

/**
 * Authorization policy, decided deliberately rather than by omission as in the
 * legacy app (where `recipe.userId` was recorded but never checked, so any
 * signed-in user could modify or delete anything).
 *
 *   edit   — any signed-in family member. It is a shared cookbook; anyone
 *            should be able to fix a typo or improve a recipe.
 *   delete — the original author, or an admin. Deletion is irreversible.
 */
export function canEditRecipe(user: SessionUser | null): boolean {
  return user !== null;
}

export function canDeleteRecipe(
  user: SessionUser | null,
  recipe: Pick<Recipe, 'authorId'>,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return recipe.authorId === user.id;
}
