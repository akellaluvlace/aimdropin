// Item URL → PreviewPlan: fetch the item (or its `-demo` sibling when the
// item is a bare primitive), resolve its dependency tree, flatten it into
// virtual modules and pick the export to render. Runs server-side in
// /api/registry/bundle; pure apart from the injected fetcher.

import type { FetchItemResult } from "./fetch-item";
import {
  aliasByBasename,
  buildModules,
  collectNpm,
  fillCandidates,
  layoutFor,
  mergeCssVars,
  pickEntry,
  serializeCss,
  unresolvedImports,
} from "./modules";
import {
  demoUrlFor,
  namespaceOfUrl,
  REGISTRY_URL_TEMPLATES,
  resolveDependencyUrl,
} from "./registries";
import {
  RegistryResolveError,
  resolveRegistryTree,
  type ResolvedTree,
  type ResolveOpts,
} from "./resolve";
import type { PreviewPlan, RegistryItem } from "./types";

// Types that are building blocks rather than something to look at.
const PRIMITIVE_TYPES = new Set(["registry:ui", "registry:component", "registry:item", undefined]);

// Versions used when an item doesn't pin one. Registries were written
// against lucide-react 0.x; 1.x dropped the brand icons (Github, Dribbble…)
// that landing pages lean on.
export const DEFAULT_NPM_VERSIONS: Readonly<Record<string, string>> = {
  "lucide-react": "0.577.0",
  // v9 dropped the v8 API (getCoreRowModel…) that registry tables use.
  "@tanstack/react-table": "8.21.3",
};

// TanStack Table v9 (stable since 2026) has a new API: <FlexRender>,
// useTable with tableFeatures/*Feature plug-ins. Registries that moved to it
// need v9; everything else still targets v8.
export const TANSTACK_TABLE_V9 = "9.3.1";
const TANSTACK_V9_API = /\b(FlexRender|tableFeatures|useTable|createTableHook|[a-z][A-Za-z]*Feature)\b/;
const TANSTACK_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']@tanstack\/react-table["']/g;

/** DEFAULT_NPM_VERSIONS, adjusted for what the item's code actually imports. */
export function defaultVersionsFor(modules: { code: string }[]): Record<string, string> {
  const out = { ...DEFAULT_NPM_VERSIONS };
  for (const m of modules) {
    for (const match of m.code.matchAll(TANSTACK_IMPORT)) {
      if (TANSTACK_V9_API.test(match[1])) {
        out["@tanstack/react-table"] = TANSTACK_TABLE_V9;
        return out;
      }
    }
  }
  return out;
}

// Packages whose components need a prebuilt stylesheet (StyleX-compiled
// design systems ship their CSS separately). Loaded from jsDelivr.
export const PACKAGE_STYLESHEETS: Readonly<Record<string, string[]>> = {
  "@astryxdesign/core": ["dist/astryx.css"],
};

const NON_REACT_FILE = /\.(astro|vue|svelte)$/i;

export async function planForUrl(
  rootUrl: string,
  fetchItem: (url: string) => Promise<FetchItemResult>,
  opts: ResolveOpts = {},
): Promise<PreviewPlan> {
  const root = await fetchItem(rootUrl);
  if (!root.ok) throw new RegistryResolveError(root.status, root.error);
  const foreign = (root.item.files ?? []).find((f) => NON_REACT_FILE.test(f.path));
  if (foreign && !(root.item.files ?? []).some((f) => /\.[jt]sx$/i.test(f.path))) {
    const kind = foreign.path.match(NON_REACT_FILE)![1].toLowerCase();
    const name = kind === "astro" ? "Astro" : kind === "vue" ? "Vue" : "Svelte";
    throw new RegistryResolveError(422, `${name} components can't be previewed in the browser`);
  }

  const demoUrl = PRIMITIVE_TYPES.has(root.item.type)
    ? demoUrlFor(rootUrl, root.item.name)
    : null;
  if (demoUrl) {
    const demo = await fetchItem(demoUrl);
    if (demo.ok && (demo.item.files ?? []).length) {
      const plan = await planForTree(rootUrl, demoUrl, fetchItem, opts);
      if (plan) return plan;
    }
  }
  const plan = await planForTree(rootUrl, rootUrl, fetchItem, opts);
  if (!plan) throw new RegistryResolveError(422, "nothing renderable in this item");
  return plan;
}

async function planForTree(
  rootUrl: string,
  renderedUrl: string,
  fetchItem: (url: string) => Promise<FetchItemResult>,
  opts: ResolveOpts,
): Promise<PreviewPlan | null> {
  const tree = await resolveRegistryTree(renderedUrl, fetchItem, opts);
  await fillUndeclared(tree, namespaceOfUrl(rootUrl), fetchItem, opts);
  const graph = buildModules(tree.items);
  for (const key of aliasByBasename(graph.modules, unresolvedImports(graph.modules))) {
    tree.missing.push({ dep: key, reason: "imported but not in the registry" });
  }
  const items = tree.items.map((t) => t.item);
  const rendered: RegistryItem = items[0];
  const entry = pickEntry(rendered, graph.modules, graph.owner);
  if (!entry) return null;
  const npm = collectNpm(items);
  for (const [pkg, ver] of Object.entries(defaultVersionsFor(graph.modules))) npm[pkg] ||= ver;
  return {
    rootUrl,
    renderedUrl,
    name: rendered.name,
    type: rendered.type ?? null,
    entry,
    layout: layoutFor(rendered.type),
    modules: graph.modules,
    npm,
    cssVars: mergeCssVars(items),
    css: items
      .map((i) => serializeCss(i.css))
      .filter(Boolean)
      .reverse()
      .join("\n"),
    stylesheets: stylesheetsFor(npm),
    missing: tree.missing,
  };
}

/**
 * Fetch items for imports nothing in the tree provides: official shadcn
 * primitives for "…/ui/x", otherwise an item named after the file in the
 * root's own registry. A few rounds, since a filled-in item can import more.
 * Keys a same-named module already covers are left to aliasByBasename.
 */
async function fillUndeclared(
  tree: ResolvedTree,
  rootNs: string | null,
  fetchItem: (url: string) => Promise<FetchItemResult>,
  opts: ResolveOpts,
) {
  const tried = new Set(tree.items.map((t) => t.url));
  const nsTemplate = rootNs ? REGISTRY_URL_TEMPLATES[rootNs] : null;
  for (let round = 0; round < 3; round++) {
    const graph = buildModules(tree.items);
    const keys = aliasByBasename(graph.modules, unresolvedImports(graph.modules));
    // Per key, candidates in order (official primitive, then the root's
    // registry); the first that resolves wins.
    const queues: string[][] = [];
    for (const key of keys) {
      const { official, basename } = fillCandidates(key);
      const q = [
        official ? resolveDependencyUrl(official) : null,
        nsTemplate && /^[\w.-]+$/.test(basename) ? nsTemplate.replace("{name}", basename) : null,
      ].filter((u): u is string => !!u && !tried.has(u));
      q.forEach((u) => tried.add(u));
      if (q.length) queues.push(q);
    }
    if (!queues.length) return;
    const subs = await Promise.all(
      queues.map(async (q) => {
        for (const u of q) {
          const sub = await resolveRegistryTree(u, fetchItem, opts).catch(() => null);
          if (sub) return sub;
        }
        return null;
      }),
    );
    for (const sub of subs) {
      for (const s of sub?.items ?? []) {
        if (tree.items.some((t) => t.url === s.url)) continue;
        tree.items.push({ ...s, depth: s.depth + 1 });
      }
    }
  }
}

function stylesheetsFor(npm: Record<string, string | null>): string[] {
  const out: string[] = [];
  for (const [pkg, files] of Object.entries(PACKAGE_STYLESHEETS)) {
    if (!(pkg in npm)) continue;
    const ver = npm[pkg];
    for (const f of files) out.push(`https://cdn.jsdelivr.net/npm/${pkg}${ver ? `@${ver}` : ""}/${f}`);
  }
  return out;
}
