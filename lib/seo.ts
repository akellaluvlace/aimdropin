// Search and share text for the item pages, and their structured data.
// Pure functions, so the wording is tested once instead of per page.

import { SITE_URL } from "./site";

interface ComponentText {
  title: string;
  // The item's own description from its registry, when it has one.
  desc: string | null;
  // "Component", "Section", "App screen"… (kindLabel).
  kind: string;
  // "HTML", "React TSX"… (stackLabel), when known.
  stack: string | null;
  author: string | null;
  lic: string;
}

/**
 * Title and description of a component's page. Thousands of components share
 * a few names ("Accordion", "Button Size") or have none that mean anything
 * ("Bad Chipmunk 3"), so both say which library the item is from, what it is
 * and who made it.
 */
export function componentPageMeta(item: ComponentText, sourceLabel: string, preview = false): { title: string; description: string } {
  const kind = item.kind.toLowerCase();
  const by = item.author && item.author.toLowerCase() !== sourceLabel.toLowerCase() ? ` by ${item.author}` : "";
  const what = `free ${item.stack ? `${item.stack} ` : ""}${kind} from ${sourceLabel}${by} (${item.lic}), with live preview, code and install command.`;
  // A library often gives a whole family the same line ("A simple features
  // block."), so the item's name goes first unless the line already has it.
  const own = item.desc?.replace(/[.\s]+$/, "") ?? "";
  const lead = own && !own.toLowerCase().includes(item.title.toLowerCase()) ? `${item.title}: ` : "";
  return {
    title: `${preview ? "Preview: " : ""}${item.title} · ${sourceLabel} ${kind}`,
    description: own ? `${lead}${own}. A ${what}` : `${item.title}: a ${what}`,
  };
}

const sharedTitleCache = new WeakMap<object, Set<string>>();

/**
 * Ids of the items whose name is also the name of another item from the same
 * library (three "Native Morphing Button" variants, say). Their pages add the
 * item's own short name to the title so each one is different. Counted once
 * per catalog.
 */
export function sharedTitleIds(items: readonly { id: string; src: string; title: string }[]): Set<string> {
  const cached = sharedTitleCache.get(items);
  if (cached) return cached;
  const groups = new Map<string, string[]>();
  for (const i of items) {
    const key = `${i.src}\n${i.title.toLowerCase()}`;
    const ids = groups.get(key);
    if (ids) ids.push(i.id);
    else groups.set(key, [i.id]);
  }
  const shared = new Set<string>();
  for (const ids of groups.values()) if (ids.length > 1) for (const id of ids) shared.add(id);
  sharedTitleCache.set(items, shared);
  return shared;
}

// What each template category is called in a sentence.
const TEMPLATE_NOUN: Record<string, string> = {
  Landing: "landing page",
  Ecommerce: "ecommerce page",
  Portfolio: "portfolio page",
  Blog: "blog page",
  Dashboard: "dashboard page",
  Marketing: "marketing page",
  Utility: "utility page",
};

/**
 * Title and description of a landing-page template's page. The template's own
 * tagline is made-up product copy ("A weekly essay on slow software"), which
 * says nothing about the page someone is searching for.
 */
export function templatePageMeta(
  t: { title: string; category: string; style?: string | null },
  kinds: readonly string[],
): { title: string; description: string } {
  const style = t.style ? `${t.style.toLowerCase()} ` : "";
  const noun = TEMPLATE_NOUN[t.category] ?? "landing page";
  const order = ["html", "jsx"].filter((k) => kinds.includes(k));
  const formats = (order.length ? order : ["html"]).map((k) => k.toUpperCase()).join(" and ");
  return {
    title: `${t.title} - free landing page template`,
    description: `${t.title}: a free ${style}${noun} template in ${formats}. Preview it live, edit it in your browser, then copy or download the code. MIT licensed.`,
  };
}

/** A schema.org breadcrumb trail, for search results to show instead of the raw address. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${SITE_URL}${step.path}`,
    })),
  };
}

/**
 * JSON for a <script type="application/ld+json"> body. Item names come from
 * other people's catalogs, so nothing in them may end the script early.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
