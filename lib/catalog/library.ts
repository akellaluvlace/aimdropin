// Library - server-side catalog search for /library and /api/catalog/search.
//
// Reads data/catalog/catalog.json (written by scripts/catalog/publish-catalog.mjs
// from the license-checked index) plus our own templates, builds one MiniSearch
// index per server process, and answers filtered, sorted, paged queries. When
// Supabase is connected, popularity comes from its ranked_targets view; until
// then "Popular" uses a fixed quality heuristic.

import { promises as fs } from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";
import {
  getAllTemplates,
  getThumbSlugs,
  listTemplateKinds,
} from "@/lib/templates";
import { SITE_URL } from "@/lib/site";

export type LibraryTab =
  | "all"
  | "landing"
  | "dashboard"
  | "screen"
  | "section"
  | "component";

// Where an item is listed. Set by publish-catalog for catalog items (from
// curation); derived for our templates and community pages.
export type ItemTab = Exclude<LibraryTab, "all">;
export const ITEM_TABS: ReadonlyArray<ItemTab> = [
  "landing",
  "dashboard",
  "screen",
  "section",
  "component",
];
export type LibrarySort = "popular" | "az";
export type LibraryStackFilter = "all" | "html" | "react";

export interface LibraryInstall {
  method: "shadcn" | "clone" | "copy" | "editor";
  command?: string;
  url?: string;
  repo?: string;
  commit?: string;
}

export interface LibraryItem {
  id: string;
  src: string;
  name: string;
  title: string;
  desc: string | null;
  kind: "page" | "section" | "component";
  tab?: ItemTab;
  purpose: string;
  stack: "react-tsx" | "react-jsx" | "html" | null;
  fw: string | null;
  type: string | null;
  cats: string[];
  deps: string[];
  regDeps: string[];
  heavy: string[];
  // SPDX id. Our own templates are MIT (public/licenses/templates-mit.txt).
  lic: string;
  licUrl: string | null;
  freeOnly: boolean;
  author: string | null;
  home: string | null;
  srcUrl: string | null;
  install: LibraryInstall;
  thumb: string | null;
  demo: string | null;
  ghStars: number | null;
  // "ok" = renders in our previewer; "unknown" = not checked yet (registry
  // React items); "error" = checked and failed; "none" = no previewer
  // (full GitHub apps - link to their demo instead).
  preview: "ok" | "unknown" | "error" | "none";
  // Our templates open straight in the editor.
  editorSlug?: string;
  // Our templates ship as HTML and/or JSX; the stack filter matches either.
  altStacks?: Array<"html" | "react-jsx">;
}

export interface LibrarySource {
  id: string;
  label: string;
  kind: string | null;
  homepage: string | null;
  license: string | null;
  licenseUrl: string | null;
  freeOnly: boolean;
  count: number;
}

export interface LibraryQuery {
  q?: string;
  tab?: LibraryTab;
  source?: string;
  stack?: LibraryStackFilter;
  category?: string;
  sort?: LibrarySort;
  page?: number;
  pageSize?: number;
}

export interface LibraryResult {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  // Counts within the current tab + query, before the source/stack/category
  // filters, so the filter chips show what picking them would give.
  facets: {
    sources: Array<{ id: string; label: string; count: number }>;
    categories: Array<{ name: string; count: number }>;
    stacks: { html: number; react: number };
  };
  tabCounts: Record<LibraryTab, number>;
}

export const AIMDROPIN_SOURCE_ID = "aimdropin";
export const TEMPLATES_LICENSE_URL = "/licenses/templates-mit.txt";
// Whole pages imported from other open-source projects (imported/).
export const OPEN_SOURCE_TEMPLATES_ID = "open-source";

interface CatalogFile {
  generatedAt: string;
  sources: LibrarySource[];
  items: LibraryItem[];
}

interface LoadedCatalog {
  items: LibraryItem[];
  byId: Map<string, LibraryItem>;
  sources: LibrarySource[];
  sourceLabel: Map<string, string>;
  search: MiniSearch<LibraryItem>;
  generatedAt: string | null;
}

const CATALOG_PATH = path.join(
  process.cwd(),
  "data",
  "catalog",
  "catalog.json",
);

let loading: Promise<LoadedCatalog> | null = null;

function templatePurpose(category: string): string {
  switch (category) {
    case "Dashboard":
      return "dashboard";
    case "Ecommerce":
      return "ecommerce";
    case "Blog":
      return "blog";
    case "Utility":
      return "auth";
    default:
      return "landing";
  }
}

async function loadOwnTemplates(): Promise<LibraryItem[]> {
  const [templates, thumbs] = await Promise.all([
    getAllTemplates({ preferKind: "jsx" }),
    getThumbSlugs(),
  ]);
  const kinds = await Promise.all(
    templates.map((t) => listTemplateKinds(t.slug).catch(() => [t.kind])),
  );
  return templates.map((t, idx) => ({
    // Imported open-source pages keep their own license and credit; ours are
    // MIT under the AIMdropin templates license.
    id: `${t.license ? OPEN_SOURCE_TEMPLATES_ID : AIMDROPIN_SOURCE_ID}/${t.slug}`,
    src: t.license ? OPEN_SOURCE_TEMPLATES_ID : AIMDROPIN_SOURCE_ID,
    name: t.slug,
    title: t.title,
    desc: t.description || null,
    kind: "page" as const,
    purpose: templatePurpose(t.category),
    stack: t.kind === "html" ? ("html" as const) : ("react-jsx" as const),
    fw: null,
    type: null,
    cats: [
      t.category.toLowerCase(),
      ...(t.style ? [t.style.toLowerCase()] : []),
      ...t.tags,
    ],
    deps: [],
    regDeps: [],
    heavy: [],
    lic: t.license?.spdx ?? "MIT",
    licUrl: t.license?.url ?? TEMPLATES_LICENSE_URL,
    freeOnly: false,
    author: t.author ?? (t.license ? null : "Akella inMotion"),
    // Absolute, because template URLs end up in the credits comment of pages
    // people take elsewhere.
    home: t.license?.sourceUrl ?? SITE_URL,
    srcUrl: t.license?.sourceUrl ?? `${SITE_URL}/t/${t.slug}`,
    install: { method: "editor" as const },
    thumb: thumbs.has(t.slug) ? `/thumbs/${t.slug}.webp` : null,
    demo: null,
    ghStars: null,
    preview: "ok" as const,
    editorSlug: t.slug,
    altStacks: kinds[idx].map((k) =>
      k === "html" ? ("html" as const) : ("react-jsx" as const),
    ),
  }));
}

async function load(): Promise<LoadedCatalog> {
  let file: CatalogFile = { generatedAt: "", sources: [], items: [] };
  try {
    file = JSON.parse(await fs.readFile(CATALOG_PATH, "utf-8")) as CatalogFile;
  } catch {
    // No published catalog yet: the library still shows our own templates.
  }
  const own = await loadOwnTemplates().catch(() => [] as LibraryItem[]);
  const items = [...own, ...file.items];
  const ownCount = own.filter((i) => i.src === AIMDROPIN_SOURCE_ID).length;
  const importedCount = own.length - ownCount;
  const sources: LibrarySource[] = [
    ...(ownCount
      ? [
          {
            id: AIMDROPIN_SOURCE_ID,
            label: "AIMdropin",
            kind: "templates",
            homepage: null,
            license: "MIT",
            licenseUrl: TEMPLATES_LICENSE_URL,
            freeOnly: false,
            count: ownCount,
          },
        ]
      : []),
    ...(importedCount
      ? [
          {
            id: OPEN_SOURCE_TEMPLATES_ID,
            label: "Open-source templates",
            kind: "templates",
            homepage: null,
            license: null,
            licenseUrl: null,
            freeOnly: false,
            count: importedCount,
          },
        ]
      : []),
    ...file.sources,
  ];
  const sourceLabel = new Map(sources.map((s) => [s.id, s.label]));

  const search = new MiniSearch<LibraryItem>({
    idField: "id",
    fields: ["title", "name", "cats", "desc", "srcLabel", "deps", "purpose"],
    extractField: (doc, field) => {
      if (field === "cats") return doc.cats.join(" ");
      if (field === "deps") return doc.deps.join(" ");
      if (field === "srcLabel") return sourceLabel.get(doc.src) ?? doc.src;
      const v = (doc as unknown as Record<string, unknown>)[field];
      return typeof v === "string" ? v : "";
    },
    searchOptions: {
      boost: { title: 3, cats: 2, name: 1.5, srcLabel: 1.5 },
      prefix: true,
      fuzzy: 0.15,
      combineWith: "AND",
    },
  });
  search.addAll(items);

  return {
    items,
    byId: new Map(items.map((i) => [i.id, i])),
    sources,
    sourceLabel,
    search,
    generatedAt: file.generatedAt || null,
  };
}

export function getCatalog(): Promise<LoadedCatalog> {
  if (!loading) {
    loading = load().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

// Our templates and community pages don't carry a tab: whole pages are
// landing pages or dashboards; anything else goes by kind.
export function tabOf(item: LibraryItem): ItemTab {
  if (item.tab) return item.tab;
  if (item.kind === "page") {
    return item.purpose === "dashboard"
      ? "dashboard"
      : item.purpose === "landing" || item.src === AIMDROPIN_SOURCE_ID
        ? "landing"
        : "screen";
  }
  return item.kind;
}

export function inTab(item: LibraryItem, tab: LibraryTab): boolean {
  return tab === "all" || tabOf(item) === tab;
}

function matchesStack(item: LibraryItem, stack: LibraryStackFilter): boolean {
  if (stack === "all") return true;
  const stacks = item.altStacks?.length ? item.altStacks : [item.stack];
  if (stack === "html") return stacks.includes("html");
  return stacks.some((s) => s === "react-tsx" || s === "react-jsx");
}

// Fixed quality order used until real usage data exists: our templates and
// full pages first, things that preview well, popular repos, then the rest.
export function heuristicScore(item: LibraryItem): number {
  let s = 0;
  if (item.src === AIMDROPIN_SOURCE_ID) s += 50;
  if (item.src === OPEN_SOURCE_TEMPLATES_ID) s += 45;
  if (item.src === "community") s += item.cats.includes("featured") ? 45 : 25;
  if (item.kind === "page") s += 20;
  else if (item.kind === "section") s += 10;
  if (item.preview === "ok") s += 8;
  if (item.preview === "error") s -= 15;
  if (item.thumb) s += 5;
  if (item.ghStars) s += Math.min(15, Math.log10(item.ghStars + 1) * 4);
  if (item.src === "@shadcn") s += 6;
  if (item.heavy.length) s -= 2;
  return s;
}

// Many items tie on score, and a big source would then fill whole pages
// (twenty "Hero N" from one registry). Each item loses a little for every
// better-ranked item from the same source, which interleaves sources while
// keeping clearly better items on top. Sorts in place.
export const SOURCE_REPEAT_PENALTY = 3;

// Stable pseudo-random tiebreak (FNV-1a of the id), so equal scores come out
// mixed instead of alphabetical, and the same on every request.
function tiebreak(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function diversify(
  scored: Array<{ item: LibraryItem; score: number }>,
): void {
  // Search relevance puts scores on a larger scale; keep the penalty
  // proportionate to the top score.
  const unit = Math.max(
    SOURCE_REPEAT_PENALTY,
    Math.abs(scored[0]?.score ?? 0) * 0.04,
  );
  const seen = new Map<string, number>();
  const adjusted = new Map<string, number>();
  for (const s of scored) {
    const n = seen.get(s.item.src) ?? 0;
    seen.set(s.item.src, n + 1);
    adjusted.set(s.item.id, s.score - n * unit);
  }
  scored.sort(
    (a, b) =>
      (adjusted.get(b.item.id) ?? 0) - (adjusted.get(a.item.id) ?? 0) ||
      tiebreak(a.item.id) - tiebreak(b.item.id),
  );
}

export interface PopularityLookup {
  // Bigger is more popular. Missing ids count as 0.
  scores: Map<string, number>;
}

export async function queryLibrary(
  query: LibraryQuery,
  popularity?: PopularityLookup,
  // Items that live outside the file catalog (published community pages).
  // Searched with a plain word match rather than the MiniSearch index.
  extra: LibraryItem[] = [],
): Promise<LibraryResult> {
  const cat = await getCatalog();
  const tab = query.tab ?? "all";
  const stack = query.stack ?? "all";
  const pageSize = Math.min(Math.max(query.pageSize ?? 48, 1), 96);
  const page = Math.max(query.page ?? 1, 1);
  const q = query.q?.trim() ?? "";

  let base: LibraryItem[];
  let relevance: Map<string, number> | null = null;
  if (q) {
    const hits = cat.search.search(q);
    relevance = new Map(hits.map((h) => [String(h.id), h.score]));
    base = hits
      .map((h) => cat.byId.get(String(h.id)))
      .filter((x): x is LibraryItem => !!x);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (const e of extra) {
      const hay =
        `${e.title} ${e.desc ?? ""} ${e.cats.join(" ")} ${e.author ?? ""}`.toLowerCase();
      if (words.every((w) => hay.includes(w))) {
        base.push(e);
        relevance.set(e.id, 5 * words.length);
      }
    }
  } else {
    base = extra.length ? [...extra, ...cat.items] : cat.items;
  }

  const tabCounts: Record<LibraryTab, number> = {
    all: base.length,
    landing: 0,
    dashboard: 0,
    screen: 0,
    section: 0,
    component: 0,
  };
  for (const i of base) tabCounts[tabOf(i)]++;

  const inCurrentTab = base.filter((i) => inTab(i, tab));

  const sourceCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  let html = 0;
  let react = 0;
  for (const i of inCurrentTab) {
    sourceCounts.set(i.src, (sourceCounts.get(i.src) ?? 0) + 1);
    for (const c of i.cats) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
    if (matchesStack(i, "html")) html++;
    if (matchesStack(i, "react")) react++;
  }

  const filtered = inCurrentTab.filter(
    (i) =>
      (!query.source || i.src === query.source) &&
      matchesStack(i, stack) &&
      (!query.category || i.cats.includes(query.category)),
  );

  const sort = query.sort ?? "popular";
  const pop = popularity?.scores;
  const scored = filtered.map((item) => {
    let score = heuristicScore(item);
    if (pop) score += (pop.get(item.id) ?? 0) * 10;
    if (relevance) score = (relevance.get(item.id) ?? 0) * 10 + score * 0.2;
    return { item, score };
  });
  if (sort === "az") {
    scored.sort((a, b) => a.item.title.localeCompare(b.item.title));
  } else {
    scored.sort(
      (a, b) => b.score - a.score || tiebreak(a.item.id) - tiebreak(b.item.id),
    );
    if (!query.source) diversify(scored);
  }

  const start = (page - 1) * pageSize;
  return {
    items: scored.slice(start, start + pageSize).map((s) => s.item),
    total: scored.length,
    page,
    pageSize,
    facets: {
      sources: [...sourceCounts.entries()]
        .map(([id, count]) => ({
          id,
          label:
            cat.sourceLabel.get(id) ?? (id === "community" ? "Community" : id),
          count,
        }))
        .sort((a, b) => b.count - a.count),
      categories: [...catCounts.entries()]
        .filter(([, n]) => n >= 3)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 40),
      stacks: { html, react },
    },
    tabCounts,
  };
}

export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
  const cat = await getCatalog();
  return cat.byId.get(id) ?? null;
}

export async function getLibrarySources(): Promise<LibrarySource[]> {
  return (await getCatalog()).sources;
}

export async function getSimilarItems(
  item: LibraryItem,
  limit = 8,
): Promise<LibraryItem[]> {
  const cat = await getCatalog();
  const sameSource = cat.items.filter(
    (i) => i.id !== item.id && i.src === item.src && i.kind === item.kind,
  );
  const overlap = (i: LibraryItem) =>
    i.cats.filter((c) => item.cats.includes(c)).length;
  return sameSource
    .map((i) => ({ i, s: overlap(i) * 3 + heuristicScore(i) * 0.1 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.i);
}

// Parse URLSearchParams-ish input into a LibraryQuery, ignoring junk.
export function parseLibraryQuery(
  sp: Record<string, string | string[] | undefined>,
): LibraryQuery {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const tab = one("tab");
  const sort = one("sort");
  const stack = one("stack");
  const page = Number(one("page"));
  return {
    q: one("q")?.slice(0, 200),
    tab: (["all", ...ITEM_TABS] as const).find((t) => t === tab) ?? "all",
    source: one("source")?.slice(0, 80) || undefined,
    stack:
      (["all", "html", "react"] as const).find((s) => s === stack) ?? "all",
    category: one("category")?.slice(0, 60) || undefined,
    sort: sort === "az" ? "az" : "popular",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}
