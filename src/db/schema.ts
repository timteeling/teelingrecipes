import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * The seven categories the legacy Angular app offered. Every one of the 52
 * migrated recipes uses only these values, so they are enforced in the DB
 * rather than left to application code.
 */
export const CATEGORIES = [
  'breakfast',
  'drinks',
  'appetizers',
  'dinner',
  'sauces',
  'sides',
  'desserts',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ROLES = ['member', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const categoryList = sql.raw(CATEGORIES.map((c) => `'${c}'`).join(', '));

/* -------------------------------------------------------------------------- */
/* Profiles                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Application-owned user data.
 *
 * Identity itself lives in Neon's managed `neon_auth.*` schema — Neon owns
 * `neon_auth.users_sync`, `neon_auth.account` and `neon_auth.session`. We do
 * not define or migrate those.
 *
 * This table holds what Neon does not know about: the authorization role and
 * the legacy locallydb identity. Rows are created by the migration keyed on
 * email, before any Neon user exists; `neonUserId` is attached on first
 * sign-in.
 *
 * Note that `neon_auth.users_sync` is populated asynchronously (usually under
 * a second), so it is deliberately not used as a foreign key target.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: text('id').primaryKey(),

    // Stable across the migration and across Google sign-in, so this is the
    // join key rather than any provider-assigned id.
    email: text('email').notNull().unique(),

    // Neon's user id. Null until the person signs in for the first time.
    neonUserId: text('neon_user_id'),

    firstName: text('first_name'),
    lastName: text('last_name'),
    role: text('role').notNull().default('member'),

    legacyCid: integer('legacy_cid'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('profiles_neon_user_id_idx').on(t.neonUserId),
    uniqueIndex('profiles_legacy_cid_idx').on(t.legacyCid),
    check('profiles_role_check', sql`${t.role} IN ('member', 'admin')`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Access control                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The allowlist.
 *
 * Neon's managed auth allows anyone to sign up by default, so this is enforced
 * in two places: the `user.before_create` webhook blocks account creation, and
 * every authenticated request re-checks it, so a stranger who somehow obtains
 * a Neon session still sees nothing.
 */
export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey(),
  note: text('note'),
  addedBy: text('added_by').references(() => profiles.id, { onDelete: 'set null' }),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Recipes                                                                    */
/* -------------------------------------------------------------------------- */

export const recipes = pgTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),

    // locallydb `cid`. Drives redirects from the old /recipes/:id URLs.
    legacyCid: integer('legacy_cid'),

    title: text('title').notNull(),
    // Markdown. So are `ingredients` and `steps` — the legacy data uses
    // **bold** as section headers inside ingredient lists.
    description: text('description'),

    // Free text in the legacy data ("Prep 10 min Bake 30 min", "yields 72
    // bites"). Deliberately not parsed into structured values.
    time: text('time'),
    servings: text('servings'),

    // Legacy stores source as [[name],[url]]; either half can be empty.
    sourceName: text('source_name'),
    sourceUrl: text('source_url'),

    ingredients: text('ingredients').array().notNull().default(sql`'{}'::text[]`),
    steps: text('steps').array().notNull().default(sql`'{}'::text[]`),
    categories: text('categories').array().notNull().default(sql`'{}'::text[]`),

    // Vercel Blob pathname. Null for the 38 of 52 recipes with no photo.
    imageKey: text('image_key'),

    authorId: text('author_id').references(() => profiles.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('recipes_legacy_cid_idx').on(t.legacyCid),
    index('recipes_author_id_idx').on(t.authorId),
    index('recipes_updated_at_idx').on(t.updatedAt),
    check('recipes_title_not_blank', sql`length(btrim(${t.title})) > 0`),
    check('recipes_categories_valid', sql`${t.categories} <@ ARRAY[${categoryList}]::text[]`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type AllowedEmail = typeof allowedEmails.$inferSelect;
