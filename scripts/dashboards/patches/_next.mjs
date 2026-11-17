// Helpers for Next.js static-export patches (runs in the build container).
// staticNextConfig() rewrites next.config.* so its exported config is wrapped:
// output "export", the demo basePath, unoptimized images, trailing slashes,
// and no server-only options (rewrites/redirects/headers/i18n/standalone).
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { BASE_NOSLASH } from "./_lib.mjs";

const WRAP = `
function __aimStatic(c) {
  if (typeof c === "function") return (...a) => { const r = c(...a); return r && typeof r.then === "function" ? r.then(__aimStatic) : __aimStatic(r); };
  if (c && typeof c.then === "function") return c.then(__aimStatic);
  const { rewrites, redirects, headers, i18n, ...rest } = c || {};
  return {
    ...rest,
    output: "export",
    basePath: ${JSON.stringify(BASE_NOSLASH)},
    trailingSlash: __AIM_TRAILING__,
    images: { ...(rest.images || {}), unoptimized: true },
    eslint: { ...(rest.eslint || {}), ignoreDuringBuilds: true },
    typescript: { ...(rest.typescript || {}), ignoreBuildErrors: true },
  };
}
`;

/** Wrap the default export / module.exports of next.config.* (or create one). */
export function staticNextConfig(dir = ".", { trailingSlash = true } = {}) {
  const wrap = WRAP.replace("__AIM_TRAILING__", String(trailingSlash));
  const name = ["next.config.ts", "next.config.mjs", "next.config.js", "next.config.cjs"].find((f) =>
    existsSync(path.join(dir, f)),
  );
  if (!name) {
    writeFileSync(path.join(dir, "next.config.mjs"), `${wrap}\nexport default __aimStatic({});\n`);
    return;
  }
  const file = path.join(dir, name);
  let s = readFileSync(file, "utf8");
  const esm = s.lastIndexOf("export default ");
  const cjs = s.lastIndexOf("module.exports =");
  if (esm > -1 && /^export default (async )?function/.test(s.slice(esm))) {
    s = s.slice(0, esm) + s.slice(esm).replace(/^export default (async )?function/, "const __aimOrig = $1function") +
      `\n${wrap}\nexport default __aimStatic(__aimOrig);\n`;
  } else if (esm > -1) {
    s = s.slice(0, esm) + "const __aimOrig = " + s.slice(esm + "export default ".length) +
      `;\n${wrap}\nexport default __aimStatic(__aimOrig);\n`;
  } else if (cjs > -1) {
    s = s.slice(0, cjs) + "const __aimOrig =" + s.slice(cjs + "module.exports =".length) +
      `;\n${wrap}\nmodule.exports = __aimStatic(__aimOrig);\n`;
  } else {
    throw new Error(`patch: ${file} has no default export`);
  }
  writeFileSync(file, s);
}

/** Delete middleware/proxy files (Next runs them only on a server). */
export function removeMiddleware(dir = ".") {
  for (const d of [dir, path.join(dir, "src")]) {
    for (const base of ["middleware", "proxy"]) {
      for (const ext of [".ts", ".js", ".tsx", ".mjs"]) {
        const f = path.join(d, base + ext);
        if (existsSync(f)) rmSync(f);
      }
    }
  }
}

/** Files under dir (recursive) whose name matches re. */
export function findFiles(dir, re, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) findFiles(p, re, out);
    else if (re.test(e)) out.push(p);
  }
  return out;
}

/** Write a root index.html-producing page that forwards to `to` (path under the app). */
export function redirectPage(file, to, { client = true } = {}) {
  writeFileSync(
    file,
    `${client ? '"use client";\n' : ""}import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AimIndexRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(${JSON.stringify(to)}); }, [router]);
  return null;
}
`,
  );
}

/**
 * Next adds basePath to links and its own assets, not to hand-written
 * "/images/..." strings for files in public/. Prefix those in code and CSS.
 * Returns how many files changed.
 */
export function prefixPublicPaths(codeDirs, { publicDir = "public", skip = [] } = {}) {
  if (!existsSync(publicDir)) return 0;
  const names = readdirSync(publicDir).filter((n) => !skip.includes(n) && !n.startsWith("."));
  if (!names.length) return 0;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "/name" followed by / " ' ` ) ? or #, inside quotes, backticks or url().
  // A folder name only counts when a path inside it follows ("/images/x"), so
  // a page route with the same name ("/images") is left alone.
  const files = names.filter((n) => !statSync(path.join(publicDir, n)).isDirectory());
  const dirs = names.filter((n) => statSync(path.join(publicDir, n)).isDirectory());
  const alt = [...files.map((n) => `${esc(n)}(?=[/"'\`)?#])`), ...dirs.map((n) => `${esc(n)}(?=/)`)];
  const re = new RegExp(`(["'\`(])/(${alt.join("|")})`, "g");
  let changed = 0;
  for (const dir of codeDirs) {
    if (!existsSync(dir)) continue;
    for (const f of findFiles(dir, /\.(m?[jt]sx?|css|scss|sass|json)$/)) {
      if (/(^|\/)(next\.config|package(-lock)?\.json|tsconfig)/.test(f)) continue;
      const s = readFileSync(f, "utf8");
      const t = s.replace(re, `$1${BASE_NOSLASH}/$2`);
      if (t !== s) {
        writeFileSync(f, t);
        changed++;
      }
    }
  }
  return changed;
}

/**
 * Turn mock route handlers into an in-browser fetch shim. `routes` maps an
 * API path prefix ("/api/notes") to its route file. Each file moves to
 * <dir>/aim-api/, NextResponse becomes a tiny Response wrapper, the original
 * route folder is deleted, and a client component installing the shim is
 * rendered first in the root layout's <body>.
 */
export function clientApi(routes, { srcDir = "src", layout, apiDir }) {
  const out = path.join(srcDir, "aim-api");
  mkdirSync(out, { recursive: true });
  const mods = [];
  Object.entries(routes).forEach(([prefix, file], i) => {
    let s = readFileSync(file, "utf8");
    const before = s;
    s = s.replace(/import\s*\{\s*NextResponse\s*(,\s*(type\s+)?NextRequest\s*)?\}\s*from\s*["']next\/server["'];?/, "");
    s = s.replace(/import\s+(type\s+)?\{\s*NextRequest\s*\}\s*from\s*["']next\/server["'];?/, "");
    if (/next\/server/.test(s)) throw new Error(`patch: ${file} still imports next/server`);
    if (s === before && /NextResponse/.test(s)) throw new Error(`patch: ${file} NextResponse import not found`);
    s =
      `const NextResponse = { json: (d: any, init?: { status?: number }) => new Response(JSON.stringify(d), { status: init?.status ?? 200, headers: { "content-type": "application/json" } }) };\ntype NextRequest = Request & { nextUrl: URL };\n` +
      s;
    writeFileSync(path.join(out, `r${i}.ts`), s);
    mods.push([prefix, `r${i}`]);
  });
  if (apiDir) rmSync(apiDir, { recursive: true, force: true });
  writeFileSync(
    path.join(out, "install.tsx"),
    `"use client";
${mods.map(([, m]) => `import * as ${m} from "./${m}";`).join("\n")}
const routes: Array<[string, any]> = [${mods.map(([p, m]) => `[${JSON.stringify(p)}, ${m}]`).join(", ")}];
if (typeof window !== "undefined" && !(window as any).__aimApi) {
  (window as any).__aimApi = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, location.href);
    for (const [prefix, mod] of routes) {
      if (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) {
        const method = String(init?.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
        const handler = mod[method];
        if (!handler) return new Response(null, { status: 405 });
        const req: any = new Request(url.href, init);
        req.nextUrl = url;
        const id = url.pathname.slice(prefix.length + 1);
        return handler(req, { params: Promise.resolve(id ? { id } : {}) });
      }
    }
    return orig(input, init);
  };
}
export default function AimApi() { return null; }
`,
  );
  const rel = path.relative(path.dirname(layout), path.join(out, "install")).replace(/^(?!\.)/, "./");
  let l = readFileSync(layout, "utf8");
  const m = l.match(/<body[^>]*>/);
  if (!m) throw new Error(`patch: ${layout} has no <body>`);
  l = `import AimApi from ${JSON.stringify(rel)};\n` + l.replace(m[0], `${m[0]}<AimApi />`);
  writeFileSync(layout, l);
}

// App-router navigations fetch "<page>/index.txt?_rsc=…" with custom RSC
// headers. From the demo's opaque origin those headers force a CORS preflight
// (OPTIONS), which static hosting answers 405. A static export ignores those
// headers anyway, so drop them: the request becomes a simple GET. Also,
// ".../index.html" URLs become ".../" before the router reads them, so
// usePathname() matches what was prerendered. Next 16's HEAD probes of
// page folders get a local 200 (a 308 to the slashless URL has no CORS).
export const RSC_FIX = String.raw`(function(){try{var P=location.pathname;if(/\/index\.html$/.test(P))history.replaceState(history.state,"",P.slice(0,-10)+location.search+location.hash);else if(/\.html$/.test(P))history.replaceState(history.state,"",P.slice(0,-5)+location.search+location.hash)}catch(e){}try{var f=window.fetch;if(!f||f.__aimRsc)return;var w=function(i,o){try{var u=typeof i==="string"?i:i&&i.url?i.url:String(i);var m=String((o&&o.method)||(i&&typeof i==="object"&&i.method)||"GET").toUpperCase();if(u.indexOf("_rsc=")>-1||/\.txt(\?|$)/.test(u)){o=Object.assign({},o||{});o.headers={};o.mode="cors";o.credentials="omit";i=u;if(i.indexOf("index.html.txt")>-1)i=i.replace("index.html.txt","index.txt");if(i.indexOf("/index.html/")>-1)i=i.replace("/index.html/","/");}else{var U=new URL(u,location.href);if(U.origin===location.origin){if(/\/$/.test(U.pathname)){if(m==="HEAD")return Promise.resolve(new Response(null,{status:200,headers:{"content-type":"text/html; charset=utf-8"}}));U.pathname+="index.html";i=U.href;}if((m==="GET"||m==="HEAD")&&o&&o.headers){o=Object.assign({},o);o.headers={};}}}}catch(e){}return f.call(this,i,o)};w.__aimRsc=1;window.fetch=w}catch(e){}})();`;

/** Insert the RSC header fix as the first thing in the root layout's <body>. */
export function fixRscFetch(layout) {
  let l = readFileSync(layout, "utf8");
  const m = l.match(/<body[^>]*>/);
  if (!m) throw new Error(`patch: ${layout} has no <body>`);
  l = l.replace(m[0], `${m[0]}<script dangerouslySetInnerHTML={{ __html: ${JSON.stringify(RSC_FIX)} }} />`);
  writeFileSync(layout, l);
}

/** fixRscFetch on every app-router layout that renders <body>. Returns the count. */
export function fixRscFetchAll(dirs = ["app", "src/app"]) {
  let n = 0;
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of findFiles(d, /^layout\.(t|j)sx?$/)) {
      if (/<body[\s>]/.test(readFileSync(f, "utf8"))) {
        fixRscFetch(f);
        n++;
      }
    }
  }
  if (!n) throw new Error("patch: no root layout with <body> found");
  return n;
}

/** Metadata routes (sitemap/robots/manifest .ts) must opt into static output. */
export function forceStaticMetaRoutes(dirs = ["app", "src/app"]) {
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of findFiles(d, /^(sitemap|robots|manifest)\.(t|j)s$/)) {
      const s = readFileSync(f, "utf8");
      if (!/export const dynamic/.test(s)) writeFileSync(f, s + '\nexport const dynamic = "force-static";\n');
    }
  }
}
