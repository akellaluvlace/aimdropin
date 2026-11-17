import { demoLogin } from "./_pure-admin.mjs";
demoLogin("router.beforeEach((to: ToRouteType, _from, next) => {");
// The CDN plugin (off in this build) still looks up every module's
// package.json when the config loads; vue-demi isn't a direct dependency, so
// pnpm doesn't link it at the top level. Drop it from the (unused) CDN list.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("build/cdn.ts", '    {\n      name: "vue-demi",\n      var: "VueDemi",\n      path: "index.iife.min.js"\n    },\n', "");
// main.ts imports tippy.js's CSS, but tippy.js is only a dependency of
// vue-tippy and the install isn't hoisted: alias it to vue-tippy's copy.
replaceOnce(
  "build/utils.ts",
  'const alias: Record<string, string> = {\n  "@": pathResolve("../src"),',
  'const alias: Record<string, string> = {\n  "tippy.js": resolve(realpathSync("node_modules/vue-tippy"), "..", "tippy.js"),\n  "@": pathResolve("../src"),',
);
replaceOnce("build/utils.ts", 'import { readdir, stat } from "node:fs";', 'import { readdir, stat, realpathSync } from "node:fs";');
