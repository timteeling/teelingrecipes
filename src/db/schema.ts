import { sql } from 'drizzle-orm';
import {
  boolean,
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
/* Auth tables (owned by Better Auth, extended with our own columns)           */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),

    // Our additions. Surfaced to Better Auth via `user.additionalFields`.
    firstName: text('first_name'),
    lastName: text('last_name'),
    role: text('role').notNull().default('member'),

    // locallydb `cid`, kept so migrated recipes can be re-linked to authors
    // and so we can prove the migration was faithful. Null for new signups.
    legacyCid: integer('legacy_cid'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_legacy_cid_idx').on(t.legacyCid),
    check('users_role_check', sql`${t.role} IN ('member', 'admin')`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    // Unused: this app has no password auth. Present because Better Auth's
    // schema expects the column.
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

/* -------------------------------------------------------------------------- */
/* Access control                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The allowlist. Sign-in succeeds only for an address listed here — this is
 * what replaces the legacy app's open `/register` route, where anyone on the
 * internet could create a full account.
 */
export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey(),
  note: text('note'),
  addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }),
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

    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),

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

export type User = typeof users.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type AllowedEmail = typeof allowedEmails.$inferSelect;
