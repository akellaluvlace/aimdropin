// Arco Design Pro (Next 12 pages router variant): built with `next export`
// under the demo base. The demo opens signed in (the mock login only sets
// localStorage) and full-page redirects keep the base.
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
import { staticNextConfig } from "./_next.mjs";
process.chdir("arco-design-pro-next");
staticNextConfig();
replaceOnce("src/pages/_app.tsx", "    if (checkLogin()) {", "    if (checkLogin() || true) {");
replaceOnce("src/pages/_app.tsx", "window.location.pathname = '/login';", `window.location.pathname = ${JSON.stringify(BASE_NOSLASH + "/login/")};`);
replaceOnce("src/components/NavBar/index.tsx", "window.location.href = '/login';", `window.location.href = ${JSON.stringify(BASE_NOSLASH + "/login/")};`);
replaceOnce("src/pages/login/form.tsx", "window.location.href = '/';", `window.location.href = ${JSON.stringify(BASE_NOSLASH + "/dashboard/workplace/")};`);
// The mockjs API mocks only run in development; the demo has no backend, so
// they run in the static build too.
replaceOnce("src/utils/setupMock.ts", "const { mock = process.env.NODE_ENV === 'development', setup } = config;", "const { mock = true, setup } = config;");
// Shorter mock latency, so the dashboard has data when the page settles.
replaceOnce("src/mock/index.ts", "timeout: '500-1500',", "timeout: '50-150',");
