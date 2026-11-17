// Live dashboard demos (/demos/<slug>/…) run other people's code. Every
// response under /demos - static assets from public/demos and the HTML the
// route handler serves - gets a CSP sandbox (opaque origin, so demo scripts
// can't read this site's storage or session) and CORS (module scripts and
// fonts requested from an opaque origin need it).
const DEMO_HEADERS = [
  {
    key: "Content-Security-Policy",
    value:
      "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads",
  },
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Headers", value: "*" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

// Everything outside /demos: no MIME sniffing, a sensible referrer, and no
// framing by other sites. The demos keep their own set above and stay
// frameable, because some dashboards open their own pages in iframes.
const SITE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

// Pages rendered on request whose output depends only on the URL: no cookies,
// nothing per visitor. Next sends them as "private, no-store", so every view
// ran a server function. This header lets Vercel's CDN keep a copy: fresh for
// ten minutes, then served stale while it refreshes in the background, and
// kept as a fallback if the function fails. A new deploy starts with an empty
// cache. A page that ever renders something per visitor on the server must
// come off this list first.
const CDN_CACHED_PAGES = [
  "/gallery",
  "/gallery/:section(dashboards|components|gsap|search)",
  "/c/:path*",
  "/d/:path*",
  "/t/:path*",
  "/preview/:path*",
];
const CDN_PAGE_CACHE = [
  { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=86400, stale-if-error=86400" },
];
// Which requests may leave a copy at the CDN: only a plain request for the
// HTML document, from something that names itself.
// - No "rsc" header. That header asks for the page's data instead of its
//   HTML (Next's router, when you click a link). Those answers are never
//   stored, so a visitor asking for the page can never be handed the data,
//   whatever the CDN does with the Vary header.
// - A User-Agent. Without one, Next sends the share tags inside <body> even
//   with htmlLimitedBots set, and that copy must not be the one a
//   link-preview bot gets.
const CDN_CACHEABLE_REQUEST = {
  has: [{ type: "header", key: "user-agent" }],
  missing: [{ type: "header", key: "rsc" }],
};

// Thumbnails, logos and icons in public/ keep their file names between
// deploys, so browsers may reuse them for a day instead of asking again for
// every image on every page.
const STATIC_IMAGE_CACHE = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Title, description and share tags go in <head> for every visitor that
  // sends a User-Agent. By default Next may send them later, inside <body>,
  // to browsers and keeps them in <head> only for link-preview bots. The CDN
  // copy above is shared by both, so a copy made for a browser must still
  // work for LinkedIn or Slack.
  htmlLimitedBots: /.*/,
  // The site never uses next/image or the /_next/image optimizer. unoptimized
  // keeps next/image off it, but Vercel's optimizer still answers direct
  // /_next/image calls (seen on Next 16 previews), so its allow-list names one
  // path that doesn't exist: every direct call gets a 400 and nothing is resized.
  images: {
    unoptimized: true,
    localPatterns: [{ pathname: "/image-optimization-is-off" }],
  },
  async headers() {
    return [
      { source: "/demos/:path*", headers: DEMO_HEADERS },
      { source: "/:path((?!demos(?:/|$)).*)", headers: SITE_HEADERS },
      ...CDN_CACHED_PAGES.map((source) => ({ source, ...CDN_CACHEABLE_REQUEST, headers: CDN_PAGE_CACHE })),
      { source: "/:dir(thumbs|component-thumbs|catalog-thumbs|assets)/:path*", headers: STATIC_IMAGE_CACHE },
    ];
  },
  // Data the server reads at runtime. The demo files themselves aren't part
  // of the deployment: in production they come from the storage bucket
  // (DEMO_STORAGE_URL, see lib/dashboards/demo-store.ts).
  outputFileTracingIncludes: {
    "/demos/**": ["./data/dashboards/serve.json", "./data/dashboards/demo-files/**"],
    "/d/**": ["./data/dashboards/*.json", "./data/dashboards/files/**", "./data/dashboards/demo-files/**"],
  },
  // Never bundle the local demo copies into a function.
  outputFileTracingExcludes: {
    "*": ["./demos/**", "./public/demos/**", "./.cache/**", "./scripts/dashboards/patches/**"],
  },
  webpack(config, { dev }) {
    // next/font writes the deployment id into each font URL in the CSS
    // (?dpl=...), and webpack's build cache then reuses that CSS on the next
    // deploy with the previous deployment's id. Pages preload the fonts under
    // the current id, so every font downloaded twice and swapped in late.
    // Builds that have a deployment id (Vercel) skip the cache: a few seconds.
    if (!dev && process.env.NEXT_DEPLOYMENT_ID) config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
