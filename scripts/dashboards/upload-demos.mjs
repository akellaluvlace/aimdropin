// Upload the live demos' files to the storage bucket the production site
// serves them from, and write the per-demo file lists the site reads.
//
//   node --env-file=.env.local scripts/dashboards/upload-demos.mjs [options]
//
//   --target prod     (default) PROD_SUPABASE_URL (or supabase_project_url) +
//                     PROD_SUPABASE_SERVICE_ROLE_KEY (or supabase_secret_key)
//   --target local    the local Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//   --only a,b        just these demos
//   --manifest-only   write data/dashboards/demo-files/<slug>.json, upload nothing
//   --concurrency 12
//
// Files come from demos/<slug>/ (HTML) and public/demos/<slug>/ (everything
// else), and go to the public bucket "demos" under <slug>/<encoded path> (see
// storage-key.mjs). A state file in .cache/ remembers what's uploaded, so a
// re-run only sends new or changed files and an interrupted run resumes.
// Then set DEMO_STORAGE_URL=<url>/storage/v1/object/public/demos on the host.

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { storageKey } from "./storage-key.mjs";

const ROOT = process.cwd();
const BUCKET = "demos";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const target = opt("target", "prod");
const only = opt("only", "") ? new Set(opt("only", "").split(",").map((s) => s.trim()).filter(Boolean)) : null;
const manifestOnly = flag("manifest-only");
const concurrency = Number(opt("concurrency", "12"));

const TYPES = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", cjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8",
  xml: "application/xml; charset=utf-8", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg",
  jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon",
  bmp: "image/bmp", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  eot: "application/vnd.ms-fontobject", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg",
  wav: "audio/wav", ogg: "audio/ogg", pdf: "application/pdf", wasm: "application/wasm",
};
const typeOf = (rel) => TYPES[rel.slice(rel.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, base, out);
    else if (e.isFile()) out.push(path.relative(base, abs).split(path.sep).join("/"));
  }
  return out;
}

// Every file of one demo: rel path → absolute path.
function demoFiles(slug) {
  const files = new Map();
  for (const root of [path.join(ROOT, "public", "demos", slug), path.join(ROOT, "demos", slug)]) {
    for (const rel of walk(root)) files.set(rel, path.join(root, rel));
  }
  return files;
}

// Only demos the gallery lists (index.json); unlisted imports stay local.
const listed = JSON.parse(readFileSync(path.join(ROOT, "data", "dashboards", "index.json"), "utf8"));
const slugs = listed.map((d) => d.slug).filter((s) => !only || only.has(s)).sort();

// 1. File lists for the site.
const manifestDir = path.join(ROOT, "data", "dashboards", "demo-files");
mkdirSync(manifestDir, { recursive: true });
const plan = [];
for (const slug of slugs) {
  const files = demoFiles(slug);
  if (!files.size) {
    console.warn(`! ${slug}: no files on disk - skipped`);
    continue;
  }
  writeFileSync(path.join(manifestDir, `${slug}.json`), JSON.stringify([...files.keys()].sort()));
  for (const [rel, abs] of files) plan.push({ slug, rel, abs });
}
console.log(`${slugs.length} demos, ${plan.length.toLocaleString("en-US")} files listed in data/dashboards/demo-files/`);
if (manifestOnly) process.exit(0);

// 2. Upload.
const env = process.env;
const url =
  target === "local" ? env.NEXT_PUBLIC_SUPABASE_URL : env.PROD_SUPABASE_URL || env.supabase_project_url;
// The secret (service-role) key: creating the bucket and uploading need it;
// the publishable key is read-only.
const key =
  target === "local"
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : env.PROD_SUPABASE_SERVICE_ROLE_KEY || env.supabase_secret_key || env.supabase_service_role_key;
if (!url || !key) {
  console.error(
    target === "local"
      ? "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)."
      : "Missing the project URL or secret key in .env.local (PROD_SUPABASE_URL or supabase_project_url, and PROD_SUPABASE_SERVICE_ROLE_KEY or supabase_secret_key). Run with --env-file=.env.local.",
  );
  process.exit(1);
}
// Talk to the project's direct storage host (<ref>.storage.supabase.co), which
// Supabase recommends for uploads. The main API host sits behind a firewall
// rule that refuses some minified JavaScript (`${JSON…tableDataEdit:` reads
// like a Log4Shell attack to it), so a few demo files can't go through there.
const storageUrl = url.replace(/^(https:\/\/[a-z0-9]+)\.supabase\.co\/?$/, "$1.storage.supabase.co");
const supabase = createClient(storageUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("Can't list buckets:", listErr.message);
  process.exit(1);
}
if (!buckets.some((b) => b.name === BUCKET)) {
  // No per-bucket size cap: Storage refuses one above the project-wide upload
  // limit (50 MB by default), and the largest demo file is under 20 MB.
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) {
    console.error("Can't create bucket:", error.message);
    process.exit(1);
  }
  console.log(`Created public bucket "${BUCKET}"`);
}

const stateDir = path.join(ROOT, ".cache", "demo-upload");
mkdirSync(stateDir, { recursive: true });
const statePath = path.join(stateDir, `${new URL(url).host}.json`);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
let dirty = 0;
const saveState = () => {
  writeFileSync(statePath, JSON.stringify(state));
  dirty = 0;
};

const todo = plan.filter((f) => {
  const st = statSync(f.abs);
  f.sig = `${st.size}:${Math.round(st.mtimeMs)}`;
  return state[storageKey(f.slug, f.rel)] !== f.sig;
});
console.log(`${todo.length.toLocaleString("en-US")} files to upload (${(plan.length - todo.length).toLocaleString("en-US")} already there)`);

let done = 0;
let failed = 0;
let bytes = 0;
const started = Date.now();
const failures = [];

async function uploadOne(f) {
  const objectKey = storageKey(f.slug, f.rel);
  const body = readFileSync(f.abs);
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectKey, body, { contentType: typeOf(f.rel), cacheControl: "31536000", upsert: true });
    if (!error) break;
    if (attempt >= 5) {
      failed++;
      failures.push(`${f.slug}/${f.rel}: ${error.message}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  state[objectKey] = f.sig;
  bytes += body.length;
  done++;
  if (++dirty >= 200) saveState();
  if (done % 500 === 0) {
    const mb = bytes / 1048576;
    const secs = (Date.now() - started) / 1000;
    console.log(`  ${done.toLocaleString("en-US")}/${todo.length.toLocaleString("en-US")} · ${mb.toFixed(0)} MB · ${(mb / secs).toFixed(1)} MB/s`);
  }
}

let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < todo.length) await uploadOne(todo[next++]);
  }),
);
saveState();
console.log(`Uploaded ${done.toLocaleString("en-US")} files (${(bytes / 1048576).toFixed(0)} MB), ${failed} failed.`);
if (failures.length) {
  writeFileSync(path.join(stateDir, "failures.txt"), failures.join("\n"));
  console.log(`Failures listed in .cache/demo-upload/failures.txt`);
  process.exit(1);
}
console.log(`\nSet on the host: DEMO_STORAGE_URL=${url.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}`);
