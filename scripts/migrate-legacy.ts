/**
 * Migrates the legacy locallydb flat files into Postgres.
 *
 *   npx tsx scripts/migrate-legacy.ts --source ./legacy-data --dry-run
 *   npx tsx scripts/migrate-legacy.ts --source ./legacy-data
 *
 * locallydb writes each collection as a single JSON file named after the
 * collection with no extension: `<source>/users` and `<source>/recipes`.
 *
 * Idempotent: row ids are derived from the legacy cid, and writes upsert on
 * conflict, so re-running corrects a previous run rather than duplicating.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import 'dotenv/config';

import { allowedEmails, recipes, users } from '../src/db/schema';
import {
  transform,
  type LegacyCollection,
  type LegacyRecipe,
  type LegacyUser,
  type TransformResult,
} from './legacy-transform';

interface Options {
  source: string;
  dryRun: boolean;
  out: string | null;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { source: './legacy-data', dryRun: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--source') opts.source = argv[++i] ?? opts.source;
    else if (arg === '--out') opts.out = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: tsx scripts/migrate-legacy.ts [--source DIR] [--dry-run] [--out FILE]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function readCollection<T>(dir: string, name: string): LegacyCollection<T> {
  const path = join(dir, name);
  if (!existsSync(path)) {
    throw new Error(
      `Missing locallydb collection at ${path}\n` +
        `Copy the droplet's .data directory here, e.g.\n` +
        `  scp -r root@teelingrecipes.com:/path/to/app/.data ${dir}`,
    );
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as LegacyCollection<T>;
  if (!Array.isArray(parsed.items)) {
    throw new Error(`${path} is not a locallydb collection (no items array)`);
  }
  return parsed;
}

function report(result: TransformResult): void {
  const { users: u, recipes: r, warnings } = result;

  console.log('\n─── Users ───────────────────────────────────────────');
  console.log(`  ${u.length} user(s)`);
  for (const user of u) {
    const label = user.role === 'admin' ? ' [admin]' : '';
    console.log(`    cid ${String(user.legacyCid).padStart(2)}  ${user.email}${label}`);
  }

  console.log('\n─── Recipes ─────────────────────────────────────────');
  console.log(`  ${r.length} recipe(s)`);

  const byAuthor = new Map<string, number>();
  for (const recipe of r) {
    const author = u.find((x) => x.id === recipe.authorId)?.email ?? '(unassigned)';
    byAuthor.set(author, (byAuthor.get(author) ?? 0) + 1);
  }
  for (const [author, count] of [...byAuthor].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(3)}  ${author}`);
  }

  const withImages = r.filter((x) => x.imageKey);
  console.log(`\n  ${withImages.length} of ${r.length} have an image`);

  const categoryCounts = new Map<string, number>();
  for (const recipe of r) {
    for (const c of recipe.categories) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  console.log('\n  Categories:');
  for (const [cat, count] of [...categoryCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(3)}  ${cat}`);
  }

  const noCategory = r.filter((x) => x.categories.length === 0);
  if (noCategory.length > 0) {
    console.log(`\n  ${noCategory.length} recipe(s) with no category:`);
    for (const x of noCategory) console.log(`    cid ${x.legacyCid}  ${x.title}`);
  }

  console.log('\n  Slugs (legacy cid → new URL):');
  for (const recipe of r) {
    console.log(`    /recipes/${String(recipe.legacyCid).padStart(2)}  →  /recipes/${recipe.slug}`);
  }

  if (warnings.length > 0) {
    console.log('\n─── Warnings ────────────────────────────────────────');
    for (const w of warnings) {
      console.log(`  cid ${String(w.cid).padStart(2)}  ${w.field}: ${w.message}`);
    }
  } else {
    console.log('\n  No warnings.');
  }
}

async function write(result: TransformResult): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL_UNPOOLED is not set. Use the DIRECT (non-pooler) Neon connection string.',
    );
  }

  const db = drizzle(neon(url));

  console.log('\nWriting to Postgres…');

  for (const user of result.users) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: user.name,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          updatedAt: user.updatedAt,
        },
      });

    // Every migrated user is allowlisted, so they can sign in with a magic
    // link without any password being carried over.
    await db
      .insert(allowedEmails)
      .values({ email: user.email, note: `migrated from legacy cid ${user.legacyCid}` })
      .onConflictDoNothing();
  }
  console.log(`  ${result.users.length} user(s) upserted and allowlisted`);

  for (const recipe of result.recipes) {
    await db
      .insert(recipes)
      .values(recipe)
      .onConflictDoUpdate({ target: recipes.id, set: { ...recipe } });
  }
  console.log(`  ${result.recipes.length} recipe(s) upserted`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const source = resolve(opts.source);

  console.log(`Reading legacy collections from ${source}`);

  const legacyUsers = readCollection<LegacyUser>(source, 'users');
  const legacyRecipes = readCollection<LegacyRecipe>(source, 'recipes');

  console.log(
    `  users:   ${legacyUsers.items.length} item(s), lcid ${legacyUsers.header.lcid}`,
  );
  console.log(
    `  recipes: ${legacyRecipes.items.length} item(s), lcid ${legacyRecipes.header.lcid}`,
  );

  const result = transform(legacyUsers.items, legacyRecipes.items);
  report(result);

  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(result, null, 2));
    console.log(`\nTransformed output written to ${opts.out}`);
  }

  if (opts.dryRun) {
    console.log('\n--dry-run: nothing written to the database.');
    return;
  }

  await write(result);
  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error('\nMigration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
