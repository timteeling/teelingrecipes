/**
 * Pure transforms from the legacy locallydb shape to the new schema.
 *
 * Kept free of DB and filesystem access so the logic can be exercised against
 * fixtures without a live Postgres.
 */
import { createHash } from 'node:crypto';

import { CATEGORIES, type Category, type Role } from '../src/db/schema';

/** A locallydb collection file: `{ header: { lcid }, items: [...] }`. */
export interface LegacyCollection<T> {
  header: { $created: string; $updated: string; lcid: number };
  items: T[];
}

export interface LegacyUser {
  cid: number;
  firstname?: string;
  lastname?: string;
  username?: string;
  /** Unsalted SHA-512. Deliberately never read. */
  passwordHash?: string;
  $created?: string;
  $updated?: string;
}

export interface LegacyRecipe {
  cid: number;
  title?: unknown;
  description?: unknown;
  time?: unknown;
  servings?: unknown;
  source?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  categories?: unknown;
  image?: unknown;
  userId?: number;
  /** Denormalised author email. Dropped — it is what leaked publicly. */
  username?: string;
  $created?: string;
  $updated?: string;
}

/**
 * Legacy fields are `[value, widgetType]` tuples — the second element is form
 * presentation metadata that leaked into storage. It is inconsistent (the
 * first step is always "textarea", later ones "text") and never read
 * meaningfully, so it is dropped entirely.
 */
export function scalar(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return scalar(value[0]);
  return '';
}

export function scalarList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(scalar).map((s) => s.trim()).filter((s) => s.length > 0);
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Deterministic ids, so re-running the migration is idempotent rather than
 * creating duplicate rows.
 */
export function stableId(kind: string, cid: number): string {
  return createHash('sha256').update(`${kind}:${cid}`).digest('hex').slice(0, 24);
}

/**
 * Titles carry typographic apostrophes ("Tim's") and hyphens ("Two-Way").
 * Apostrophes are removed rather than replaced, so "Tim's" becomes "tims"
 * and not "tim-s".
 */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’ʼ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Appends -2, -3 … on collision. */
export function uniqueSlug(title: string, taken: Set<string>): string {
  const base = slugify(title) || 'recipe';
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  taken.add(slug);
  return slug;
}

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string') return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export interface TransformedProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  neonUserId: string | null;
  legacyCid: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformedRecipe {
  id: string;
  slug: string;
  legacyCid: number;
  title: string;
  description: string | null;
  time: string | null;
  servings: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  ingredients: string[];
  steps: string[];
  categories: Category[];
  /** Legacy filename; rewritten to a Blob pathname by migrate-images. */
  imageKey: string | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformWarning {
  cid: number;
  field: string;
  message: string;
}

export interface TransformResult {
  profiles: TransformedProfile[];
  recipes: TransformedRecipe[];
  warnings: TransformWarning[];
}

export function transformProfiles(
  items: LegacyUser[],
  warnings: TransformWarning[],
): TransformedProfile[] {
  const seenEmails = new Set<string>();
  const out: TransformedProfile[] = [];

  for (const u of items) {
    const email = (u.username ?? '').trim().toLowerCase();
    if (!email) {
      warnings.push({ cid: u.cid, field: 'username', message: 'user has no email; skipped' });
      continue;
    }
    if (seenEmails.has(email)) {
      warnings.push({ cid: u.cid, field: 'username', message: `duplicate email ${email}; skipped` });
      continue;
    }
    seenEmails.add(email);

    const firstName = nullIfBlank(u.firstname ?? '');
    const lastName = nullIfBlank(u.lastname ?? '');
    const created = parseDate(u.$created, new Date());

    out.push({
      id: stableId('profile', u.cid),
      // Attached on first sign-in; Neon assigns the identity.
      neonUserId: null,
      email,
      firstName,
      lastName,
      // The legacy app hardcoded `user.cid == 0` as its only admin check, and
      // only in the nav template. That becomes a real, server-enforced column.
      role: u.cid === 0 ? 'admin' : 'member',
      legacyCid: u.cid,
      createdAt: created,
      updatedAt: parseDate(u.$updated, created),
    });
  }

  return out;
}

export function transformRecipes(
  items: LegacyRecipe[],
  profilesByCid: Map<number, TransformedProfile>,
  warnings: TransformWarning[],
): TransformedRecipe[] {
  const takenSlugs = new Set<string>();
  const out: TransformedRecipe[] = [];

  for (const r of items) {
    const title = scalar(r.title).trim();
    if (!title) {
      warnings.push({ cid: r.cid, field: 'title', message: 'recipe has no title; skipped' });
      continue;
    }

    const rawCategories = Array.isArray(r.categories) ? r.categories.map(scalar) : [];
    const categories: Category[] = [];
    for (const c of rawCategories) {
      const normalised = c.trim().toLowerCase();
      if ((CATEGORIES as readonly string[]).includes(normalised)) {
        if (!categories.includes(normalised as Category)) categories.push(normalised as Category);
      } else if (normalised) {
        warnings.push({ cid: r.cid, field: 'categories', message: `unknown category "${c}"; dropped` });
      }
    }

    let authorId: string | null = null;
    if (typeof r.userId === 'number') {
      const author = profilesByCid.get(r.userId);
      if (author) {
        authorId = author.id;
      } else {
        warnings.push({
          cid: r.cid,
          field: 'userId',
          message: `author cid ${r.userId} not found in users; author left unset`,
        });
      }
    } else {
      warnings.push({ cid: r.cid, field: 'userId', message: 'no userId; author left unset' });
    }

    const source = Array.isArray(r.source) ? r.source : [];
    const ingredients = scalarList(r.ingredients);
    const steps = scalarList(r.steps);

    if (ingredients.length === 0) {
      warnings.push({ cid: r.cid, field: 'ingredients', message: 'no ingredients' });
    }
    if (steps.length === 0) {
      warnings.push({ cid: r.cid, field: 'steps', message: 'no steps' });
    }

    const created = parseDate(r.$created, new Date());

    out.push({
      id: stableId('recipe', r.cid),
      slug: uniqueSlug(title, takenSlugs),
      legacyCid: r.cid,
      title,
      description: nullIfBlank(scalar(r.description)),
      time: nullIfBlank(scalar(r.time)),
      servings: nullIfBlank(scalar(r.servings)),
      sourceName: nullIfBlank(scalar(source[0])),
      sourceUrl: nullIfBlank(scalar(source[1])),
      ingredients,
      steps,
      categories,
      imageKey: nullIfBlank(scalar(r.image)),
      authorId,
      createdAt: created,
      updatedAt: parseDate(r.$updated, created),
    });
  }

  return out;
}

export function transform(
  legacyUsers: LegacyUser[],
  legacyRecipes: LegacyRecipe[],
): TransformResult {
  const warnings: TransformWarning[] = [];
  const profiles = transformProfiles(legacyUsers, warnings);
  const profilesByCid = new Map(profiles.map((p) => [p.legacyCid, p]));
  const recipes = transformRecipes(legacyRecipes, profilesByCid, warnings);
  return { profiles, recipes, warnings };
}
