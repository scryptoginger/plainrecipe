# PlainRecipe

PlainRecipe turns a cluttered recipe page into the useful part: one short context paragraph, ingredients, and steps. It saves cleaned recipes in Neon Postgres, supports title search and admin-only deletion, and installs as a mobile PWA.

The extractor reads the `schema.org/Recipe` JSON-LD that recipe publishers provide to search engines. It does not run a headless browser, load source pages in the background, or reproduce their ads. Every recipe keeps a prominent **Open original** link back to its author.

## Architecture and security

- Next.js App Router and TypeScript, deployed on Vercel
- Neon Postgres accessed only by server-side API routes using parameterized SQL
- Gemini 2.5 Flash for long-description condensation; short descriptions skip the API call
- Cheerio for JSON-LD extraction
- Serwist for installation, caching, and an offline shell

The browser never receives the Neon connection string or a Gemini key and never connects to Neon directly. All reads and writes pass through server-only API routes. Do not prefix any application credentials with `NEXT_PUBLIC_`.

## Environment variables

Copy `.env.example` to `.env.local` for local development. `.env.local` is gitignored.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string; server-only secret |
| `GEMINI_API_KEY` | Optional Google AI Studio key for Gemini condensation; recipes still save without it |
| `ADMIN_SECRET` | Shared delete credential; server-only secret |
| `RATE_LIMIT_PER_DAY` | Optional per-IP daily cap for new extractions; defaults to `15` |

All credentials stay server-side. The pooled Neon connection string is supported and recommended for serverless deployments.

## Neon setup

1. Create a project at [neon.tech](https://neon.tech).
2. Open the Neon SQL Editor.
3. Run [`supabase/schema.sql`](supabase/schema.sql) once. The filename is historical; it is plain Postgres SQL and runs on Neon unchanged.
4. Copy the connection string from the Neon dashboard and set it as `DATABASE_URL`. The pooled connection string is fine.

The SQL creates the recipes table, canonical-URL uniqueness constraint, per-IP/day counter, atomic `increment_rate_limit` function, indexes, and defense-in-depth RLS settings.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` before exercising API routes. Run a production-mode check with:

```bash
npm run build
npm start
```

Serwist is disabled during development and is built by the production command. Next 16 defaults to Turbopack, but this project deliberately uses `--webpack` in its scripts because the requested `@serwist/next` integration is webpack-based.

## Deploy to Vercel

1. Import `scryptoginger/plainrecipe` into Vercel.
2. In **Project Settings → Environment Variables**, add `DATABASE_URL` and `ADMIN_SECRET` for Production. Add a free-tier Google AI Studio `GEMINI_API_KEY` if AI condensation is wanted; recipes still save without it. Optionally override `RATE_LIMIT_PER_DAY`.
3. Alternatively, install Neon through the Vercel Marketplace integration; it provisions and injects `DATABASE_URL` automatically.
4. Run the schema in Neon before using the app.
5. Redeploy after setting or changing environment variables. Vercel only applies environment changes to a fresh build.
6. Open `/api/recipes` after deployment. A `[]` response instead of a 500 confirms Neon is connected and the tables exist.

**Vercel environment variables must be set before the first successful deployment or the API routes will return errors.** Do not expose the database, Gemini, or admin values as client variables.

## Using the app

Paste an HTTP or HTTPS recipe URL and choose **Clean it.** After any short-link resolution, the canonical source URL is checked against saved recipes first. A match returns without fetching the recipe page, calling Gemini, or consuming the daily rate limit. New recipes count toward the submitting IP’s daily limit.

### Supported links

Recipe-page URLs work directly, and common short links such as bit.ly, TinyURL, t.co, and pin.it are followed to their destination. Pinterest resolution is best-effort: PlainRecipe tries the redirected pin page and two alternate browser-like HTTP fetches, scanning each response for the original source. If Pinterest blocks all attempts or a native pin has no outbound link, the app explains that it could not trace the source; open the pin, tap through to the recipe site, and paste that page URL instead.

Search matches saved recipe titles case-insensitively. Full-text ingredient search is deferred.

### Admin delete

Normal visitors do not see delete controls. Choose **Admin mode** at the bottom of the page and enter `ADMIN_SECRET`; the browser stores it in local storage and sends it only as the `x-admin-secret` header on delete requests. Trash controls remain visible until **Exit admin** is selected. A rejected secret is removed automatically.

This shared secret is intentionally an MVP gate, not user authentication.

### Install on a phone

Open the production HTTPS site in the phone browser. On iPhone/iPad, use **Share → Add to Home Screen**. On supported Android browsers, choose **Install app** or **Add to Home screen** from the browser menu. The app then launches standalone.

The icons in `public/` are placeholder “PR” artwork (192px, 512px, and a maskable 512px version) and can be replaced later using the same filenames.

## Extraction behavior

The extractor supports bare JSON-LD objects, arrays, and `@graph`; string and structured instructions; common image/author/yield shapes; and ISO-8601 recipe durations. Failed source fetches and missing recipes are logged. The browser fallback is deliberately a clean, logged `501` stub so real failure data can guide whether a hosted browser service is worthwhile.

## Deferred to the next session

- Hosted browser fallback such as Browserless, ScrapingBee, or similar, based on logged failures
- Postgres `tsvector` full-text search across titles and ingredients
- Content-hash deduplication across different URLs
- Tags, collections, and a screen-on step-by-step cook mode
- Managed authentication if the shared admin secret becomes too limited
