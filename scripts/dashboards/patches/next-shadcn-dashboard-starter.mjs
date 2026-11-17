// Kiranism's Next Shadcn Dashboard Starter: static export. The repo's own
// cleanup script removes Clerk (auth, orgs, billing) and Sentry; then the
// mock /api route handlers go (the services call the in-memory fakes
// directly), server pages stop reading searchParams/cookies (nuqs and the
// client tables still filter in the browser), and product pages get params.
import { execFileSync } from "node:child_process";
import { replaceOnce, remove } from "./_lib.mjs";
import { staticNextConfig, removeMiddleware, fixRscFetchAll } from "./_next.mjs";

execFileSync("node", ["scripts/cleanup.js", "--force", "clerk", "sentry"], { stdio: "inherit" });

removeMiddleware();
remove("src/app/api");
staticNextConfig();

for (const page of ["src/app/dashboard/product/page.tsx", "src/app/dashboard/users/page.tsx"]) {
  replaceOnce(page, /const searchParams = await props\.searchParams;\s*searchParamsCache\.parse\(searchParams\);/, "searchParamsCache.parse({});");
}

const detail = "src/app/dashboard/product/[productId]/page.tsx";
replaceOnce(
  detail,
  "export default async function Page(",
  `export function generateStaticParams() {\n  return ["new", ...Array.from({ length: 20 }, (_, i) => String(i + 1))].map((productId) => ({ productId }));\n}\n\nexport default async function Page(`,
);

const root = "src/app/layout.tsx";
replaceOnce(root, "import { cookies } from 'next/headers';\n", "");
replaceOnce(root, /const cookieStore = await cookies\(\);\s*const activeThemeValue = cookieStore\.get\('active_theme'\)\?\.value;/, "const activeThemeValue: string | undefined = undefined;");

const dash = "src/app/dashboard/layout.tsx";
replaceOnce(dash, "import { cookies } from 'next/headers';\n", "");
replaceOnce(dash, /const cookieStore = await cookies\(\);\s*const defaultOpen = cookieStore\.get\('sidebar_state'\)\?\.value === 'true';/, "const defaultOpen = true;");

// Nothing may still import Clerk.
let left = "";
try {
  left = execFileSync("grep", ["-rl", "@clerk", "src"], { encoding: "utf8" }).trim();
} catch {
  // grep exits 1 when nothing matches
}
if (left) throw new Error(`patch: Clerk still imported in:\n${left}`);
fixRscFetchAll();
