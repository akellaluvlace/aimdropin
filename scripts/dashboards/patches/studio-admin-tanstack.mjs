// Studio Admin (TanStack Start): build as a client-only SPA. The only server
// functions read/write preference cookies, so they become plain
// document.cookie code; the Nitro server goes; the router gets the demo base.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";

const actions = "src/server/server-actions.ts";
const original = readFileSync(actions, "utf8");
for (const name of ["getValueFromCookie", "setValueToCookie", "getPreference", "getDashboardLayout"]) {
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

export async function getDashboardLayout() {
  return {
    defaultOpen: getCookie("sidebar_state") !== "false",
    variant: parsePreference("sidebar_variant", getCookie("sidebar_variant")?.trim()),
    collapsible: parsePreference("sidebar_collapsible", getCookie("sidebar_collapsible")?.trim()),
  };
}
`,
);

replaceOnce("vite.config.ts", "    tanstackStart(),", '    tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index.html" } } }),');
replaceOnce("vite.config.ts", "    nitro(),\n", "");
replaceOnce("vite.config.ts", 'import { nitro } from "nitro/vite";\n', "");
replaceOnce("src/router.tsx", "    routeTree,", `    routeTree,\n    basepath: ${JSON.stringify(BASE_NOSLASH)},`);
// The SPA-shell prerender fetches from the preview server on 127.0.0.1.
replaceOnce("vite.config.ts", "  resolve: { tsconfigPaths: true },", '  resolve: { tsconfigPaths: true },\n  preview: { host: "127.0.0.1" },');
