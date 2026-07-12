# PlainRecipe

PlainRecipe turns a cluttered recipe page into the useful part: one short context paragraph, ingredients, and steps. It saves cleaned recipes in Supabase, supports title search and admin-only deletion, and installs as a mobile PWA.

The extractor reads the `schema.org/Recipe` JSON-LD that recipe publishers provide to search engines. It does not run a headless browser, load source pages in the background, or reproduce their ads. Every recipe keeps a prominent **Open original** link back to its author.

## Architecture and security

- Next.js App Router and TypeScript, deployed on Vercel
- Supabase Postgres accessed only by server-side API routes
- Anthropic Haiku for long-description condensation; short descriptions skip the API call
- Cheerio for JSON-LD extraction
- Serwist for installation, caching, and an offline shell

The browser never receives Supabase credentials or an Anthropic key and never connects to Supabase directly. Supabase RLS is enabled with no permissive anonymous policies; the server-only service-role client bypasses RLS. Do not prefix any of the application credentials with `NEXT_PUBLIC_`.

## Environment variables

Copy `.env.example` to `.env.local` for local development. `.env.local` is gitignored.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL, used only by server routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role credential; server-only secret |
| `ANTHROPIC_API_KEY` | Anthropic credential used by the condenser; server-only secret |
| `ADMIN_SECRET` | Shared delete credential; server-only secret |
| `RATE_LIMIT_PER_DAY` | Optional per-IP daily cap for new extractions; defaults to `15` |

All credentials stay server-side. Although the Supabase project URL is not itself a secret, it is intentionally kept behind this app’s API boundary along with the three secret values.

## Supabase setup

1. Create a Supabase project.
2. Open its SQL editor.
3. Run [`supabase/schema.sql`](supabase/schema.sql) once.
4. Copy the project URL and service-role key from the Supabase project settings into the matching environment variables.

The SQL creates the recipes table, canonical-URL uniqueness constraint, per-IP/day counter, atomic `increment_rate_limit` RPC, indexes, and RLS lockdown.

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
2. In **Project Settings → Environment Variables**, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `ADMIN_SECRET`. Optionally override `RATE_LIMIT_PER_DAY`.
3. Apply the Supabase schema before using the app.
4. Redeploy if the first deployment started before the variables were added.

**Vercel environment variables must be set before the first successful deployment or the API routes will return errors.** Do not expose the service-role, Anthropic, or admin values as client variables.

## Using the app

Paste an HTTP or HTTPS recipe URL and choose **Clean it.** A canonicalized URL is checked against saved recipes first. A match returns immediately without fetching the source, calling Anthropic, or consuming the daily rate limit. New recipes count toward the submitting IP’s daily limit.

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
- Supabase Auth if the shared admin secret becomes too limited
