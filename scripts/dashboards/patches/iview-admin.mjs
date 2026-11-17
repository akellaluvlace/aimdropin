// iView Admin: base path and history routing at the demo base. The MockJS
// mocks are only loaded outside production upstream; keep them in the demo,
// and start signed in as the mock super_admin user.
import { replaceOnce, BASE } from "./_lib.mjs";
replaceOnce("vue.config.js", "const BASE_URL = process.env.NODE_ENV === 'production'\n  ? '/'", `const BASE_URL = process.env.NODE_ENV === 'production'\n  ? ${JSON.stringify(BASE)}`);
replaceOnce("vue.config.js", "lintOnSave: true,", "lintOnSave: false,");
replaceOnce("src/router/index.js", "  mode: 'history'\n})", "  mode: 'history',\n  base: process.env.BASE_URL\n})");
replaceOnce("src/main.js", "if (process.env.NODE_ENV !== 'production') require('@/mock')", "require('@/mock')");
replaceOnce("src/libs/util.js", "  if (token) return token\n  else return false", "  if (token) return token\n  else return 'super_admin'");
// No lockfile upstream: simplemde's "marked: *" now resolves to a modern
// build webpack 4 can't parse. Pin the 2019-era release.
import { editJson } from "./_lib.mjs";
editJson("package.json", (j) => {
  j.overrides = { ...(j.overrides ?? {}), marked: "0.8.2" };
});
