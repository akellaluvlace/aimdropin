// Crawl every demo in a real browser, page by page, the way a visitor would.
// A page fails on a broken file from the demo or from jsDelivr, an uncaught
// script error, or an empty body. The entry page is also screenshotted for
// the gallery thumbnail. Needs the app running (npm run dev).
//
//   node scripts/dashboards/check.mjs [--base http://localhost:3000]
//        [--only a,b] [--max-pages 80] [--concurrency 4] [--no-thumbs]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import sharp from "sharp";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "dashboards");
const THUMBS = path.join(ROOT, "public", "thumbs", "dashboards");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const ONLY = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
const MAX_PAGES = Number(arg("max-pages", "80"));
const CONCURRENCY = Number(arg("concurrency", "4"));
const THUMBS_ON = !process.argv.includes("--no-thumbs");

// Errors that say nothing about the template (extensions, benign observers).
const BENIGN_ERROR = /ResizeObserver loop|Script error\.?$|Non-Error promise rejection|play\(\) request was interrupted/i;

function pagePathOf(url, prefix) {
  const u = new URL(url);
  return decodeURIComponent(u.pathname.slice(prefix.length)) + u.search + (u.hash.startsWith("#/") ? u.hash : "");
}

async function checkPage(browser, url, ctx) {
  const page = await browser.newPage();
  const problems = [];
  // External SVG sprite refs (x.svg#id) are blocked by design in the opaque
  // origin; the shim inlines the sprite, so that first attempt doesn't count.
  const watch = (u) => (u.startsWith(ctx.demoUrl) || u.startsWith(ctx.cdnPrefix)) && !/\.svg#/i.test(u);
  page.on("response", (r) => {
    if (r.status() >= 400 && watch(r.url())) problems.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`);
  });
  page.on("requestfailed", (r) => {
    const err = r.failure()?.errorText ?? "failed";
    if (watch(r.url()) && !/ERR_ABORTED/.test(err)) problems.push(`${err} ${r.url().replace(BASE, "")}`);
  });
  // alert()/confirm() would block the crawl; print() would open a dialog.
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.evaluateOnNewDocument(() => {
    window.print = () => {};
  });
  page.on("pageerror", (e) => {
    const m = String(e?.message ?? e);
    if (!BENIGN_ERROR.test(m)) problems.push(`script error: ${m.slice(0, 200)}`);
  });
  let title = "";
  let links = [];
  let routerLinks = [];
  // A page the template links to but never shipped (dead in the original too).
  let dead = false;
  try {
    await page.setViewport({ width: 1440, height: 900 });
    const res = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    if (!res) problems.push("page didn't respond");
    else if (res.status() === 404) dead = true;
    else if (res.status() >= 400) problems.push(`page HTTP ${res.status()}`);
    await new Promise((r) => setTimeout(r, ctx.spa ? 2500 : 1200));
    // Open collapsed menus (sidebar groups, dropdowns) so the links inside
    // them exist in the DOM; many kits unmount closed sections.
    await page.evaluate(async () => {
      // Only real toggles: an aria-expanded link with a destination would navigate away.
      const toggles = Array.from(document.querySelectorAll('[aria-expanded="false"]'))
        .filter((el) => {
          if (el.tagName !== "A") return true;
          const href = el.getAttribute("href") || "";
          return href === "" || href.startsWith("#") || href.startsWith("javascript:");
        })
        .slice(0, 40);
      for (const el of toggles) {
        try {
          el.click();
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 400));
    });
    const info = await page.evaluate(() => ({
      title: document.title,
      text: (document.body?.innerText ?? "").trim().length,
      nodes: document.body ? document.body.querySelectorAll("*").length : 0,
      links: Array.from(document.querySelectorAll("a[href]"), (a) => a.href),
      // Menus that navigate in code (Element Plus, Naive, Arco…) render no
      // links; a Vue app's router knows every static route.
      routerLinks: (() => {
          try {
            const host = Array.from(document.querySelectorAll("body, body *")).find((el) => el.__vue_app__);
            const router = host?.__vue_app__?.config?.globalProperties?.$router;
            if (!router) return [];
            return router
              .getRoutes()
              .map((r) => r.path)
              .filter((p) => p && !/[:*]/.test(p))
              .slice(0, 200)
              .map((p) => new URL(router.resolve(p).href, location.href).href);
          } catch {
            return [];
          }
        })(),
      notFound: (() => {
        // Title and headings only: a sidebar link labelled "404 Not Found"
        // isn't a missing page.
        const heads = Array.from(document.querySelectorAll("h1,h2,h3"), (h) => h.textContent ?? "").slice(0, 6).join(" ");
        const t = (document.title + " " + heads).toLowerCase();
        return /\b404\b/.test(t) && /not found|doesn.t exist|does not exist|page you.re looking|lost/.test(t);
      })(),
    }));
    title = info.title;
    links = info.links;
    routerLinks = info.routerLinks;
    if (info.text < 20 && info.nodes < 15) problems.push("page is empty");
    if (info.notFound && !ctx.allow404.has(url)) dead = true;
  } catch (e) {
    problems.push(`load failed: ${String(e.message).slice(0, 160)}`);
  } finally {
    await Promise.race([page.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
  }
  return { title, links, routerLinks, dead, problems: dead ? [] : [...new Set(problems)] };
}

export function routeTitle(p) {
  const clean = p.replace(/[?#].*$/, "").replace(/\/index\.html?$|\.html?$/i, "").replace(/\/$/, "");
  if (!clean) return "Home";
  return clean
    .split("/")
    .map((seg) => seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" / ");
}

function normalizeLink(href, ctx) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const prefix = ctx.demoUrl.slice(BASE.length);
  // Next drops the trailing slash: /demos/x#/route is still inside the demo.
  if (u.pathname + "/" === prefix) u.pathname = prefix;
  if (u.origin !== BASE || !u.pathname.startsWith(prefix)) return null;
  // Hash-routed apps (#/settings) keep their route; plain anchors don't count.
  if (!u.hash.startsWith("#/")) u.hash = "";
  const last = u.pathname.slice(u.pathname.lastIndexOf("/") + 1);
  const ext = last.includes(".") ? last.slice(last.lastIndexOf(".") + 1).toLowerCase() : "";
  if (ext && ext !== "html" && ext !== "htm") return null;
  return u.toString();
}

async function checkDemo(browser, slug, info, record) {
  const demoUrl = `${BASE}/demos/${slug}/`;
  const ctx = {
    slug,
    demoUrl,
    spa: info.spa,
    cdnPrefix: info.cdnBase ?? "\u0000",
    // Templates ship their own 404 pages; those are meant to say 404.
    allow404: new Set((record.pages ?? []).filter((p) => /(^|\/)(404|error-?404|page-?404|not-?found)[^/]*$/i.test(p.path)).map((p) => demoUrl + p.path)),
  };
  // Client-routed apps start at the demo root; "/index.html" isn't a route.
  const entryUrl = demoUrl + (info.spa ? "" : info.entry);
  const queue = [entryUrl];
  const seen = new Set([entryUrl]);
  // Pages the importer found are crawled even when nothing links to them.
  for (const p of record.pages ?? []) {
    const u = demoUrl + p.path;
    if (!seen.has(u)) {
      seen.add(u);
      queue.push(u);
    }
  }
  // Routes found only in the router (no menu links to them): listed when they
  // work, not held against the dashboard when they don't (param pages etc.).
  const viaRouter = new Set();
  const results = [];
  while (queue.length && results.length < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY);
    const out = await Promise.all(
      batch.map((u) => checkPage(browser, u, ctx)),
    );
    batch.forEach((u, i) => {
      results.push({ url: u, ...out[i] });
      for (const l of out[i].links) {
        const n = normalizeLink(l, ctx);
        if (n && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
        if (n) viaRouter.delete(n);
      }
      for (const l of out[i].routerLinks ?? []) {
        const n = normalizeLink(l, ctx);
        if (n && !seen.has(n)) {
          seen.add(n);
          viaRouter.add(n);
          queue.push(n);
        }
      }
    });
  }
  const failures = [];
  const pages = [];
  const deadLinks = [];
  const entryTitle = results.find((r) => r.url === entryUrl)?.title ?? "";
  for (const r of results) {
    const p = pagePathOf(r.url, `/demos/${slug}/`);
    if (r.dead) {
      if (r.url === entryUrl) failures.push({ path: "(entry)", problem: "entry page not found" });
      else deadLinks.push(p);
    } else if (r.problems.length && viaRouter.has(r.url)) {
      deadLinks.push(p);
    } else if (r.problems.length) {
      failures.push({ path: r.url === entryUrl ? "(entry)" : p, problem: r.problems.slice(0, 3).join(" · ") });
    } else {
      // Client-routed apps keep one document title; name pages by route.
      const title = info.spa && (r.title === entryTitle || !r.title) && r.url !== entryUrl ? routeTitle(p) : r.title || routeTitle(p);
      pages.push({ path: p, title });
    }
  }
  const checked = results.length - deadLinks.length;
  const check = {
    checkedAt: new Date().toISOString(),
    pagesChecked: checked,
    pagesOk: checked - failures.length,
    failures,
    deadLinks,
    pages,
  };
  mkdirSync(path.join(DATA_DIR, "check"), { recursive: true });
  writeFileSync(path.join(DATA_DIR, "check", `${slug}.json`), JSON.stringify(check, null, 2));
  if (THUMBS_ON && !failures.some((f) => f.path === "(entry)")) await thumbnail(browser, entryUrl, slug, info.spa);
  return check;
}

// Alone and in front: headless Chrome doesn't paint background tabs.
export async function thumbnail(browser, url, slug, spa) {
  const page = await browser.newPage();
  try {
    await page.bringToFront();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await new Promise((r) => setTimeout(r, spa ? 3000 : 1800));
    const png = await page.screenshot({ type: "png" });
    mkdirSync(THUMBS, { recursive: true });
    await sharp(png).resize(960, 600, { fit: "cover", position: "top" }).webp({ quality: 78 }).toFile(path.join(THUMBS, `${slug}.webp`));
  } catch (e) {
    console.warn(`${slug}: thumbnail failed: ${e.message}`);
  } finally {
    await Promise.race([page.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
  }
}

async function main() {
  const serve = JSON.parse(readFileSync(path.join(DATA_DIR, "serve.json"), "utf8"));
  const slugs = Object.keys(serve).filter((s) => !ONLY || ONLY.has(s));
  // "shell" (chrome-headless-shell): the new headless mode hangs on
  // screenshots on macOS and is several times slower here.
  const browser = await puppeteer.launch({
    headless: "shell",
    protocolTimeout: 60_000,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
  });
  try {
    for (const slug of slugs) {
      const { record } = JSON.parse(readFileSync(path.join(DATA_DIR, "records", `${slug}.json`), "utf8"));
      const t0 = Date.now();
      // One stuck page must not hang the whole run.
      const c = await Promise.race([
        checkDemo(browser, slug, serve[slug], record),
        new Promise((_, rej) => setTimeout(() => rej(new Error("crawl timed out after 15 min")), 15 * 60_000)),
      ]).catch((e) => {
        console.log(`${slug}: ${e.message}`);
        return null;
      });
      if (!c) continue;
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`${slug}: ${c.pagesOk}/${c.pagesChecked} ok in ${secs}s${c.failures.length ? ` - e.g. ${c.failures[0].path}: ${c.failures[0].problem}` : ""}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
