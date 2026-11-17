// Check which registry items render in the live preview, so the library can
// hide the preview pane (and show code + install only) for the ones that
// don't. Drives a running dev server's /dev/registry-preview page with
// puppeteer and records the status each item's iframe reports.
//
//   npm run dev                   (in another terminal)
//   node scripts/catalog/check-previews.mjs [--base http://localhost:3000]
//     [--source @magicui] [--kind page|section|component] [--limit 200]
//     [--concurrency 4] [--retry-failed] [--thumbs]
//
// --thumbs also saves a card thumbnail for every item that renders, to
// public/catalog-thumbs/r/<hash>.webp (recorded as "thumb" in the status
// file; publish-catalog attaches it). Items already checked but without a
// thumbnail are revisited.
//
// Results go to .cache/catalog/preview-status.json ({ [id]: { status,
// message, checkedAt } }) and are written as they arrive, so an interrupted
// run resumes where it stopped.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer";
import { frameThumb } from "./thumb-frame.mjs";

const args = parseArgs(process.argv.slice(2));
const base = (args.base ?? "http://localhost:3000").replace(/\/$/, "");
const concurrency = Number(args.concurrency ?? 4);
const outPath = resolve(args.out ?? ".cache/catalog/preview-status.json");
const itemsPath = resolve(args.items ?? ".cache/catalog/items.json");

const status = existsSync(outPath)
  ? JSON.parse(readFileSync(outPath, "utf8"))
  : {};
let items = JSON.parse(readFileSync(itemsPath, "utf8")).filter(
  (i) => i.sourceKind === "shadcn-registry" && i.install?.url,
);
// Items curation hides anyway aren't worth a browser visit.
const curation = JSON.parse(
  readFileSync(resolve("scripts/catalog/curation.json"), "utf8"),
);
const curatedOut = new Set(curation.hide ?? []);
const curatedPatterns = Object.entries(curation.hidePatterns ?? {}).map(
  ([src, re]) => [src, new RegExp(re)],
);
items = items.filter(
  (i) =>
    !curatedOut.has(i.id) &&
    !curatedPatterns.some(([src, re]) => i.sourceId === src && re.test(i.name)),
);
if (args.source) items = items.filter((i) => i.sourceId === args.source);
if (args.kind) items = items.filter((i) => i.kind === args.kind);
const thumbs = Boolean(args.thumbs);
const thumbDir = resolve("public/catalog-thumbs/r");
if (thumbs) mkdirSync(thumbDir, { recursive: true });
items = items.filter(
  (i) =>
    !status[i.id] ||
    (args["retry-failed"] && status[i.id].status !== "ok") ||
    (thumbs && status[i.id].status === "ok" && !status[i.id].thumb),
);
if (args.limit) items = items.slice(0, Number(args.limit));

console.log(
  `checking ${items.length} items against ${base} (${concurrency} at a time)`,
);

// "shell" (chrome-headless-shell): the new headless mode hangs on screenshots
// on macOS and is several times slower.
const browser = await puppeteer.launch({ headless: "shell", protocolTimeout: 60_000 });
let next = 0;
let done = 0;
let saveTimer = null;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => writeFileSync(outPath, JSON.stringify(status, null, 1)),
    500,
  );
};

async function worker() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  while (next < items.length) {
    const item = items[next++];
    let result;
    try {
      await page.goto(
        `${base}/dev/registry-preview?url=${encodeURIComponent(item.install.url)}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        },
      );
      await page.waitForFunction(
        () => {
          const s = document.getElementById("rp-status")?.dataset.status;
          return s && s !== "pending";
        },
        { timeout: 75_000, polling: 500 },
      );
      const s = await page.$eval("#rp-status", (e) => e.dataset.status);
      const [st, ...msg] = s.split(": ");
      result = {
        status: st === "ok" ? "ok" : "error",
        message: msg.join(": ") || null,
      };
      if (thumbs && result.status === "ok") {
        // Let entrance animations settle before the picture.
        await new Promise((r) => setTimeout(r, 1800));
        const frame = await page.$("iframe");
        const png = frame ? await frame.screenshot({ type: "png" }) : null;
        const webp = png ? await frameThumb(png) : null;
        if (!webp) {
          result = { status: "error", message: "rendered a blank frame" };
        } else {
          const name = createHash("sha1")
            .update(item.id)
            .digest("hex")
            .slice(0, 16);
          writeFileSync(resolve(thumbDir, `${name}.webp`), webp);
          result.thumb = `/catalog-thumbs/r/${name}.webp`;
        }
      }
    } catch (e) {
      result = {
        status: "error",
        message: `checker: ${String(e.message).split("\n")[0]}`,
      };
    }
    status[item.id] = { ...result, checkedAt: new Date().toISOString() };
    done++;
    console.log(
      `${result.status === "ok" ? "ok  " : "FAIL"} ${done}/${items.length} ${item.id}${result.message ? ` - ${result.message.slice(0, 160)}` : ""}`,
    );
    save();
  }
  await page.close();
}

await Promise.all(Array.from({ length: concurrency }, worker));
await browser.close();
clearTimeout(saveTimer);
writeFileSync(outPath, JSON.stringify(status, null, 1));
const all = Object.values(status);
console.log(
  `\n${all.filter((s) => s.status === "ok").length}/${all.length} ok overall → ${outPath}`,
);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    out[key] = val;
  }
  return out;
}
