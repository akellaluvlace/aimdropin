// vue-element-plus-admin v2.10.0: history routing at the base (VITE_BASE_PATH
// in the entry's env; vite-plugin-mock serves the mocks in production). The
// demo starts signed in as the mock admin with the static route table, in English.
import { replaceOnce } from "./_lib.mjs";
import { hashToHistory } from "./_vue.mjs";
hashToHistory("src/router/index.ts");
replaceOnce("src/store/modules/user.ts", "      userInfo: undefined,\n", "      userInfo: { username: 'admin', password: 'admin', role: 'admin', roleId: '1' } as any,\n");
replaceOnce("src/store/modules/app.ts", "dynamicRouter: true, // 是否动态路由", "dynamicRouter: false, // 是否动态路由");
replaceOnce("src/store/modules/locale.ts", "lang: getStorage('lang') || 'zh-CN',", "lang: getStorage('lang') || 'en',");
