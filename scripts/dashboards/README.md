# Dashboard import pipeline

Imports complete free dashboards from GitHub so the site can show them as live demos
(every page clickable), with their full source and a ZIP download.

## Files

| Path | What it is |
| --- | --- |
| `sources.json`, `sources/*.json` | Every dashboard we know about (one JSON array per file). Excluded ones stay, with `exclude`. |
| `patches/<slug>.mjs` | Optional pre-build patch (runs in the build container, cwd = repo). Use `./_lib.mjs` helpers. |
| `.cache/dashboards/<slug>/src` | The repo at the pinned sha (untrusted). `work/` is the build copy, `build.log` the build output. |
| `demos/<slug>/**.html` | Stored HTML pages (rewritten at serve time by `app/demos/[slug]/[[...path]]/route.ts`). |
| `public/demos/<slug>/**` | Every other stored file, served as static files. Files identical to jsDelivr's copy aren't stored. |
| `data/dashboards/records/<slug>.json` | Record + serve info written by `process.mjs`. |
| `data/dashboards/check/<slug>.json` | Crawl result written by `check.mjs`. |
| `data/dashboards/index.json`, `serve.json` | Built by `build-index.mjs`: what the gallery lists / what the demo route serves. |

## Commands

```bash
node scripts/dashboards/run.mjs --only <slug>[,<slug>]   # download (+ Docker build) + process; --force to redo
node scripts/dashboards/check.mjs --only <slug>          # crawl every page in a browser (needs the app on :3000) + thumbnail
node scripts/dashboards/build-index.mjs                  # rebuild index.json / serve.json
```

A dashboard is listed in the gallery when its crawl reached the entry page and ≥ 90% of the
pages found loaded with no broken files, no uncaught script errors and a non-empty body.
Links to pages the template never shipped count as dead links, not failures.

## Source entry

```jsonc
{
  "slug": "shadcn-admin",                       // lowercase, dashes; URL is /d/<slug>
  "title": "Shadcn Admin",
  "description": "Admin dashboard with tasks, chats, users, settings and auth screens.", // factual, ≤ 160 chars
  "repo": "satnaing/shadcn-admin",
  "sha": "e16c87f213a5ba5e45964e9b67c792105ec74d26", // full 40-char commit, never a branch
  "license": { "spdx": "MIT", "path": "LICENSE", "verifiedAt": "2026-11-10" },
  "author": "Sat Naing",
  "framework": "react",                         // html react next vue nuxt angular svelte sveltekit solid astro qwik
  "ui": "shadcn",                               // bootstrap tailwind shadcn mui chakra antd mantine tremor element-plus vuetify naive primevue primeng ant-design-vue nebular bulma daisyui flowbite material other
  "category": "Admin",                          // Admin, Analytics, CRM, E-commerce, Finance, Project management, SaaS, Starter
  "tags": ["vite", "tanstack-router", "dark-mode"],
  "demoUrl": "https://shadcn-admin.netlify.app",
  "quality": 5,                                 // 1-5, how good it looks and how complete it is
  "site": {
    // committed HTML:  { "kind": "static", "root": "dist", "entry": "index.html", "ignore": ["docs"] }
    "kind": "build",
    "image": "node:22-bookworm",                // node:16/18/20/22-bookworm
    "install": "pnpm install --frozen-lockfile --config.strict-dep-builds=false",
    "build": "pnpm exec vite build --base=$DEMO_BASE",
    "out": "dist",
    "entry": "index.html",
    "spa": true,                                // client-side routes fall back to the entry
    "patch": "shadcn-admin.mjs"
  }
}
```

Builds run with `DEMO_BASE=/demos/<slug>/` and `DEMO_BASE_NOSLASH=/demos/<slug>` in the
environment. SPAs need their bundler base **and** their router base set to it (that's usually
what the patch does). Next.js needs `output: "export"`, `basePath`, `images.unoptimized` and
usually `trailingSlash: true`; server-only features (middleware, route handlers, server actions,
`cookies()`) must go. Dependency install scripts stay blocked (pnpm `strict-dep-builds=false`
only stops that being an error) - never allow them.

## License rule

MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense, CC0-1.0 only, read from the LICENSE file at
the pinned sha. Exclude GPL/AGPL/LGPL, any Creative Commons, "MIT + Commons Clause", custom terms,
no LICENSE file, and any README or vendor terms that add conditions (e.g. a required footer
credit link, no redistribution in template collections).

## Hosting the demos in production

`demos/` and `public/demos/` (≈1.3 GB) are gitignored: they're built locally and never part of
the repo or the deployment. Production reads them from a public Supabase Storage bucket:

1. Put the project's credentials in `.env.local` (local only):
   `PROD_SUPABASE_URL=https://<ref>.supabase.co` and `PROD_SUPABASE_SERVICE_ROLE_KEY=…`
2. `node --env-file=.env.local scripts/dashboards/upload-demos.mjs` - creates the public bucket
   `demos` if needed, uploads every listed dashboard's files (resumable; re-runs only send new or
   changed files) and writes `data/dashboards/demo-files/<slug>.json` (commit these).
3. On the host set `DEMO_STORAGE_URL=https://<ref>.supabase.co/storage/v1/object/public/demos`
   for Production and Preview, then redeploy: Vercel only gives a deployment the variables that
   existed when it was created. If every demo answers "Not found", the function log says which
   environment and branch is missing the variable.

The demo route (`app/demos/[slug]/[[...path]]/route.ts` via `lib/dashboards/demo-store.ts`) then
fetches each file from the bucket and serves it under the same `/demos/<slug>/…` URL with the
sandbox headers; the CDN caches responses for a year (content is pinned to a commit), so the
bucket is only read on a cache miss. Object keys are path-encoded (`storage-key.mjs`) because
Storage rejects characters like `[`, `]` and non-ASCII that built apps use.

After importing or rebuilding a dashboard, run the upload again (`--only <slug>`) before deploying.
`--target local` uploads to the local Supabase instead, for testing production mode.
