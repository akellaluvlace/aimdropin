#!/usr/bin/env node
// Moderate community pages (the database only lets the service role publish).
//
//   npm run review                     # list pages waiting for review + checks
//   npm run review -- show <id>        # write it to .cache/review/<id>.html|jsx
//   npm run review -- approve <id> [--feature]
//   npm run review -- reject <id>
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local). The service-role key bypasses row-level security: keep it on
// this machine / the server, never in the browser.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkPageSource } from "./page-checks.mjs";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env))
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.",
  );
  process.exit(1);
}

async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const [cmd = "list", id, ...flags] = process.argv.slice(2);

if (cmd === "list") {
  const rows = await rest(
    "pages?status=eq.pending_review&select=id,title,kind,purpose,stack,source,created_at,updated_at,owner_id&order=updated_at.asc",
  );
  if (!rows.length) console.log("Nothing waiting for review.");
  for (const r of rows) {
    const c = checkPageSource(r.source, r.stack);
    console.log(`\n${r.id}  [${c.verdict.toUpperCase()}]  ${r.title}`);
    console.log(
      `  ${r.kind}/${r.purpose} · ${r.stack} · ${Math.round(c.bytes / 1024)} KB · updated ${r.updated_at}`,
    );
    for (const f of c.findings)
      console.log(
        `  ${f.level === "block" ? "✗" : "!"} ${f.rule}: ${f.detail}`,
      );
  }
} else if (cmd === "show" && id) {
  const [r] = await rest(`pages?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!r) throw new Error("No such page");
  const dir = path.join(process.cwd(), ".cache", "review");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.${r.stack === "html" ? "html" : "jsx"}`);
  writeFileSync(file, r.source);
  console.log(`Wrote ${file}`);
  console.log(JSON.stringify(checkPageSource(r.source, r.stack), null, 2));
} else if (cmd === "approve" && id) {
  const patch = { status: "published", published_at: new Date().toISOString() };
  if (flags.includes("--feature")) patch.tier = "featured";
  const rows = await rest(
    `pages?id=eq.${encodeURIComponent(id)}&status=eq.pending_review`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  console.log(
    rows.length
      ? `Published ${id}${patch.tier ? " (featured)" : ""}.`
      : "Not found or not pending.",
  );
} else if (cmd === "reject" && id) {
  const rows = await rest(
    `pages?id=eq.${encodeURIComponent(id)}&status=eq.pending_review`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected" }),
    },
  );
  console.log(rows.length ? `Rejected ${id}.` : "Not found or not pending.");
} else {
  console.log(
    "Usage: review [list | show <id> | approve <id> [--feature] | reject <id>]",
  );
  process.exit(1);
}
