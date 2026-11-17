// PanJiaChen Vue CLI admin: publicPath and history routing at the demo base;
// MockJS already fakes the API in production builds. The demo starts signed
// in as the mock "admin" user instead of on the login page.
import { replaceOnce, BASE } from "./_lib.mjs";
replaceOnce("vue.config.js", "publicPath: '/',", `publicPath: ${JSON.stringify(BASE)},`);
replaceOnce("src/router/index.js", "// mode: 'history', // require service support", "mode: 'history',\n  base: process.env.BASE_URL,");
replaceOnce("src/utils/auth.js", "return Cookies.get(TokenKey)", "return Cookies.get(TokenKey) || 'admin-token'");
