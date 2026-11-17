// Turn a downloaded (and maybe built) dashboard into what the app serves:
//   demos/<slug>/**.html          HTML pages, rewritten at serve time
//   public/demos/<slug>/**        every other file, served as static files
//   data/dashboards/records/<slug>.json   record + serve info
//   data/dashboards/files/<slug>.json     the repo's file list (code view)
// Files byte-identical to what jsDelivr serves for the repo at the pinned
// commit aren't stored; the demo route redirects them to jsDelivr.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { listFiles } from "./git-blob.mjs";
import { cdnBase, jsdelivrFiles, sha256b64 } from "./fetch.mjs";

const ROOT = process.cwd();
export const DEMOS_HTML = path.join(ROOT, "demos");
export const DEMOS_ASSETS = path.join(ROOT, "public", "demos");
export const DATA_DIR = path.join(ROOT, "data", "dashboards");

// Never shipped: source maps, OS junk, and anything that looks like a secret.
// Dotfiles and dot-folders are never served (the route refuses them too).
const SKIP_FILE = /(^|\/)\.|(^|\/)(Thumbs\.db|desktop\.ini)$|\.map$|\.(pem|key)$/i;
const HTML_RE = /\.html?$/i;

function extOf(p) {
  const base = p.slice(p.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function isPageHtml(text) {
  return /<body[\s>]|<html[\s>]/i.test(text);
}

export function pageTitle(text, rel) {
  const m = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = m ? m[1] : "";
  const t = raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t) return t.slice(0, 120);
  const base = rel.replace(/\/index\.html?$/i, "").replace(/\.html?$/i, "");
  const name = base.slice(base.lastIndexOf("/") + 1) || "Home";
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isIgnored(rel, ignore) {
  return ignore.some((dir) => rel === dir || rel.startsWith(`${dir.replace(/\/$/, "")}/`));
}

function copyInto(destRoot, rel, from) {
  const to = path.join(destRoot, rel);
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
}

/**
 * @param {{ source: import('../../lib/dashboards/types').DashboardSource,
 *           repoDir: string, siteDir: string, log?: (m: string) => void }} args
 */
export async function processSite({ source, repoDir, siteDir, log = () => {} }) {
  const { slug, site } = source;
  const isStatic = site.kind === "static";
  const ignore = isStatic ? site.ignore ?? [] : [];
  const jsd = await jsdelivrFiles(source.repo, source.sha).catch((e) => {
    log(`jsDelivr listing failed, storing everything: ${e.message}`);
    return null;
  });
  // For built sites: any repo file jsDelivr serves, by content hash.
  const byHash = new Map();
  if (jsd && !isStatic) {
    for (const [p, f] of jsd) byHash.set(f.hash, [...(byHash.get(f.hash) ?? []), p]);
  }
  const siteRootInRepo = isStatic ? (site.root === "." ? "" : site.root.replace(/\/$/, "")) : null;

  rmSync(path.join(DEMOS_HTML, slug), { recursive: true, force: true });
  rmSync(path.join(DEMOS_ASSETS, slug), { recursive: true, force: true });

  const pages = [];
  const cdnMap = {};
  let storedBytes = 0;
  let cdnFiles = 0;
  for (const f of listFiles(siteDir)) {
    if (SKIP_FILE.test(f.path) || isIgnored(f.path, ignore)) continue;
    const abs = path.join(siteDir, f.path);
    if (HTML_RE.test(f.path)) {
      const text = readFileSync(abs, "utf8");
      copyInto(path.join(DEMOS_HTML, slug), f.path, abs);
      storedBytes += f.size;
      if (isPageHtml(text)) pages.push({ path: f.path, title: pageTitle(text, f.path) });
      continue;
    }
    // SVGs stay local: browsers refuse cross-origin <use href="sprite.svg#id">.
    // Data files (JSON) stay local too: apps fetch them with credentials or
    // custom headers, which a cross-origin CDN redirect would break.
    if (jsd && !/\.(svg|json)$/i.test(f.path)) {
      const hash = sha256b64(readFileSync(abs));
      if (isStatic) {
        const repoPath = siteRootInRepo ? `${siteRootInRepo}/${f.path}` : f.path;
        if (jsd.get(repoPath)?.hash === hash) {
          cdnFiles++;
          continue;
        }
      } else {
        // jsDelivr picks the Content-Type from the repo file's extension, so
        // only reuse a file with the same extension (identical bytes can sit
        // under another name, e.g. two empty files: polyfills.js vs app.css).
        const repoPath = (byHash.get(hash) ?? []).find((p) => extOf(p) === extOf(f.path));
        if (repoPath) {
          cdnMap[f.path] = repoPath;
          cdnFiles++;
          continue;
        }
      }
    }
    copyInto(path.join(DEMOS_ASSETS, slug), f.path, abs);
    storedBytes += f.size;
  }

  const entry = site.entry;
  if (!existsSync(path.join(DEMOS_HTML, slug, entry))) {
    throw new Error(`${slug}: entry ${entry} is missing from the site`);
  }
  pages.sort((a, b) => (a.path === entry ? -1 : b.path === entry ? 1 : a.path.localeCompare(b.path)));
  // Client-routed apps: the routes are found by the crawl, from the root.
  if (!isStatic && site.spa) pages.splice(0, pages.length, { path: "", title: source.title });

  const serve = {
    slug,
    kind: site.kind,
    entry,
    spa: !isStatic && site.spa === true,
    cdnBase: jsd ? cdnBase(source.repo, source.sha) : null,
    cdnRoot: isStatic && jsd ? siteRootInRepo : null,
    cdnMap: !isStatic && jsd && Object.keys(cdnMap).length ? cdnMap : null,
  };
  const record = {
    slug,
    title: source.title,
    description: source.description,
    repo: source.repo,
    sha: source.sha,
    license: { ...source.license, url: `https://github.com/${source.repo}/blob/${source.sha}/${source.license.path}` },
    author: source.author,
    framework: source.framework,
    ui: source.ui,
    category: source.category,
    tags: source.tags,
    demoUrl: source.demoUrl ?? null,
    quality: source.quality,
    entry,
    spa: serve.spa,
    pages,
    storedBytes,
    thumb: null,
    check: null,
    importedAt: new Date().toISOString(),
  };

  const repoFiles = listFiles(repoDir).map((f) => [f.path, f.size]);
  mkdirSync(path.join(DATA_DIR, "records"), { recursive: true });
  mkdirSync(path.join(DATA_DIR, "files"), { recursive: true });
  writeFileSync(path.join(DATA_DIR, "records", `${slug}.json`), JSON.stringify({ record, serve }, null, 2));
  writeFileSync(path.join(DATA_DIR, "files", `${slug}.json`), JSON.stringify(repoFiles));
  log(`${slug}: ${pages.length} pages, ${(storedBytes / 1048576).toFixed(1)} MB stored, ${cdnFiles} files via jsDelivr`);
  return { record, serve };
}
