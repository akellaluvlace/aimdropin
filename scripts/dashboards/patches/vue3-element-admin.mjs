// vue3-element-admin: its mocks only run in the Vite dev server. For the demo
// they run in the page through an axios adapter (same mock files, same
// responses). History routing at the bundler base; starts signed in with the
// mock admin token.
import { writeFileSync } from "node:fs";
import { replaceOnce } from "./_lib.mjs";
import { hashToHistory } from "./_vue.mjs";

replaceOnce("mock/base.ts", 'import { createDefineMock } from "vite-plugin-mock-dev-server";', "");
writeFileSync(
  "mock/base.ts",
  `// Demo build: plain mock list (vite-plugin-mock-dev-server only runs in dev).
export const defineMock = (mocks: any) =>
  (Array.isArray(mocks) ? mocks : [mocks]).map((m: any) => ({
    ...m,
    url: /^https?:/.test(m.url) ? m.url : (import.meta.env.VITE_API_BASE + "/api/v1/" + m.url).replace(/\\/+/g, "/"),
  }));
`,
);

writeFileSync(
  "src/demo-mock-adapter.ts",
  `// Demo build: answers API calls in the page from the repo's mock/*.mock.ts.
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

const modules = import.meta.glob("../mock/*.mock.ts", { eager: true }) as Record<string, { default: any[] }>;
const mocks: any[] = Object.values(modules).flatMap((m) => m.default ?? []);

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export const demoMockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const base = config.baseURL ?? "";
  const raw = /^https?:/.test(config.url ?? "") ? config.url! : base + (config.url ?? "");
  const u = new URL(raw, "http://demo.local");
  const method = (config.method ?? "get").toUpperCase();
  const query: Record<string, any> = Object.fromEntries(u.searchParams.entries());
  Object.assign(query, config.params ?? {});
  let body: any = config.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {}
  }
  for (const m of mocks) {
    const methods = m.method ? (Array.isArray(m.method) ? m.method : [m.method]).map((x: string) => x.toUpperCase()) : null;
    if (methods && !methods.includes(method)) continue;
    const params = match(new URL(m.url, "http://demo.local").pathname, u.pathname);
    if (!params) continue;
    const data = typeof m.body === "function" ? await m.body({ query, params, body: body ?? {}, headers: config.headers }) : m.body;
    await new Promise((r) => setTimeout(r, 120));
    return { data, status: 200, statusText: "OK", headers: {}, config, request: {} };
  }
  return Promise.reject(Object.assign(new Error("Request failed with status code 404"), { config, response: { status: 404, data: null, headers: {}, config } }));
};
`,
);

replaceOnce(
  "src/utils/request.ts",
  "// 先注册续期拦截器",
  "http.defaults.adapter = demoMockAdapter;\n\n// 先注册续期拦截器",
);
replaceOnce("src/utils/request.ts", 'import qs from "qs";', 'import qs from "qs";\nimport { demoMockAdapter } from "@/demo-mock-adapter";');

replaceOnce(
  "src/utils/auth.ts",
  "    return isRememberMe\n      ? Storage.get(STORAGE_KEYS.ACCESS_TOKEN, \"\", isString)\n      : Storage.sessionGet(STORAGE_KEYS.ACCESS_TOKEN, \"\", isString);",
  "    return (\n      (isRememberMe\n        ? Storage.get(STORAGE_KEYS.ACCESS_TOKEN, \"\", isString)\n        : Storage.sessionGet(STORAGE_KEYS.ACCESS_TOKEN, \"\", isString)) || \"demo-access-token\"\n    );",
);
hashToHistory("src/router/index.ts");
