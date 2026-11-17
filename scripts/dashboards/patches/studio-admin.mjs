// Studio Admin (Next.js): static export. The server actions only read/write
// preference cookies, so they become plain document.cookie code (defaults at
// build time); the dashboard layout's cookies() read becomes a default; the
// catch-all not-found route (no static params possible) goes.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce, remove } from "./_lib.mjs";
import { staticNextConfig, forceStaticMetaRoutes, fixRscFetchAll } from "./_next.mjs";

staticNextConfig();
forceStaticMetaRoutes();

const actions = "src/server/server-actions.ts";
const original = readFileSync(actions, "utf8");
for (const name of ["getValueFromCookie", "setValueToCookie", "getPreference"]) {
  if (!original.includes(`export async function ${name}`)) throw new Error(`patch: ${actions} no longer exports ${name}`);
}
writeFileSync(
  actions,
  `import {
  getPreferencePersistence,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";

function getCookie(key: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === key) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export async function getValueFromCookie(key: string): Promise<string | undefined> {
  return getCookie(key);
}

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number } = {},
): Promise<void> {
  document.cookie = \`\${key}=\${encodeURIComponent(value)}; path=\${options.path ?? "/"}; max-age=\${options.maxAge ?? 60 * 60 * 24 * 7}; samesite=lax\`;
}

export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  const definition = PREFERENCE_REGISTRY[key];
  const persistence = getPreferencePersistence(key);
  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return definition.defaultValue as PreferenceValueMap[K];
  }
  return parsePreference(key, getCookie(key)?.trim()) as PreferenceValueMap[K];
}
`,
);

const layout = "src/app/(main)/dashboard/layout.tsx";
replaceOnce(layout, 'import { cookies } from "next/headers";\n', "");
replaceOnce(
  layout,
  '  const cookieStore = await cookies();\n  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";\n',
  "  const defaultOpen = true;\n",
);
remove("src/app/(main)/dashboard/[...not-found]");

// The file manager's grid/list switch reads searchParams on the server: the
// static page shows the grid view.
const fm = "src/app/(main)/dashboard/file-manager/page.tsx";
replaceOnce(fm, "export default async function Page({ searchParams }: PageProps) {\n  const { view } = await searchParams;", "export default async function Page(_props: PageProps) {\n  const view: string | undefined = undefined;");
// Client components reading useSearchParams (kanban) need a Suspense boundary.
replaceOnce(layout, 'import type { ReactNode } from "react";', 'import { Suspense, type ReactNode } from "react";');
replaceOnce(layout, "          {children}\n", "          <Suspense>{children}</Suspense>\n");
// Google tag goes: the demo route strips tracker scripts, and with the app
// router that also strips the RSC payload chunk quoting the snippet.
const root = "src/app/layout.tsx";
if (readFileSync(root, "utf8").includes("googletagmanager")) {
  replaceOnce(root, /\s*\{\/\* Google tag \(gtag\.js\) \*\/\}[\s\S]*?gtag\('config'[^\n]*\n\s*`,\n\s*\}\}\n\s*\/>/, "");
}
// Generated icons are linked without the base path: drop them.
for (const f of ["src/app/icon.tsx", "src/app/apple-icon.tsx"]) remove(f);
fixRscFetchAll();
