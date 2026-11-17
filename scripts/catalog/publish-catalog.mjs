#!/usr/bin/env node
// Turn the indexer output (.cache/catalog/items.json, gitignored) into the
// compact catalog the site reads at runtime: data/catalog/catalog.json.
//
//   npm run catalog -- --tier all     # index sources (network)
//   npm run catalog:publish           # this script
//
// Only items that work here get listed: registry items need a passing
// preview (scripts/catalog/check-previews.mjs --thumbs) and a thumbnail with
// real content (thumb-quality.mjs); curation.json does the rest by hand.
// Our own templates are merged at runtime from web/ + templates/
// (lib/catalog/library.ts), not here.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IN = path.join(ROOT, ".cache/catalog/items.json");
const OUT_DIR = path.join(ROOT, "data/catalog");
const OUT = path.join(OUT_DIR, "catalog.json");
const COMPONENT_INDEX = path.join(ROOT, "public/data/components/index.json");
const SOURCES = path.join(ROOT, "scripts/catalog/sources.json");
const PREVIEW_STATUS = path.join(ROOT, ".cache/catalog/preview-status.json");
const CURATION = path.join(ROOT, "scripts/catalog/curation.json");
const THUMB_QUALITY = path.join(ROOT, ".cache/catalog/thumb-quality.json");
// Share of a thumbnail that must be actual content (thumb-quality.mjs).
const MIN_THUMB_CONTENT = 0.01;
const MIN_HTML_THUMB_CONTENT = 0.001;

const DESC_MAX = 220;

function trimTo(s, max) {
  if (!s) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

// Titles and descriptions are shown as the site's own copy, which uses no em
// dashes (U+2014): spaced or not, each becomes " - ".
function plain(s) {
  return typeof s === "string" ? s.replace(/\s*\u2014\s*/g, " - ") : s;
}

// Friendly names for the source filter. Registry namespaces fall back to the
// namespace without "@", title-cased.
const SOURCE_LABELS = {
  "@shadcn": "shadcn/ui",
  "@magicui": "Magic UI",
  "@kokonutui": "Kokonut UI",
  "@cult-ui": "Cult UI",
  "@motion-primitives": "Motion Primitives",
  "@eldoraui": "Eldora UI",
  "@hextaui": "HextaUI",
  "@intentui": "Intent UI",
  "@shadcnui-blocks": "shadcn/ui blocks",
  "@shadcn-space": "Shadcn Space",
  "@shadcnstore": "ShadcnStore",
  "@uitripled": "UI Tripled",
  "@uiable": "Uiable",
  "@astryx": "Astryx",
  "@saastro": "Saastro",
  "@soldevelo": "SolDevelo",
  uiverse: "Uiverse",
  hyperui: "HyperUI",
};

function sourceLabel(id, cfg) {
  if (SOURCE_LABELS[id]) return SOURCE_LABELS[id];
  if (cfg?.title) return cfg.title;
  return id
    .replace(/^@/, "")
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  if (!existsSync(IN)) {
    console.error(`Missing ${IN}. Run "npm run catalog -- --tier all" first.`);
    process.exit(1);
  }
  const items = JSON.parse(readFileSync(IN, "utf8"));
  const sourcesCfg = JSON.parse(readFileSync(SOURCES, "utf8")).sources;
  const cfgById = new Map(sourcesCfg.map((s) => [s.name, s]));

  const thumbs = new Map();
  if (existsSync(COMPONENT_INDEX)) {
    for (const c of JSON.parse(readFileSync(COMPONENT_INDEX, "utf8"))
      .components ?? []) {
      if (c.thumbUrl) thumbs.set(c.slug, c.thumbUrl);
    }
  }
  const previewStatus = existsSync(PREVIEW_STATUS)
    ? JSON.parse(readFileSync(PREVIEW_STATUS, "utf8"))
    : {};
  // Thumbnails saved by check-previews --thumbs (only for items that render).
  const previewThumb = (id) => {
    const s = previewStatus[id];
    return s && typeof s === "object" && s.status === "ok" && s.thumb
      ? s.thumb
      : null;
  };
  const statusOf = (id) => {
    const s = previewStatus[id] ?? previewStatus.items?.[id];
    return typeof s === "string" ? s : (s?.status ?? null);
  };

  const curation = JSON.parse(readFileSync(CURATION, "utf8"));
  const dashboards = new Set(curation.dashboards);
  const toSection = new Set(curation.toSection);
  // Hidden by hand, plus items the vendor has since locked (401/403).
  const hidden = new Set([...(curation.hide ?? []), ...(curation.locked ?? [])]);
  const hidePatterns = Object.entries(curation.hidePatterns ?? {}).map(
    ([src, re]) => [src, new RegExp(re)],
  );
  const quality = existsSync(THUMB_QUALITY)
    ? JSON.parse(readFileSync(THUMB_QUALITY, "utf8"))
    : {};

  // Only list what works here and now: it renders in our previewer, has a
  // picture with real content in it, and passed curation. Whole-app GitHub
  // projects can't run in the browser, so they're not listed at all.
  const dropped = { app: 0, noPreview: 0, blank: 0, curated: 0 };
  const out = [];
  for (const i of items) {
    // The indexer already enforces the license allowlist; refuse to publish
    // anything that slipped through without one.
    if (!i.license?.spdx || !i.license?.url) {
      console.warn(`  skipping ${i.id}: no license`);
      continue;
    }
    if (i.install?.method === "clone") {
      dropped.app++;
      continue;
    }
    if (
      hidden.has(i.id) ||
      hidePatterns.some(([src, re]) => i.sourceId === src && re.test(i.name))
    ) {
      dropped.curated++;
      continue;
    }
    const isRegistry = i.sourceKind === "shadcn-registry";
    const thumb = thumbs.get(i.name) ?? previewThumb(i.id);
    // HTML collection pictures come from the editor's component panel and
    // aren't cropped; only drop the ones that are effectively empty.
    if (
      !isRegistry &&
      thumb &&
      (quality[thumb] ?? 1) < MIN_HTML_THUMB_CONTENT
    ) {
      dropped.blank++;
      continue;
    }
    if (isRegistry) {
      if (statusOf(i.id) !== "ok" || !thumb) {
        dropped.noPreview++;
        continue;
      }
      if ((quality[thumb] ?? 1) < MIN_THUMB_CONTENT) {
        dropped.blank++;
        continue;
      }
    }
    const kind = toSection.has(i.id) ? "section" : i.kind;
    const tab =
      kind === "page" ? (dashboards.has(i.id) ? "dashboard" : "screen") : kind;
    out.push({
      id: i.id,
      src: i.sourceId,
      name: i.name,
      title: plain(i.title),
      desc: trimTo(plain(i.description), DESC_MAX),
      kind,
      tab,
      purpose: i.purpose,
      stack: i.stack,
      fw: i.framework ?? null,
      type: i.registryType ?? null,
      cats: i.categories ?? [],
      deps: i.dependencies ?? [],
      regDeps: i.registryDependencies ?? [],
      heavy: i.heavyDeps ?? [],
      lic: i.license.spdx,
      licUrl: i.license.url,
      freeOnly: i.license.freeOnly === true,
      author: i.author ?? null,
      home: i.homepage ?? null,
      srcUrl: i.sourceUrl ?? null,
      install: i.install,
      thumb,
      demo: null,
      ghStars: null,
      preview: "ok",
    });
  }
  console.log(
    `  not listed: ${dropped.app} whole apps, ${dropped.noPreview} without a working preview, ${dropped.blank} near-blank renders, ${dropped.curated} by curation`,
  );

  const counts = new Map();
  for (const i of out) counts.set(i.src, (counts.get(i.src) ?? 0) + 1);
  const sources = [...counts.entries()]
    .map(([id, count]) => {
      const cfg = cfgById.get(id);
      return {
        id,
        label: sourceLabel(id, cfg),
        kind: cfg?.kind ?? null,
        homepage: cfg?.homepage ?? null,
        license: cfg?.license?.spdx ?? null,
        licenseUrl: cfg?.license?.url ?? null,
        freeOnly: cfg?.license?.freeOnly === true,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sources,
      items: out,
    }),
  );
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `Wrote ${out.length} items from ${sources.length} sources to ${path.relative(ROOT, OUT)} (${kb} KB)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
