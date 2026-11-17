# Supabase

Database schema for accounts, the catalog, saved and published pages,
stars, ratings, usage events and ranking. Every table has row-level
security; see the comments in `migrations/`.

The site runs without Supabase (signed out, no counts, "Best first"
ordering). Adding the two public keys switches on sign-in, stars, ratings,
view/copy counts, "Popular" ordering, saving pages and sharing them to the
library.

## Local development (Docker)

```
npx supabase@2.122.0 start -x realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta
npx supabase@2.122.0 status -o env   # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY into .env.local
```

Magic-link emails land in Mailpit at http://127.0.0.1:54324. `npx supabase@2.122.0 db reset`
re-applies every migration from scratch.

## Migrations

- `20261029000000_init.sql` - profiles, catalog, pages, events, stars, ratings, stats, reports.
- `20261110000000_gallery_ratings_community.sql` - landing templates (`template`) and dashboards
  (`dashboard`) become rateable targets; any signed-in user may rate anything once (changeable)
  except their own page; `ranked_targets.bayes` (Bayesian average, C = 5); `community_pages`
  view with `promoted` = featured by hand, or 10+ ratings averaging 4.0+.

## Publishing

`POST /api/pages/<id>/publish` (needs `SUPABASE_SERVICE_ROLE_KEY` on the server) runs
`scripts/community/page-checks.mjs`: clean pages go live at once, flagged ones wait as
`pending_review` (see them with `npm run review`), blocked ones are `rejected` with reasons.

## Set up

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema, either:
   - paste `migrations/20261029000000_init.sql` into the SQL editor and run it, or
   - `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Authentication → URL Configuration:
   - **Site URL**: `https://www.aimdropin.com` (or your domain)
   - **Redirect URLs**: add `https://www.aimdropin.com/auth/callback`
     and `http://localhost:3000/auth/callback` for local development.
4. Authentication → Providers:
   - **Email**: on (magic links work out of the box).
   - **GitHub**: create an OAuth app at github.com/settings/developers with
     callback `https://<ref>.supabase.co/auth/v1/callback`, paste its client
     id and secret.
   - **Google**: create an OAuth client in Google Cloud (Web application) with
     the same callback URL, paste its client id and secret.
5. Put the keys in `.env.local` (never commit them) and in your host's
   environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
# Server / CLI only (npm run review). Never expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

6. Restart the dev server. "Sign in" appears in the header.

## Who can do what

| Data | Read | Write |
| --- | --- | --- |
| `catalog_items` | everyone | service role (indexer) only |
| `pages` | published public/unlisted pages, plus your own | your own; publishing goes through `submit_page()` and review |
| `stars`, `ratings` | everyone | yourself; ratings for anything except your own page |
| `events` | nobody | only via `track_event()`, one per visitor, item and day |
| `target_stats`, `ranked_targets` | everyone | triggers only |
| `reports` | nobody | signed-in users |

## Reviewing shared pages

When someone shares a page it goes to `pending_review`; owners can't publish
or feature their own pages. Review with the service-role key in `.env.local`:

```
npm run review                        # waiting pages + automatic checks
npm run review -- show <id>           # write it to .cache/review/ to open
npm run review -- approve <id>        # publish (add --feature to feature it)
npm run review -- reject <id>
```

The automatic checks (`scripts/community/page-checks.mjs`) flag external
scripts, forms that post elsewhere, obfuscated code, miners, frame-busting,
credential reads and paid-template markers. Editing a published page sends
it back to review.

## Not stored here

AI keys. Users connect OpenRouter or paste their own key; it stays in their
browser and calls go straight to the provider.
