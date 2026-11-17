// Flatten a resolved registry tree into virtual modules the preview iframe
// can import by specifier, and decide which export to render.
//
// Registry files are written against the author's own repo layout
// ("@/registry/new-york-v4/ui/button") while consumers import the installed
// location ("@/components/ui/button"). Each file therefore gets several
// aliases, ranked: its registry path, its install target, then the
// conventional location for its type. A higher-ranked claim always wins, and
// for equal rank the first item seen (the root, then BFS order) wins.

import type { ResolvedItem } from "./resolve";
import type {
  ModuleLang,
  PreviewEntry,
  PreviewLayout,
  RegistryCssVars,
  RegistryFile,
  RegistryItem,
  VirtualModule,
} from "./types";

const LANG_BY_EXT: Record<string, ModuleLang> = {
  tsx: "tsx",
  ts: "ts",
  mts: "ts",
  jsx: "jsx",
  js: "js",
  mjs: "js",
  json: "json",
  css: "css",
};

export function langOf(path: string): ModuleLang | null {
  const m = path.match(/\.([a-z]+)$/i);
  return m ? (LANG_BY_EXT[m[1].toLowerCase()] ?? null) : null;
}

/**
 * "./src/components/x.tsx" → "components/x.tsx". "~/x" counts as "@/x", and
 * the "@components/x" shorthand some registries use as a target as
 * "components/x".
 */
export function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^(?:@|~)\//, "")
    .replace(/^@(components|lib|hooks|ui)\//, "$1/")
    .replace(/^(?:\.\/|\/)+/, "")
    .replace(/^src\//, "");
}

/** Module key: extension dropped for code and JSON, kept for CSS. */
export function moduleKey(p: string): string {
  return /\.css$/i.test(p) ? p : p.replace(/\.(tsx|ts|mts|jsx|js|mjs|json)$/i, "");
}

function dirOf(id: string): string {
  const i = id.lastIndexOf("/");
  return i < 0 ? "@" : id.slice(0, i);
}

function baseName(p: string): string {
  return moduleKey(p.slice(p.lastIndexOf("/") + 1));
}

const TYPE_DIRS: Record<string, string> = {
  "registry:ui": "components/ui",
  "registry:hook": "hooks",
  "registry:lib": "lib",
  "registry:component": "components",
  "registry:block": "components",
  "registry:example": "components",
};

/** Ranked aliases for one file; index 0 is the canonical id. */
export function fileAliases(file: RegistryFile, itemType?: string): string[][] {
  const path = normalizePath(file.path);
  const ranks: string[][] = [[`@/${moduleKey(path)}`], [], []];
  if (file.target) ranks[1].push(`@/${moduleKey(normalizePath(file.target))}`);
  // Folder conventions inside a registry repo: …/ui/x → components/ui/x etc.
  const conv = path.match(/(?:^|\/)(ui|hooks|lib|components)\/(.+)$/);
  if (conv) {
    const dir = conv[1] === "ui" ? "components/ui" : conv[1];
    ranks[2].push(`@/${dir}/${moduleKey(conv[2])}`);
  }
  const typeDir = TYPE_DIRS[file.type ?? itemType ?? ""];
  if (typeDir) ranks[2].push(`@/${typeDir}/${baseName(path)}`);
  // "x/index" is importable as "x".
  for (const r of ranks) {
    for (const a of [...r]) if (a.endsWith("/index")) r.push(a.slice(0, -"/index".length));
  }
  return ranks;
}

export interface ModuleGraph {
  modules: VirtualModule[];
  // Which item each module came from (index into the tree's items).
  owner: Map<string, number>;
}

export function buildModules(items: ResolvedItem[]): ModuleGraph {
  const modules: VirtualModule[] = [];
  const owner = new Map<string, number>();
  const claimed = new Map<string, { rank: number; mod: VirtualModule }>();

  items.forEach(({ item }, itemIdx) => {
    for (const file of item.files ?? []) {
      const lang = langOf(file.path) ?? (file.target ? langOf(file.target) : null);
      if (!lang || typeof file.content !== "string") continue;
      const ranks = fileAliases(file, item.type);
      const id = ranks[0][0];
      if (claimed.get(id)?.rank === 0) continue; // same file from two items
      const dirs = [dirOf(id)];
      if (file.target) dirs.push(dirOf(`@/${moduleKey(normalizePath(file.target))}`));
      const mod: VirtualModule = { id, aliases: [], lang, code: file.content, dirs };
      modules.push(mod);
      owner.set(id, itemIdx);
      ranks.forEach((aliases, rank) => {
        for (const a of aliases) {
          const prev = claimed.get(a);
          if (prev && prev.rank <= rank) continue;
          if (prev) prev.mod.aliases = prev.mod.aliases.filter((x) => x !== a);
          claimed.set(a, { rank, mod });
          if (a !== id) mod.aliases.push(a);
        }
      });
    }
  });
  return { modules, owner };
}

/** Every import specifier in a source file (static, re-export, dynamic). */
export function importSpecifiers(code: string): string[] {
  const out = new Set<string>();
  const res = [
    /\b(?:import|export)\s[^'"]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of res) for (const m of code.matchAll(re)) out.add(m[1]);
  return [...out];
}

/** Same join the iframe runtime does for relative specifiers. */
export function joinPath(dir: string, rel: string): string {
  const parts = dir.split("/");
  for (const seg of rel.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

/**
 * Module keys that some file imports (via "@/…" or a relative path) but no
 * module provides. Relative imports are reported resolved against the
 * importing file's registry path, which is how the runtime will look them up.
 */
export function unresolvedImports(modules: VirtualModule[]): string[] {
  const known = new Set<string>();
  for (const m of modules) {
    known.add(m.id);
    for (const a of m.aliases) known.add(a);
  }
  const has = (k: string) => known.has(k) || known.has(`${k}/index`);
  const out = new Set<string>();
  for (const m of modules) {
    if (m.lang === "css" || m.lang === "json") continue;
    for (const spec of importSpecifiers(m.code)) {
      if (/\.css$/i.test(spec)) continue;
      if (/^[@~]\//.test(spec)) {
        const key = moduleKey(`@/${spec.slice(2)}`);
        if (key !== "@/lib/utils" && !has(key)) out.add(key);
      } else if (spec.startsWith(".")) {
        const keys = m.dirs.map((d) => moduleKey(joinPath(d, spec)));
        if (!keys.some(has)) out.add(keys[0]);
      }
    }
  }
  return [...out];
}

/**
 * Registry items worth fetching for an unresolved key, most likely first.
 * "…/ui/x" and "…/hooks/use-mobile" are official shadcn primitives (plenty
 * of community items import primitives they forgot to declare; the CLI user
 * has them installed already). Anything else is tried by its basename in the
 * root item's own registry.
 */
export function fillCandidates(key: string): { official: string | null; basename: string } {
  const ui = key.match(/^@\/(?:components|registry)(?:\/[\w.-]+)*\/ui\/([\w-]+)$/);
  const hook = key.match(/^@\/(?:hooks|registry(?:\/[\w.-]+)*\/hooks)\/(use-mobile)$/);
  return { official: ui?.[1] ?? hook?.[1] ?? null, basename: baseName(key) };
}

/**
 * Last resort for imports whose path matches nothing: if exactly one module
 * has the same file name, alias the key to it (registries often import a
 * file by its path in their own repo while shipping it somewhere else).
 * Returns the keys it could not place.
 */
export function aliasByBasename(modules: VirtualModule[], keys: string[]): string[] {
  const left: string[] = [];
  for (const key of keys) {
    const name = baseName(key);
    const hits = modules.filter(
      (m) => m.lang !== "css" && (baseName(m.id) === name || m.aliases.some((a) => baseName(a) === name)),
    );
    if (hits.length === 1) hits[0].aliases.push(key);
    else left.push(key);
  }
  return left;
}

// ---------------------------------------------------------------- exports

export interface ExportInfo {
  hasDefault: boolean;
  named: string[];
  // `export * from "pkg"`: names only known at runtime.
  reExportsAll: boolean;
}

export function parseExports(code: string): ExportInfo {
  const src = stripComments(code);
  const named = new Set<string>();
  const decl =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of src.matchAll(decl)) named.add(m[1]);
  let hasDefault = /export\s+default\s/.test(src);
  for (const m of src.matchAll(/export\s+(?!type\s)\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const p = part.trim().replace(/^type\s+/, "");
      if (!p) continue;
      const as = p.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      const name = as ? as[1] : p;
      if (name === "default") hasDefault = true;
      else if (/^[A-Za-z_$][\w$]*$/.test(name)) named.add(name);
    }
  }
  const reExportsAll = /export\s*\*\s*from\s/.test(src);
  return { hasDefault, named: [...named], reExportsAll };
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

export function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

const NOT_RENDERABLE = /(?:Context|Provider|Props|Variants|Config|Schema)$/;

/**
 * Pick what to render from the root item: a page's default export, else a
 * default export from the root's own files (preferring the file named after
 * the item), else a named component export matching the item name, else the
 * first PascalCase component export.
 */
export function pickEntry(
  root: RegistryItem,
  modules: VirtualModule[],
  owner: Map<string, number>,
): PreviewEntry | null {
  const rootFiles = (root.files ?? []).filter((f) => {
    const l = langOf(f.path) ?? (f.target ? langOf(f.target) : null);
    return l === "tsx" || l === "jsx" || l === "ts" || l === "js";
  });
  const byId = new Map(modules.map((m) => [m.id, m]));
  const candidates = rootFiles
    .map((f) => {
      const id = `@/${moduleKey(normalizePath(f.path))}`;
      const mod = byId.get(id);
      if (!mod || owner.get(id) !== 0) return null;
      return { file: f, mod, exports: parseExports(mod.code) };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (!candidates.length) return null;

  const isPage = (f: RegistryFile) =>
    f.type === "registry:page" ||
    /(^|\/)page\.[jt]sx?$/.test(normalizePath(f.target ?? "")) ||
    /(^|\/)page\.[jt]sx?$/.test(normalizePath(f.path));
  const page = candidates.find((c) => c.exports.hasDefault && isPage(c.file));
  if (page) return { moduleId: page.mod.id, exportName: "default" };

  const named = candidates.find((c) => baseName(c.file.path) === root.name);
  const nonLib = (c: (typeof candidates)[number]) =>
    !["registry:lib", "registry:hook"].includes(c.file.type ?? "");
  const withDefault = [
    ...(named ? [named] : []),
    ...candidates.filter((c) => c !== named && nonLib(c)),
  ].find((c) => c.exports.hasDefault);
  if (withDefault) return { moduleId: withDefault.mod.id, exportName: "default" };

  const want = pascalCase(root.name);
  for (const c of [...(named ? [named] : []), ...candidates]) {
    for (const n of [want, `${want}Demo`]) {
      if (c.exports.named.includes(n)) return { moduleId: c.mod.id, exportName: n };
    }
  }
  for (const c of [...(named ? [named] : []), ...candidates.filter(nonLib)]) {
    const n = c.exports.named.find((x) => /^[A-Z]/.test(x) && !NOT_RENDERABLE.test(x));
    if (n) return { moduleId: c.mod.id, exportName: n };
  }
  // Thin wrappers (`export * from "@pkg/InputGroup"`): let the runtime pick
  // the export named after the file, or the first component it finds.
  const wrapper = candidates.find((c) => c.exports.reExportsAll);
  if (wrapper) return { moduleId: wrapper.mod.id, exportName: `?${pascalCase(baseName(wrapper.file.path))}` };
  return null;
}

export function layoutFor(type: string | undefined): PreviewLayout {
  return type === "registry:page" || type === "registry:block" ? "page" : "centered";
}

// -------------------------------------------------------------- npm + css

/** "@scope/pkg@^1.2.0" → ["@scope/pkg", "^1.2.0"]. */
export function splitDep(dep: string): [string, string | null] {
  const d = dep.trim();
  const at = d.lastIndexOf("@");
  if (at > 0) return [d.slice(0, at), d.slice(at + 1) || null];
  return [d, null];
}

export function collectNpm(items: RegistryItem[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const it of items) {
    for (const dep of it.dependencies ?? []) {
      const [name, ver] = splitDep(dep);
      if (!name || name in out) continue;
      out[name] = ver;
    }
  }
  return out;
}

/** Merge cssVars with later (closer to the root) items winning. */
export function mergeCssVars(items: RegistryItem[]): RegistryCssVars {
  const out: Required<RegistryCssVars> = { theme: {}, light: {}, dark: {} };
  for (const it of [...items].reverse()) {
    for (const k of ["theme", "light", "dark"] as const) Object.assign(out[k], it.cssVars?.[k]);
  }
  return out;
}

/**
 * Serialize registry `css` objects into Tailwind v4 CSS. `@plugin` and
 * `@import` need a build step the browser runtime doesn't have, so they're
 * dropped.
 */
export function serializeCss(css: Record<string, unknown> | undefined): string {
  if (!css) return "";
  const walk = (obj: Record<string, unknown>, indent: string): string =>
    Object.entries(obj)
      .map(([k, v]) => {
        if (/^@(plugin|import)\b/.test(k)) return "";
        if (v && typeof v === "object") {
          return `${indent}${k} {\n${walk(v as Record<string, unknown>, indent + "  ")}\n${indent}}`;
        }
        if (typeof v === "string" || typeof v === "number") {
          return v === "" ? `${indent}${k};` : `${indent}${k}: ${v};`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  return walk(css, "");
}
