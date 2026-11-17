// MatDash (Next.js): static export from package/. The mock /api route
// handlers (blog, notes, tickets) run in the browser through a fetch shim;
// blog detail pages get static params from the mock posts' titles.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths, clientApi, fixRscFetchAll } from "./_next.mjs";

process.chdir("package");
staticNextConfig();

const blog = readFileSync("src/app/api/blog/route.ts", "utf8");
const slugs = [...blog.matchAll(/title:\s*"([^"]+)"/g)].map((m) =>
  m[1].toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, ""),
);
if (slugs.length < 5) throw new Error("patch: blog titles not found");

clientApi(
  { "/api/blog": "src/app/api/blog/route.ts", "/api/notes": "src/app/api/notes/route.ts", "/api/ticket": "src/app/api/ticket/route.ts" },
  { layout: "src/app/layout.tsx", apiDir: "src/app/api" },
);

const detail = "src/app/(DashboardLayout)/apps/blog/detail/[slug]/page.tsx";
replaceOnce(detail, "const BlogDetail = () => {", `export function generateStaticParams() {\n  return ${JSON.stringify(slugs.map((slug) => ({ slug })))};\n}\n\nconst BlogDetail = () => {`);

prefixPublicPaths(["src"]);
fixRscFetchAll();
