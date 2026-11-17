// Vben Admin (web-antd app): base path and history routing in its
// .env.production (vben's env loader reads only the files); data comes from
// the project's hosted mock API. The demo signs in as the mock user "vben"
// on first navigation instead of showing the login page.
import { replaceOnce, BASE } from "./_lib.mjs";
const app = "apps/web-antd/";
replaceOnce(app + ".env.production", "VITE_BASE=/\n", `VITE_BASE=${BASE}\n`);
replaceOnce(app + ".env.production", "VITE_ROUTER_HISTORY=hash", "VITE_ROUTER_HISTORY=history");
replaceOnce(app + ".env.production", "VITE_ARCHIVER=true", "VITE_ARCHIVER=false");
replaceOnce(
  app + "src/router/guard.ts",
  "    if (!accessStore.accessToken) {\n",
  `    if (!accessStore.accessToken) {
      try {
        const { loginApi } = await import('#/api');
        const { accessToken } = await loginApi({ password: '123456', username: 'vben' } as any);
        accessStore.setAccessToken(accessToken);
      } catch {}
    }
    if (!accessStore.accessToken) {
`,
);
// The lockfile resolves vue-router 5.2.0 twice (two rolldown peer variants),
// so the bundle carries two router instances and useRouter() comes back
// undefined in the layout. Dedupe it.
replaceOnce(app + "vite.config.ts", "    vite: {\n      server: {", "    vite: {\n      resolve: { dedupe: ['vue-router', 'vue', 'pinia'] },\n      server: {");
