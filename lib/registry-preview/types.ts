// Shapes shared by the registry preview proxy, resolver, srcDoc builder and
// the RegistryPreview component. A registry item is the JSON a shadcn
// registry serves at `/r/{name}.json`; a PreviewPlan is what the bundle route
// hands the browser: every file the item needs, flattened into virtual
// modules, plus which export to render.

export interface RegistryFile {
  path: string;
  type?: string;
  target?: string;
  content?: string;
}

export interface RegistryCssVars {
  theme?: Record<string, string>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface RegistryItem {
  name: string;
  type?: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  cssVars?: RegistryCssVars;
  // Tailwind v4 at-rules: { "@keyframes x": {...}, "@utility y": {...} }.
  css?: Record<string, unknown>;
}

export type ModuleLang = "tsx" | "ts" | "jsx" | "js" | "json" | "css";

export interface VirtualModule {
  // Canonical import id, e.g. "@/components/ui/button".
  id: string;
  // Every other specifier that should resolve to this module.
  aliases: string[];
  lang: ModuleLang;
  code: string;
  // Directories relative imports resolve against: the file's registry path
  // first, then its install target ("@/app/dashboard").
  dirs: string[];
}

export interface PreviewEntry {
  moduleId: string;
  // "default", a named export, or "?Name" for an `export *` wrapper: the
  // runtime renders `Name` if present, else the first component export.
  exportName: string;
}

export type PreviewLayout = "page" | "centered";

export interface PreviewPlan {
  rootUrl: string;
  // The item actually rendered: the root, or its `-demo` sibling.
  renderedUrl: string;
  name: string;
  type: string | null;
  entry: PreviewEntry;
  layout: PreviewLayout;
  modules: VirtualModule[];
  // npm package → pinned version (or null for latest).
  npm: Record<string, string | null>;
  cssVars: RegistryCssVars;
  css: string;
  // Prebuilt stylesheets some npm packages need (jsDelivr URLs).
  stylesheets: string[];
  // Dependencies that could not be fetched (unknown registry, 404, caps).
  missing: { dep: string; reason: string }[];
}
