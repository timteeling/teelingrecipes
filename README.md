# Teeling Recipes

Family recipe app. Being rewritten from a 2016 AngularJS + Express app on a
DigitalOcean droplet to Next.js on Vercel with Neon Postgres.

The old app is preserved under [`legacy/`](./legacy) as the reference for the
port. It is not built or deployed.

---

## Picking this back up

**Status: partial. Data layer and auth are done; the UI port is in progress.**

### Do this first (security, not optional)

1. **Back up the droplet** before anything else. `.data/` and the image
   directories are gitignored, so that box is the only copy that exists:
   ```bash
   scp -r root@teelingrecipes.com:/path/to/app/.data ./legacy-data
   scp -r root@teelingrecipes.com:/path/to/app/public/img ./legacy-images
   ```
   Verify both open before proceeding. `legacy-data/` is gitignored — it
   contains family email addresses and password hashes.

2. **Power the droplet off.** The live app serves the entire cookbook, plus
   every family member's email address, to anyone unauthenticated. Nothing has
   been written to it since January 2017, so nobody is inconvenienced. See
   [Security findings](#security-findings-in-the-legacy-app) for why this is
   worth doing before the rewrite ships rather than after.

### Then

3. Collect the two outstanding facts (see [Blocked on](#blocked-on)).
4. Work through [Setup checklist](#setup-checklist).
5. Run the migration (see [Migrating the data](#migrating-the-data)).
6. Finish the UI port (see [What is left](#what-is-left)).

---

## Stack

| Concern | Choice |
| --- | --- |
| Host | Vercel |
| Database | Neon Postgres (AWS `us-east-1`) |
| ORM | Drizzle |
| Auth | Neon Managed Better Auth, Google OAuth only |
| Images | Vercel Blob, served through `next/image` |
| Framework | Next.js App Router, TypeScript |

Two vendors total. No transactional email vendor: every family member in the
legacy data uses a Gmail address, so Google sign-in covers the whole roster
with no email infrastructure, no SPF/DKIM records, and no magic-link handling.

**Why not passwords:** the legacy app hashed with unsalted SHA-512. Those
hashes are not imported and could not safely be reused. Google sign-in means
there is no password to migrate, reset, or leak.

**Note on maturity:** `@neondatabase/auth` is `0.5.0-beta` and
`@neondatabase/neon-auth-next` is `0.1.0-alpha.24` as installed. This was a
deliberate choice to keep the vendor count at two.

---

## What is done

- **Schema** (`src/db/schema.ts`) — `profiles`, `allowed_emails`, `recipes`.
- **Migration** (`scripts/`) — locallydb flat files to Postgres, with fixtures
  covering the real edge cases. Verified by dry run.
- **Auth** (`src/lib/auth.ts`, `src/app/api/auth/`) — Neon managed auth wiring
  plus the allowlist webhook.
- **Authorization** (`src/lib/authz.ts`) — policy is: **any member may edit,
  only the author or an admin may delete**.
- **Styles** (`src/app/globals.scss`) — the legacy visual design ported to
  CSS custom properties and modern layout.

## What is left

1. Port the 8 templates in `legacy/public/views/` to React components:
   `list`, `single`, `new`, `edit`, `account`, `admin`, `nav`, `form-field`.
2. Server Actions for create / edit / delete, with zod validation.
3. Image upload route to Vercel Blob, plus `scripts/migrate-images.ts` to move
   the 14 existing images and rewrite `recipes.image_key`.
4. Redirects from the old `/recipes/:id` URLs using `recipes.legacy_cid`.
5. Confirm the webhook signature scheme (see below).
6. Cutover: DNS, final data sync, decommission the droplet.

### Known TODO on the security path

`src/app/api/auth/webhook/route.ts` verifies the signature using an assumed
HMAC-SHA256-over-raw-body scheme with an `x-neon-signature` header. **This was
not verified against Neon's documentation** and is marked `TODO(confirm)` in
the file. Confirm it before going live.

The handler fails closed, so an unverified call denies the signup rather than
approving it. It is also not the only gate — see below.

---

## How access control works

Neon's managed auth lets anyone sign up by default; restricted signups are not
yet supported. So membership is enforced in two independent places:

1. **`user.before_create` webhook** — checks `allowed_emails` and denies
   unknown addresses at account creation. This is a *blocking* event: if the
   app is down or returns a 500, all new sign-ups fail. That is the correct
   failure direction here, but it means this route must stay healthy.
2. **`requireMember()`** — re-checks the allowlist on every authenticated
   request. A valid Neon session is not proof of membership; any Gmail account
   can complete Google OAuth. This is what makes the app invite-only even if
   a user record is created by some path not anticipated here.

`allowed_emails` is seeded by the migration from the legacy user list. **Until
that table has rows, the webhook denies everyone, including you.**

---

## Blocked on

Two facts from the droplet, both needed before the migration can run:

1. **`.data/users`** — the roster. How many rows and which addresses. This is
   what seeds `allowed_emails`. (Password hashes are not needed and should not
   be copied around.)
2. **`public/img/recipes/` file count** — 14 images are referenced by recipes;
   unknown whether the directory holds orphans from the six deleted recipes.

---

## Setup checklist

### Neon Console
- [ ] Auth → enable. Copy the base URL → `NEON_AUTH_BASE_URL`
- [ ] Auth → Google OAuth with **your own** credentials, not the shared
      development ones
- [ ] Auth → Configuration → Domains → add `https://teelingrecipes.com`
- [ ] Auth → Webhooks → `user.before_create` →
      `https://teelingrecipes.com/api/auth/webhook`
- [ ] Confirm the project is on **AWS** — managed auth does not support Azure,
      IP Allow, or Private Networking

### Google Cloud Console
- [ ] OAuth client (Web application). Redirect URI:
      `{NEON_AUTH_BASE_URL}/callback/google` — confirm the exact path in
      Neon's OAuth setup guide
- [ ] Consent screen. Testing mode with the family as test users is fine, and
      is arguably a useful second gate

### Vercel
```bash
vercel link
vercel env pull .env.local        # check which DATABASE_* names Neon injected
openssl rand -base64 32 | vercel env add NEON_AUTH_COOKIE_SECRET production
openssl rand -base64 32 | vercel env add NEON_AUTH_WEBHOOK_SECRET production
vercel env add NEON_AUTH_BASE_URL production
vercel blob store add teeling-recipes
```

See `.env.example` for the full list.

**Pooled vs direct connection strings matter.** The app uses the pooled string
(host contains `-pooler`); `drizzle-kit` migrations need the direct one. Both
must be set.

---

## Migrating the data

```bash
npm install

# Inspect the transform without touching the database.
npx tsx scripts/migrate-legacy.ts --source ./legacy-data --dry-run

# Same, dumping the transformed output for inspection.
npx tsx scripts/migrate-legacy.ts --source ./legacy-data --dry-run --out /tmp/out.json

# Create the tables, then write.
npm run db:generate && npm run db:migrate
npx tsx scripts/migrate-legacy.ts --source ./legacy-data
```

The dry run prints a full report: per-author counts, category counts, the
complete legacy-cid → slug mapping, and warnings for anything dropped. Row ids
are derived from the legacy `cid`, so re-running corrects a previous run
rather than duplicating.

Run it against the fixtures to see the shape without real data:

```bash
npx tsx scripts/migrate-legacy.ts --source ./scripts/fixtures/legacy-data --dry-run
```

### What the migration does to the data

- **Flattens the `[value, widgetType]` tuples.** The second element was form
  presentation metadata that leaked into storage, was inconsistent (the first
  step is always `"textarea"`, later ones `"text"`), and was never
  meaningfully read.
- **Splits `source`** from `[[name],[url]]` into nullable `source_name` and
  `source_url`. Many recipes have a name with no URL.
- **Keeps `time` and `servings` as free text** — "Prep 10 min Bake 30 min",
  "yields 72 bites". Parsing these into structured values would lose meaning.
- **Preserves markdown** in description, ingredients and steps. Ingredient
  lists use `**bold**` as section headers.
- **Drops the denormalised author email** from every recipe. That field is
  what was leaking publicly.
- **Does not import password hashes.**
- **Generates slugs** from titles, handling typographic apostrophes so
  "Tim's Guacamole" becomes `tims-guacamole`. `legacy_cid` is preserved for
  redirects from the old numeric URLs.

---

## Security findings in the legacy app

Recorded so the reasons behind the rewrite are not lost. All of these are in
`legacy/` and none carry over.

1. **All recipes public.** `recipes.js` has `//.all(login.required)` commented
   out on both GET routes, so `GET /api/recipes` returns the entire cookbook
   unauthenticated.
2. **Family emails leaked publicly.** Every recipe carries a denormalised
   `username` field containing the author's email, served by that same
   unauthenticated route.
3. **Account takeover by any logged-in user.** `login.js` `PUT /api/users/:id`
   uses `req.body.cid` rather than the URL param, with no check that it is
   you. Any member could set any other member's password.
4. **Open registration.** `/register` accepted anyone, granting full read and
   write on every recipe.
5. **Unauthenticated file upload.** `POST /api/upload` had no auth, no MIME
   check, no size cap, and took the extension from the supplied filename,
   writing into a statically served directory.
6. **Unsalted SHA-512 password hashing.**
7. **Session secret hardcoded in source** and committed to git.
8. **No authorization anywhere.** `recipe.userId` was written but never read.
   "Admin" was `user.cid == 0`, checked only in the nav template.
9. **No CSRF protection**, no rate limiting on login or register.
10. **Passport 0.3** does not regenerate the session on login (fixture).
11. **Credentials in transit.** The app served directly from Node on port 5000
    with broken or absent TLS, posting passwords in cleartext.
12. **Data durability.** Flat JSON files on one droplet, no backups, rewritten
    synchronously in full on every write.

---

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run db:generate  # generate migration from schema
npm run db:migrate   # apply migrations (needs the DIRECT connection string)
npm run db:studio    # drizzle studio
```
