// Arco Design Pro Vue: router at the bundler base; MockJS already runs in
// production. The image optimiser needs native binaries from install scripts
// (blocked here) and the bundle visualiser opens a browser: both are dropped.
// Starts signed in, in English.
import { replaceOnce } from "./_lib.mjs";
import { historyAtBase } from "./_vue.mjs";
const dir = "arco-design-pro-vite/";
historyAtBase(dir + "src/router/index.ts", "createWebHistory()");
replaceOnce(dir + "config/vite.config.prod.ts", "      configImageminPlugin(),\n", "");
replaceOnce(dir + "config/plugin/visualizer.ts", "open: true,", "open: false,");
replaceOnce(dir + "src/utils/auth.ts", "  return !!localStorage.getItem(TOKEN_KEY);", "  return true;");
replaceOnce(dir + "src/utils/auth.ts", "  return localStorage.getItem(TOKEN_KEY);", "  return localStorage.getItem(TOKEN_KEY) || 'demo-token';");
replaceOnce(dir + "src/locale/index.ts", "localStorage.getItem('arco-locale') || 'zh-CN'", "localStorage.getItem('arco-locale') || 'en-US'");
// The MockJS handlers only register outside production mode: keep them on.
replaceOnce(dir + "src/utils/setup-mock.ts", "if (mock !== false && debug) setup();", "if (mock !== false) setup();\n  void debug;");
// The root redirects to the login page; open the workplace dashboard instead.
replaceOnce(dir + "src/router/index.ts", "      path: '/',\n      redirect: 'login',", "      path: '/',\n      redirect: '/dashboard/workplace',");
