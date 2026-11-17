// Pure classification helpers for catalog items: what kind of thing it is
// (page / section / component), what it is for (landing, dashboard…), which
// heavy runtime deps it pulls in, and which stack its files are written in.
// No I/O - everything here is unit-tested in tests/catalog-classify-prod.test.ts.

// Registry types that are visual UI. Themes, hooks, libs, fonts, styles and
// raw files are not indexed as catalog items.
const VISUAL_TYPES = new Set([
  "registry:page",
  "registry:block",
  "registry:component",
  "registry:ui",
  "registry:example",
  "registry:item",
]);

// A `registry:block` whose name says it is a whole screen is a page - e.g.
// shadcn's own `dashboard-01`, `login-03`, or `template-saas-landing`.
const PAGE_NAME_RE =
  /^(dashboard|landing|landing-page|template|admin|login|signup|sign-up|sign-in|signin|auth|homepage)(-|$)|(^|-)(template|page|landing-page)(-\d+)?$/;

/** "motion@^11.0.0" → "motion", "@radix-ui/react-slot@1" → "@radix-ui/react-slot" */
export function normalizeDep(dep) {
  if (typeof dep !== "string") return "";
  const at = dep.lastIndexOf("@");
  return at > 0 ? dep.slice(0, at) : dep;
}

// Many registries ship component demos as `registry:page` (intentui's
// "radial-bar-chart-example", uitripled's "scroll-reveal"). Only a
// registry:page whose name says it is a screen counts as a page.
const DEMO_RE = /-(example|demo|preview)(-\d+)?$/;
const SCREEN_WORD_RE =
  /(^|-)(dashboard|landing|login|signup|sign-in|sign-up|signin|auth|template|page|home|homepage|admin|settings|pricing|checkout|blog|docs|portfolio|profile|onboarding|404|error|account|billing)(-|$)/;

/**
 * @param {{ registryType?: string | null, name?: string | null }} item
 * @returns {"page" | "section" | "component" | null} null = not a visual item
 */
export function classifyKind({ registryType, name }) {
  const type = registryType ?? null;
  if (!type || !VISUAL_TYPES.has(type)) return null;
  const n = (name ?? "").toLowerCase();
  if (type === "registry:page") return !DEMO_RE.test(n) && SCREEN_WORD_RE.test(n) ? "page" : "component";
  if (type === "registry:block") return PAGE_NAME_RE.test(n) ? "page" : "section";
  return "component";
}

// Ordered: the first purpose whose vocabulary matches wins. Dashboard and auth
// come before landing so "pricing-settings" lands in dashboard and
// "login-hero" in auth.
const PURPOSE_RULES = [
  ["dashboard", ["dashboard", "admin", "analytics", "kanban", "crm", "datatable", "data-table", "sidebar", "settings", "billing", "inbox", "metrics", "overview", "app-shell", "appshell"]],
  ["auth", ["login", "signin", "sign-in", "signup", "sign-up", "register", "auth", "otp", "forgot-password", "reset-password"]],
  ["ecommerce", ["ecommerce", "e-commerce", "shop", "store", "product", "products", "cart", "checkout"]],
  ["blog", ["blog", "article", "articles", "post", "posts"]],
  ["docs", ["docs", "documentation"]],
  ["landing", ["landing", "hero", "pricing", "feature", "features", "testimonial", "testimonials", "cta", "faq", "footer", "header", "navbar", "marketing", "waitlist", "newsletter", "logos", "logo-cloud", "stats", "team", "contact", "about", "portfolio", "saas", "bento"]],
];

function tokens(text) {
  const t = String(text ?? "").toLowerCase();
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const out = new Set(words);
  // Keep hyphenated pairs too so "sign-in" / "data-table" match.
  for (let i = 0; i + 1 < words.length; i++) out.add(`${words[i]}-${words[i + 1]}`);
  return out;
}

/**
 * @param {{ name?: string | null, title?: string | null, description?: string | null, categories?: string[] }} item
 * @returns {"landing" | "dashboard" | "auth" | "ecommerce" | "blog" | "docs" | "general"}
 */
export function classifyPurpose({ name, title, description, categories }) {
  // Name, title and categories are strong signals; the description is only
  // consulted when they say nothing (descriptions mention "dashboard" in
  // passing far too often).
  const strong = tokens([name, title, ...(categories ?? [])].join(" "));
  for (const [purpose, words] of PURPOSE_RULES) {
    if (words.some((w) => strong.has(w))) return purpose;
  }
  // Descriptions mention "docs" and "blog" in passing ("see the docs"), so the
  // weak pass only looks for screen-level purposes.
  const weak = tokens(description);
  for (const [purpose, words] of PURPOSE_RULES) {
    if (purpose === "docs" || purpose === "blog") continue;
    if (words.some((w) => weak.has(w))) return purpose;
  }
  return "general";
}

const HEAVY_DEPS = new Set([
  "motion",
  "framer-motion",
  "gsap",
  "@gsap/react",
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  "@react-three/postprocessing",
  "postprocessing",
  "ogl",
  "cobe",
  "matter-js",
  "lottie-react",
  "@lottiefiles/dotlottie-react",
  "@tsparticles/react",
  "recharts",
]);

/** @param {string[]} deps */
export function detectHeavyDeps(deps) {
  const out = new Set();
  for (const d of deps ?? []) {
    const n = normalizeDep(d);
    if (HEAVY_DEPS.has(n)) out.add(n);
  }
  return [...out].sort();
}

/**
 * @param {{ path?: string, target?: string }[] | undefined} files
 * @returns {"react-tsx" | "react-jsx" | "html" | null}
 */
export function detectStack(files) {
  const paths = (files ?? []).map((f) => f.path ?? f.target ?? "");
  if (paths.some((p) => /\.tsx?$/.test(p))) return "react-tsx";
  if (paths.some((p) => /\.jsx?$/.test(p))) return "react-jsx";
  if (paths.some((p) => /\.html?$/.test(p))) return "html";
  return null;
}

/** "hero-section-01" → "Hero Section 01" */
export function titleFromName(name) {
  return String(name ?? "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
