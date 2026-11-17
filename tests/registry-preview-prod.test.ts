// Direct-import tests for the registry preview runtime's pure parts:
// allowlist + dependency URLs (registries.ts), the proxy fetcher
// (fetch-item.ts), tree resolution (resolve.ts), module aliasing and entry
// picking (modules.ts), plan building (plan.ts) and the srcDoc (srcdoc.ts).

import { describe, it, expect } from "vitest";
import {
  ALLOWED_REGISTRY_HOSTS,
  demoUrlFor,
  isAllowedRegistryUrl,
  namespaceOfUrl,
  resolveDependencyUrl,
} from "../lib/registry-preview/registries";
import { createItemFetcher, createLru, type FetchItemResult } from "../lib/registry-preview/fetch-item";
import { resolveRegistryTree, RegistryResolveError } from "../lib/registry-preview/resolve";
import {
  aliasByBasename,
  buildModules,
  collectNpm,
  fileAliases,
  fillCandidates,
  importSpecifiers,
  layoutFor,
  mergeCssVars,
  moduleKey,
  normalizePath,
  parseExports,
  pickEntry,
  serializeCss,
  splitDep,
  unresolvedImports,
} from "../lib/registry-preview/modules";
import { planForUrl } from "../lib/registry-preview/plan";
import type { VirtualModule } from "../lib/registry-preview/types";
import { buildRegistryPreviewDocument, scriptJson } from "../lib/registry-preview/srcdoc";
import type { RegistryItem } from "../lib/registry-preview/types";

const OFFICIAL = (n: string) => `https://ui.shadcn.com/r/styles/new-york-v4/${n}.json`;

function fakeFetcher(items: Record<string, RegistryItem>) {
  const calls: string[] = [];
  const fn = async (url: string): Promise<FetchItemResult> => {
    calls.push(url);
    const item = items[url];
    return item ? { ok: true, item, finalUrl: url } : { ok: false, status: 404, error: "upstream 404" };
  };
  return Object.assign(fn, { calls });
}

describe("registries", () => {
  it("allows only https on listed hosts", () => {
    expect(isAllowedRegistryUrl(OFFICIAL("button"))).toBe(true);
    expect(isAllowedRegistryUrl("https://magicui.design/r/marquee")).toBe(true);
    expect(isAllowedRegistryUrl("https://www.magicui.design/r/marquee")).toBe(true);
    expect(isAllowedRegistryUrl("http://ui.shadcn.com/r/x.json")).toBe(false);
    expect(isAllowedRegistryUrl("https://evil.example/r/x.json")).toBe(false);
    expect(isAllowedRegistryUrl("https://ui.shadcn.com:8443/r/x.json")).toBe(false);
    expect(isAllowedRegistryUrl("https://user:pw@ui.shadcn.com/r/x.json")).toBe(false);
    expect(isAllowedRegistryUrl("https://ui.shadcn.com.evil.example/r/x.json")).toBe(false);
    expect(isAllowedRegistryUrl("not a url")).toBe(false);
    expect(ALLOWED_REGISTRY_HOSTS.has("ui.shadcn.com")).toBe(true);
  });

  it("resolves dependencies like the shadcn CLI", () => {
    expect(resolveDependencyUrl("button")).toBe(OFFICIAL("button"));
    expect(resolveDependencyUrl("@magicui/marquee")).toBe("https://magicui.design/r/marquee");
    expect(resolveDependencyUrl("@intentui/primitive")).toBe("https://intentui.com/r/primitive");
    expect(resolveDependencyUrl("https://intentui.com/r/primitive")).toBe("https://intentui.com/r/primitive");
    expect(resolveDependencyUrl("@aceternity/thing")).toBeNull();
    expect(resolveDependencyUrl("https://ui.aceternity.com/registry/x.json")).toBeNull();
    expect(resolveDependencyUrl("")).toBeNull();
  });

  it("finds namespaces and demo siblings", () => {
    expect(namespaceOfUrl("https://www.magicui.design/r/x")).toBe("@magicui");
    expect(namespaceOfUrl("https://example.com/x")).toBeNull();
    expect(demoUrlFor(OFFICIAL("button"), "button")).toBe(OFFICIAL("button-demo"));
    expect(demoUrlFor("https://magicui.design/r/marquee", "marquee")).toBe("https://magicui.design/r/marquee-demo");
    expect(demoUrlFor(OFFICIAL("button-demo"), "button-demo")).toBeNull();
  });
});

describe("fetch-item", () => {
  const res = (status: number, body: string, headers: Record<string, string> = {}) =>
    new Response(status >= 300 && status < 400 ? null : body, { status, headers });

  it("follows allowed redirects and rejects disallowed hops", async () => {
    const seen: string[] = [];
    const fetchImpl = (async (u: string) => {
      seen.push(u);
      if (u === "https://magicui.design/r/marquee") return res(308, "", { location: "https://www.magicui.design/r/marquee" });
      if (u === "https://www.magicui.design/r/marquee") return res(200, JSON.stringify({ name: "marquee", files: [] }));
      if (u === "https://kokonutui.com/r/x.json") return res(302, "", { location: "https://evil.example/x.json" });
      return res(404, "");
    }) as unknown as typeof fetch;
    const f = createItemFetcher({ fetchImpl });
    const ok = await f("https://magicui.design/r/marquee");
    expect(ok.ok && ok.finalUrl).toBe("https://www.magicui.design/r/marquee");
    const bad = await f("https://kokonutui.com/r/x.json");
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.status).toBe(403);
    expect(seen).not.toContain("https://evil.example/x.json");
  });

  it("caps size, rejects non-items and caches results", async () => {
    let calls = 0;
    const fetchImpl = (async (u: string) => {
      calls++;
      if (u.endsWith("big.json")) return res(200, "x".repeat(50));
      if (u.endsWith("html.json")) return res(200, "Redirecting...");
      return res(200, JSON.stringify({ name: "ok" }));
    }) as unknown as typeof fetch;
    const f = createItemFetcher({ fetchImpl, maxBytes: 20 });
    expect(await f(OFFICIAL("big"))).toMatchObject({ ok: false, status: 413 });
    expect(await f(OFFICIAL("html"))).toMatchObject({ ok: false, error: "not JSON" });
    await f(OFFICIAL("ok"));
    await f(OFFICIAL("ok"));
    expect(calls).toBe(3);
  });

  it("LRU evicts the oldest entry", () => {
    const l = createLru<number>(2);
    l.set("a", 1);
    l.set("b", 2);
    l.get("a");
    l.set("c", 3);
    expect(l.get("b")).toBeUndefined();
    expect(l.get("a")).toBe(1);
    expect(l.size).toBe(2);
  });
});

describe("resolve", () => {
  it("walks dependencies breadth-first, deduped, reporting what's missing", async () => {
    const f = fakeFetcher({
      [OFFICIAL("login-03")]: { name: "login-03", registryDependencies: ["button", "card", "@aceternity/x", "gone"] },
      [OFFICIAL("button")]: { name: "button", registryDependencies: ["utils"] },
      [OFFICIAL("card")]: { name: "card", registryDependencies: ["button"] },
      [OFFICIAL("utils")]: { name: "utils" },
    });
    const tree = await resolveRegistryTree(OFFICIAL("login-03"), f);
    expect(tree.items.map((i) => i.item.name)).toEqual(["login-03", "button", "card", "utils"]);
    expect(tree.items.map((i) => i.depth)).toEqual([0, 1, 1, 2]);
    expect(tree.missing.map((m) => m.dep).sort()).toEqual(["@aceternity/x", "gone"]);
    expect(f.calls.filter((c) => c === OFFICIAL("button"))).toHaveLength(1);
  });

  it("throws when the root itself can't be fetched and honours caps", async () => {
    await expect(resolveRegistryTree(OFFICIAL("nope"), fakeFetcher({}))).rejects.toBeInstanceOf(RegistryResolveError);
    const chain: Record<string, RegistryItem> = {};
    for (let i = 0; i < 10; i++) chain[OFFICIAL(`n${i}`)] = { name: `n${i}`, registryDependencies: [`n${i + 1}`] };
    const tree = await resolveRegistryTree(OFFICIAL("n0"), fakeFetcher(chain), { maxDepth: 3 });
    expect(tree.items).toHaveLength(4);
    expect(tree.missing[0]).toMatchObject({ dep: "n4", reason: "too deep" });
  });
});

describe("modules", () => {
  it("normalizes paths and keys", () => {
    expect(normalizePath("./src/components/x.tsx")).toBe("components/x.tsx");
    expect(normalizePath("/components/kokonutui/a.tsx")).toBe("components/kokonutui/a.tsx");
    expect(normalizePath("~/lib/utils.ts")).toBe("lib/utils.ts");
    expect(moduleKey("a/b.tsx")).toBe("a/b");
    expect(moduleKey("a/b.json")).toBe("a/b");
    expect(moduleKey("a/b.css")).toBe("a/b.css");
  });

  it("aliases registry paths to their installed locations", () => {
    const ui = fileAliases({ path: "registry/new-york-v4/ui/button.tsx", type: "registry:ui" });
    expect(ui[0]).toEqual(["@/registry/new-york-v4/ui/button"]);
    expect(ui[2]).toContain("@/components/ui/button");
    const hook = fileAliases({ path: "registry/new-york-v4/hooks/use-mobile.ts", type: "registry:hook" });
    expect(hook[2]).toContain("@/hooks/use-mobile");
    const lib = fileAliases({ path: "src/lib/primitive.ts", type: "registry:lib" });
    expect(lib[0]).toEqual(["@/lib/primitive"]);
    const targeted = fileAliases({ path: "registry/b/page.tsx", target: "app/dashboard/page.tsx" });
    expect(targeted[1]).toEqual(["@/app/dashboard/page"]);
    const idx = fileAliases({ path: "components/fancy/index.tsx" });
    expect(idx[0]).toContain("@/components/fancy");
  });

  it("gives higher-ranked claims precedence and keeps the root's files", () => {
    const { modules } = buildModules([
      {
        url: "r",
        depth: 0,
        item: { name: "x", files: [{ path: "registry/x/ui/button.tsx", type: "registry:ui", content: "root" }] },
      },
      {
        url: "d",
        depth: 1,
        item: {
          name: "button",
          files: [
            { path: "registry/new-york-v4/ui/button.tsx", type: "registry:ui", content: "dep" },
            { path: "registry/x/ui/button.tsx", type: "registry:ui", content: "dup" },
            { path: "README.md", content: "# no" },
          ],
        },
      },
    ]);
    expect(modules).toHaveLength(2);
    const root = modules.find((m) => m.code === "root")!;
    expect(root.aliases).toContain("@/components/ui/button");
    const dep = modules.find((m) => m.code === "dep")!;
    expect(dep.aliases).not.toContain("@/components/ui/button");
  });

  it("parses exports", () => {
    const e = parseExports(`
      "use client";
      // export function Commented() {}
      export function Hero() {}
      export const buttonVariants = cva();
      const A = 1; const B = 2;
      export { A as Alpha, B };
      export type { Props };
      export default function Page() {}
    `);
    expect(e.hasDefault).toBe(true);
    expect(e.named.sort()).toEqual(["Alpha", "B", "Hero", "buttonVariants"]);
    expect(parseExports("const X = 1; export { X as default }").hasDefault).toBe(true);
  });

  it("picks the page, then default, then the matching named export", () => {
    const pageItem: RegistryItem = {
      name: "dashboard-01",
      type: "registry:block",
      files: [
        { path: "b/components/app-sidebar.tsx", type: "registry:component", content: "export function AppSidebar() {}" },
        { path: "b/page.tsx", type: "registry:page", target: "app/dashboard/page.tsx", content: "export default function Page() {}" },
      ],
    };
    const g1 = buildModules([{ url: "u", depth: 0, item: pageItem }]);
    expect(pickEntry(pageItem, g1.modules, g1.owner)).toEqual({ moduleId: "@/b/page", exportName: "default" });

    const named: RegistryItem = {
      name: "animated-beam",
      type: "registry:ui",
      files: [{ path: "registry/magicui/animated-beam.tsx", content: "export const AnimatedBeam = () => null; export interface AnimatedBeamProps {}" }],
    };
    const g2 = buildModules([{ url: "u", depth: 0, item: named }]);
    expect(pickEntry(named, g2.modules, g2.owner)).toEqual({ moduleId: "@/registry/magicui/animated-beam", exportName: "AnimatedBeam" });

    const fallback: RegistryItem = {
      name: "thing",
      files: [{ path: "c/other.tsx", content: "export const ThingContext = 1; export function Widget() {}" }],
    };
    const g3 = buildModules([{ url: "u", depth: 0, item: fallback }]);
    expect(pickEntry(fallback, g3.modules, g3.owner)?.exportName).toBe("Widget");

    const empty: RegistryItem = { name: "theme", files: [{ path: "x.css", content: "a{}" }] };
    const g4 = buildModules([{ url: "u", depth: 0, item: empty }]);
    expect(pickEntry(empty, g4.modules, g4.owner)).toBeNull();
    expect(layoutFor("registry:block")).toBe("page");
    expect(layoutFor("registry:ui")).toBe("centered");
  });

  it("collects npm versions, merges cssVars and serializes css", () => {
    expect(splitDep("@scope/pkg@^1.2.0")).toEqual(["@scope/pkg", "^1.2.0"]);
    expect(splitDep("motion")).toEqual(["motion", null]);
    expect(collectNpm([{ name: "a", dependencies: ["motion@12.0.0", "clsx"] }, { name: "b", dependencies: ["motion"] }])).toEqual({
      motion: "12.0.0",
      clsx: null,
    });
    const vars = mergeCssVars([
      { name: "root", cssVars: { theme: { "animate-x": "x 1s" } } },
      { name: "dep", cssVars: { theme: { "animate-x": "dep" }, light: { brand: "red" } } },
    ]);
    expect(vars.theme).toEqual({ "animate-x": "x 1s" });
    expect(vars.light).toEqual({ brand: "red" });
    const css = serializeCss({
      '@plugin "x"': {},
      "@keyframes spin": { from: { transform: "rotate(0)" }, to: { transform: "rotate(360deg)" } },
      "@utility glow": { "box-shadow": "0 0 4px red" },
    });
    expect(css).not.toContain("@plugin");
    expect(css).toContain("@keyframes spin {");
    expect(css).toContain("transform: rotate(360deg);");
    expect(css).toContain("@utility glow {");
  });
});

describe("plan + srcdoc", () => {
  it("renders the -demo sibling of a primitive when there is one", async () => {
    const f = fakeFetcher({
      [OFFICIAL("button")]: {
        name: "button",
        type: "registry:ui",
        dependencies: ["@radix-ui/react-slot"],
        files: [{ path: "registry/new-york-v4/ui/button.tsx", type: "registry:ui", content: "export function Button() {}" }],
      },
      [OFFICIAL("button-demo")]: {
        name: "button-demo",
        type: "registry:example",
        registryDependencies: ["button"],
        files: [{ path: "registry/new-york-v4/examples/button-demo.tsx", content: "export default function D() {}" }],
      },
    });
    const plan = await planForUrl(OFFICIAL("button"), f);
    expect(plan.renderedUrl).toBe(OFFICIAL("button-demo"));
    expect(plan.entry).toEqual({ moduleId: "@/registry/new-york-v4/examples/button-demo", exportName: "default" });
    expect(plan.npm).toMatchObject({ "@radix-ui/react-slot": null });
    expect(plan.layout).toBe("centered");
  });

  it("falls back to the item itself and errors when nothing is renderable", async () => {
    const f = fakeFetcher({
      [OFFICIAL("marquee")]: {
        name: "marquee",
        type: "registry:ui",
        files: [{ path: "ui/marquee.tsx", content: "export function Marquee() {}" }],
      },
      [OFFICIAL("theme-x")]: { name: "theme-x", type: "registry:theme", files: [] },
    });
    const plan = await planForUrl(OFFICIAL("marquee"), f);
    expect(plan.renderedUrl).toBe(OFFICIAL("marquee"));
    expect(plan.entry.exportName).toBe("Marquee");
    await expect(planForUrl(OFFICIAL("theme-x"), f)).rejects.toMatchObject({ status: 422 });
  });

  it("builds a sandbox-safe document", async () => {
    const f = fakeFetcher({
      [OFFICIAL("hero")]: {
        name: "hero",
        type: "registry:block",
        files: [{ path: "b/hero.tsx", content: 'export default function H() { return "</script><script>alert(1)</script>" }' }],
      },
    });
    const plan = await planForUrl(OFFICIAL("hero"), f);
    const html = buildRegistryPreviewDocument(plan, { theme: "dark" });
    expect(html).toContain('<html lang="en" class="dark">');
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain('type="application/json" id="__rp_plan"');
    // The only closing script tags are our own.
    expect(html.match(/<\/script>/g)?.length).toBe(4);
    expect(scriptJson("a</script> ")).toBe('"a\\u003c/script>\\u2028"');
    expect(html).toContain("--color-background: var(--background);");
  });
});

describe("undeclared imports", () => {
  const mod = (id: string, code: string, aliases: string[] = []): VirtualModule => ({
    id,
    aliases,
    lang: "tsx",
    code,
    dirs: [id.slice(0, id.lastIndexOf("/"))],
  });

  it("lists import specifiers", () => {
    expect(
      importSpecifiers(
        'import { A } from "@/a";\nimport type { T } from \'./t\';\nexport * from "./b";\nimport "./x.css";\nconst L = import("@/lazy");',
      ).sort(),
    ).toEqual(["./b", "./t", "./x.css", "@/a", "@/lazy"]);
  });

  it("finds imports nothing provides, relative ones resolved", () => {
    const mods = [
      mod("@/registry/b/page", 'import { X } from "@/components/ui/badge";\nimport { M } from "../m/marquee";\nimport { cn } from "@/lib/utils";\nimport { Y } from "./y";'),
      mod("@/registry/b/y", "export const Y = 1;"),
    ];
    expect(unresolvedImports(mods).sort()).toEqual(["@/components/ui/badge", "@/registry/m/marquee"]);
  });

  it("aliases unique basename matches only", () => {
    const mods = [mod("@/registry/blocks/x/components/marquee", ""), mod("@/a/card", ""), mod("@/b/card", "")];
    expect(aliasByBasename(mods, ["@/registry/eldoraui/marquee", "@/components/card"])).toEqual(["@/components/card"]);
    expect(mods[0].aliases).toContain("@/registry/eldoraui/marquee");
  });

  it("knows which keys are official primitives", () => {
    expect(fillCandidates("@/components/ui/badge").official).toBe("badge");
    expect(fillCandidates("@/registry/new-york-v4/ui/input-group").official).toBe("input-group");
    expect(fillCandidates("@/registry/bases/radix/ui/button").official).toBe("button");
    expect(fillCandidates("@/hooks/use-mobile").official).toBe("use-mobile");
    expect(fillCandidates("@/registry/default/ui/halo-progress").official).toBe("halo-progress");
    expect(fillCandidates("@/components/icons")).toEqual({ official: null, basename: "icons" });
  });

  it("normalizes the @components target shorthand", () => {
    expect(normalizePath("@components/data/x-data.ts")).toBe("components/data/x-data.ts");
  });

  it("fills undeclared primitives and same-registry siblings when planning", async () => {
    const f = fakeFetcher({
      "https://cult-ui.com/r/hero.json": {
        name: "hero",
        type: "registry:block",
        files: [{ path: "registry/default/blocks/hero.tsx", content: 'import { Badge } from "@/components/ui/badge";\nimport { Glow } from "@/registry/default/ui/glow";\nexport default function H() {}' }],
      },
      [OFFICIAL("badge")]: { name: "badge", type: "registry:ui", files: [{ path: "registry/new-york-v4/ui/badge.tsx", type: "registry:ui", content: "export function Badge() {}" }] },
      // Not an official primitive, so it comes from the root's registry.
      "https://cult-ui.com/r/glow.json": { name: "glow", type: "registry:ui", files: [{ path: "registry/default/ui/glow.tsx", content: "export function Glow() {}" }] },
    });
    const plan = await planForUrl("https://cult-ui.com/r/hero.json", f);
    expect(plan.modules.map((m) => m.id)).toEqual([
      "@/registry/default/blocks/hero",
      "@/registry/new-york-v4/ui/badge",
      "@/registry/default/ui/glow",
    ]);
    expect(plan.missing).toEqual([]);
    expect(f.calls).toContain(OFFICIAL("glow"));
  });

  it("pins defaults, adds package stylesheets and rejects Astro items", async () => {
    const f = fakeFetcher({
      [OFFICIAL("x")]: {
        name: "x",
        type: "registry:block",
        dependencies: ["@astryxdesign/core@0.7.4"],
        files: [{ path: "b/x.tsx", content: "export default function X() {}" }],
      },
      "https://ui.saastro.io/r/hero-01.json": { name: "hero-01", type: "registry:block", files: [{ path: "registry/default/blocks/hero-01.astro", content: "---\n---" }] },
    });
    const plan = await planForUrl(OFFICIAL("x"), f);
    expect(plan.npm["lucide-react"]).toBe("0.577.0");
    expect(plan.stylesheets).toEqual(["https://cdn.jsdelivr.net/npm/@astryxdesign/core@0.7.4/dist/astryx.css"]);
    await expect(planForUrl("https://ui.saastro.io/r/hero-01.json", f)).rejects.toMatchObject({
      status: 422,
      message: "Astro components can't be previewed in the browser",
    });
  });
});

describe("export-star wrappers", () => {
  it("defers the export choice to the runtime", () => {
    const item: RegistryItem = {
      name: "component-input-group",
      type: "registry:component",
      files: [{ path: "registry/component-input-group/InputGroup.ts", content: "export * from '@astryxdesign/core/InputGroup';\n" }],
    };
    const g = buildModules([{ url: "u", depth: 0, item }]);
    expect(parseExports(item.files![0].content!).reExportsAll).toBe(true);
    expect(pickEntry(item, g.modules, g.owner)).toEqual({
      moduleId: "@/registry/component-input-group/InputGroup",
      exportName: "?InputGroup",
    });
  });
});

describe("default npm pins", () => {
  it("pins packages whose newest major breaks registry code", async () => {
    const { DEFAULT_NPM_VERSIONS } = await import("@/lib/registry-preview/plan");
    // @tanstack/react-table 9 dropped the v8 API (getCoreRowModel…) the registries use.
    expect(DEFAULT_NPM_VERSIONS["@tanstack/react-table"]).toBe("8.21.3");
  });

  it("switches to TanStack Table v9 only for code written against the v9 API", async () => {
    const { defaultVersionsFor, TANSTACK_TABLE_V9 } = await import("@/lib/registry-preview/plan");
    const v8 = `import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";`;
    const v9 = `import {\n  FlexRender,\n  columnFilteringFeature,\n  tableFeatures,\n  useTable,\n} from "@tanstack/react-table";`;
    expect(defaultVersionsFor([{ code: v8 }])["@tanstack/react-table"]).toBe("8.21.3");
    expect(defaultVersionsFor([{ code: "const x = 1;" }, { code: v9 }])["@tanstack/react-table"]).toBe(TANSTACK_TABLE_V9);
    // Other pins are untouched.
    expect(defaultVersionsFor([{ code: v9 }])["lucide-react"]).toBe("0.577.0");
  });
});

describe("process shim", () => {
  it("gives components a process.env with NODE_ENV, without replacing a real one", async () => {
    const { PROCESS_SHIM } = await import("@/lib/registry-preview/runtime");
    const vm = await import("node:vm");
    const ctx: Record<string, unknown> = {};
    ctx.window = ctx;
    vm.runInNewContext(PROCESS_SHIM, ctx);
    expect((ctx.process as { env: { NODE_ENV: string } }).env.NODE_ENV).toBe("production");
    const existing = { env: { NODE_ENV: "x" } };
    const ctx2: Record<string, unknown> = { process: existing };
    ctx2.window = ctx2;
    vm.runInNewContext(PROCESS_SHIM, ctx2);
    expect(ctx2.process).toBe(existing);
  });
});
