// File tree + language helpers for the dashboard code view.

export type TreeNode =
  | { kind: "dir"; name: string; path: string; children: TreeNode[] }
  | { kind: "file"; name: string; path: string; size: number };

export function buildFileTree(files: Array<[string, number]>): TreeNode[] {
  const root: TreeNode = { kind: "dir", name: "", path: "", children: [] };
  for (const [filePath, size] of files) {
    const parts = filePath.split("/");
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      let next = dir.children.find((c): c is Extract<TreeNode, { kind: "dir" }> => c.kind === "dir" && c.name === name);
      if (!next) {
        next = { kind: "dir", name, path: parts.slice(0, i + 1).join("/"), children: [] };
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ kind: "file", name: parts[parts.length - 1], path: filePath, size });
  }
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.kind !== b.kind ? (a.kind === "dir" ? -1 : 1) : a.name.localeCompare(b.name, "en", { sensitivity: "base" })));
    for (const n of nodes) if (n.kind === "dir") sortTree(n.children);
  };
  sortTree(root.children);
  return root.kind === "dir" ? root.children : [];
}

const LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  astro: "html",
  hbs: "handlebars",
  njk: "html",
  ejs: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  json: "json",
  md: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  svg: "xml",
  sh: "shell",
  py: "python",
  php: "php",
};

function extOf(p: string): string {
  const name = p.slice(p.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function languageForPath(p: string): string {
  return LANGUAGES[extOf(p)] ?? "plaintext";
}

const BINARY = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "tif", "tiff", "psd",
  "woff", "woff2", "ttf", "otf", "eot",
  "zip", "gz", "tgz", "rar", "7z",
  "mp4", "webm", "mov", "mp3", "wav", "ogg",
  "pdf", "wasm", "exe", "dll", "so", "dylib", "jar", "sketch", "fig",
]);

export function isBinaryPath(p: string): boolean {
  return BINARY.has(extOf(p));
}

export const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "svg"]);

export function isImagePath(p: string): boolean {
  return IMAGE_EXTS.has(extOf(p));
}

/** README first, then the demo's entry page, then the first file. */
export function defaultOpenFile(files: Array<[string, number]>, entry: string): string | null {
  const readme = files.find(([p]) => /^readme(\.md|\.markdown|\.txt)?$/i.test(p));
  if (readme) return readme[0];
  const entryFile = files.find(([p]) => p === entry || p.endsWith(`/${entry}`));
  if (entryFile) return entryFile[0];
  return files.length ? files[0][0] : null;
}
