// Slash Admin: the demo runs in an opaque origin where service workers can't
// register, so the MSW handlers run in-page through msw/native (fetch/XHR
// interception, no worker). The demo user is signed in on first load so the
// dashboard opens instead of the login page. Base path comes from
// VITE_APP_PUBLIC_PATH (set in the build command).
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";
// msw/native's export map hides it from browser builds ("browser": null), so
// import its entry file by path.
replaceOnce("src/_mock/index.ts", 'import { setupWorker } from "msw/browser";', 'import { setupServer as setupWorker } from "../../node_modules/msw/lib/native/index.mjs";');
replaceOnce("src/main.tsx", "await worker.start({", "worker.listen({");
replaceOnce("src/main.tsx", '\tserviceWorker: { url: urlJoin(GLOBAL_CONFIG.publicPath, "mockServiceWorker.js") },\n', "");
replaceOnce(
  "src/main.tsx",
  'import { urlJoin } from "./utils";',
  `import { urlJoin } from "./utils";
import userService from "./api/services/userService";
import useUserStore from "./store/userStore";
import { DB_USER } from "./_mock/assets_backup";`,
);
replaceOnce(
  "src/main.tsx",
  'if (GLOBAL_CONFIG.routerMode === "backend") {',
  `if (!useUserStore.getState().userToken.accessToken) {
	const demo = DB_USER[0];
	const res = await userService.signin({ username: demo.username, password: demo.password });
	useUserStore.getState().actions.setUserToken({ accessToken: res.accessToken, refreshToken: res.refreshToken });
	useUserStore.getState().actions.setUserInfo(res.user);
}
void urlJoin;
if (GLOBAL_CONFIG.routerMode === "backend") {`,
);
// The bundle visualizer must not try to open a browser in the container.
replaceOnce("vite.config.ts", "open: true,\n\t\t\t\t\tgzipSize", "open: false,\n\t\t\t\t\tgzipSize");
// The demo root is served without its trailing slash; a basename ending in
// "/" wouldn't match it.
replaceOnce("src/main.tsx", "basename: GLOBAL_CONFIG.publicPath,", `basename: ${JSON.stringify(BASE_NOSLASH)},`);
