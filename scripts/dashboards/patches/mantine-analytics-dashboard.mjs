// Mantine Analytics Dashboard: static export. Every /api route handler only
// serves (or pretends to write) a JSON fixture from public/mocks, so the
// handlers go and an in-browser fetch shim serves the same envelopes from the
// stored fixtures. Invoice detail pages get params from the fixture.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce, remove, BASE_NOSLASH } from "./_lib.mjs";
import { staticNextConfig, removeMiddleware, findFiles, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";

staticNextConfig();
removeMiddleware();
// The Clerk sign-in example pulls in Clerk server actions (and needs keys).
remove("src/app/auth/clerk");

const table = [];
for (const f of findFiles("src/app/api", /^route\.ts$/)) {
  const route = "/" + path.dirname(path.relative("src/app", f)).split(path.sep).join("/");
  const fixture = readFileSync(f, "utf8").match(/['"]([A-Za-z0-9_-]+\.json)['"]/)?.[1];
  if (!fixture) continue; // changelog: reads CHANGELOG.md on the server
  const re = "^" + route.replace(/\[[^\]]+\]/g, "([^/]+)") + "/?$";
  table.push({ re, fixture, id: route.includes("[") });
}
if (table.length < 40) throw new Error(`patch: only ${table.length} mock routes found`);
remove("src/app/api");

writeFileSync(
  "src/aim-mock-api.tsx",
  `"use client";
const BASE = ${JSON.stringify(BASE_NOSLASH)};
const TABLE: Array<{ re: string; fixture: string; id: boolean }> = ${JSON.stringify(table)};
const envelope = (data: unknown, ok = true, status = 200) =>
  new Response(JSON.stringify({ succeeded: ok, data, errors: ok ? [] : ["Not found"], message: ok ? "Retrieved successfully" : "Not found", timestamp: new Date().toISOString() }), { status, headers: { "content-type": "application/json" } });
if (typeof window !== "undefined" && !(window as any).__aimMock) {
  (window as any).__aimMock = true;
  const orig = window.fetch.bind(window);
  const cache: Record<string, Promise<any>> = {};
  const load = (f: string) => (cache[f] ??= orig(BASE + "/mocks/" + f).then((r) => r.json()));
  window.fetch = async (input: any, init?: any) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return orig(input, init);
    const method = String(init?.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    for (const r of TABLE) {
      const m = url.pathname.match(new RegExp(r.re));
      if (!m) continue;
      if (method !== "GET") {
        let body: unknown = null;
        try { body = init?.body ? JSON.parse(init.body) : null; } catch {}
        return envelope(body, true, method === "POST" ? 201 : 200);
      }
      const data = await load(r.fixture);
      if (!r.id) return envelope(data);
      const row = Array.isArray(data) ? data.find((x: any) => String(x?.id) === decodeURIComponent(m[1])) : undefined;
      return row ? envelope(row) : envelope(null, false, 404);
    }
    return envelope(null, false, 404);
  };
}
export default function AimMockApi() { return null; }
`,
);
replaceOnce("src/app/layout.tsx", "      <body>", "      <body>\n        <AimMockApi />");
replaceOnce("src/app/layout.tsx", /^/, 'import AimMockApi from "@/aim-mock-api";\n');

const invoices = JSON.parse(readFileSync("public/mocks/Invoices.json", "utf8")).map((x) => ({ id: String(x.id) }));
replaceOnce(
  "src/app/apps/invoices/details/[id]/page.tsx",
  "export async function generateMetadata(",
  `export function generateStaticParams() {\n  return ${JSON.stringify(invoices)};\n}\n\nexport async function generateMetadata(`,
);
prefixPublicPaths(["src"], { skip: ["mocks"] });
prefixPublicPaths(["public/mocks"], { skip: ["mocks"] }); // fixtures name avatars as "/assets/..."
// Three pages read their fixtures per request; at export they read them once.
for (const f of ["src/app/dashboard/default/page.tsx", "src/app/dashboard/analytics/page.tsx", "src/app/apps/profile/page.tsx"]) {
  replaceOnce(f, "export const dynamic = 'force-dynamic';", "export const dynamic = 'force-static';");
}
fixRscFetchAll();
// PATH_TASKS.root points at "/tasks", which doesn't exist (the board is /apps/tasks).
replaceOnce("src/routes/index.ts", "const ROOTS_TASKS = '/tasks';", "const ROOTS_TASKS = '/apps/tasks';");
