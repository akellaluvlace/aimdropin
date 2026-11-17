// Vue Admin Better: publicPath and history routing at the demo base (MockJS is
// on in production upstream); starts signed in as the mock admin.
import { replaceOnce, BASE } from "./_lib.mjs";
replaceOnce("src/config/setting.config.js", "publicPath: '',", `publicPath: ${JSON.stringify(BASE)},`);
replaceOnce("src/config/setting.config.js", "routerMode: 'hash',", "routerMode: 'history',");
replaceOnce("src/utils/accessToken.js", "export function getAccessToken() {", "export function getAccessToken() {\n  return getStoredAccessToken() || 'admin-accessToken'\n}\n\nfunction getStoredAccessToken() {");
