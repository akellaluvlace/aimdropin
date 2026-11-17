import { demoLogin } from "./_pure-admin.mjs";
demoLogin("router.beforeEach((to: ToRouteType, _from) => {");
// The "external page" menu only frames third-party doc sites (colorhunt,
// element-plus.org, vitejs.dev...), which break inside the demo sandbox.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("mock/asyncRoutes.ts", "          permissionRouter,\n          frameRouter,\n", "          permissionRouter,\n");
